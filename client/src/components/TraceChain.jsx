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
import { useI18n } from '../i18n/index.jsx';
import { useLabels } from '../i18n/labels.js';

/** Crosswalk relation enum, translated at render time; unknown values fall back to Title Case. */
function relationLabel(t, value) {
  const map = {
    equivalent: t('traceUi.relation.equivalent'),
    broader: t('traceUi.relation.broader'),
    narrower: t('traceUi.relation.narrower'),
    related: t('traceUi.relation.related')
  };
  return map[value] || titleCase(value);
}

/** Mapping confidence enum (low / medium / high). */
function confidenceLabel(t, value) {
  const map = {
    low: t('traceUi.confidence.low'),
    medium: t('traceUi.confidence.medium'),
    high: t('traceUi.confidence.high')
  };
  return map[value] || t('traceUi.confidence.unknown', { level: value });
}

function Arrow() {
  return <div className="trace-arrow"><IconArrowDown width={15} height={15} /></div>;
}

export default function TraceChain({ trace }) {
  const { t } = useI18n();
  const labels = useLabels();
  const r = trace.requirement;

  return (
    <div className="stack">
      <div className="callout">
        <strong>{t('traceUi.sourceStatus')}</strong>
        <p style={{ marginBottom: 0 }}>{trace.sourceNote}</p>
      </div>

      <div className="trace-chain">
        <div className="trace-node source">
          <span className="trace-kind">{t('traceUi.kindSource')}</span>
          <div className="trace-body">
            <div className="trace-title">{r.framework_name}</div>
            <div className="trace-meta">
              <span className="mono">{r.ref}</span> — {r.title}
            </div>
            <div className="row-tight" style={{ marginTop: 6 }}>
              <ProvenanceTag provenance={r.provenance} />
              {r.domain_label && <Badge tone="neutral">{r.domain_label}</Badge>}
              <Badge tone={COVERAGE_TONE[trace.coverage] || 'neutral'}>{labels.coverage(trace.coverage)}</Badge>
            </div>
          </div>
        </div>

        {trace.chain.length === 0 && (
          <>
            <Arrow />
            <div className="trace-node">
              <span className="trace-kind">{t('traceUi.kindGap')}</span>
              <div className="trace-body">
                <div className="trace-title">{t('traceUi.noControl')}</div>
                <div className="trace-meta">
                  {t('traceUi.noControlBody')}
                </div>
              </div>
            </div>
          </>
        )}

        {trace.chain.map((link, i) => (
          <div key={i}>
            <Arrow />
            <div className="trace-node control">
              <span className="trace-kind">{t('traceUi.kindControl')}</span>
              <div className="trace-body">
                <div className="trace-title">
                  <span className="mono">{link.control.control_id}</span> — {link.control.name}
                </div>
                <div className="trace-meta">{link.control.rationale}</div>
                <div className="row-tight" style={{ marginTop: 6 }}>
                  <Badge tone={COVERAGE_TONE[link.control.coverage] || 'neutral'}>{labels.coverage(link.control.coverage)}</Badge>
                  <Badge tone="neutral">{confidenceLabel(t, link.control.confidence)}</Badge>
                  {link.control.responsible_role && <span className="tiny muted">{link.control.responsible_role}</span>}
                </div>
              </div>
            </div>

            {(link.policy || link.policy_ref) && (
              <>
                <Arrow />
                <div className="trace-node">
                  <span className="trace-kind">{t('traceUi.kindPolicy')}</span>
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
                  <span className="trace-kind">{t('traceUi.kindStandard')}</span>
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
                  <span className="trace-kind">{t('traceUi.kindProcedure')}</span>
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
                  <span className="trace-kind">{t('traceUi.kindEvidence')}</span>
                  <div className="trace-body">
                    <div className="trace-title">{t('traceUi.evidenceCount', { count: link.evidence.length })}</div>
                    <ul style={{ margin: '6px 0 0', paddingInlineStart: 18, fontSize: 12.5 }}>
                      {link.evidence.map((e) => (
                        <li key={e.id} style={{ marginBottom: 3 }}>
                          <span className="mono tiny">{e.evidence_id}</span> {e.name}
                          <span className="tiny muted"> · {e.frequency || t('traceUi.noFrequency')}</span>
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
          <h4 style={{ marginBottom: 8 }}>{t('traceUi.equivalents')}</h4>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>{t('traceUi.colSource')}</th><th>{t('traceUi.colRef')}</th><th>{t('traceUi.colRequirement')}</th><th>{t('traceUi.colRelation')}</th></tr></thead>
              <tbody>
                {trace.crosswalks.map((cw, i) => (
                  <tr key={i}>
                    <td className="nowrap"><Badge tone="info">{cw.framework_code}</Badge></td>
                    <td className="mono nowrap">{cw.ref}</td>
                    <td className="small">{cw.title}</td>
                    <td className="nowrap"><Badge tone="neutral">{relationLabel(t, cw.relation)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            {t('traceUi.equivalentsNote')}
          </p>
        </section>
      )}
    </div>
  );
}
