/**
 * Notifications.
 *
 * The dashboard has always been able to count documents past their review date.
 * Nobody was told. This turns those facts into something addressed to a named
 * person, and the My Work queue reads the same underlying state back so the
 * two cannot disagree.
 *
 * Delivery is in-app only. There is deliberately no mail transport: the
 * platform is installed locally, an SMTP configuration it cannot verify would
 * fail silently, and a notification nobody receives is worse than one they have
 * to come and look at.
 */

import { q, nowIso } from '../db/index.js';
import { id } from '../utils/ids.js';
import { PERMISSIONS } from '../middleware/auth.js';
import { getAutomation } from './risk-methodology.js';
import { cycleDays } from './cadence.js';

/** Raise one notification. A dedupeKey makes repeated raising idempotent. */
export function notify({
  userId, kind, title, body = null, entityType = null, entityId = null,
  url = null, severity = 'info', actor = null, dedupeKey = null
}) {
  if (!userId) return null;
  const notificationId = id('ntf');
  // A dedupe key collides with the row already raised for the same thing, so
  // the sweep can run as often as it likes.
  const result = q.run(
    `INSERT INTO notifications
       (id, user_id, kind, title, body, entity_type, entity_id, url, severity, actor_id, actor_name, dedupe_key, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     -- The unique index is partial, so the conflict target has to repeat its
     -- WHERE clause; without it SQLite refuses to prepare the statement.
     ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
    notificationId, userId, kind, title, body, entityType, entityId, url, severity,
    actor?.id || null, actor?.name || null, dedupeKey, nowIso()
  );
  return result.changes ? notificationId : null;
}

/** Everyone active who holds a permission — used when no individual is named. */
export function usersWithPermission(permission) {
  const roles = PERMISSIONS[permission] || [];
  if (!roles.length) return [];
  return q.all(
    `SELECT id, name, email, role FROM users
      WHERE status = 'active' AND role IN (${roles.map(() => '?').join(',')})`,
    ...roles
  );
}

/**
 * Notify whoever is named for the job, falling back to the permission holders.
 * `exclude` keeps an actor from being told about their own action.
 */
export function notifyResponsible({ namedUserId, permission, exclude = [], ...payload }) {
  const skip = new Set(exclude.filter(Boolean));
  const targets = namedUserId && !skip.has(namedUserId)
    ? [{ id: namedUserId }]
    : usersWithPermission(permission).filter((u) => !skip.has(u.id));
  const raised = [];
  for (const target of targets) {
    const notificationId = notify({ ...payload, userId: target.id });
    if (notificationId) raised.push(notificationId);
  }
  return raised;
}

// ------------------------------------------------------------- lifecycle ---

const DOC_URL = (docId) => `/documents/${docId}`;

/** Called on every document lifecycle transition. */
export function notifyTransition({ document, from, to, actor }) {
  const label = `${document.reference} — ${document.title}`;
  const common = { entityType: 'document', entityId: document.id, url: DOC_URL(document.id), actor };

  if (to === 'under_review') {
    notifyResponsible({
      ...common,
      namedUserId: document.approver_id,
      permission: 'document:approve',
      exclude: [actor?.id],
      kind: 'approval_requested',
      severity: 'warn',
      title: `Approval needed: ${label}`,
      body: `${actor?.name || 'Someone'} submitted this ${document.doc_type} for approval.`
    });
    if (document.reviewer_id && document.reviewer_id !== actor?.id) {
      notify({
        ...common, userId: document.reviewer_id, kind: 'review_requested',
        title: `Review requested: ${label}`,
        body: `You are named as the reviewer of this ${document.doc_type}.`
      });
    }
    return;
  }

  if (to === 'approved') {
    notifyResponsible({
      ...common,
      permission: 'document:publish',
      exclude: [actor?.id],
      kind: 'ready_to_publish',
      title: `Ready to publish: ${label}`,
      body: `Approved by ${actor?.name || 'an approver'}.`
    });
    if (document.owner_id && document.owner_id !== actor?.id) {
      notify({
        ...common, userId: document.owner_id, kind: 'approved',
        title: `Approved: ${label}`,
        body: `${actor?.name || 'An approver'} approved your ${document.doc_type}.`
      });
    }
    return;
  }

  if (to === 'published' && document.owner_id && document.owner_id !== actor?.id) {
    notify({
      ...common, userId: document.owner_id, kind: 'published',
      title: `Published: ${label}`,
      body: `Now effective as version ${document.version}.`
    });
    return;
  }

  // Sent back for rework: the owner is the one who has to act.
  if (to === 'draft' && from === 'under_review' && document.owner_id && document.owner_id !== actor?.id) {
    notify({
      ...common, userId: document.owner_id, kind: 'review_requested', severity: 'warn',
      title: `Returned for revision: ${label}`,
      body: `${actor?.name || 'A reviewer'} sent this back to draft.`
    });
  }
}

/** A comment concerns the people accountable for the document, not everyone. */
export function notifyComment({ document, comment, actor }) {
  const interested = new Set([document.owner_id, document.approver_id, document.reviewer_id].filter(Boolean));
  interested.delete(actor?.id);
  for (const userId of interested) {
    notify({
      userId, kind: 'comment', entityType: 'document', entityId: document.id,
      url: DOC_URL(document.id), actor,
      title: `Comment on ${document.reference}`,
      body: comment.body.slice(0, 240)
    });
  }
}

/** Only findings that change what someone must do are worth interrupting for. */
export function notifyFindings({ findings, actor }) {
  for (const finding of findings) {
    if (!['high', 'critical'].includes(finding.severity)) continue;
    if (finding.scope_type !== 'document' || !finding.scope_id) continue;
    const doc = q.get('SELECT id, reference, title, owner_id FROM documents WHERE id = ?', finding.scope_id);
    if (!doc?.owner_id || doc.owner_id === actor?.id) continue;
    notify({
      userId: doc.owner_id, kind: 'finding', entityType: 'finding', entityId: finding.id,
      url: DOC_URL(doc.id), actor,
      severity: finding.severity === 'critical' ? 'danger' : 'warn',
      title: `${finding.severity === 'critical' ? 'Critical' : 'High'} finding on ${doc.reference}`,
      body: finding.title,
      // One notification per finding, however many times a review is re-run.
      dedupeKey: `finding:${finding.id}`
    });
  }
}

// ----------------------------------------------------------------- sweeps ---

const REVIEW_HORIZON_DAYS = 30;

/**
 * Documents approaching or past their review date. Runs at boot and on an
 * interval; the dedupe key carries the review date, so the next review cycle
 * raises a fresh notification while the current one stays a single row.
 */
export function sweepReviewDue() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = q.all(
    `SELECT d.id, d.reference, d.title, d.doc_type, d.review_date, d.owner_id
       FROM documents d
      WHERE d.review_date IS NOT NULL
        AND d.status NOT IN ('retired', 'draft')
        AND d.owner_id IS NOT NULL
        AND d.review_date <= date('now', ?)`,
    `+${REVIEW_HORIZON_DAYS} day`
  );

  let raised = 0;
  for (const doc of rows) {
    const overdue = doc.review_date < today;
    const created = notify({
      userId: doc.owner_id,
      kind: 'review_due',
      severity: overdue ? 'danger' : 'warn',
      entityType: 'document',
      entityId: doc.id,
      url: DOC_URL(doc.id),
      title: overdue
        ? `Review overdue: ${doc.reference} — ${doc.title}`
        : `Review due ${doc.review_date}: ${doc.reference} — ${doc.title}`,
      body: overdue
        ? `The review date passed on ${doc.review_date}. A published document past its review date is a finding in most audits.`
        : `Scheduled review falls due within ${REVIEW_HORIZON_DAYS} days.`,
      // Overdue is a distinct state from approaching, so each is raised once.
      dedupeKey: `review:${doc.id}:${doc.review_date}:${overdue ? 'overdue' : 'due'}`
    });
    if (created) raised += 1;
  }
  return { examined: rows.length, raised };
}

/**
 * Artefacts sitting unverified. Addressed to the people who can verify them,
 * minus whoever collected them — the same segregation the route enforces.
 */
export function sweepEvidenceVerification() {
  const rows = q.all(
    `SELECT f.id, f.filename, f.uploaded_by, e.id AS evidence_row, e.evidence_id, e.name
       FROM evidence_files f
       JOIN evidence e ON e.id = f.evidence_id
      WHERE f.verified_at IS NULL`
  );
  const verifiers = usersWithPermission('evidence:verify');

  let raised = 0;
  for (const file of rows) {
    for (const user of verifiers) {
      if (user.id === file.uploaded_by) continue;
      const created = notify({
        userId: user.id,
        kind: 'evidence_verification',
        entityType: 'evidence',
        entityId: file.evidence_row,
        url: '/evidence',
        title: `Evidence awaiting verification: ${file.evidence_id}`,
        body: `"${file.filename}" was collected for ${file.name} and has not been verified.`,
        dedupeKey: `evidence:${file.id}`
      });
      if (created) raised += 1;
    }
  }
  return { examined: rows.length, raised };
}

// ------------------------------------------------------------- deadlines ---

/** Whole days from today to a date (negative once it has passed). */
export function daysUntil(date, today = new Date()) {
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86400000);
}

/**
 * One deadline, worked through the organisation's reminder schedule. Before
 * it, the owner is reminded once at each interval it crosses (30, 15, 5 days
 * by default), and only at the nearest one, so a task created three days out
 * gets one reminder, not three. Once it passes, the owner is told it is
 * overdue, and after the escalation period the people who answer for the work
 * are told too. Every notice carries the deadline in its key, so moving the
 * date starts the schedule again and running the sweep twice raises nothing.
 */
export function remindDeadline({
  due, ownerIds, escalationPermission, key, entityType, entityId, url, what, automation, today
}) {
  const days = daysUntil(due, today);
  if (days === null) return 0;
  const owners = [...new Set(ownerIds.filter(Boolean))];
  let raised = 0;
  const send = (userId, stage, severity, title, body) => {
    if (notify({ userId, kind: 'deadline', severity, entityType, entityId, url, title, body, dedupeKey: `${key}:${due}:${stage}` })) raised += 1;
  };
  if (days >= 0) {
    const stage = [...automation.reminderDays].sort((a, b) => a - b).find((d) => days <= d);
    if (stage === undefined) return 0;
    for (const userId of owners) {
      send(userId, `r${stage}`, days <= 5 ? 'warn' : 'info',
        `Due in ${days} day(s): ${what}`, `The deadline is ${due}.`);
    }
    return raised;
  }
  for (const userId of owners) {
    send(userId, 'overdue', 'danger', `Overdue: ${what}`, `The deadline was ${due}.`);
  }
  if (-days >= automation.escalateAfterDays && escalationPermission) {
    for (const user of usersWithPermission(escalationPermission)) {
      if (owners.includes(user.id)) continue;
      send(user.id, 'escalated', 'danger', `Escalated, ${-days} day(s) overdue: ${what}`,
        `The deadline was ${due}. It is escalated to you because it is ${-days} day(s) overdue.`);
    }
  }
  return raised;
}

/**
 * Every dated obligation the platform holds: corrective actions, risk
 * reviews, risk treatment target dates, risk acceptance expiries, control
 * assessments and evidence collection. Escalation goes to the people whose
 * permission covers the work, since the platform holds no reporting lines.
 */
export function sweepDeadlines(today = new Date()) {
  const automation = getAutomation();
  const common = { automation, today };
  let raised = 0;
  let examined = 0;

  for (const a of q.all(`SELECT id, action_id, title, owner_id, due_date FROM corrective_actions
      WHERE due_date IS NOT NULL AND status IN ('open','in_progress','blocked')`)) {
    examined += 1;
    raised += remindDeadline({
      ...common, due: a.due_date, ownerIds: [a.owner_id], escalationPermission: 'action:verify',
      key: `action:${a.id}`, entityType: 'action', entityId: a.id, url: '/actions',
      what: `corrective action ${a.action_id} — ${a.title}`
    });
  }

  for (const r of q.all(`SELECT id, risk_id, title, owner_id, action_owner_id, review_date, target_date, status,
        accepted_at, accepted_by, acceptance_expires FROM risks WHERE status != 'closed'`)) {
    examined += 1;
    const url = `/risks?open=${r.id}`;
    if (r.review_date && r.owner_id) {
      raised += remindDeadline({
        ...common, due: r.review_date, ownerIds: [r.owner_id], escalationPermission: 'settings:write',
        key: `risk-review:${r.id}`, entityType: 'risk', entityId: r.id, url, what: `review of risk ${r.risk_id} — ${r.title}`
      });
    }
    if (r.target_date && !['treated', 'accepted'].includes(r.status)) {
      raised += remindDeadline({
        ...common, due: r.target_date, ownerIds: [r.action_owner_id || r.owner_id], escalationPermission: 'settings:write',
        key: `risk-treatment:${r.id}`, entityType: 'risk', entityId: r.id, url, what: `treatment of risk ${r.risk_id} — ${r.title}`
      });
    }
    if (r.accepted_at && r.acceptance_expires) {
      raised += remindDeadline({
        ...common, due: r.acceptance_expires, ownerIds: [r.owner_id, r.accepted_by], escalationPermission: 'risk:accept',
        key: `risk-acceptance:${r.id}`, entityType: 'risk', entityId: r.id, url, what: `acceptance of risk ${r.risk_id} — ${r.title}`
      });
    }
  }

  for (const c of q.all(`SELECT id, control_id, name, owner_id, next_assessment_date FROM controls
      WHERE status != 'retired' AND owner_id IS NOT NULL AND next_assessment_date IS NOT NULL`)) {
    examined += 1;
    raised += remindDeadline({
      ...common, due: c.next_assessment_date, ownerIds: [c.owner_id], escalationPermission: 'settings:write',
      key: `control-assessment:${c.id}`, entityType: 'control', entityId: c.id, url: '/controls',
      what: `assessment of control ${c.control_id} — ${c.name}`
    });
  }

  // Evidence falls due one cycle after it was last collected, and is chased
  // with the owner of the control it demonstrates.
  for (const e of q.all(`SELECT e.id, e.evidence_id, e.name, e.frequency, e.last_collected, c.owner_id
      FROM evidence e JOIN controls c ON c.id = e.control_id
      WHERE c.owner_id IS NOT NULL AND e.last_collected IS NOT NULL AND c.status != 'retired'`)) {
    const cycle = cycleDays(e.frequency);
    if (!cycle) continue;
    examined += 1;
    const due = new Date(`${String(e.last_collected).slice(0, 10)}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + cycle);
    raised += remindDeadline({
      ...common, due: due.toISOString().slice(0, 10), ownerIds: [e.owner_id], escalationPermission: 'settings:write',
      key: `evidence-due:${e.id}`, entityType: 'evidence', entityId: e.id, url: '/evidence',
      what: `collection of evidence ${e.evidence_id} — ${e.name}`
    });
  }
  return { examined, raised };
}

export function runSweeps() {
  const review = sweepReviewDue();
  const evidence = sweepEvidenceVerification();
  const deadlines = sweepDeadlines();
  return { review, evidence, deadlines };
}

// ------------------------------------------------------------- scheduling ---

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let timer = null;

/**
 * There is no scheduler to hang this off: the platform runs as one local
 * process, so the process sweeps for itself.
 */
export function startSweepSchedule() {
  if (timer) return timer;
  try {
    const first = runSweeps();
    if (first.review.raised || first.evidence.raised || first.deadlines.raised) {
      console.log(`[AutGRC] Notifications raised at startup: ${first.review.raised} review, ${first.evidence.raised} evidence, ${first.deadlines.raised} deadline`);
    }
  } catch (err) {
    console.warn(`[AutGRC] Notification sweep failed: ${err.message}`);
  }
  timer = setInterval(() => {
    try { runSweeps(); } catch (err) { console.warn(`[AutGRC] Notification sweep failed: ${err.message}`); }
  }, SWEEP_INTERVAL_MS);
  return timer;
}

export function stopSweepSchedule() {
  if (timer) { clearInterval(timer); timer = null; }
}
