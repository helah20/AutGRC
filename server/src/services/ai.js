/**
 * AI provider abstraction.
 *
 * Two providers are supported:
 *
 *  - `anthropic`  calls the Claude Messages API when ANTHROPIC_API_KEY is set.
 *  - `builtin`    a deterministic engine that uses the curated knowledge base
 *                 and rule-based rewriting. It requires no network access and
 *                 is the default, so every workflow in the platform functions
 *                 without an API key.
 *
 * Whichever provider runs, output is labelled as AI-generated organisational
 * content. The platform never promotes generated text to a regulatory
 * requirement: authoritative source material only ever comes from the
 * framework catalogue.
 */

import config from '../config.js';
import { q, nowIso, toJson } from '../db/index.js';
import { id } from '../utils/ids.js';
import { htmlToText, sanitiseHtml, h, joinBlocks } from './html.js';
import { DOMAIN_MODELS, domainName, resolveText } from '../knowledge/index.js';

export function activeProvider() {
  return config.ai.provider === 'anthropic' && config.ai.apiKey ? 'anthropic' : 'builtin';
}

export function providerInfo() {
  const provider = activeProvider();
  return {
    provider,
    model: provider === 'anthropic' ? config.ai.model : 'builtin-knowledge-engine',
    configured: provider === 'anthropic',
    description: provider === 'anthropic'
      ? `Claude (${config.ai.model}) generates and reviews content, grounded in the platform knowledge base.`
      : 'The built-in knowledge engine generates and reviews content deterministically from the curated requirement models. Set ANTHROPIC_API_KEY to enable Claude-assisted generation.'
  };
}

function recordRun({ kind, scopeType, scopeId, input, output, assumptions, durationMs, status, userId, provider, model }) {
  q.run(
    `INSERT INTO ai_runs (id, kind, provider, model, scope_type, scope_id, input, output, assumptions, duration_ms, status, user_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id('air'), kind, provider, model, scopeType || null, scopeId || null,
    toJson(input), toJson(output), toJson(assumptions || []), durationMs || 0,
    status || 'success', userId || null, nowIso()
  );
}

// ------------------------------------------------------ anthropic client ---

async function callClaude({ system, messages, maxTokens }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const res = await fetch(`${config.ai.baseUrl}/v1/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.ai.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.ai.model,
        max_tokens: maxTokens || config.ai.maxTokens,
        system,
        messages
      })
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Claude API ${res.status}: ${body.slice(0, 500)}`);
    }
    const data = await res.json();
    return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the first JSON object or array from a model response. */
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  for (let end = candidate.length; end > start; end -= 1) {
    const slice = candidate.slice(start, end);
    try { return JSON.parse(slice); } catch { /* keep shrinking */ }
  }
  return null;
}

const GOVERNANCE_SYSTEM = `You are a senior cybersecurity GRC architect drafting governance documentation.

