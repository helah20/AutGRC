/** Renders a governance finding with its evidence and recommendation. */

import { SeverityBadge, Badge, ProvenanceTag } from './ui.jsx';
import { titleCase, relativeTime } from '../lib/format.js';
import { IconCheck, IconX, IconAlert } from './Icons.jsx';

function parseEvidence(evidence) {
  if (!evidence) return null;
  if (typeof evidence === 'string') {
    try { return JSON.parse(evidence); } catch { return null; }
  }
  return evidence;
}

export default function FindingCard({ finding, onStatusChange, canManage }) {
  const evidence = parseEvidence(finding.evidence);

  return (
    <article className={`finding ${finding.severity}`}>
      <div className="finding-head">
        <SeverityBadge severity={finding.severity} />
        <span className="finding-title">{finding.title}</span>
        <Badge tone="neutral">{titleCase(finding.category)}</Badge>
        {finding.source === 'ai' && <ProvenanceTag provenance="ai_recommendation" />}
        {finding.status && finding.status !== 'open' && <Badge tone="info">{titleCase(finding.status)}</Badge>}
      </div>

      {finding.location && <div className="tiny muted mono" style={{ marginTop: 4 }}>{finding.location}</div>}
      {finding.detail && <p className="finding-detail">{finding.detail}</p>}

      {evidence?.conflicting && (
        <div className="finding-evidence">
          <div className="evidence-quote conflict">
            <div className="evidence-quote-label">
              Conflicting — {evidence.conflicting.document}
              {evidence.conflicting.section ? ` · ${evidence.conflicting.section}` : ''}
            </div>
            “{evidence.conflicting.statement}”
          </div>
          {evidence.agreeing && (
            <div className="evidence-quote agree">
              <div className="evidence-quote-label">
                Agrees with the Standard — {evidence.agreeing.document}
                {evidence.agreeing.section ? ` · ${evidence.agreeing.section}` : ''}
              </div>
              “{evidence.agreeing.statement}”
            </div>
          )}
          {evidence.agreedValue && (
            <div className="tiny muted">
              Agreed organisational value: <span className="strong">{evidence.agreedValue}</span>
              {evidence.parameter ? <> (parameter <span className="mono">{evidence.parameter}</span>)</> : null}
            </div>
          )}
        </div>
      )}

      {evidence?.statement && !evidence.conflicting && (
        <div className="evidence-quote" style={{ marginTop: 8 }}>
          <div className="evidence-quote-label">Statement</div>“{evidence.statement}”
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
          Roles marked accountable: <span className="strong">{evidence.roles.join(', ')}</span>
        </div>
      )}

      {evidence?.refs && (
        <div className="row-tight" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          {evidence.refs.slice(0, 12).map((r) => <span key={r} className="pill mono">{r}</span>)}
          {evidence.refs.length > 12 && <span className="tiny muted">+{evidence.refs.length - 12} more</span>}
        </div>
      )}

      {finding.recommendation && <div className="finding-rec"><strong>Recommendation. </strong>{finding.recommendation}</div>}

      {canManage && onStatusChange && finding.id && (
        <div className="row-tight" style={{ marginTop: 9 }}>
          <button className="btn btn-sm" onClick={() => onStatusChange(finding, 'acknowledged')}>Acknowledge</button>
          <button className="btn btn-sm" onClick={() => onStatusChange(finding, 'resolved')}><IconCheck width={12} height={12} />Resolved</button>
          <button className="btn btn-sm" onClick={() => onStatusChange(finding, 'accepted_risk')}><IconAlert width={12} height={12} />Accept risk</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onStatusChange(finding, 'false_positive')}><IconX width={12} height={12} />False positive</button>
          {finding.created_at && <span className="tiny faint" style={{ marginLeft: 'auto' }}>Raised {relativeTime(finding.created_at)}</span>}
        </div>
      )}
    </article>
  );
}
