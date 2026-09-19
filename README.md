# AutGRC

A web platform for creating, managing, mapping, reviewing and exporting
cybersecurity governance documentation.

AutGRC generates a complete governance package for a cybersecurity domain —
policy, standard, procedure, guideline, roles, RACI, control matrix and
framework mapping — from a single canonical requirement model. Because every
document is a projection of the same model, they agree with one another by
construction, and the platform can tell you when a human edit has made them
disagree.

---

## What it does

**Generates consistent packages.** Select a domain, the document types you
need and the frameworks you are working to. The generator renders one
requirement model into every document. If the policy says privileged access
requires multi-factor authentication, the standard specifies the method, the
procedure enrols it and the control library records the evidence — from the
same record.

**Keeps numbers in one place.** Frequencies, thresholds and windows live in a
domain parameter set, referenced from document text by placeholder. Changing
the access review frequency in one place changes it in every document.

**Detects governance inconsistency.** The quality engine compares the
commitments stated across documents in a domain against the agreed parameter
set and reports disagreements with both statements quoted:

> ⚠ Governance inconsistency: access review frequency
> PRC-IAM-001 states "annually" where the agreed organisational value is
> "quarterly" and POL-IAM-001 states it correctly.

**Traces every requirement to evidence.** Source requirement → organisational
control → policy clause → standard clause → procedure → evidence, rendered as
a chain and exported for audit.

**Separates source material from generated content.** Framework requirements
are authoritative and read-only. Everything the platform produces is
organisational content, labelled as such at the block level. The platform
never presents generated text as a regulatory requirement. See
[docs/GOVERNANCE.md](docs/GOVERNANCE.md).

---

## Quick start

```bash
npm install
npm run seed        # loads the framework catalogue and a demo data set
npm run dev         # API on :4000, client on :5173
```

Open <http://localhost:5173> and sign in with any demonstration account:

| Account | Role | Can |
| --- | --- | --- |
| `grc@autgrc.demo` | GRC Manager | generate, edit, publish, review |
| `ciso@autgrc.demo` | Approver | approve documents |
| `analyst@autgrc.demo` | Cybersecurity User | author and review |
| `reviewer@autgrc.demo` | Reviewer | review and comment |
| `auditor@autgrc.demo` | Auditor | assess, read the audit log |
| `admin@autgrc.demo` | Administrator | everything, including user management |
| `viewer@autgrc.demo` | Read Only | view and export |

Password for all demonstration accounts: `Autgrc#2025`

For a single-process deployment:

```bash
npm run build && npm start   # serves the API and the client from :4000
```

---

## Try the workflow

1. **Generate** — *Generate* → Identity & Access Management → NCA ECC and
   ISO/IEC 27001 → review the preview and the recorded assumptions → generate.
2. **Inspect consistency** — *Hierarchy* → Identity & Access Management →
   *Check consistency*. The seeded demo data contains one deliberate conflict
   between the IAM Procedure and the IAM Standard.
3. **Trace** — *Frameworks* → NCA ECC → open a requirement with a mapped
   control to see the full chain down to evidence.
4. **Approve and export** — open the policy, submit it for review, approve it
   as `ciso@autgrc.demo`, publish it, then export to Word or PDF.

---

## Architecture

```
client/                 React 18 + Vite, React Router, Recharts
  src/components/       Shell, editor, flow diagram, trace chain, UI primitives
  src/pages/            21 screens
  src/lib/              API client with token refresh, auth context, formatting
  src/styles/           Token-driven design system, light and dark

server/                 Node.js + Express + SQLite (better-sqlite3)
  src/knowledge/        The requirement models — see below
  src/services/         Generation, quality engine, AI, exports, import, search
  src/routes/           17 route modules
  src/middleware/       Authentication, RBAC, audit, error handling
  src/db/               Schema, accessors, seed
  test/                 31 tests
```

### The knowledge base

`server/src/knowledge/` is the substance of the platform.

| File | Contents |
| --- | --- |
| `frameworks.js` | 14 frameworks, 482 requirement references, 89 cross-framework equivalences |
| `domains.js` | 24 cybersecurity domains and the placeholder resolver |
| `req-*.js` | Canonical requirement models: 122 requirements across every domain |
| `roles.js` | 14 cybersecurity roles with authority, approvals and escalations |
| `index.js` | Assembly and a load-time integrity validator |

The validator refuses to start on a broken model: unknown framework
references, placeholders with no parameter, duplicate requirement keys, and
RACI matrices without exactly one accountable role all fail fast.

### How consistency is guaranteed

A domain model holds one requirement set and one parameter set. Each
requirement carries the policy statement, the standard requirement, the
control attributes, the evidence and the framework references. The document
builders project that record into different shapes — so cross-document
agreement is structural, not a matter of authoring discipline.

The quality engine then works in the opposite direction: it reads the
documents back, extracts the commitments they state, and compares them with
the agreed parameter set. That is what catches drift after a human edit.

---

## AI integration

Two providers, selected automatically:

- **`anthropic`** — used when `ANTHROPIC_API_KEY` is set. Claude generates
  and reviews content under a system prompt that forbids inventing regulatory
  requirements or stating any value not supplied in the parameter set.
- **`builtin`** — the default. A deterministic engine driven by the curated
  knowledge base and rule-based rewriting. Requires no network access, so
  every workflow in the platform functions offline.

If a Claude call fails, the request falls back to the built-in engine rather
than failing. Both paths label their output as an AI-generated recommendation.

---

## Security

| Area | Implementation |
| --- | --- |
| Authentication | Short-lived JWT access tokens held in memory; opaque refresh tokens, hashed at rest, rotated on every use and bound to a revocable session row |
| Passwords | bcrypt, length-first policy, breached-pattern block list |
| Brute force | Rate limiting plus account lockout after five failed attempts |
| Authorisation | Permission matrix — routes name a permission, never a role |
| Segregation of duties | A document cannot be approved by its own owner |
| Audit | Every authentication, authorisation decision, document change, generation, export and administrative action, with actor and outcome |
| Input | Zod validation on every write; strict allow-list HTML sanitiser on section bodies |
| Uploads | Extension and MIME checks, size cap, client filename never used on disk |
| Transport | Helmet with a restrictive CSP; `JWT_SECRET` mandatory in production |

## Configuration

Copy `.env.example` to `.env`. `JWT_SECRET` is required in production; in
development a secret is generated and persisted on first run.

## Testing

```bash
npm test          # 31 tests — requires the API running on :4000
```

`server/test/workflow.test.js` exercises the complete path the platform
exists to support: generate → map controls → review → identify inconsistencies
→ approve → export. `server/test/consistency.test.js` covers the quality
engine against an isolated database, including the false-positive cases that
made its earlier revisions unusable.

## Limitations

- Framework catalogue entries are **reference metadata**, not licensed
  reproductions. Verify against the official publication before relying on
  them for regulatory attestation, and import your licensed copies to replace
  them.
- SQLite suits a single-node deployment. A multi-node deployment needs
  PostgreSQL; the data access layer is confined to `server/src/db/`.
- Imported PDFs must contain a text layer. Scanned documents need OCR first.
