/**
 * The five-criterion quality profile, and the reviewer panel beside it.
 *
 * The readiness score answers "is this ready". It cannot answer "what is wrong
 * with it", because a domain that loses twenty points to missing accountability
 * and one that loses twenty points to two contradictory review frequencies
 * render the same number. The profile splits the same findings across the
 * criteria a GRC reviewer already argues in.
 *
 * Both bases are shown and neither is presented as the truth. The checks see
 * only what a rule can express; a reviewer sees whether the policy fits the
 * organisation. Where they disagree by two bands, one of them is measuring the
 * wrong thing and it is worth knowing which.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { Card, Badge, Empty, Field, Loading, ErrorNote, useToast } from './ui.jsx';
import { IconCheck, IconAlert, IconInfo } from './Icons.jsx';
import { useI18n } from '../i18n/index.jsx';

const TONE = { ok: 'ok', attention: 'warn', breach: 'danger' };
const METER = { ok: 'ok', attention: 'warn', breach: 'danger' };

/** The question under each criterion, in the reader's language. */
function useQuestion() {
  const { t } = useI18n();
  return (criterion) => {
    const key = `scorecard.question${criterion.short}`;
    const translated = t(key);
    return translated === key.split('.').pop() || translated === key ? criterion.question : translated;
  };
}

/** The criterion labels live in the dictionaries, keyed by the short code. */
function useCriterionLabel() {
  const { t } = useI18n();
  return (criterion) => {
    const key = `scorecard.criterion${criterion.short.charAt(0)}${criterion.short.charAt(1).toLowerCase()}`;
    const translated = t(key);
    // A code the dictionary does not know falls back to the server's label
    // rather than to the dotted path.
    return translated === key.split('.').pop() ? criterion.label : translated;
  };
}

const SEVERITY_TONE = { critical: 'critical', high: 'danger', medium: 'warn', low: 'neutral', info: 'neutral' };

/**
 * What a criterion is losing points to: each finding, the points it costs and
 * a way to the place it is fixed. `onFix` handles a target on the page the
 * reader is on; without it, the item links to the document.
 */
