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

export default function Imports() {
  const labels = useLabels();
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
      toast.success('Document analysed', `${res.analysis.findings.length} finding(s), ${res.analysis.statistics.coverage}% requirement coverage.`);
      reload();
    } catch (err) {
      toast.error('Upload failed', err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Import and Analyse</h1>
          <p className="page-sub">
            Upload existing policies, procedures, standards, control matrices or framework documents.
            The platform reports duplicate, missing, conflicting and outdated content, missing ownership
            and missing evidence.
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
            <div className="strong" style={{ marginBottom: 3 }}>Drop a document here, or choose a file</div>
            <p className="small muted" style={{ maxWidth: '52ch', margin: '0 auto 12px' }}>
              Word (.docx), PDF, Excel (.xlsx), CSV and plain text are supported, up to 15 MB. Scanned
              documents need OCR applied before upload.
            </p>
            <input ref={fileRef} type="file" hidden accept=".docx,.pdf,.xlsx,.xlsm,.csv,.txt,.md,.html"
              onChange={(e) => upload(e.target.files?.[0])} />
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <><span className="spinner" style={{ width: 14, height: 14 }} />Analysing…</> : <><IconUpload />Choose file</>}
            </button>
          </div>
        </Card>
      )}

      {analysis && <AnalysisReport analysis={analysis} onPromote={() => setPromote(analysis)} onDismiss={() => setAnalysis(null)} />}

      <Card title="Upload history" flush>
        {loading && <Loading />}
        {error && <div className="card-body"><ErrorNote error={error} onRetry={reload} /></div>}
        {!loading && !error && (
          <DataTable
            columns={[
              { key: 'filename', header: 'File', render: (u) => (<><div className="cell-title">{u.filename}</div><div className="cell-sub">{Math.round(u.size_bytes / 1024)} KB · {u.uploaded_by_name}</div></>) },
              { key: 'kind', header: 'Detected type', nowrap: true, render: (u) => <Badge tone="neutral">{titleCase(u.kind)}</Badge> },
              { key: 'domain_label', header: 'Detected domain', nowrap: true, render: (u) => u.domain_label || '—' },
              { key: 'status', header: 'Status', nowrap: true, render: (u) => <Badge tone={u.status === 'imported' ? 'ok' : u.status === 'failed' ? 'danger' : 'info'}>{titleCase(u.status)}</Badge> },
              { key: 'created_at', header: 'Uploaded', nowrap: true, render: (u) => <span className="small">{relativeTime(u.created_at)}</span> }
            ]}
            rows={uploads || []}
            onRowClick={async (u) => {
              try {
                const res = await api.get(`/imports/${u.id}`);
                setViewing({ ...res, upload: u });
              } catch (err) { toast.error('Could not load the analysis', err.message); }
            }}
            empty={<Empty icon={IconUpload} title="Nothing uploaded yet" >Upload an existing governance document to have it analysed against the knowledge base.</Empty>}
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
            <h4 style={{ marginBottom: 8 }}>Extracted text (first 4,000 characters)</h4>
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
  const stats = analysis.statistics;
  const bySeverity = analysis.findings.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] || 0) + 1 }), {});

  return (
    <Card title={embedded ? 'Analysis' : `Analysis of ${analysis.filename}`}
      subtitle={`Assessed against the ${analysis.domainName} requirement model as a ${titleCase(analysis.docType)}.`}
      style={{ marginBottom: 14 }}
      actions={
        <div className="row-tight">
          {onPromote && <button className="btn btn-primary btn-sm" onClick={onPromote}><IconCheck width={13} height={13} />Import as draft</button>}
          {onDismiss && <button className="btn btn-ghost btn-sm" onClick={onDismiss}><IconX width={13} height={13} />Dismiss</button>}
        </div>
      }>
      <div className="grid grid-kpi" style={{ marginBottom: 14 }}>
        <Kpi label="Requirement coverage" value={`${stats.coverage}%`} progress={stats.coverage}
          tone={stats.coverage >= 70 ? 'ok' : stats.coverage >= 40 ? 'warn' : 'danger'}
          meta={`${stats.requirementsCovered} of ${stats.requirementsExpected}`} />
        <Kpi label="Findings" value={analysis.findings.length} tone={bySeverity.high ? 'danger' : bySeverity.medium ? 'warn' : undefined}
          meta={`${bySeverity.high || 0} high · ${bySeverity.medium || 0} medium`} />
        <Kpi label="Words" value={stats.words.toLocaleString()} meta={`${stats.sentences} sentences`} />
        <Kpi label="Document control" value={
          ['hasOwner', 'hasApprover', 'hasVersion', 'hasReview'].filter((k) => analysis.metadata[k]).length + '/4'
        } tone={analysis.metadata.hasOwner && analysis.metadata.hasApprover ? 'ok' : 'warn'}
          meta="Owner, approver, version, review" />
      </div>

      {analysis.missing?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 6 }}>Requirements not addressed ({analysis.missing.length})</h4>
          <div className="row-tight" style={{ flexWrap: 'wrap' }}>
            {analysis.missing.map((m) => <span key={m.key} className="pill">{m.title}</span>)}
          </div>
        </div>
      )}

      {analysis.covered?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 6 }}>Requirements addressed ({analysis.covered.length})</h4>
          <div className="row-tight" style={{ flexWrap: 'wrap' }}>
            {analysis.covered.map((m) => <span key={m.key} className="pill" style={{ background: 'var(--ok-soft)', color: 'var(--ok)', borderColor: 'var(--ok)' }}>{m.title}</span>)}
          </div>
        </div>
      )}

      <h4 style={{ marginBottom: 8 }}>Findings</h4>
      {analysis.findings.length ? (
        <div className="stack-sm">
          {analysis.findings.map((f, i) => <FindingCard key={i} finding={f} />)}
        </div>
      ) : <Empty icon={IconCheck} title="No issues found" >The document addressed every requirement in the model and carries complete document control.</Empty>}
    </Card>
  );
}

