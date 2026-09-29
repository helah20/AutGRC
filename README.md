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

**Reports quality per dimension, not as one number.** The same findings are
split across five criteria — policy alignment, role clarity, applicability,
governance and compliance, completeness of controls — and scored 1 to 5 per
document, so a weak dimension is visible instead of disappearing into a
readiness percentage. Reviewers can record their own rating against the same
five criteria; the ratings are held separately and the **spread** is reported,
because a panel that disagrees by two bands has not agreed on anything the mean
would tell you. See [docs/RESEARCH-ALIGNMENT.md](docs/RESEARCH-ALIGNMENT.md).

**Traces every requirement to evidence.** Source requirement → organisational
control → policy clause → standard clause → procedure → evidence, rendered as
a chain and exported for audit.

**Holds a risk register, not a risk column.** Risks are projected from the
same requirement model as the policies, scored on a 5×5 matrix, and treated by
the controls generated from that same requirement. A residual rating nobody has
assessed is reported as unassessed rather than as a reduction somebody
achieved.

**Closes the loop.** Evidence carries the artefact, not just the requirement
for one. Findings, gaps and risks carry corrective actions with an owner and a
date. Notifications tell the named person, and the My Work queue offers only
actions they can actually take.

**Works in Arabic.** The interface, navigation, labels, statuses and generated
documents are available in Arabic, with the layout mirrored through logical CSS
properties rather than a stylesheet of overrides. Numbers, dates and plurals
follow the reader's locale. Latin strings inside Arabic prose — a control
reference, a clause citation — are bidi-isolated so they stay readable. See
[Arabic and right-to-left support](#arabic-and-right-to-left-support).

**Separates source material from generated content.** Framework requirements
are authoritative and read-only. Everything the platform produces is
organisational content, labelled as such at the block level. The platform
never presents generated text as a regulatory requirement. See
[docs/GOVERNANCE.md](docs/GOVERNANCE.md).

---

## Run it on your machine

Node.js 20 or newer is the only prerequisite. Everything else is local — the
database is a single file on your disk, and nothing is sent anywhere.

```bash
git clone https://github.com/helah20/AutGRC.git
cd AutGRC
git checkout claude/grc-documentation-platform-qovrtf
npm run setup       # checks your toolchain, installs, builds and seeds
npm start           # http://localhost:4000
```

[docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md) covers Windows, where your data
lives, backups, and troubleshooting.

Sign in with any demonstration account:

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

While changing the code, `npm run dev` runs the API on `:4000` and a
hot-reloading client on <http://localhost:5173>.

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
  test/                 137 tests
```

### The knowledge base

`server/src/knowledge/` is the substance of the platform.

| File | Contents |
| --- | --- |
| `frameworks.js` | 14 frameworks, 482 requirement references, 89 cross-framework equivalences |
| `domains.js` | 24 cybersecurity domains and the placeholder resolver |
| `req-*.js` | Canonical requirement models: 218 requirements across 24 domains, every one traced to at least one framework requirement |
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
| Second factor | TOTP (RFC 6238) with hashed single-use recovery codes; enforceable per role, and the password alone buys a challenge token the API refuses |
| Account recovery | Administrator-issued temporary password, shown once; the account can do nothing but change it |
| Segregation of duties | A document cannot be approved or assessed by its own owner, evidence cannot be verified by whoever collected it, a corrective action cannot be verified by whoever did it, and a risk cannot be accepted by its owner |
| Audit | Every authentication, authorisation decision, document change, generation, export and administrative action, with actor and outcome |
| Input | Zod validation on every write; strict allow-list HTML sanitiser on section bodies |
| Uploads | Extension and MIME checks, size cap, client filename never used on disk |
| Transport | Helmet with a restrictive CSP; `JWT_SECRET` mandatory in production |

## Configuration

Copy `.env.example` to `.env`. `JWT_SECRET` is required in production; in
development a secret is generated and persisted on first run.

## Testing

```bash
npm test          # 98 offline tests (1 suite skipped); 137 with a server on :4000
npm run check     # static checks the bundler does not catch
```

The end-to-end suite needs a running server and reports itself as skipped
without one. Both run in CI on every push, against a server the workflow
starts.

`server/test/workflow.test.js` exercises the complete path the platform exists
to support: generate → map controls → review → identify inconsistencies →
approve → export, plus evidence collection, notifications, the second factor,
the risk register and the bilingual export.

`server/test/consistency.test.js` covers the quality engine against an isolated
database, including the false-positive cases that made its earlier revisions
unusable. `server/test/totp.test.js` checks the second factor against the
RFC 6238 vectors — a home-grown implementation that disagrees with the
published algorithm would refuse every real authenticator app.
`server/test/risk.test.js` checks that a requirement the knowledge base calls
medium risk produces a medium risk, because a register that inflates every
entry by a band is one nobody believes.

`server/test/scorecard.test.js` asserts the property the quality profile depends
on and nothing in its output would reveal: that every finding category the engine
or the importer can emit is counted against exactly one criterion. A category
mapped to nothing would score nothing, and the profile would look better than the
evidence supports. It also checks that a single reviewer's rating is never
reported as reviewers agreeing.

`server/test/framework-import.test.js` covers the catalogue import, which writes
to the one table the platform treats as authoritative — so it asserts the
destructive things it must not do: no row is deleted, existing requirement ids
survive so the mappings built on them survive, and a column naming other
frameworks does not become a crosswalk.

`npm run check` catches a React hook used without being imported or obtained.
Vite compiles that happily and it only fails when the component renders, which
is how a page that worked in English threw in Arabic.

## Arabic and right-to-left support

Switch language from the globe in the top bar, or from the login screen before
signing in. The choice persists, and direction is applied before the first
paint so a page never renders left-to-right and then flips.

**What is in Arabic.** The whole interface: navigation, page headings, table
columns, buttons, filters, empty states, toasts, form labels and help text.
Also the values the API returns as enumerations — domains, lifecycle statuses,
document types, roles, coverage, risk bands, treatments, finding categories —
which are re-labelled on the client from the key the API sends, so no endpoint
needs to know the reader's language.

**Generated documents in Arabic.** Twenty-one domains — governance, risk
management, security awareness, identity and access, privileged access, asset
management, incident management, vulnerability management, third-party security,
security operations, security monitoring, logging & monitoring, backup &
recovery, business continuity, disaster recovery, cryptography, endpoint
security, network security, application security, secure SDLC and change
management — generate a complete Arabic package: every policy clause, standard
requirement, procedure step, decision branch, escalation condition, role
definition, RACI activity, control name, KPI and piece of required evidence.
The document furniture around them is Arabic too: headings, table columns,
connective prose, the cover page, the document control and approval tables,
version history, contents, headers and footers.

Choosing Arabic for a domain that has no translation yet generates it in
English and records the document's language as English, rather than labelling a
half-translated document as Arabic.

An agreed numeric value is never written into the translated sentence. Both
languages carry the same `{{placeholder}}`, and the value arrives from the one
agreed parameter set — in Arabic wording for an Arabic document, and always the
same commitment. `npm run --workspace server verify:knowledge` fails if a
translation drops, adds or moves a placeholder.

**What stays in English, and why.** The catalogue holds each publisher's own
wording for a framework requirement. Rendering an NCA ECC control into Arabic
here and presenting it as the framework's text would be inventing a regulatory
requirement, which this platform does not do; import the official Arabic
publication to replace the reference entries. Framework references, control
identifiers and acronyms that are read as words in Arabic technical speech —
CISO, SOC, RACI, FIDO2 — also stay as they are.

All of these appear bidi-isolated inside Arabic pages, so English reads
left-to-right in its own block instead of having its punctuation moved to the
wrong end.

**The quality engine reads Arabic.** The cross-document consistency check finds
a commitment stated in one document that disagrees with another. It attributes a
sentence to a parameter through that parameter's subject, and English subjects
are derived from the parameter's name, so Arabic ones are written out
explicitly — including the frequency and duration vocabulary, Arabic-Indic
digits and units such as "يوم عمل". A planted contradiction is caught in each of
every translated domain, and `arabicTopicGaps` reports any parameter the
check compares but has no Arabic subject for, so the engine cannot quietly stop
reading a language.

**Word exports in Arabic. PDF does not.** Word does Arabic shaping and bidi
reordering itself, so `?lang=ar` on a Word export produces a genuine RTL
document — `<w:bidi/>` on paragraphs, `<w:rtl/>` on runs, an Arabic font — that
the recipient can edit. The PDF engine writes glyphs in code-point order with
no shaping, so an Arabic PDF would arrive with its letters unjoined; the export
returns 501 and says so rather than producing it. Export to Word and let Word
save the PDF.

---

## Limitations

- Framework catalogue entries are **reference metadata**, not licensed
  reproductions. Verify against the official publication before relying on
  them for regulatory attestation, and import your licensed copies to replace
  them — *Frameworks* → open a framework → **Import licensed copy**, which
  accepts a spreadsheet of the publication's own controls, previews what it
  would change, and deletes nothing.
- SQLite suits a single-node deployment. A multi-node deployment needs
  PostgreSQL; the data access layer is confined to `server/src/db/`.
- Imported PDFs must contain a text layer. Scanned documents need OCR first.
- Requirement depth varies by domain, from 8 clauses to 12. The shape of the
  model is uniform; the amount of detail a domain warrants is not, and no domain
  is padded to a target.
- Arabic generation covers twenty-one of the twenty-four domains. The other
  three generate in English and say so; the machinery is in place and each is a
  content addition under `server/src/knowledge/ar/`. Framework requirement text
  stays in the publisher's wording in any language, for the reason in
  [Arabic and right-to-left support](#arabic-and-right-to-left-support).
- Arabic PDF export is not supported. The PDF engine cannot shape Arabic
  script; Word export handles Arabic correctly and can save as PDF.
