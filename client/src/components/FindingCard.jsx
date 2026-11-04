/** Renders a governance finding with its evidence and recommendation. */

import { Link } from 'react-router-dom';
import { SeverityBadge, Badge, ProvenanceTag } from './ui.jsx';
import { titleCase, relativeTime } from '../lib/format.js';
import { IconCheck, IconX, IconAlert } from './Icons.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useLabels } from '../i18n/labels.js';

function parseEvidence(evidence) {
  if (!evidence) return null;
  if (typeof evidence === 'string') {
    try { return JSON.parse(evidence); } catch { return null; }
  }
  return evidence;
}

/** The document page, opened at the place a finding is fixed. */
function fixHref(target) {
  const q = new URLSearchParams({ fix: target.action });
  for (const k of ['sectionKey', 'heading', 'field', 'after']) if (target[k]) q.set(k === 'sectionKey' ? 'section' : k, target[k]);
  return `/documents/${target.documentId}?${q}`;
}

export default function FindingCard({ finding, onStatusChange, canManage, onRaiseAction }) {
  const { t } = useI18n();
  const labels = useLabels();
  const evidence = parseEvidence(finding.evidence);
  // Where the finding is fixed, when the check knows it.
  const target = evidence?.target?.documentId ? evidence.target : null;

  return (
    <article className={`finding ${finding.severity}`}>
      <div className="finding-head">
        <SeverityBadge severity={finding.severity} />
        <span className="finding-title">{finding.title}</span>
        <Badge tone="neutral">{labels.findingCategory(finding.category, titleCase(finding.category))}</Badge>
        {finding.source === 'ai' && <ProvenanceTag provenance="ai_recommendation" />}
        {finding.status && finding.status !== 'open' && <Badge tone="info">{labels.findingStatus(finding.status, titleCase(finding.status))}</Badge>}
      </div>

      {finding.location && <div className="tiny muted mono" style={{ marginTop: 4 }}>{finding.location}</div>}
      {finding.detail && <p className="finding-detail">{finding.detail}</p>}

      {evidence?.conflicting && (
        <div className="finding-evidence">
          <div className="evidence-quote conflict">
            <div className="evidence-quote-label">
              {t('findingsUi.conflicting', { document: evidence.conflicting.document })}
              {evidence.conflicting.section ? ` · ${evidence.conflicting.section}` : ''}
            </div>
            “{evidence.conflicting.statement}”
          </div>
          {evidence.agreeing && (
            <div className="evidence-quote agree">
              <div className="evidence-quote-label">
                {t('findingsUi.agreesWithStandard', { document: evidence.agreeing.document })}
                {evidence.agreeing.section ? ` · ${evidence.agreeing.section}` : ''}
              </div>
              “{evidence.agreeing.statement}”
            </div>
          )}
          {evidence.agreedValue && (
            <div className="tiny muted">
              {t('findingsUi.agreedValue')} <span className="strong">{evidence.agreedValue}</span>
              {evidence.parameter ? <> ({t('findingsUi.parameter')} <span className="mono">{evidence.parameter}</span>)</> : null}
            </div>
          )}
        </div>
      )}

      {evidence?.statement && !evidence.conflicting && (
        <div className="evidence-quote" style={{ marginTop: 8 }}>
          <div className="evidence-quote-label">{t('findingsUi.statement')}</div>“{evidence.statement}”
        </div>
      )}

      {evidence?.examples && (
        <div className="finding-evidence">
          {evidence.examples.slice(0, 4).map((ex, i) => (
            <div key={i} className="evidence-quote">
              <div className="evidence-quote-label">“{ex.term}”</div>{ex.sentence}
            </div>
          ))}
        </div>
      )}

      {evidence?.roles && (
        <div className="tiny muted" style={{ marginTop: 6 }}>
          {t('findingsUi.rolesAccountable')} <span className="strong">{evidence.roles.join(', ')}</span>
        </div>
      )}

      {evidence?.refs && (
        <div className="row-tight" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          {evidence.refs.slice(0, 12).map((r) => <span key={r} className="pill mono">{r}</span>)}
          {evidence.refs.length > 12 && <span className="tiny muted">{t('findingsUi.more', { count: evidence.refs.length - 12 })}</span>}
        </div>
      )}

      {finding.recommendation && <div className="finding-rec"><strong>{t('findingsUi.recommendation')} </strong>{finding.recommendation}</div>}

      {canManage && onStatusChange && finding.id && (
        <div className="row-tight" style={{ marginTop: 9, flexWrap: 'wrap' }}>
          {target && (
            <Link className="btn btn-sm btn-primary" to={fixHref(target)}>
              {t(`scorecard.fix_${target.action}`)}{target.reference ? ` · ${target.reference}` : ''}
            </Link>
          )}
          {finding.status !== 'acknowledged' && (
            <button className="btn btn-sm" onClick={() => onStatusChange(finding, 'acknowledged')}>{t('findingsUi.acknowledge')}</button>
          )}
          <button className="btn btn-sm" onClick={() => onStatusChange(finding, 'resolved')}><IconCheck width={12} height={12} />{t('findingsUi.resolved')}</button>
          <button className="btn btn-sm" onClick={() => onStatusChange(finding, 'accepted_risk')}><IconAlert width={12} height={12} />{t('findingsUi.acceptRisk')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onStatusChange(finding, 'false_positive')}><IconX width={12} height={12} />{t('findingsUi.falsePositive')}</button>
          {onRaiseAction && (
            <button className="btn btn-sm" onClick={() => onRaiseAction(finding)}>{t('findingsUi.raiseAction')}</button>
          )}
          {finding.created_at && <span className="tiny faint" style={{ marginInlineStart: 'auto' }}>{t('findingsUi.raised', { when: relativeTime(finding.created_at) })}</span>}
        </div>
      )}
    </article>
  );
}
