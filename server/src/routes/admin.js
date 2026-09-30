/** User administration, organisation profile and audit log. */

import express from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { q, nowIso, toJson } from '../db/index.js';
import { id } from '../utils/ids.js';
import {
  authenticate, requirePermission, audit, hashPassword, validatePassword,
  revokeAllSessions, ROLES, PERMISSIONS, permissionsFor, mfaRequiredRoles
} from '../middleware/auth.js';
import { asyncHandler, validate, notFound, HttpError } from '../middleware/errors.js';
import { getOrgProfile, listParam, paginate } from './_shared.js';
import { providerInfo } from '../services/ai.js';
import { validateKnowledgeBase, DOMAIN_META, FRAMEWORKS } from '../knowledge/index.js';

const router = express.Router();
router.use(authenticate);

// ----------------------------------------------------------------- users ---

router.get('/users', requirePermission('user:manage'), asyncHandler(async (req, res) => {
  const rows = q.all(
    `SELECT id, email, name, role, job_title, status, last_login_at, failed_logins, locked_until, created_at,
            mfa_enabled, mfa_enrolled_at, must_change_password
       FROM users ORDER BY name`
  );
  res.json({
    items: rows.map((u) => ({ ...u, role_label: ROLES[u.role], permissions: permissionsFor(u.role).length })),
    roles: Object.entries(ROLES).map(([value, label]) => ({ value, label, permissions: permissionsFor(value) })),
    permissionMatrix: PERMISSIONS
  });
}));

router.post('/users', requirePermission('user:manage'), validate(z.object({
  email: z.string().email().max(200),
  name: z.string().min(2).max(150),
  role: z.enum(Object.keys(ROLES)),
  job_title: z.string().max(150).optional(),
  password: z.string().min(1)
})), asyncHandler(async (req, res) => {
  if (q.get('SELECT id FROM users WHERE lower(email) = lower(?)', req.body.email)) {
    throw new HttpError(409, 'An account already exists with that email address.');
  }
  const errors = validatePassword(req.body.password);
  if (errors.length) throw new HttpError(400, 'Password does not meet the policy', errors);

  const userId = id('usr');
  const at = nowIso();
  q.run(
    `INSERT INTO users (id, email, name, password_hash, role, job_title, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    userId, req.body.email.toLowerCase(), req.body.name, hashPassword(req.body.password),
    req.body.role, req.body.job_title || null, 'active', at, at
  );
  audit(req, { action: 'user:create', entityType: 'user', entityId: userId, summary: `Created user ${req.body.email} with role ${req.body.role}` });
  res.status(201).json({ user: q.get('SELECT id, email, name, role, job_title, status, created_at FROM users WHERE id = ?', userId) });
}));

router.patch('/users/:id', requirePermission('user:manage'), validate(z.object({
  name: z.string().min(2).max(150).optional(),
  role: z.enum(Object.keys(ROLES)).optional(),
  job_title: z.string().max(150).nullable().optional(),
  status: z.enum(['active', 'suspended']).optional(),
  password: z.string().optional()
})), asyncHandler(async (req, res) => {
  const user = q.get('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!user) throw notFound('User');

  // Guard against removing the last administrator.
  if ((req.body.role && req.body.role !== 'admin' && user.role === 'admin') ||
      (req.body.status === 'suspended' && user.role === 'admin')) {
    const admins = q.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'").n;
    if (admins <= 1) throw new HttpError(409, 'At least one active administrator must remain.');
  }

  const { password, ...fields } = req.body;
  if (password) {
    const errors = validatePassword(password);
    if (errors.length) throw new HttpError(400, 'Password does not meet the policy', errors);
    fields.password_hash = hashPassword(password);
    fields.failed_logins = 0;
    fields.locked_until = null;
    revokeAllSessions(user.id);
  }
  if (req.body.status === 'active' && user.status === 'suspended') {
    fields.failed_logins = 0;
    fields.locked_until = null;
  }
  if (req.body.status === 'suspended') revokeAllSessions(user.id);

  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length) {
    q.run(`UPDATE users SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v), nowIso(), user.id);
  }
  audit(req, {
    action: 'user:update', entityType: 'user', entityId: user.id,
    summary: `Updated ${user.email}${password ? ' (password reset)' : ''}`,
    detail: Object.fromEntries(entries.filter(([k]) => k !== 'password_hash'))
  });
  res.json({ user: q.get('SELECT id, email, name, role, job_title, status, last_login_at FROM users WHERE id = ?', user.id) });
}));