Absolute rules:
1. Never invent, paraphrase or restate a regulatory or framework requirement as if it were authoritative text. Framework requirements are supplied to you as context only; refer to them by identifier.
2. Everything you write is ORGANISATIONAL content — the organisation's own policy, standard or procedure. It is never a regulatory requirement.
3. Never state a frequency, threshold, duration or percentage that was not supplied to you in the parameter set. If a value is needed and not supplied, write the placeholder {{parameterName}} and list it as an assumption.
4. Write normative statements using "shall". Avoid "regularly", "periodically", "appropriately", "as needed", "where applicable", "timely" and similar unmeasurable wording — always state a measurable value.
5. Every requirement you write must be capable of being evidenced. If you cannot name the evidence, do not write the requirement.
6. Use British English and a formal corporate register. Do not use marketing language.
7. Return only the structure requested, with no preamble or commentary.`;

// ------------------------------------------------------------- rewriting --

const REWRITE_RULES = [
  [/\bregularly\b/gi, 'at least quarterly'],
  [/\bperiodically\b/gi, 'at least annually'],
  [/\bfrom time to time\b/gi, 'at least annually'],
  [/\bin a timely manner\b/gi, 'within 5 business days'],
  [/\bin a timely fashion\b/gi, 'within 5 business days'],
  [/\btimely\b/gi, 'within the defined service level'],
  [/\bas soon as possible\b/gi, 'without delay and no later than 24 hours'],
  [/\bas needed\b/gi, 'when the defined trigger conditions are met'],
  [/\bas appropriate\b/gi, 'in line with the criteria defined in the Standard'],
  [/\bappropriately\b/gi, 'in line with the requirements of the Standard'],
  [/\bwhere applicable\b/gi, 'where the conditions defined in the Standard apply'],
  [/\bwhere possible\b/gi, 'unless a documented technical constraint prevents it'],
  [/\badequate\b/gi, 'sufficient to meet the requirements of the Standard'],
  [/\bstrong passwords?\b/gi, 'passwords meeting the length and composition requirements of the Standard'],
  [/\bbest effort\b/gi, 'the committed service level'],
  [/\bshould be\b/gi, 'shall be'],
  [/\bmust be\b/gi, 'shall be'],
  [/\bwill be\b/gi, 'shall be'],
  [/\bneeds to be\b/gi, 'shall be'],
  [/\bis required to\b/gi, 'shall'],
  [/\bit is recommended that\b/gi, 'the organisation shall']
];

function deterministicRewrite(text, mode) {
  let out = text;
  const changes = [];

  if (mode === 'improve' || mode === 'compliance') {
    for (const [re, replacement] of REWRITE_RULES) {
      out = out.replace(re, (match) => {
        changes.push({ from: match, to: replacement, reason: 'Replaced unmeasurable or non-normative wording with an auditable formulation.' });
        return replacement;
      });
    }
  }

  if (mode === 'shorten') {
    out = out
      .replace(/\b(in order to)\b/gi, 'to')
      .replace(/\b(due to the fact that|owing to the fact that)\b/gi, 'because')
      .replace(/\b(at this point in time|at the present time)\b/gi, 'now')
      .replace(/\b(in the event that)\b/gi, 'if')
      .replace(/\b(for the purpose of)\b/gi, 'to')
      .replace(/\b(with regard to|with respect to)\b/gi, 'regarding')
      .replace(/\b(a number of)\b/gi, 'several')
      .replace(/\s{2,}/g, ' ');
    changes.push({ from: 'verbose constructions', to: 'concise equivalents', reason: 'Reduced wordiness without changing the obligation.' });
  }

  if (mode === 'formalise') {
    out = out
      .replace(/\bcan't\b/gi, 'cannot').replace(/\bdon't\b/gi, 'do not')
      .replace(/\bwon't\b/gi, 'will not').replace(/\bit's\b/gi, 'it is')
      .replace(/\bwe\b/gi, 'the organisation').replace(/\bour\b/gi, "the organisation's")
      .replace(/\byou\b/gi, 'the user');
    changes.push({ from: 'informal register', to: 'formal corporate register', reason: 'Governance documents address roles, not individuals in the second person.' });
  }

  return { text: out, changes };
}

// -------------------------------------------------------------- exports ----

/**
 * Rewrite or improve a block of text.
 * @param {'improve'|'shorten'|'formalise'|'compliance'} mode
 */
export async function rewriteText({ text, mode = 'improve', context = {}, userId = null, scopeId = null }) {
  const started = Date.now();
  const provider = activeProvider();
  const plain = htmlToText(text);

  if (provider === 'anthropic') {
    const instructions = {
      improve: 'Rewrite the passage so that every obligation is normative ("shall") and measurable. Do not introduce any numeric value that is not present in the supplied parameters.',
      shorten: 'Rewrite the passage more concisely without removing any obligation or changing any value.',
      formalise: 'Rewrite the passage in a formal corporate register, addressing roles rather than individuals.',
      compliance: 'Rewrite the passage so each statement is auditable and can be evidenced. Flag any statement that cannot be evidenced.'
    }[mode];

    try {
      const raw = await callClaude({
        system: GOVERNANCE_SYSTEM,
        maxTokens: 4000,
        messages: [{
          role: 'user',
          content: `${instructions}\n\nContext:\n${JSON.stringify(context).slice(0, 4000)}\n\nPassage:\n"""\n${plain}\n"""\n\nReturn JSON: {"text": "<rewritten passage as plain paragraphs separated by blank lines>", "changes": [{"from":"","to":"","reason":""}], "notes": ["..."]}`
        }]
      });
      const parsed = extractJson(raw);
      if (parsed?.text) {
        const result = {
          provider, model: config.ai.model, mode,
          html: toParagraphs(parsed.text),
          changes: parsed.changes || [],
          notes: parsed.notes || [],
          provenance: 'ai_recommendation'
        };
        recordRun({ kind: 'rewrite', scopeType: 'document', scopeId, input: { mode, text: plain.slice(0, 2000) }, output: result, durationMs: Date.now() - started, userId, provider, model: config.ai.model });
        return result;
      }
    } catch (err) {
      // Fall through to the deterministic engine rather than failing the request.
      recordRun({ kind: 'rewrite', scopeType: 'document', scopeId, input: { mode }, output: { error: err.message }, durationMs: Date.now() - started, status: 'fallback', userId, provider, model: config.ai.model });
    }
  }

  const { text: rewritten, changes } = deterministicRewrite(plain, mode);
  const result = {
    provider: 'builtin', model: 'builtin-knowledge-engine', mode,
    html: toParagraphs(rewritten),
    changes,
    notes: changes.length
      ? ['Replacements use the platform wording rules. Review each substituted value against the agreed Standard before accepting.']
      : ['No unmeasurable wording was detected in this passage.'],
    provenance: 'ai_recommendation'
  };
  recordRun({ kind: 'rewrite', scopeType: 'document', scopeId, input: { mode, text: plain.slice(0, 2000) }, output: result, durationMs: Date.now() - started, userId, provider: 'builtin', model: 'builtin-knowledge-engine' });
  return result;
}

function toParagraphs(text) {
  return sanitiseHtml(
    String(text)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${p.replace(/\n/g, ' ')}</p>`)
      .join('')
  );
}

