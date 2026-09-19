/**
 * Source traceability chain.
 *
 * Renders the full path required for audit readiness:
 *   source requirement → organisational control → policy clause →
 *   standard clause → procedure → evidence.
 */

import { Link } from 'react-router-dom';
import { Badge, Empty, ProvenanceTag } from './ui.jsx';
import { IconArrowDown, IconLink, IconInfo } from './Icons.jsx';
import { titleCase, COVERAGE_TONE } from '../lib/format.js';

function Arrow() {
  return <div className="trace-arrow"><IconArrowDown width={15} height={15} /></div>;
}

export default function TraceChain({ trace }) {
  const r = trace.requirement;

  return (
    <div className="stack">
      <div className="callout">
        <strong>Source status</strong>
        <p style={{ marginBottom: 0 }}>{trace.sourceNote}</p>
      </div>

      <div className="trace-chain">
        <div className="trace-node source">
          <span className="trace-kind">Source</span>
          <div className="trace-body">
            <div className="trace-title">{r.framework_name}</div>
            <div className="trace-meta">
              <span className="mono">{r.ref}</span> — {r.title}
            </div>
            <div className="row-tight" style={{ marginTop: 6 }}>
              <ProvenanceTag provenance={r.provenance} />
              {r.domain_label && <Badge tone="neutral">{r.domain_label}</Badge>}
              <Badge tone={COVERAGE_TONE[trace.coverage] || 'neutral'}>{titleCase(trace.coverage)}</Badge>
            </div>
          </div>
        </div>

        {trace.chain.length === 0 && (
          <>
            <Arrow />
            <div className="trace-node">
              <span className="trace-kind">Gap</span>
              <div className="trace-body">
                <div className="trace-title">No organisational control is mapped</div>
                <div className="trace-meta">
                  This requirement cannot currently be evidenced. Map an existing control, create one,
                  or record the requirement as Not Applicable with a documented rationale.
                </div>
              </div>
            </div>
          </>
        )}

        {trace.chain.map((link, i) => (
          <div key={i}>
            <Arrow />
            <div className="trace-node control">
              <span className="trace-kind">Control</span>
              <div className="trace-body">
                <div className="trace-title">
                  <span className="mono">{link.control.control_id}</span> — {link.control.name}
                </div>
                <div className="trace-meta">{link.control.rationale}</div>
                <div className="row-tight" style={{ marginTop: 6 }}>
                  <Badge tone={COVERAGE_TONE[link.control.coverage] || 'neutral'}>{titleCase(link.control.coverage)}</Badge>
                  <Badge tone="neutral">{link.control.confidence} confidence</Badge>
                  {link.control.responsible_role && <span className="tiny muted">{link.control.responsible_role}</span>}
                </div>
              </div>
            </div>

            {(link.policy || link.policy_ref) && (
              <>
                <Arrow />
                <div className="trace-node">
                  <span className="trace-kind">Policy</span>
                  <div className="trace-body">
                    <div className="trace-title">
                      {link.policy ? <Link to={`/documents/${link.policy.id}`}>{link.policy.reference} — {link.policy.title}</Link> : link.policy_ref}
                    </div>
                    {link.policy_ref && <div className="trace-meta mono">{link.policy_ref}</div>}
                  </div>
                </div>
              </>
            )}

            {(link.standard || link.standard_ref) && (
              <>
                <Arrow />
                <div className="trace-node">
                  <span className="trace-kind">Standard</span>
                  <div className="trace-body">
                    <div className="trace-title">
                      {link.standard ? <Link to={`/documents/${link.standard.id}`}>{link.standard.reference} — {link.standard.title}</Link> : link.standard_ref}
                    </div>
                    {link.standard_ref && <div className="trace-meta mono">{link.standard_ref}</div>}
                  </div>
                </div>
              </>
            )}

            {link.procedure && (
              <>
                <Arrow />
                <div className="trace-node">
                  <span className="trace-kind">Procedure</span>
                  <div className="trace-body">
                    <div className="trace-title">
                      <Link to={`/documents/${link.procedure.id}`}>{link.procedure.reference} — {link.procedure.title}</Link>
                    </div>
                  </div>
                </div>
              </>
            )}

            {link.evidence.length > 0 && (
              <>
                <Arrow />
                <div className="trace-node evidence">
                  <span className="trace-kind">Evidence</span>
                  <div className="trace-body">
                    <div className="trace-title">{link.evidence.length} evidence requirement{link.evidence.length === 1 ? '' : 's'}</div>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5 }}>
                      {link.evidence.map((e) => (
                        <li key={e.id} style={{ marginBottom: 3 }}>
                          <span className="mono tiny">{e.evidence_id}</span> {e.name}
                          <span className="tiny muted"> · {e.frequency || 'no frequency'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {trace.crosswalks.length > 0 && (
        <section>
          <h4 style={{ marginBottom: 8 }}>Equivalent requirements in other sources</h4>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Source</th><th>Ref</th><th>Requirement</th><th>Relation</th></tr></thead>
              <tbody>
                {trace.crosswalks.map((cw, i) => (
                  <tr key={i}>
                    <td className="nowrap"><Badge tone="info">{cw.framework_code}</Badge></td>
                    <td className="mono nowrap">{cw.ref}</td>
                    <td className="small">{cw.title}</td>
                    <td className="nowrap"><Badge tone="neutral">{titleCase(cw.relation)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Satisfying this requirement is likely to contribute to the equivalents above, but each
            source must still be assessed on its own terms.
          </p>
        </section>
      )}
    </div>
  );
}