router.post('/users/:id/unlock', requirePermission('user:manage'), asyncHandler(async (req, res) => {
  const user = q.get('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!user) throw notFound('User');
  q.run('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', user.id);
  audit(req, { action: 'user:unlock', entityType: 'user', entityId: user.id, summary: `Unlocked ${user.email}` });
  res.json({ ok: true });
}));

/**
 * Reset a password an administrator cannot see.
 *
 * There is no self-service reset, because there is no mail transport to send a
 * link through and a governance platform should not pretend to have one. The
 * temporary password is returned once, to be passed on out of band, and the
 * account can do nothing else until it is changed.
 */
router.post('/users/:id/reset-password', requirePermission('user:manage'), asyncHandler(async (req, res) => {
  const user = q.get('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!user) throw notFound('User');

  // Long enough that it is not worth guessing, and it lives for one sign-in.
  const temporary = `${crypto.randomBytes(9).toString('base64url')}Aa1`;
  q.run(
    `UPDATE users SET password_hash = ?, must_change_password = 1,
       failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?`,
    hashPassword(temporary), nowIso(), user.id
  );
  // Whatever was signed in as this account no longer is.
  revokeAllSessions(user.id);

  audit(req, {
    action: 'user:reset_password', entityType: 'user', entityId: user.id,
    summary: `Reset the password for ${user.email}; all sessions revoked`
  });

  res.json({
    ok: true,
    temporaryPassword: temporary,
    message: 'Give this to the account holder through a channel other than email. They must change it at next sign-in.'
  });
}));

/**
 * Turn off a second factor for someone who has lost both their authenticator
 * and their recovery codes. Audited loudly: it is a way past a control.
 */
router.post('/users/:id/reset-mfa', requirePermission('user:manage'), asyncHandler(async (req, res) => {
  const user = q.get('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!user) throw notFound('User');
  if (!user.mfa_enabled) throw new HttpError(409, 'Multi-factor authentication is not enabled on this account.');

  q.run(
    `UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_enrolled_at = NULL,
       mfa_recovery_codes = NULL, updated_at = ? WHERE id = ?`,
    nowIso(), user.id
  );
  revokeAllSessions(user.id);

  const stillRequired = mfaRequiredRoles().includes(user.role);
  audit(req, {
    action: 'user:reset_mfa', entityType: 'user', entityId: user.id,
    summary: `Removed the second factor for ${user.email}; all sessions revoked`,
    detail: { role: user.role, mustReEnrol: stillRequired }
  });

  res.json({
    ok: true,
    mustReEnrol: stillRequired,
    message: stillRequired
      ? `${user.name} must enrol a new authenticator before they can use the platform again.`
      : `${user.name} can sign in with a password alone until they enrol again.`
  });
}));

/** Users the whole application needs for owner and approver pickers. */
router.get('/directory', asyncHandler(async (req, res) => {
  res.json(q.all("SELECT id, name, email, role, job_title FROM users WHERE status = 'active' ORDER BY name"));
}));

// ------------------------------------------------------- org profile -------

router.get('/org', asyncHandler(async (req, res) => res.json(getOrgProfile())));

router.put('/org', requirePermission('settings:write'), validate(z.object({
  org_name: z.string().min(2).max(200),
  org_type: z.string().max(100).nullable().optional(),
  industry: z.string().max(100).nullable().optional(),
  size: z.string().max(100).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  regulators: z.array(z.string().max(120)).optional(),
  operating_model: z.string().max(200).nullable().optional(),
  technology_env: z.array(z.string().max(120)).optional(),
  risk_appetite: z.string().max(100).nullable().optional(),
  business_requirements: z.string().max(4000).nullable().optional(),
  data_classifications: z.array(z.string().max(60)).optional(),
  mfa_required_roles: z.array(z.enum(Object.keys(ROLES))).optional(),
  applicable_frameworks: z.array(z.string().max(60)).optional()
})), asyncHandler(async (req, res) => {
  const b = req.body;
  const at = nowIso();
  // Omitting the field leaves the setting alone. The profile form does not
  // carry it, and a PUT that replaced everything would silently clear a choice
  // made during setup and send the installation back through it.
  const current = getOrgProfile().applicable_frameworks;
  const frameworks = b.applicable_frameworks === undefined
    ? (current === null ? null : toJson(current))
    : toJson(b.applicable_frameworks);
  q.run(
    `INSERT INTO org_profile (id, org_name, org_type, industry, size, country, regulators, operating_model,
       technology_env, risk_appetite, business_requirements, data_classifications, mfa_required_roles,
       applicable_frameworks, updated_at)
     VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       org_name = excluded.org_name, org_type = excluded.org_type, industry = excluded.industry,
       size = excluded.size, country = excluded.country, regulators = excluded.regulators,
       operating_model = excluded.operating_model, technology_env = excluded.technology_env,
       risk_appetite = excluded.risk_appetite, business_requirements = excluded.business_requirements,
       data_classifications = excluded.data_classifications,
       mfa_required_roles = excluded.mfa_required_roles,
       applicable_frameworks = excluded.applicable_frameworks, updated_at = excluded.updated_at`,
    b.org_name, b.org_type || null, b.industry || null, b.size || null, b.country || null,
    toJson(b.regulators || []), b.operating_model || null, toJson(b.technology_env || []),
    b.risk_appetite || null, b.business_requirements || null, toJson(b.data_classifications || []),
    b.mfa_required_roles ? b.mfa_required_roles.join(',') : mfaRequiredRoles().join(','), frameworks, at
  );
  audit(req, { action: 'settings:org', entityType: 'org_profile', summary: `Updated the organisation profile for ${b.org_name}` });
  res.json(getOrgProfile());
}));

/**
 * Record which frameworks and regulations the organisation is subject to.
 *
 * Separate from the profile PUT because this is the question a new
 * installation is asked before it generates anything, and the setup screen
 * should not have to send a whole organisation profile to answer it.
 *
 * An empty list is a legitimate answer and is stored as one: it means the
 * organisation has decided no external source applies, and documents generate
 * without framework traceability. That is different from never having been
 * asked, which is what the null the column starts at means.
 */
router.put('/org/frameworks', requirePermission('settings:write'),
  validate(z.object({ codes: z.array(z.string().max(60)) })), asyncHandler(async (req, res) => {
    const known = new Map(q.all('SELECT code, name FROM frameworks').map((f) => [f.code, f.name]));
    const unknown = req.body.codes.filter((code) => !known.has(code));
    if (unknown.length) {
      throw new HttpError(400, `Not in the framework catalogue: ${unknown.join(', ')}`);
    }
    // De-duplicated and ordered by the catalogue so the stored list does not
    // depend on the order the boxes happened to be ticked in.
    const codes = [...known.keys()].filter((code) => req.body.codes.includes(code));

    const existing = q.get('SELECT id FROM org_profile WHERE id = 1');
    if (!existing) throw new HttpError(409, 'Set the organisation profile before choosing its frameworks.');
    q.run('UPDATE org_profile SET applicable_frameworks = ?, updated_at = ? WHERE id = 1', toJson(codes), nowIso());

    audit(req, {
      action: 'settings:frameworks', entityType: 'org_profile',
      summary: codes.length
        ? `Recorded ${codes.length} applicable framework(s): ${codes.join(', ')}`
        : 'Recorded that no external framework applies to this organisation',
      detail: { codes }
    });
    res.json(getOrgProfile());
  }));

// ----------------------------------------------------------- audit log -----

router.get('/audit', requirePermission('audit:read'), asyncHandler(async (req, res) => {
  const { limit, offset } = paginate(req, 100, 1000);
  const filters = [];
  const args = [];
  const actions = listParam(req.query.action);
  if (actions.length) { filters.push(`action IN (${actions.map(() => '?').join(',')})`); args.push(...actions); }
  if (req.query.user) { filters.push('user_email = ?'); args.push(req.query.user); }
  if (req.query.entityType) { filters.push('entity_type = ?'); args.push(req.query.entityType); }
  if (req.query.entityId) { filters.push('entity_id = ?'); args.push(req.query.entityId); }
  if (req.query.outcome) { filters.push('outcome = ?'); args.push(req.query.outcome); }
  if (req.query.from) { filters.push('at >= ?'); args.push(req.query.from); }
  if (req.query.to) { filters.push('at <= ?'); args.push(req.query.to); }
  if (req.query.search) { filters.push('(summary LIKE ? OR action LIKE ?)'); args.push(`%${req.query.search}%`, `%${req.query.search}%`); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = q.get(`SELECT COUNT(*) AS n FROM audit_log ${where}`, ...args).n;
  const rows = q.all(`SELECT * FROM audit_log ${where} ORDER BY at DESC LIMIT ? OFFSET ?`, ...args, limit, offset);
  res.json({
    total, limit, offset, items: rows,
    facets: {
      actions: q.all('SELECT action, COUNT(*) AS n FROM audit_log GROUP BY action ORDER BY n DESC LIMIT 40'),
      users: q.all('SELECT user_email, COUNT(*) AS n FROM audit_log WHERE user_email IS NOT NULL GROUP BY user_email ORDER BY n DESC LIMIT 20'),
      outcomes: q.all('SELECT outcome, COUNT(*) AS n FROM audit_log GROUP BY outcome')
    }
  });
}));

// ------------------------------------------------------------- system ------

router.get('/system', asyncHandler(async (req, res) => {
  const problems = validateKnowledgeBase();
  res.json({
    ai: providerInfo(),
    knowledgeBase: {
      domains: DOMAIN_META.length,
      frameworks: FRAMEWORKS.length,
      frameworkRequirements: q.get('SELECT COUNT(*) AS n FROM framework_requirements').n,
      crosswalks: q.get('SELECT COUNT(*) AS n FROM crosswalks').n,
      integrityProblems: problems
    },
    counts: {
      users: q.get('SELECT COUNT(*) AS n FROM users').n,
      documents: q.get('SELECT COUNT(*) AS n FROM documents').n,
      controls: q.get('SELECT COUNT(*) AS n FROM controls').n,
      evidence: q.get('SELECT COUNT(*) AS n FROM evidence').n,
      findings: q.get('SELECT COUNT(*) AS n FROM findings').n,
      auditEntries: q.get('SELECT COUNT(*) AS n FROM audit_log').n
    },
    roles: Object.entries(ROLES).map(([value, label]) => ({ value, label, permissions: permissionsFor(value) }))
  });
}));

export default router;
