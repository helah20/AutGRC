/**
 * The identity exported files carry: logo, colours and type.
 *
 * Curated choices rather than a free colour wheel. Each palette is a primary
 * that carries white text and an accent for headings, checked for contrast on
 * the server; each font option pairs a Latin face with an Arabic one that
 * ships with Windows. The preview draws a cover and a table header
 * with the same derived tints the exports use, so what is chosen here is what
 * the Word, PDF, Excel and PowerPoint files show.
 */

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useT } from '../i18n/index.jsx';
import { Loading, ErrorNote, Field, useToast } from './ui.jsx';
import { IconUpload, IconTrash, IconSave } from './Icons.jsx';

const MAX_LOGO = 512 * 1024;

/** The colour `amount` of the way to white, as the server derives it. */
function tint(hex, amount) {
  const n = parseInt(hex, 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0')).join('');
}

export default function BrandSettings({ canEdit, orgName }) {
  const t = useT();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/admin/org/brand');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (data) setForm({ palette: data.palette, primary: data.primary, accent: data.accent, font: data.font, logo: data.logo, logoChanged: false });
  }, [data]);

  if (loading || !form) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const colours = form.palette === 'custom'
    ? { primary: form.primary, accent: form.accent }
    : data.palettes[form.palette];
  const fonts = data.fonts[form.font];
  const primary = `#${colours.primary}`;
  const accent = `#${colours.accent}`;

  function pickLogo(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { toast.error(t('brand.logoType')); return; }
    if (file.size > MAX_LOGO) { toast.error(t('brand.logoSize')); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result, logoChanged: true }));
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      const body = { palette: form.palette, font: form.font };
      if (form.palette === 'custom') Object.assign(body, { primary: form.primary, accent: form.accent });
      if (form.logoChanged) body.logo = form.logo || null;
      await api.put('/admin/org/brand', body);
      toast.success(t('brand.saved'));
      reload();
    } catch (err) {
      toast.error(t('brand.saveFailed'), err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="brand-settings">
      <div className="brand-controls stack">
        <p className="muted" style={{ margin: 0 }}>{t('brand.intro')}</p>

        <Field label={t('brand.logo')} hint={t('brand.logoHint')}>
          <div className="brand-logo-row">
            <div className="brand-logo-box">
              {form.logo ? <img src={form.logo} alt={t('brand.logo')} /> : <span className="muted">{t('brand.noLogo')}</span>}
            </div>
            {canEdit && (
              <div className="btn-group">
                <button className="btn" type="button" onClick={() => fileRef.current?.click()}><IconUpload />{t('brand.upload')}</button>
                {form.logo && (
                  <button className="btn" type="button" onClick={() => setForm((f) => ({ ...f, logo: null, logoChanged: true }))}>
                    <IconTrash />{t('brand.remove')}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden
                  onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
            )}
          </div>
        </Field>

        <Field label={t('brand.palette')} hint={t('brand.paletteHint')}>
          <div className="brand-swatches">
            {Object.entries(data.palettes).map(([key, p]) => (
              <button key={key} type="button" disabled={!canEdit}
                className={`brand-swatch ${form.palette === key ? 'on' : ''}`}
                onClick={() => setForm((f) => ({ ...f, palette: key }))}>
                <span className="brand-chips"><i style={{ background: `#${p.primary}` }} /><i style={{ background: `#${p.accent}` }} /></span>
                {t(`brand.palette_${key}`)}
              </button>
            ))}
            <button type="button" disabled={!canEdit}
              className={`brand-swatch ${form.palette === 'custom' ? 'on' : ''}`}
              onClick={() => setForm((f) => ({ ...f, palette: 'custom' }))}>
              <span className="brand-chips"><i style={{ background: `#${form.primary}` }} /><i style={{ background: `#${form.accent}` }} /></span>
              {t('brand.palette_custom')}
            </button>
          </div>
        </Field>

        {form.palette === 'custom' && (
          <div className="field-row">
            <Field label={t('brand.primary')} hint={t('brand.primaryHint')}>
              <input type="color" className="brand-colour" disabled={!canEdit} value={`#${form.primary}`}
                onChange={(e) => setForm((f) => ({ ...f, primary: e.target.value.slice(1).toUpperCase() }))} />
            </Field>
            <Field label={t('brand.accent')} hint={t('brand.accentHint')}>
              <input type="color" className="brand-colour" disabled={!canEdit} value={`#${form.accent}`}
                onChange={(e) => setForm((f) => ({ ...f, accent: e.target.value.slice(1).toUpperCase() }))} />
            </Field>
          </div>
        )}

        <Field label={t('brand.font')} hint={t('brand.fontHint')}>
          <div className="brand-fonts">
            {Object.entries(data.fonts).map(([key, f]) => (
              <label key={key} className={`brand-font ${form.font === key ? 'on' : ''}`}>
                <input type="radio" name="brand-font" checked={form.font === key} disabled={!canEdit}
                  onChange={() => setForm((x) => ({ ...x, font: key }))} />
                <span className="brand-font-sample" style={{ fontFamily: `'${f.arabic}', '${f.latin}', sans-serif` }}>
                  {t('brand.sample')}
                </span>
                <span className="brand-font-name">{f.latin} / {f.arabic}</span>
                <span className="muted brand-font-note">{t(`brand.font_${key}`)}</span>
              </label>
            ))}
          </div>
        </Field>

        {canEdit && (
          <div>
            <button className="btn btn-primary" type="button" disabled={saving} onClick={save}><IconSave />{t('brand.save')}</button>
          </div>
        )}
      </div>

      {/* The cover and a table as the exports draw them. */}
      <div className="brand-preview" aria-label={t('brand.preview')}>
        <div className="brand-preview-label">{t('brand.preview')}</div>
        <div className="brand-page" style={{ fontFamily: `'${fonts.arabic}', '${fonts.latin}', sans-serif` }}>
          {form.logo && <img className="brand-page-logo" src={form.logo} alt="" />}
          <div className="brand-page-org" style={{ color: accent }}>{orgName}</div>
          <div className="brand-page-kicker">{t('brand.kicker')}</div>
          <div className="brand-page-rule" style={{ background: primary }} />
          <div className="brand-page-title" style={{ color: primary }}>{t('brand.sampleTitle')}</div>
          <div className="brand-page-meta">POL-IAM-001 · 1.0</div>
          <table className="brand-page-table">
            <thead><tr>{[t('brand.colInput'), t('brand.colStep'), t('brand.colOutput')].map((h) => (
              <th key={h} style={{ background: tint(colours.primary, 0.93), color: primary, borderColor: tint(colours.primary, 0.75) }}>{h}</th>
            ))}</tr></thead>
            <tbody><tr>{[t('brand.cellInput'), t('brand.cellStep'), t('brand.cellOutput')].map((c) => (
              <td key={c} style={{ borderColor: tint(colours.primary, 0.75) }}>{c}</td>
            ))}</tr></tbody>
          </table>
          <div className="brand-page-lane">
            <span className="brand-lane-name" style={{ background: primary }}>{t('brand.laneName')}</span>
            <span className="brand-lane-box" style={{ background: tint(colours.accent, 0.55), borderColor: accent }}>1</span>
            <span className="brand-lane-arrow">→</span>
            <span className="brand-lane-box" style={{ background: tint(colours.accent, 0.55), borderColor: accent }}>2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
