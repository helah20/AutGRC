/**
 * Document generation wizard.
 *
 * Step 1 document types · Step 2 domain · Step 3 frameworks ·
 * Step 4 organisation context and agreed values · Step 5 preview and generate.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Field, Select, Badge, Empty, Prose, ProvenanceTag, useToast, Tabs
} from '../components/ui.jsx';
import {
  IconWand, IconCheck, IconChevronRight, IconChevronLeft, IconAlert,
  IconSparkles, IconEye, IconShield, IconBuilding
} from '../components/Icons.jsx';
import { titleCase } from '../lib/format.js';
import { useLabels } from '../i18n/labels.js';

const STEPS = ['Document types', 'Domain', 'Frameworks', 'Context', 'Review & generate'];

const DEFAULT_TYPES = ['policy', 'standard', 'procedure', 'roles', 'raci', 'control_matrix'];

export default function Generator() {
  const labels = useLabels();
  const { data: options, loading, error, reload } = useFetch('/generator/options');
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [docTypes, setDocTypes] = useState(DEFAULT_TYPES);
  const [domainKey, setDomainKey] = useState('');
  const [frameworkCodes, setFrameworkCodes] = useState([]);
  const [classification, setClassification] = useState('internal');
  const [ownerId, setOwnerId] = useState('');
  const [approverId, setApproverId] = useState('');
  const [overrides, setOverrides] = useState({});
  const [domainDetail, setDomainDetail] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewTab, setPreviewTab] = useState('policy');
  const [busy, setBusy] = useState(false);
  const [domainFilter, setDomainFilter] = useState('');

  useEffect(() => {
    if (options?.users?.length && !ownerId) {
      setOwnerId(user?.id || options.users[0].id);
      const approver = options.users.find((u) => u.role === 'approver');
      if (approver) setApproverId(approver.id);
    }
  }, [options, ownerId, user]);

  // Loading a domain resets the agreed values to that domain's defaults.
  useEffect(() => {
    if (!domainKey) { setDomainDetail(null); return; }
    let cancelled = false;
    api.get(`/generator/domains/${domainKey}`)
      .then((d) => {
        if (cancelled) return;
        setDomainDetail(d);
        setOverrides(Object.fromEntries(d.parameters.map((p) => [p.name, p.value])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [domainKey]);

  const domains = useMemo(() => {
    if (!options) return [];
    const term = domainFilter.trim().toLowerCase();
    if (!term) return options.domains;
    return options.domains.filter((d) => `${d.name} ${d.description}`.toLowerCase().includes(term));
  }, [options, domainFilter]);

  if (loading) return <Loading label="Preparing the generator…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const canAdvance = [
    docTypes.length > 0,
    Boolean(domainKey),
    true,                     // frameworks may legitimately be empty
    true,
    Boolean(preview)
  ][step];

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  async function runPreview() {
    setBusy(true);
    try {
      const res = await api.post('/generator/preview', {
        domainKey, docTypes, frameworkCodes, parameterOverrides: overrides, classification
      });
      setPreview(res);
      setPreviewTab(res.documents[0]?.docType || 'policy');
      setStep(4);
    } catch (err) {
      toast.error('Preview failed', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    try {
      const res = await api.post('/generator/generate', {
        domainKey, docTypes, frameworkCodes, parameterOverrides: overrides,
        classification, ownerId: ownerId || null, approverId: approverId || null
      });
      toast.success(
        `Generated ${res.documents.length} documents`,
        `${res.controls} controls and ${res.evidence} evidence requirements created for ${domainDetail?.name}.`
      );
      const policy = res.documents.find((d) => d.doc_type === 'policy') || res.documents[0];
      navigate(policy ? `/documents/${policy.id}` : '/documents');
    } catch (err) {
      toast.error('Generation failed', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-narrow" style={{ margin: '0 auto' }}>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title"><IconWand width={20} height={20} />Document Generator</h1>
          <p className="page-sub">
            Every document in a package renders from one requirement model, so the policy, standard,
            procedure, RACI and control library state the same commitments by construction.
          </p>
        </div>
      </div>

      <div className="wizard-steps">
        {STEPS.map((label, i) => (
          <div key={label} className={`wizard-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
            <span className="wizard-num">{i < step ? <IconCheck width={13} height={13} /> : i + 1}</span>
            <span className="wizard-label">{label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card title="Which documents do you need?" subtitle="Generating the full set keeps the package internally consistent. You can add more later.">
          <div className="grid grid-2">
            {options.documentTypes.map((t) => (
              <label key={t.value} className={`option-card ${docTypes.includes(t.value) ? 'selected' : ''}`}>
                <input type="checkbox" checked={docTypes.includes(t.value)}
                  onChange={() => toggle(docTypes, setDocTypes, t.value)} />
                <span className="option-card-body">
                  <span className="option-card-title">{t.label}</span>
                  <span className="option-card-desc">{t.description}</span>
                </span>
              </label>
            ))}
          </div>
          {!docTypes.includes('policy') && docTypes.includes('standard') && (
            <div className="callout" data-callout="warning">
              <strong>No Policy selected</strong>
              <p>A Standard without a Policy leaves the governance hierarchy incomplete, and the quality engine will raise it as a finding.</p>
            </div>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card title="Select the cybersecurity domain"
          subtitle="The domain determines the requirement model the whole package is generated from."
          actions={
            <input className="input" style={{ width: 200, height: 30 }} placeholder="Filter domains…"
              value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} />
          }>
          <div className="grid grid-3">
            {domains.map((d) => (
              <button key={d.key} type="button"
                className={`option-card ${domainKey === d.key ? 'selected' : ''}`}
                style={{ textAlign: 'left', font: 'inherit' }}
                onClick={() => setDomainKey(d.key)}>
                <span className="option-card-body">
                  <span className="option-card-title">
                    {d.name}
                    <span className="pill mono">{d.short}</span>
                  </span>
                  <span className="option-card-desc">{d.description}</span>
                  <span className="row-tight" style={{ marginTop: 6 }}>
                    <Badge tone="neutral">{d.requirements} requirements</Badge>
                    <Badge tone="neutral">{d.activities} activities</Badge>
                    {d.existingDocuments > 0 && <Badge tone="info">{d.existingDocuments} existing</Badge>}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {!domains.length && <Empty title="No matching domain" >Clear the filter to see all 24 domains.</Empty>}
        </Card>
      )}

      {step === 2 && (
        <>
          <Card title="Select the authoritative sources"
            subtitle="Framework requirements are source material. The generator references them; it never rewrites them.">
            <div className="callout">
              <strong>How sources are treated</strong>
              <p style={{ marginBottom: 0 }}>
                Selected requirements are mapped to the controls this package creates and cited in each policy clause.
                Catalogue entries are reference metadata — verify against the official publication before relying on
                them for regulatory attestation.
              </p>
            </div>
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              {options.frameworks.map((f) => (
                <label key={f.code} className={`option-card ${frameworkCodes.includes(f.code) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={frameworkCodes.includes(f.code)}
                    onChange={() => toggle(frameworkCodes, setFrameworkCodes, f.code)} />
                  <span className="option-card-body">
                    <span className="option-card-title">
                      {f.code}
                      {f.is_mandatory ? <Badge tone="critical">Regulatory</Badge> : <Badge tone="neutral">Framework</Badge>}
                    </span>
                    <span className="option-card-desc">{f.name}</span>
                    <span className="tiny faint" style={{ display: 'block', marginTop: 3 }}>{f.publisher}{f.version ? ` · ${f.version}` : ''}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>
          {!frameworkCodes.length && (
            <div className="callout" data-callout="warning" style={{ marginTop: 12 }}>
              <strong>No source selected</strong>
              <p style={{ marginBottom: 0 }}>Documents will still generate, but without framework traceability or compliance mapping.</p>
            </div>
          )}
        </>
      )}

      {step === 3 && domainDetail && (
        <div className="stack">
          <Card title="Organisation context" subtitle="Used to tailor the generated content. Maintained under Settings.">
            <div className="definition">
              <dt>Organisation</dt><dd>{options.org.org_name || 'Not set'}</dd>
              <dt>Type</dt><dd>{options.org.org_type || <span className="muted">Not set — an assumption will be recorded</span>}</dd>
              <dt>Industry</dt><dd>{options.org.industry || <span className="muted">Not set — an assumption will be recorded</span>}</dd>
              <dt>Size</dt><dd>{options.org.size || <span className="muted">Not set</span>}</dd>
              <dt>Operating model</dt><dd>{options.org.operating_model || <span className="muted">Not set</span>}</dd>
              <dt>Risk appetite</dt><dd>{options.org.risk_appetite || <span className="muted">Not set</span>}</dd>
              <dt>Regulators</dt><dd>{options.org.regulators?.join(', ') || <span className="muted">Not set</span>}</dd>
              <dt>Technology</dt><dd>{options.org.technology_env?.join(', ') || <span className="muted">Not set</span>}</dd>
            </div>
          </Card>

          <Card title="Agreed values"
            subtitle="These are organisational decisions, not regulatory requirements. Each value is used unchanged in every document in the package.">
            <div className="field-row">
              {domainDetail.parameters.map((p) => (
                <Field key={p.name} label={p.label}>
                  <input className="input" value={overrides[p.name] ?? p.value}
                    onChange={(e) => setOverrides((o) => ({ ...o, [p.name]: e.target.value }))} />
                </Field>
              ))}
            </div>
          </Card>

          <Card title="Ownership and classification">
            <div className="field-row">
              <Field label="Document owner" hint="Accountable for content and the review cycle.">
                <Select value={ownerId} onChange={setOwnerId}
                  options={options.users.map((u) => ({ value: u.id, label: `${u.name} — ${u.job_title || labels.role(u.role)}` }))} />
              </Field>
              <Field label="Approver" hint="A document cannot be approved by its own owner.">
                <Select value={approverId} onChange={setApproverId} placeholder="Assign later"
                  options={options.users.filter((u) => ['approver', 'admin'].includes(u.role))
                    .map((u) => ({ value: u.id, label: `${u.name} — ${u.job_title || labels.role(u.role)}` }))} />
              </Field>
              <Field label="Classification">
                <Select value={classification} onChange={setClassification}
                  options={['public', 'internal', 'confidential', 'secret', 'top_secret'].map((v) => ({ value: v, label: titleCase(v) }))} />
              </Field>
            </div>
          </Card>
        </div>
      )}

      {step === 4 && preview && (
        <div className="stack">
          <Card title="Package summary">
            <div className="grid grid-4" style={{ marginBottom: 14 }}>
              <div><div className="kpi-label">Domain</div><div className="strong">{preview.domain.name}</div></div>
              <div><div className="kpi-label">Documents</div><div className="strong">{preview.documents.length}</div></div>
              <div><div className="kpi-label">Controls</div><div className="strong">{preview.controls.length}</div></div>
              <div><div className="kpi-label">Evidence items</div><div className="strong">{preview.controls.reduce((a, c) => a + c.evidenceItems.length, 0)}</div></div>
            </div>
            <div className="row">
              {frameworkCodes.map((code) => <Badge key={code} tone="info">{code}</Badge>)}
              {!frameworkCodes.length && <span className="muted small">No authoritative source selected.</span>}
            </div>
          </Card>

          {preview.assumptions.length > 0 && (
            <Card title="Assumptions recorded"
              subtitle="Where the organisation profile did not supply an input, the generator states the assumption rather than presenting it as fact.">
              <div className="stack-sm">
                {preview.assumptions.map((a, i) => (
                  <div key={i} className="finding low">
                    <div className="finding-head">
                      <span className="finding-title">{a.field}</span>
                      <ProvenanceTag provenance="ai_recommendation" />
                    </div>
                    <div className="finding-detail">{a.assumption}</div>
                    <div className="finding-rec">{a.impact}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Controls to be created" flush>
            <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="data">
                <thead><tr><th>ID</th><th>Control</th><th>Type</th><th>Frequency</th><th>Responsible</th><th>Mapping</th></tr></thead>
                <tbody>
                  {preview.controls.map((c) => (
                    <tr key={c.control_id}>
                      <td className="mono nowrap">{c.control_id}</td>
                      <td><div className="cell-title">{c.name}</div><div className="cell-sub">{c.evidenceItems.length} evidence item(s)</div></td>
                      <td className="nowrap"><Badge tone="neutral">{titleCase(c.control_type)}</Badge></td>
                      <td className="small">{c.frequency}</td>
                      <td className="small nowrap">{c.responsible_role}</td>
                      <td className="tiny mono">{c.mappingLabel || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Document preview" flush>
            <Tabs
              tabs={preview.documents.map((d) => ({ key: d.docType, label: titleCase(d.docType) }))}
              active={previewTab} onChange={setPreviewTab} />
            {preview.documents.filter((d) => d.docType === previewTab).map((d) => (
              <div key={d.docType} style={{ padding: 16 }}>
                <div className="row-tight" style={{ marginBottom: 10 }}>
                  <span className="ref-tag">{d.reference}</span>
                  <span className="strong">{d.title}</span>
                </div>
                <div className="preview-pane">
                  {d.sections.map((s) => (
                    <section key={s.key} style={{ marginBottom: 18 }}>
                      <div className="row-tight" style={{ marginBottom: 6 }}>
                        <h4 style={{ margin: 0 }}>{s.heading}</h4>
                        <ProvenanceTag provenance={s.provenance} />
                      </div>
                      <Prose html={s.body} />
                    </section>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="between" style={{ marginTop: 18 }}>
        <button className="btn" disabled={step === 0 || busy}
          onClick={() => { setStep((s) => Math.max(0, s - 1)); if (step === 4) setPreview(null); }}>
          <IconChevronLeft />Back
        </button>
        <div className="row-tight">
          {step === 4 ? (
            <>
              <button className="btn" onClick={() => { setPreview(null); setStep(3); }} disabled={busy}>
                <IconEye />Change inputs
              </button>
              <button className="btn btn-primary btn-lg" onClick={generate} disabled={busy}>
                {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />Generating…</> : <><IconSparkles />Generate package</>}
              </button>
            </>
          ) : step === 3 ? (
            <button className="btn btn-primary" onClick={runPreview} disabled={busy || !canAdvance}>
              {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />Building preview…</> : <><IconEye />Preview package</>}
            </button>
          ) : (
            <button className="btn btn-primary" disabled={!canAdvance || busy} onClick={() => setStep((s) => s + 1)}>
              Continue<IconChevronRight />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