/**
 * Ask the provider for additional review findings on top of the engine's.
 * Returns findings in the same shape the engine produces.
 */
export async function aiReview({ document, sections, engineFindings, userId = null }) {
  const started = Date.now();
  const provider = activeProvider();
  const model = DOMAIN_MODELS[document.domain_key];

  if (provider === 'anthropic') {
    try {
      const body = sections.map((s) => `## ${s.heading}\n${htmlToText(s.body).slice(0, 2500)}`).join('\n\n');
      const raw = await callClaude({
        system: GOVERNANCE_SYSTEM,
        maxTokens: 6000,
        messages: [{
          role: 'user',
          content:
            `Review this ${document.doc_type.replace('_', ' ')} for a cybersecurity GRC audience.\n\n` +
            `Document: ${document.reference} — ${document.title}\nDomain: ${domainName(document.domain_key)}\n\n` +
            `The deterministic engine already reported these findings; do not repeat them:\n` +
            `${engineFindings.map((f) => `- [${f.category}] ${f.title}`).join('\n') || '- none'}\n\n` +
            `Document content:\n${body.slice(0, 40000)}\n\n` +
            `Identify substantive governance weaknesses a regulator or auditor would raise. ` +
            `Return JSON: {"findings":[{"category":"completeness|consistency|accountability|auditability|compliance|ambiguity","severity":"critical|high|medium|low|info","title":"","detail":"","location":"","recommendation":""}],"summary":""}`
        }]
      });
      const parsed = extractJson(raw);
      if (parsed?.findings) {
        const findings = parsed.findings
          .filter((f) => f.title && f.detail)
          .map((f) => ({
            category: ['completeness', 'consistency', 'accountability', 'auditability', 'compliance', 'ambiguity', 'duplication', 'currency', 'ownership'].includes(f.category) ? f.category : 'completeness',
            severity: ['critical', 'high', 'medium', 'low', 'info'].includes(f.severity) ? f.severity : 'medium',
            title: String(f.title).slice(0, 200),
            detail: String(f.detail).slice(0, 2000),
            location: String(f.location || document.reference).slice(0, 200),
            recommendation: String(f.recommendation || '').slice(0, 1000),
            source: 'ai'
          }));
        const result = { provider, model: config.ai.model, findings, summary: parsed.summary || '' };
        recordRun({ kind: 'review', scopeType: 'document', scopeId: document.id, input: { reference: document.reference }, output: { count: findings.length }, durationMs: Date.now() - started, userId, provider, model: config.ai.model });
        return result;
      }
    } catch (err) {
      recordRun({ kind: 'review', scopeType: 'document', scopeId: document.id, input: {}, output: { error: err.message }, durationMs: Date.now() - started, status: 'fallback', userId, provider, model: config.ai.model });
    }
  }

  // Built-in reviewer: knowledge-base coverage checks the engine does not do.
  const findings = [];
  if (model) {
    const text = sections.map((s) => htmlToText(s.body)).join('\n').toLowerCase();
    const missing = model.requirements.filter((r) => {
      const words = r.title.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
      if (!words.length) return false;
      const hits = words.filter((w) => text.includes(w)).length;
      return hits / words.length < 0.4;
    });
    if (document.doc_type === 'policy' || document.doc_type === 'standard') {
      for (const r of missing.slice(0, 6)) {
        findings.push({
          category: 'completeness', severity: 'medium', source: 'ai',
          title: `Requirement not addressed: ${r.title}`,
          detail: `The ${domainName(document.domain_key)} requirement model includes "${r.title}", which does not appear to be addressed in this document. Leaving it out creates a gap against ${Object.entries(r.refs).map(([c, l]) => `${c} ${l.join('/')}`).join(', ')}.`,
          location: document.reference,
          recommendation: `Add a statement covering: ${r.controlName}.`
        });
      }
    }
  }
  const summary = findings.length
    ? `The built-in reviewer identified ${findings.length} requirement${findings.length === 1 ? '' : 's'} from the domain model that this document does not appear to address.`
    : 'The built-in reviewer found no unaddressed requirements from the domain model in this document.';

  const result = { provider: 'builtin', model: 'builtin-knowledge-engine', findings, summary };
  recordRun({ kind: 'review', scopeType: 'document', scopeId: document.id, input: { reference: document.reference }, output: { count: findings.length }, durationMs: Date.now() - started, userId, provider: 'builtin', model: 'builtin-knowledge-engine' });
  return result;
}

