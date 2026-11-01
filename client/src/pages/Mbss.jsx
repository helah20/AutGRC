/**
 * Minimum Baseline Security Standards: pick the technologies the organisation
 * runs (or a project is introducing), and generate one hardening baseline per
 * technology into the library, with its verification workbook.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Loading, ErrorNote, Badge, StatusBadge, Field, Select, useToast, DataTable } from '../components/ui.jsx';
import { IconWand, IconCheck, IconShield } from '../components/Icons.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function Mbss() {
  const { t, language } = useI18n();
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, reload } = useFetch('/mbss');
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState('');
  const [docLanguage, setDocLanguage] = useState(language === 'ar' ? 'ar' : 'en');
  const [level, setLevel] = useState('1');
  const [versions, setVersions] = useState({});
  const [custom, setCustom] = useState({ name: '', category: 'other', benchmark: '' });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState([]);

  // The technologies in the organisation's environment start ticked.
  const chosen = useMemo(() => selected ?? new Set(data?.suggested || []), [selected, data]);
  const toggle = (key) => {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const shown = data.technologies.filter((x) => !category || x.category === category);
  const canGenerate = can('generate:run');
  const ready = chosen.size > 0 || custom.name.trim().length >= 2;

  async function generate() {
    setBusy(true);
    try {
      const res = await api.post('/mbss/generate', {
        technologies: [...chosen],
        custom: custom.name.trim().length >= 2 ? { name: custom.name.trim(), category: custom.category, benchmark: custom.benchmark.trim() || undefined } : null,
        language: docLanguage,
        level: Number(level),
        benchmarkVersions: Object.fromEntries(Object.entries(versions).filter(([k, v]) => chosen.has(k) && v.trim()))
      });
      setCreated(res.documents);
      toast.success(t('mbss.generated', { count: res.documents.length }));
      setCustom({ name: '', category: 'other', benchmark: '' });
      reload();
    } catch (err) {
      toast.error(t('mbss.generateFailed'), err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('mbss.title')}</h1>
          <p className="page-sub">{t('mbss.subtitle')}</p>
        </div>
      </div>

      <div className="callout" style={{ marginBottom: 14 }}>
        <strong>{t('mbss.sourceTitle')}</strong>
        <p>{t('mbss.sourceBody')}</p>
      </div>

      {created.length > 0 && (
        <Card title={t('mbss.createdTitle')} className="card-gap-b">
          <ul className="stack-sm" style={{ margin: 0, paddingInlineStart: 18 }}>
            {created.map((d) => (
              <li key={d.id}><Link to={`/documents/${d.id}`}><span className="ref-tag">{d.reference}</span> {d.title}</Link></li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t('mbss.catalogueTitle')}
        subtitle={data.suggested.length ? t('mbss.suggestedNote', { count: data.suggested.length }) : t('mbss.noSuggestion')}
        actions={
          <Select value={category} onChange={setCategory} placeholder={t('mbss.allCategories')}
            options={data.categories.map((c) => ({ value: c.key, label: c.name }))} />
        }>
        <div className="mbss-grid">
          {shown.map((x) => (
            <label key={x.key} className={`mbss-card ${chosen.has(x.key) ? 'selected' : ''}`}>
              <input type="checkbox" checked={chosen.has(x.key)} onChange={() => toggle(x.key)} disabled={!canGenerate} />
              <span className="mbss-card-body">
                <span className="strong">{x.name}</span>
                <span className="tiny muted">{x.benchmark}</span>
                <span className="row-tight" style={{ flexWrap: 'wrap', marginTop: 4 }}>
                  <Badge tone="neutral">{t('mbss.itemCount', { count: x.items })}</Badge>
                  {x.level2 > 0 && <Badge tone="neutral">{t('mbss.level2Count', { count: x.level2 })}</Badge>}
                  {x.inEnvironment && <Badge tone="info">{t('mbss.inEnvironment')}</Badge>}
                  {x.existing > 0 && <Badge tone="success">{t('mbss.existing', { count: x.existing })}</Badge>}
                </span>
                {chosen.has(x.key) && (
                  <input className="input" style={{ marginTop: 6 }} placeholder={t('mbss.versionPlaceholder')}
                    aria-label={t('mbss.versionPlaceholder')}
                    value={versions[x.key] || ''} onClick={(e) => e.preventDefault()}
                    onChange={(e) => setVersions((v) => ({ ...v, [x.key]: e.target.value }))} />
                )}
              </span>
            </label>
          ))}
        </div>
      </Card>

      {canGenerate && (
        <Card title={t('mbss.customTitle')} subtitle={t('mbss.customSubtitle')} className="card-gap">
          <div className="field-row">
            <Field label={t('mbss.customName')}>
              <input className="input" value={custom.name} placeholder={t('mbss.customNamePlaceholder')}
                onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} />
            </Field>
            <Field label={t('mbss.customCategory')}>
              <Select value={custom.category} onChange={(v) => setCustom((c) => ({ ...c, category: v }))}
                options={data.categories.map((c) => ({ value: c.key, label: c.name }))} />
            </Field>
            <Field label={t('mbss.customBenchmark')} hint={t('mbss.customBenchmarkHint')}>
              <input className="input" value={custom.benchmark}
                onChange={(e) => setCustom((c) => ({ ...c, benchmark: e.target.value }))} />
            </Field>
          </div>
        </Card>
      )}

      {canGenerate && (
        <Card title={t('mbss.generateTitle')} className="card-gap">
          <div className="field-row">
            <Field label={t('mbss.language')}>
              <Select value={docLanguage} onChange={setDocLanguage}
                options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
            </Field>
            <Field label={t('mbss.level')} hint={t('mbss.levelHint')}>
              <Select value={level} onChange={setLevel}
                options={[{ value: '1', label: t('mbss.level1') }, { value: '2', label: t('mbss.level2') }]} />
            </Field>
          </div>
          <div className="row" style={{ alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary" disabled={!ready || busy} onClick={generate}>
              <IconWand />{t('mbss.generate', { count: chosen.size + (custom.name.trim().length >= 2 ? 1 : 0) })}
            </button>
            <span className="small muted">{t('mbss.generateNote')}</span>
          </div>
        </Card>
      )}

      <Card title={t('mbss.libraryTitle')} flush className="card-gap">
        <DataTable
          rows={data.documents}
          empty={<div className="card-body small muted"><IconShield width={14} height={14} /> {t('mbss.libraryEmpty')}</div>}
          columns={[
            { key: 'reference', header: t('documentsUi.columnReference'), nowrap: true, render: (d) => <Link to={`/documents/${d.id}`} className="ref-tag">{d.reference}</Link> },
            { key: 'title', header: t('documentsUi.columnDocument'), render: (d) => <Link to={`/documents/${d.id}`}>{d.title}</Link> },
            { key: 'language', header: t('documents.language'), minor: true, nowrap: true, render: (d) => (d.language === 'ar' ? 'العربية' : 'English') },
            { key: 'status', header: t('common.status'), nowrap: true, render: (d) => <StatusBadge status={d.status} /> },
            {
              key: 'checklist', header: '', nowrap: true,
              render: (d) => (
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  try { await api.download(`/export/mbss/${d.id}.xlsx`); } catch (err) { toast.error(t('common.exportFailed'), err.message); }
                }}><IconCheck width={12} height={12} />{t('mbss.checklist')}</button>
              )
            }
          ]} />
      </Card>
    </>
  );
}