function PromoteModal({ open, onClose, analysis, options, onDone }) {
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
      title="Import as a draft document"
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" disabled={!form.title.trim() || busy} onClick={async () => {
            setBusy(true);
            try {
              const res = await api.post(`/imports/${analysis.uploadId}/promote`, form);
              toast.success('Imported', `${res.document.reference} created as a draft with ${res.sections} sections.`);
              setForm({ title: '', docType: 'policy', domainKey: 'governance', classification: 'internal' });
              onDone(res.document);
            } catch (err) { toast.error('Import failed', err.message); }
            finally { setBusy(false); }
          }}>{busy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : null}Import</button>
        </>
      }>
      <p className="muted small" style={{ marginBottom: 14 }}>
        The document is imported as a draft with its extracted sections and its analysis findings, so
        they appear in the review queue. Content is marked as an uploaded source rather than generated.
      </p>
      <Field label="Document title" required>
        <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </Field>
      <div className="field-row">
        <Field label="Document type">
          <Select value={form.docType} onChange={(v) => setForm((f) => ({ ...f, docType: v }))}
            options={['policy', 'standard', 'procedure', 'guideline', 'framework', 'roles', 'raci', 'control_matrix'].map((v) => ({ value: v, label: titleCase(v) }))} />
        </Field>
        <Field label="Domain">
          <Select value={form.domainKey} onChange={(v) => setForm((f) => ({ ...f, domainKey: v }))}
            options={(options?.domains || []).map((d) => ({ value: d.key, label: d.name }))} />
        </Field>
        <Field label="Classification">
          <Select value={form.classification} onChange={(v) => setForm((f) => ({ ...f, classification: v }))}
            options={['public', 'internal', 'confidential', 'secret', 'top_secret'].map((v) => ({ value: v, label: titleCase(v) }))} />
        </Field>
      </div>
    </Modal>
  );
}