/**
 * Suggest control mappings for a framework requirement that has none.
 * The built-in path scores candidate controls by domain and term overlap.
 */
export async function suggestMappings({ requirement, controls, userId = null }) {
  const started = Date.now();
  const provider = activeProvider();

  const scored = controls
    .map((c) => {
      const reqWords = new Set(`${requirement.title} ${requirement.statement || ''}`.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
      const ctlWords = new Set(`${c.name} ${c.description || ''} ${c.requirement || ''}`.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
      let overlap = 0;
      for (const w of reqWords) if (ctlWords.has(w)) overlap += 1;
      const domainBonus = c.domain_key === requirement.domain_key ? 4 : 0;
      return { control: c, score: overlap + domainBonus };
    })
    .filter((x) => x.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const suggestions = scored.map((x) => ({
    controlId: x.control.id,
    controlRef: x.control.control_id,
    controlName: x.control.name,
    coverage: x.score >= 8 ? 'covered' : 'partial',
    confidence: x.score >= 10 ? 'high' : x.score >= 6 ? 'medium' : 'low',
    rationale: `${x.control.control_id} addresses the same subject matter in the ${domainName(x.control.domain_key)} domain (term overlap score ${x.score}).`,
    provenance: 'ai_recommendation'
  }));

  recordRun({
    kind: 'map', scopeType: 'framework_requirement', scopeId: requirement.id,
    input: { ref: requirement.ref }, output: { count: suggestions.length },
    durationMs: Date.now() - started, userId, provider: 'builtin', model: 'builtin-knowledge-engine'
  });
  return { provider: 'builtin', suggestions };
}

/**
 * Generate additional narrative for a section, grounded in the domain model.
 * Used by the editor's "AI draft" action.
 */
export async function draftSection({ domainKey, docType, sectionKey, heading, instruction, params = {}, userId = null, scopeId = null }) {
  const started = Date.now();
  const provider = activeProvider();
  const model = DOMAIN_MODELS[domainKey];

  if (provider === 'anthropic') {
    try {
      const grounding = model
        ? {
            domain: model.name,
            objectives: model.objectives,
            parameters: params,
            requirements: model.requirements.map((r) => ({ title: r.title, policy: resolveText(r.policy, params), standard: resolveText(r.standard, params) }))
          }
        : { domain: domainKey };
      const raw = await callClaude({
        system: GOVERNANCE_SYSTEM,
        maxTokens: 4000,
        messages: [{
          role: 'user',
          content:
            `Draft the "${heading}" section of a ${docType.replace('_', ' ')} for the ${domainName(domainKey)} domain.\n\n` +
            `${instruction ? `Additional instruction: ${instruction}\n\n` : ''}` +
            `Grounding data (use only values present here):\n${JSON.stringify(grounding).slice(0, 20000)}\n\n` +
            `Return JSON: {"html":"<valid HTML using only p, ul, ol, li, table, thead, tbody, tr, th, td, h4, strong>","assumptions":["..."]}`
        }]
      });
      const parsed = extractJson(raw);
      if (parsed?.html) {
        const result = { provider, model: config.ai.model, html: sanitiseHtml(parsed.html), assumptions: parsed.assumptions || [], provenance: 'ai_recommendation' };
        recordRun({ kind: 'generate', scopeType: 'document', scopeId, input: { sectionKey, heading }, output: { length: result.html.length }, durationMs: Date.now() - started, userId, provider, model: config.ai.model });
        return result;
      }
    } catch (err) {
      recordRun({ kind: 'generate', scopeType: 'document', scopeId, input: { sectionKey }, output: { error: err.message }, durationMs: Date.now() - started, status: 'fallback', userId, provider, model: config.ai.model });
    }
  }

  // Built-in: assemble from the requirement model rather than inventing text.
  const reqs = model?.requirements || [];
  const html = joinBlocks(
    h.p(`The following is drafted from the ${domainName(domainKey)} requirement model. Review and adjust before approval.`),
    h.ul(reqs.map((r) => resolveText(docType === 'standard' ? r.standard : r.policy, params)))
  );
  const result = {
    provider: 'builtin', model: 'builtin-knowledge-engine',
    html: sanitiseHtml(html),
    assumptions: ['Content is assembled from the curated domain requirement model. Values come from the agreed parameter set and have not been independently derived.'],
    provenance: 'ai_recommendation'
  };
  recordRun({ kind: 'generate', scopeType: 'document', scopeId, input: { sectionKey, heading }, output: { length: result.html.length }, durationMs: Date.now() - started, userId, provider: 'builtin', model: 'builtin-knowledge-engine' });
  return result;
}
