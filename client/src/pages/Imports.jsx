import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, DataTable, Modal, Field, Select,
  useToast, Kpi, CoverageBar, Drawer
} from '../components/ui.jsx';
import FindingCard from '../components/FindingCard.jsx';
import { IconUpload, IconCheck, IconX, IconAlert, IconDocument } from '../components/Icons.jsx';
import { formatDate, titleCase, relativeTime } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';
import { useI18n } from '../i18n/index.jsx';

export default function Imports() {
  const labels = useLabels();
  const { t, formatNumber } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const fileRef = useRef(null);
  const { data: uploads, loading, error, reload } = useFetch('/imports');
  const { data: options } = useFetch('/generator/options');
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [promote, setPromote] = useState(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.upload('/imports', form);
      setAnalysis({ uploadId: res.uploadId, ...res.analysis, filename: file.name, sections: res.sections });
      toast.success(t('importsUi.analysed'), t('importsUi.analysedBody', { count: res.analysis.findings.length, coverage: res.analysis.statistics.coverage }));
      reload();
    } catch (err) {
      toast.error(t('importsUi.uploadFailed'), err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const uploadStatus = {
    analyzed: t('importsUi.statusAnalyzed'),
    imported: t('importsUi.statusImported'),
    failed: t('importsUi.statusFailed')
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">{t('imports.title')}</h1>
          <p className="page-sub">
            {t('imports.subtitle')}
          </p>
        </div>
      </div>

      {can('import:write') && (
        <Card style={{ marginBottom: 14 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files?.[0]); }}
            style={{
              border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-strong)'}`,
              borderRadius: 9, padding: '32px 20px', textAlign: 'center',
              background: dragging ? 'var(--accent-soft)' : 'var(--bg-sunken)', transition: 'all .15s'
            }}>
            <IconUpload width={28} height={28} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />
            <div className="strong" style={{ marginBottom: 3 }}>{t('importsUi.dropTitle')}</div>
            <p className="small muted" style={{ maxWidth: '52ch', margin: '0 auto 12px' }}>
              {t('importsUi.dropHint')}
            </p>
            <input ref={fileRef} type="file" hidden accept=".docx,.pdf,.xlsx,.xlsm,.csv,.txt,.md,.html"
              onChange={(e) => upload(e.target.files?.[0])} />
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <><span className="spinner" style={{ width: 14, height: 14 }} />{t('importsUi.analysing')}</> : <><IconUpload />{t('importsUi.chooseFile')}</>}
            </button>
          </div>
        </Card>
      )}

      {analysis && <AnalysisReport analysis={analysis} onPromote={() => setPromote(analysis)} onDismiss={() => setAnalysis(null)} />}

      <Card title={t('importsUi.uploadHistory')} flush>
        {loading && <Loading />}
        {error && <div className="card-body"><ErrorNote error={error} onRetry={reload} /></div>}
        {!loading && !error && (
          <DataTable
            columns={[
              { key: 'filename', header: t('importsUi.columnFile'), render: (u) => (<><div className="cell-title">{u.filename}</div><div className="cell-sub">{Math.round(u.size_bytes / 1024)} KB · {u.uploaded_by_name}</div></>) },
              { key: 'kind', header: t('importsUi.columnDetectedType'), nowrap: true, render: (u) => <Badge tone="neutral">{labels.docType(u.kind, titleCase(u.kind))}</Badge> },
              { key: 'domain_label', header: t('importsUi.columnDetectedDomain'), nowrap: true, render: (u) => (u.domain_key ? labels.domain(u.domain_key, u.domain_label) : u.domain_label) || '—' },
              { key: 'status', header: t('common.status'), nowrap: true, render: (u) => <Badge tone={u.status === 'imported' ? 'ok' : u.status === 'failed' ? 'danger' : 'info'}>{uploadStatus[u.status] || titleCase(u.status)}</Badge> },
              { key: 'created_at', header: t('importsUi.columnUploaded'), nowrap: true, render: (u) => <span className="small">{relativeTime(u.created_at)}</span> }
            ]}
            rows={uploads || []}
            onRowClick={async (u) => {
              try {
                const res = await api.get(`/imports/${u.id}`);
                setViewing({ ...res, upload: u });
              } catch (err) { toast.error(t('importsUi.couldNotLoadAnalysis'), err.message); }
            }}
            empty={<Empty icon={IconUpload} title={t('importsUi.emptyTitle')} >{t('importsUi.emptyBody')}</Empty>}
          />
        )}
      </Card>

      <Drawer open={Boolean(viewing)} onClose={() => setViewing(null)} wide title={viewing?.upload?.filename || ''}>
        {viewing?.analysis && (
          <>
            <AnalysisReport analysis={{ ...viewing.analysis, filename: viewing.upload.filename, uploadId: viewing.upload.id }} embedded
              onPromote={viewing.upload.status !== 'imported' && can('document:create')
                ? () => { setPromote({ ...viewing.analysis, uploadId: viewing.upload.id, filename: viewing.upload.filename }); setViewing(null); }
                : null} />
            <div className="divider" />
            <h4 style={{ marginBottom: 8 }}>{t('importsUi.extractedText')}</h4>
            <pre className="mono tiny" style={{
              whiteSpace: 'pre-wrap', background: 'var(--bg-sunken)', padding: 12,
              borderRadius: 7, maxHeight: 340, overflow: 'auto', margin: 0
            }}>{viewing.excerpt}</pre>
          </>
        )}
      </Drawer>

      <PromoteModal open={Boolean(promote)} onClose={() => setPromote(null)} analysis={promote}
        options={options} onDone={(doc) => { setPromote(null); setAnalysis(null); reload(); navigate(`/documents/${doc.id}`); }} />
    </>
  );
}

