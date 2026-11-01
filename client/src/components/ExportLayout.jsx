/**
 * The parts an exported document carries around its content, as checkboxes.
 * Used for the organisation's default (Settings) and for one export at a time
 * (the document page), so both name the parts the same way.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Modal } from './ui.jsx';
import { IconDownload } from './Icons.jsx';
import { useI18n } from '../i18n/index.jsx';

export const LAYOUT_PARTS = ['cover', 'control', 'approvals', 'versions', 'contents', 'numbering'];
export const FULL_LAYOUT = Object.fromEntries(LAYOUT_PARTS.map((p) => [p, true]));

export function LayoutChoices({ value, onChange, disabled }) {
  const { t } = useI18n();
  return (
    <div className="layout-choices">
      {LAYOUT_PARTS.map((part) => (
        <label key={part} className="check-row">
          <input type="checkbox" checked={Boolean(value[part])} disabled={disabled}
            onChange={(e) => onChange({ ...value, [part]: e.target.checked })} />
          <span>
            <span className="strong">{t(`exportLayout.${part}`)}</span>
            <span className="tiny muted" style={{ display: 'block' }}>{t(`exportLayout.${part}Hint`)}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** The query string that asks the server for this layout. */
export function layoutQuery(layout) {
  return `parts=${LAYOUT_PARTS.filter((p) => layout[p]).join(',')}`;
}

/**
 * Before a Word or PDF export: what the file should carry, starting from the
 * organisation's default. The choice is remembered for the rest of the visit.
 */
let lastChoice = null;

export function ExportDialog({ format, onClose, onExport, hiddenSections = 0 }) {
  const { t } = useI18n();
  const [layout, setLayout] = useState(lastChoice || FULL_LAYOUT);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!format || lastChoice) return;
    api.get('/admin/org/brand').then((b) => { if (b?.layout) setLayout(b.layout); }).catch(() => {});
  }, [format]);

  async function run() {
    setBusy(true);
    lastChoice = layout;
    try { await onExport(format, layout); onClose(); } finally { setBusy(false); }
  }

  return (
    <Modal open={Boolean(format)} onClose={onClose}
      title={t('exportLayout.dialogTitle', { format: format === 'pdf' ? 'PDF' : 'Word' })}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={run}>
            <IconDownload width={13} height={13} />{t('exportLayout.export')}
          </button>
        </>
      }>
      <p className="small muted" style={{ marginTop: 0 }}>{t('exportLayout.dialogLead')}</p>
      <LayoutChoices value={layout} onChange={setLayout} />
      {hiddenSections > 0 && (
        <p className="small muted">{t('exportLayout.hiddenSections', { count: hiddenSections })}</p>
      )}
    </Modal>
  );
}

/** Settings: the organisation's default for what exported documents carry. */
export function LayoutSettings({ canEdit, toast }) {
  const { t } = useI18n();
  const [layout, setLayout] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/org/brand').then((b) => setLayout(b?.layout || FULL_LAYOUT)).catch(() => setLayout(FULL_LAYOUT));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put('/admin/org/export-layout', layout);
      lastChoice = null;
      toast.success(t('exportLayout.saved'));
    } catch (err) {
      toast.error(t('exportLayout.saveFailed'), err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!layout) return null;
  return (
    <div className="stack" style={{ marginTop: 24 }}>
      <div>
        <h3 style={{ marginBottom: 4 }}>{t('exportLayout.settingsTitle')}</h3>
        <p className="muted small" style={{ margin: 0 }}>{t('exportLayout.settingsLead')}</p>
      </div>
      <LayoutChoices value={layout} onChange={setLayout} disabled={!canEdit} />
      {canEdit && (
        <div><button className="btn btn-primary" type="button" disabled={saving} onClick={save}>{t('exportLayout.save')}</button></div>
      )}
    </div>
  );
}