function CriterionItems({ items, toNextBand, band, onFix, documentId }) {
  const { t, formatNumber } = useI18n();
  const fixLabel = (target) => t(`scorecard.fix_${target.action}`);
  return (
    <div className="scorecard-items">
      {band < 5 && toNextBand > 0 && (
        <p className="tiny muted" style={{ margin: '0 0 6px' }}>
          {t('scorecard.toNextBand', { band: formatNumber(band + 1), points: formatNumber(toNextBand) })}
        </p>
      )}
      <ul>
        {items.map((item, i) => (
          <li key={item.id || i} className="scorecard-item">
            <span className="scorecard-item-main">
              <span className="row-tight" style={{ flexWrap: 'wrap' }}>
                <Badge tone={SEVERITY_TONE[item.severity] || 'neutral'}>{t(`rating.${item.severity}`)}</Badge>
                <span className="strong small">{item.title}</span>
              </span>
              {item.location && <span className="tiny muted">{item.location}</span>}
              {item.statement && <q className="tiny scorecard-quote" dir="auto">{item.statement}</q>}
              {item.recommendation && <span className="tiny">{item.recommendation}</span>}
            </span>
            <span className="scorecard-item-side">
              {item.weight > 0 && <span className="tiny muted nowrap">{t('scorecard.points', { points: formatNumber(item.weight) })}</span>}
              {/* The page handles a place in its own document; a place in
                  another document of the domain is a link to it. */}
              {item.target && (onFix && (!documentId || item.target.documentId === documentId)
                ? <button className="btn btn-sm" onClick={() => onFix(item.target)}>{fixLabel(item.target)}</button>
                : (
                  <Link className="btn btn-sm" to={`/documents/${item.target.documentId}?${new URLSearchParams({
                    fix: item.target.action, ...(item.target.sectionKey ? { section: item.target.sectionKey } : {}),
                    ...(item.target.heading ? { heading: item.target.heading } : {}), ...(item.target.field ? { field: item.target.field } : {}),
                    ...(item.target.after ? { after: item.target.after } : {})
                  })}`}>{fixLabel(item.target)}{item.target.documentId !== documentId && item.target.reference ? ` · ${item.target.reference}` : ''}</Link>
                ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BandRow({ label, question, band, status, findings, meta, items, toNextBand, onFix, documentId }) {
  const { t, formatNumber } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="scorecard-row-wrap">
    <div className="scorecard-row">
      <div className="scorecard-row-main">
        <div className="between" style={{ gap: 8, alignItems: 'baseline' }}>
          <span className="strong">{label}</span>
          <span className="tiny muted nowrap">
            {t('scorecard.outOfFive', { score: formatNumber(band), max: formatNumber(5) })}
          </span>
        </div>
        <div className={`meter ${METER[status] || ''}`} style={{ marginTop: 6 }}>
          <span style={{ width: `${(band / 5) * 100}%` }} />
        </div>
        {question && <p className="tiny muted" style={{ margin: '5px 0 0' }}>{question}</p>}
      </div>
      <div className="scorecard-row-side">
        <Badge tone={TONE[status] || 'neutral'}>{t(`scorecard.status${status.charAt(0).toUpperCase()}${status.slice(1)}`)}</Badge>
        {meta || (findings && items?.length
          ? (
            <button className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? t('scorecard.hideWhat') : t('scorecard.showWhat', { count: formatNumber(findings) })}
            </button>
          )
          : (
            <span className="tiny muted">
              {findings
                ? t('scorecard.findingCount', { count: formatNumber(findings) })
                : t('scorecard.noFindings')}
            </span>
          ))}
      </div>
    </div>
    {open && items?.length > 0 && <CriterionItems items={items} toNextBand={toNextBand} band={band} onFix={onFix} documentId={documentId} />}
    </div>
  );
}

/**
 * The engine's profile. `compact` drops the framing text for inline use;
 * `onFix` takes the reader to a finding's place on the current page.
 */
export function Scorecard({ scorecard, compact = false, onFix, live = false, documentId }) {
  const { t, formatNumber } = useI18n();
  const labelOf = useCriterionLabel();
  const questionOf = useQuestion();
  if (!scorecard) return null;

  return (
    <div className="stack-sm">
      {!compact && <p className="small muted" style={{ marginBottom: 0 }}>{t('scorecard.subtitle')}</p>}
      <div className="scorecard">
        {scorecard.criteria.map((c) => (
          <BandRow key={c.key} label={labelOf(c)} question={compact ? null : questionOf(c)}
            band={c.band} status={c.status} findings={c.findings}
            items={c.items} toNextBand={c.toNextBand} onFix={onFix} documentId={documentId} />
        ))}
      </div>
      <div className="between">
        <span className="tiny muted">{live ? t('scorecard.liveNote') : t('scorecard.derived')}</span>
        <span className="small strong nowrap">
          {t('scorecard.overall')} {t('scorecard.outOfFive', { score: formatNumber(scorecard.overall), max: formatNumber(5) })}
        </span>
      </div>
      {scorecard.unmapped?.length > 0 && (
        // Visible on purpose. A finding category the profile cannot place is
        // scoring nothing, and a silent zero is the failure this view exists
        // to prevent.
        <div className="callout" data-callout="warning">
          <strong>{t('appUi.unclassifiedFindings')}</strong>
          <p style={{ marginBottom: 0 }}>
            {t('appUi.unclassifiedBody', {
              list: scorecard.unmapped.map((u) => `${u.category} (${u.findings})`).join(', ')
            })}
          </p>
        </div>
      )}
    </div>
  );
}

const SCORES = [1, 2, 3, 4, 5];

/**
 * The reviewer panel: every rating held separately, the spread reported, and a
 * form for the reader's own rating.
 */
export function AssessmentPanel({ documentId, showEngine = true }) {
  const { t, formatNumber } = useI18n();
  const toast = useToast();
  const labelOf = useCriterionLabel();
  const { data, loading, error, reload } = useFetch(`/documents/${documentId}/assessment`);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  // Seed the form from the reader's existing rating once it arrives, so the
  // control shows what they said last rather than a default they did not choose.
  useEffect(() => {
    if (!data) return;
    setDraft(data.mine
      ? { ...data.mine.scores, comment: data.mine.comment || '' }
      : { policy_alignment: 0, role_clarity: 0, applicability: 0, governance_compliance: 0, control_completeness: 0, comment: '' });
  }, [data]);

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      await api.put(`/documents/${documentId}/assessment`, {
        policy_alignment: draft.policy_alignment,
        role_clarity: draft.role_clarity,
        applicability: draft.applicability,
        governance_compliance: draft.governance_compliance,
        control_completeness: draft.control_completeness,
        comment: draft.comment || null
      });
      toast.success(t('scorecard.saved'));
      reload();
    } catch (err) {
      toast.error(t('scorecard.panelTitle'), err.message);
    } finally { setBusy(false); }
  }, [documentId, draft, reload, t, toast]);

  if (loading) return <Loading label={t('scorecard.panelTitle')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const { engine, assessment, comparison, criteria } = data;
  const complete = draft && criteria.every((c) => draft[c.key] > 0);

  return (
    <div className="stack">
      {showEngine && (
        <Card title={t('scorecard.title')} subtitle={t('scorecard.engineBasis')}>
          <Scorecard scorecard={engine} />
        </Card>
      )}

      <Card title={t('scorecard.panelTitle')} subtitle={t('scorecard.panelSubtitle')}
        actions={assessment.panelSize
          ? <Badge tone="neutral">{t('scorecard.panelSize', { count: formatNumber(assessment.panelSize) })}</Badge>
          : null}>
        {assessment.divergence.material && (
          <div className="callout" data-callout="warning" style={{ marginBottom: 12 }}>
            <strong>{t('scorecard.divergence')}</strong>
            <p style={{ marginBottom: 0 }}>
              {t('scorecard.divergenceBody', {
                range: formatNumber(assessment.divergence.maxRange),
                count: formatNumber(assessment.divergence.criteria.length)
              })}
            </p>
          </div>
        )}

        {assessment.panelSize === 0 ? (
          <Empty icon={IconInfo} title={t('scorecard.panelEmpty')}>{t('scorecard.panelEmptyBody')}</Empty>
        ) : (
          <>
            <div className="scorecard">
              {assessment.criteria.map((c) => (
                <BandRow key={c.key} label={labelOf(c)} band={c.mean}
                  status={c.diverges ? 'attention' : c.mean <= 2 ? 'breach' : c.mean <= 3 ? 'attention' : 'ok'}
                  meta={
                    <span className="tiny muted nowrap">
                      {t('scorecard.range')} {formatNumber(c.min)}–{formatNumber(c.max)}
                    </span>
                  } />
              ))}
            </div>
            <div className="between" style={{ marginTop: 10 }}>
              <span className="tiny muted">{t('scorecard.reviewerBasis')} · v{assessment.version}</span>
              <span className="small strong nowrap">
                {t('scorecard.meanTotal')} {formatNumber(assessment.meanTotal)}/25
              </span>
            </div>
            <div className="stack-sm" style={{ marginTop: 12 }}>
              {assessment.reviewers.map((r) => (
                <div key={r.id} className="between scorecard-reviewer">
                  <div>
                    <div className="small strong">{r.reviewerName}</div>
                    {r.comment && <p className="tiny muted" style={{ margin: '3px 0 0' }}>{r.comment}</p>}
                  </div>
                  <div className="row-tight nowrap">
                    {criteria.map((c) => (
                      <span key={c.key} className="pill tiny" title={labelOf(c)}>
                        {c.short} {formatNumber(r.scores[c.key])}
                      </span>
                    ))}
                    <span className="small strong">{formatNumber(r.total)}/25</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {data.canAssess && draft && (
          <div className="scorecard-form">
            <div className="label">{data.mine ? t('scorecard.myAssessment') : t('scorecard.submit')}</div>
            {criteria.map((c) => (
              <div key={c.key} className="scorecard-form-row">
                <div>
                  <div className="small strong">{labelOf(c)}</div>
                  <p className="tiny muted" style={{ margin: 0 }}>{c.question}</p>
                </div>
                <div className="btn-group">
                  {SCORES.map((n) => (
                    <button key={n} type="button"
                      className={`btn btn-sm${draft[c.key] === n ? ' btn-primary' : ''}`}
                      onClick={() => setDraft((d) => ({ ...d, [c.key]: n }))}>
                      {formatNumber(n)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Field label={t('scorecard.commentLabel')}>
              <textarea className="input" rows={2} value={draft.comment}
                placeholder={t('scorecard.commentPlaceholder')}
                onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))} />
            </Field>
            <button className="btn btn-primary" onClick={submit} disabled={busy || !complete}>
              {busy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <IconCheck />}
              {data.mine ? t('scorecard.update') : t('scorecard.submit')}
            </button>
          </div>
        )}
      </Card>

      {comparison && (
        <Card title={t('scorecard.compareTitle')} subtitle={t('scorecard.compareSubtitle')}>
          <div className="stack-sm">
            {comparison.criteria.map((c) => (
              <div key={c.key} className="between scorecard-reviewer">
                <span className="small strong">{labelOf(c)}</span>
                <div className="row-tight nowrap">
                  <span className="tiny muted">{t('scorecard.engineBand')} {formatNumber(c.engineBand)}</span>
                  <span className="tiny muted">{t('scorecard.reviewerMean')} {formatNumber(c.reviewerMean)}</span>
                  <Badge tone={c.material ? 'warn' : 'neutral'}>
                    {c.material && <IconAlert width={11} height={11} />}
                    {t('scorecard.delta')} {c.delta > 0 ? '+' : ''}{formatNumber(c.delta)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