function AnalysisReport({ analysis, onPromote, onDismiss, embedded }) {
  const { t, formatNumber } = useI18n();
  const labels = useLabels();
  const stats = analysis.statistics;
  const bySeverity = analysis.findings.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] || 0) + 1 }), {});

  return (
    <Card title={embedded ? t('importsUi.analysis') : t('importsUi.analysisOf', { filename: analysis.filename })}
      subtitle={t('importsUi.assessedAgainst', { domain: analysis.domainName, docType: labels.docType(analysis.docType, titleCase(analysis.docType)) })}
      style={{ marginBottom: 14 }}
      actions={
        <div className="row-tight">
          {onPromote && <button className="btn btn-primary btn-sm" onClick={onPromote}><IconCheck width={13} height={13} />{t('importsUi.importAsDraft')}</button>}
          {onDismiss && <button className="btn btn-ghost btn-sm" onClick={onDismiss}><IconX width={13} height={13} />{t('importsUi.dismiss')}</button>}
        </div>
      }>
      <div className="grid grid-kpi" style={{ marginBottom: 14 }}>
        <Kpi label={t('importsUi.kpiCoverage')} value={`${stats.coverage}%`} progress={stats.coverage}
          tone={stats.coverage >= 70 ? 'ok' : stats.coverage >= 40 ? 'warn' : 'danger'}
          meta={t('counts.covered', { covered: formatNumber(stats.requirementsCovered), total: formatNumber(stats.requirementsExpected) })} />
        <Kpi label={t('importsUi.kpiFindings')} value={analysis.findings.length} tone={bySeverity.high ? 'danger' : bySeverity.medium ? 'warn' : undefined}
          meta={t('importsUi.kpiFindingsMeta', { high: bySeverity.high || 0, medium: bySeverity.medium || 0 })} />
        <Kpi label={t('importsUi.kpiWords')} value={stats.words.toLocaleString()} meta={t('importsUi.kpiSentences', { count: stats.sentences })} />
        <Kpi label={t('importsUi.kpiDocumentControl')} value={
          ['hasOwner', 'hasApprover', 'hasVersion', 'hasReview'].filter((k) => analysis.metadata[k]).length + '/4'
        } tone={analysis.metadata.hasOwner && analysis.metadata.hasApprover ? 'ok' : 'warn'}
          meta={t('importsUi.kpiDocumentControlMeta')} />
      </div>

      {analysis.missing?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 6 }}>{t('importsUi.notAddressed', { count: analysis.missing.length })}</h4>
          <div className="row-tight" style={{ flexWrap: 'wrap' }}>
            {analysis.missing.map((m) => <span key={m.key} className="pill">{m.title}</span>)}
          </div>
        </div>
      )}

      {analysis.covered?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 6 }}>{t('importsUi.addressed', { count: analysis.covered.length })}</h4>
          <div className="row-tight" style={{ flexWrap: 'wrap' }}>
            {analysis.covered.map((m) => <span key={m.key} className="pill" style={{ background: 'var(--ok-soft)', color: 'var(--ok)', borderColor: 'var(--ok)' }}>{m.title}</span>)}
          </div>
        </div>
      )}

      <h4 style={{ marginBottom: 8 }}>{t('importsUi.kpiFindings')}</h4>
      {analysis.findings.length ? (
        <div className="stack-sm">
          {analysis.findings.map((f, i) => <FindingCard key={i} finding={f} />)}
        </div>
      ) : <Empty icon={IconCheck} title={t('importsUi.noIssuesTitle')} >{t('importsUi.noIssuesBody')}</Empty>}
    </Card>
  );
}

