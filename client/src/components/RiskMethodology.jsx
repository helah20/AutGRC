/**
 * Settings: the organisation's risk methodology and reminder schedule.
 *
 * The matrix, the meaning of each level, the highest rating that may be
 * accepted, how often a risk of each rating is reviewed and how far control
 * effectiveness lowers likelihood are decided here once and applied to every
 * risk. The server refuses a matrix that ranks a worse cell lower.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card, Loading, ErrorNote, Field, Select, Badge, useToast } from './ui.jsx';
import { RISK_TONE } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

const RATINGS = ['low', 'medium', 'high', 'critical'];
const LEVELS = [1, 2, 3, 4, 5];

export function RiskMethodologySettings({ canEdit }) {
  const { t, formatNumber, language } = useI18n();
  const word = (level) => (language === 'ar' ? level.label_ar : level.label) || level.label;
  const labels = useLabels();
  const toast = useToast();
  const [m, setM] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [auto, setAuto] = useState(null);
  const [days, setDays] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/admin/risk-methodology'), api.get('/admin/automation')])
      .then(([res, a]) => {
        setM(res.methodology); setDefaults(res.defaults);
        setAuto(a.automation); setDays(a.automation.reminderDays.join(', '));
      })
      .catch(setError);
  }, []);

  if (error) return <ErrorNote error={error} />;
  if (!m || !auto) return <Loading />;

  const setCell = (impact, likelihood, value) => setM((x) => ({
    ...x, matrix: x.matrix.map((row, i) => (i === impact - 1 ? row.map((cell, l) => (l === likelihood - 1 ? value : cell)) : row))
  }));
  const setLevel = (kind, index, key, value) => setM((x) => ({
    ...x, [kind]: x[kind].map((level, i) => (i === index ? { ...level, [key]: value } : level))
  }));

  async function saveMethodology() {
    setSaving(true);
    try {
      const res = await api.put('/admin/risk-methodology', m);
      setM(res.methodology);
      toast.success(t('methodology.saved'), t('methodology.savedBody'));
    } catch (err) { toast.error(t('methodology.saveFailed'), err.message); } finally { setSaving(false); }
  }

  const parsedDays = days.split(/[,،\s]+/).map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 1 && d <= 365);
  async function saveAutomation() {
    try {
      const res = await api.put('/admin/automation', { reminderDays: parsedDays, escalateAfterDays: Number(auto.escalateAfterDays) });
      setAuto(res.automation); setDays(res.automation.reminderDays.join(', '));
      toast.success(t('methodology.remindersSaved'));
    } catch (err) { toast.error(t('methodology.saveFailed'), err.message); }
  }

  return (
    <div className="stack">
      <Card title={t('methodology.matrixTitle')} subtitle={t('methodology.matrixSubtitle')}>
        <div className="table-wrap">
          <table className="data methodology-matrix">
            <thead>
              <tr>
                <th>{t('methodology.impactLikelihood')}</th>
                {LEVELS.map((l) => <th key={l} className="nowrap">{formatNumber(l)} · {word(m.likelihood[l - 1])}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...LEVELS].reverse().map((i) => (
                <tr key={i}>
                  <th className="nowrap">{formatNumber(i)} · {word(m.impact[i - 1])}</th>
                  {LEVELS.map((l) => {
                    const value = m.matrix[i - 1][l - 1];
                    return (
                      <td key={l} className={`methodology-cell tone-${value}`}>
                        {canEdit
                          ? <select className="select" aria-label={t('methodology.cellLabel', { impact: i, likelihood: l })} value={value} onChange={(e) => setCell(i, l, e.target.value)}>
                            {RATINGS.map((r) => <option key={r} value={r}>{labels.rating(r)}</option>)}
                          </select>
                          : <Badge tone={RISK_TONE[value]}>{labels.rating(value)}</Badge>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t('methodology.rulesTitle')} subtitle={t('methodology.rulesSubtitle')}>
        <div className="field-row">
          <Field label={t('methodology.acceptableUpTo')} hint={t('methodology.acceptableUpToHint')}>
            <Select value={m.acceptableUpTo} disabled={!canEdit} onChange={(v) => setM((x) => ({ ...x, acceptableUpTo: v }))}
              options={RATINGS.map((r) => ({ value: r, label: labels.rating(r) }))} />
          </Field>
        </div>
        <h4>{t('methodology.reviewCycle')}</h4>
        <div className="field-row">
          {[...RATINGS].reverse().map((r) => (
            <Field key={r} label={labels.rating(r)} hint={t('methodology.days')}>
              <input className="input" type="number" min={1} max={1095} disabled={!canEdit} value={m.reviewDays[r]}
                onChange={(e) => setM((x) => ({ ...x, reviewDays: { ...x.reviewDays, [r]: Number(e.target.value) } }))} />
            </Field>
          ))}
        </div>
        <h4>{t('methodology.effectiveness')}</h4>
        <p className="small muted" style={{ marginTop: 0 }}>{t('methodology.effectivenessHint')}</p>
        <div className="field-row">
          {['ineffective', 'partially_effective', 'effective'].map((e) => (
            <Field key={e} label={labels.effectiveness(e)} hint={t('methodology.levels')}>
              <input className="input" type="number" min={0} max={4} disabled={!canEdit} value={m.effectivenessReduction[e]}
                onChange={(ev) => setM((x) => ({ ...x, effectivenessReduction: { ...x.effectivenessReduction, [e]: Number(ev.target.value) } }))} />
            </Field>
          ))}
        </div>
      </Card>

      {['likelihood', 'impact'].map((kind) => (
        <Card key={kind} title={t(`methodology.${kind}Scale`)} subtitle={t('methodology.scaleSubtitle')}>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>#</th><th>{t('methodology.labelEn')}</th><th>{t('methodology.labelAr')}</th><th>{t('methodology.criterionEn')}</th><th>{t('methodology.criterionAr')}</th></tr></thead>
              <tbody>
                {m[kind].map((level, idx) => (
                  <tr key={level.value}>
                    <td className="mono">{formatNumber(level.value)}</td>
                    {['label', 'label_ar', 'description', 'description_ar'].map((key) => (
                      <td key={key}>
                        {canEdit
                          ? <input className="input" dir={key.endsWith('_ar') ? 'rtl' : 'ltr'} value={level[key]} maxLength={key.startsWith('label') ? 40 : 300}
                            aria-label={`${kind} ${level.value} ${key}`} onChange={(e) => setLevel(kind, idx, key, e.target.value)} />
                          : <span className="small" dir={key.endsWith('_ar') ? 'rtl' : 'ltr'}>{level[key]}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {canEdit && (
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-primary" disabled={saving} onClick={saveMethodology}>{t('methodology.save')}</button>
          <button className="btn" onClick={() => setM(defaults)}>{t('methodology.restoreDefaults')}</button>
        </div>
      )}

      <Card title={t('methodology.remindersTitle')} subtitle={t('methodology.remindersSubtitle')}>
        <div className="field-row">
          <Field label={t('methodology.reminderDays')} hint={t('methodology.reminderDaysHint')}>
            <input className="input" disabled={!canEdit} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <Field label={t('methodology.escalateAfter')} hint={t('methodology.escalateAfterHint')}>
            <input className="input" type="number" min={0} max={90} disabled={!canEdit} value={auto.escalateAfterDays}
              onChange={(e) => setAuto((a) => ({ ...a, escalateAfterDays: e.target.value }))} />
          </Field>
        </div>
        <p className="small muted">{t('methodology.remindersCover')}</p>
        {canEdit && <button className="btn btn-primary btn-sm" disabled={!parsedDays.length} onClick={saveAutomation}>{t('methodology.saveReminders')}</button>}
      </Card>
    </div>
  );
}