function PromoteModal({ open, onClose, analysis, options, onDone }) {
  const { t } = useI18n();
  const labels = useLabels();
  const toast = useToast();
  const [form, setForm] = useState({ title: '', docType: 'policy', domainKey: 'governance', classification: 'internal' });
  const [busy, setBusy] = useState(false);

  // Seed the form from the analysis the first time the dialog opens for it.
  if (open && analysis && form.title === '') {
    setForm({
      title: analysis.filename.replace(/\.[^.]+$/, ''),
      docType: analysis.docType || 'policy',
      domainKey: analysis.domainKey || 'governance',
      classification: 'internal'
    });
  }

  return (
    <Modal open={open} onClose={() => { setForm({ title: '', docType: 'policy', domainKey: 'governance', classification: 'internal' }); onClose(); }}
      title={t('importsUi.promoteTitle')}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={!form.title.trim() || busy} onClick={async () => {
            setBusy(true);
            try {
              const res = await api.post(`/imports/${analysis.uploadId}/promote`, form);
              toast.success(t('importsUi.imported'), t('importsUi.importedBody', { reference: res.document.reference, count: res.sections }));
              setForm({ title: '', docType: 'policy', domainKey: 'governance', classification: 'internal' });
              onDone(res.document);
            } catch (err) { toast.error(t('importsUi.importFailed'), err.message); }
            finally { setBusy(false); }
          }}>{busy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : null}{t('importsUi.import')}</button>
        </>
      }>
      <p className="muted small" style={{ marginBottom: 14 }}>
        {t('importsUi.promoteBody')}
      </p>
      <Field label={t('importsUi.documentTitle')} required>
        <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </Field>
      <div className="field-row">
        <Field label={t('importsUi.documentType')}>
          <Select value={form.docType} onChange={(v) => setForm((f) => ({ ...f, docType: v }))}
            options={['policy', 'standard', 'procedure', 'guideline', 'framework', 'roles', 'raci', 'control_matrix'].map((v) => ({ value: v, label: labels.docType(v, titleCase(v)) }))} />
        </Field>
        <Field label={t('common.domain')}>
          <Select value={form.domainKey} onChange={(v) => setForm((f) => ({ ...f, domainKey: v }))}
            options={(options?.domains || []).map((d) => ({ value: d.key, label: labels.domain(d.key, d.name) }))} />
        </Field>
        <Field label={t('importsUi.classification')}>
          <Select value={form.classification} onChange={(v) => setForm((f) => ({ ...f, classification: v }))}
            options={[
              { value: 'public', label: t('importsUi.classPublic') },
              { value: 'internal', label: t('importsUi.classInternal') },
              { value: 'confidential', label: t('importsUi.classConfidential') },
              { value: 'secret', label: t('importsUi.classSecret') },
              { value: 'top_secret', label: t('importsUi.classTopSecret') }
            ]} />
        </Field>
      </div>
    </Modal>
  );
}
