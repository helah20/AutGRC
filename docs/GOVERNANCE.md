# Governance rules

These rules constrain what AutGRC is permitted to produce. They are enforced
in code, not left to the author of a prompt.

## The distinction that matters

A governance platform that blurs the line between a regulator's requirement
and its own generated text is worse than no platform at all: it produces
documents that read as authoritative and cannot survive an audit. AutGRC
keeps six categories separate, and every stored object carries its category
in a `provenance` column.

| Provenance | Meaning | Who may create it |
| --- | --- | --- |
| `regulatory_requirement` | A requirement imposed by a regulator | Seed or licensed import only |
| `framework_guidance` | A control or clause from an adopted framework | Seed or licensed import only |
| `organizational_policy` | The organisation's own mandatory position | Generator or user |
| `organizational_standard` | The organisation's own measurable requirements | Generator or user |
| `procedure` | Operational steps defined by the organisation | Generator or user |
| `implementation_guidance` | Advisory guidance creating no obligation | Generator or user |
| `ai_recommendation` | Generated content awaiting human review | Generator or AI |
| `user_input` | Authored or edited by a platform user | User |
| `uploaded_source` | Extracted from an uploaded document | Import |

The first two are **source material**. The rest are **organisational
content**. The platform never promotes the second into the first.

## Rules the code enforces

**1. The generator does not write regulatory text.**
`framework_requirements` rows are created only by the seed or by an import
the customer performs from their licensed copy. No generation path writes to
that table. The generator may only *reference* those rows — by identifier, in
a policy clause citation or a control mapping.

**2. Generated content is labelled at the block level.**
Every `document_sections` row carries its provenance, rendered in the
interface as a tag beside the section heading, and every section records the
source references it derives from.

**3. No value is invented.**
Numeric commitments come from the domain parameter set. When the Claude
provider is used, the system prompt forbids stating any frequency, threshold,
duration or percentage that was not supplied, and requires an unresolved
placeholder plus a recorded assumption instead. The load-time validator
rejects any requirement text containing a placeholder with no matching
parameter, so a document can never render with a silently empty commitment.

**4. Assumptions are stated, never implied.**
Where the organisation profile does not supply an input the generator needed,
an explicit assumption is recorded on the package — the field, what was
assumed and what it affects — shown in the wizard preview before generation
and retained on every document afterwards.

**5. A human edit changes the provenance.**
Editing a section whose provenance is `ai_recommendation` moves it to
`user_input`. The record shows who last had responsibility for the wording.

**6. Source status is never overstated.**
Catalogue entries are stamped `source_status: 'reference'` and every view
that presents them carries the notice:

> Reference metadata compiled for control-mapping purposes. Control
> identifiers and titles must be verified against the official publication
> before being relied upon for regulatory attestation.

`source_status` accepts `verified_official` and `user_imported` for customers
who replace the catalogue with their licensed copies.

## Document hierarchy

```
Framework / Regulation     source material, read-only
        ↓
Requirements               source material, read-only
        ↓
Organisational Controls    organisational content
        ↓
Policy                     what must be achieved
        ↓
Standard                   the measurable requirements, and the agreed values
        ↓
Procedure                  how it is carried out
        ↓
Work Instruction           platform-specific detail
        ↓
Evidence                   what demonstrates it happened
```

Each tier traces to the one above through `document_links` and the control's
`policy_id`, `standard_id` and `procedure_id`. The quality engine reports a
policy with no standard or no procedure as an incomplete chain, because a
position that is never translated into measurable requirements cannot be
evidenced.

## What the quality engine checks

| Check | Question |
| --- | --- |
| Completeness | Are all required sections present and populated? Is there an owner, approver and review date? |
| Consistency | Do the documents in this domain state the same commitments? |
| Accountability | Does every activity have exactly one accountable role, and every control a responsible one? |
| Auditability | Can each control be evidenced, and is there an indicator? |
| Compliance | Do the mapped framework requirements have controls behind them? |
| Ambiguity | Are obligations measurable, or do they rely on "regularly", "appropriately", "as needed"? |

### How the consistency check works

For each parameter in the domain model, the engine derives the topic words
from the parameter name, finds the prose sentences across every document in
the domain that discuss that topic, extracts the frequency or duration each
states, and reports any that disagree with the agreed value — quoting both
the conflicting statement and a correct one.

Precision matters more than recall here: a tool that raises false conflicts
is switched off. Four rules keep it honest, each with a regression test:

- **Prose only.** Control matrix rows list each control's own frequency,
  which legitimately differs from a domain parameter. Table-derived text is
  excluded.
- **Word boundaries.** Topic words match at a word boundary, so `priv` does
  not match inside `privileged` and `account` does not match inside
  `accountable`.
- **Every topic word.** A sentence must mention all of a parameter's topic
  words, so the privileged-access parameter does not claim every sentence
  about access review.
- **No single-word topics.** A parameter reducing to one generic word such as
  `review` is not compared at all, because it cannot be matched precisely
  enough to assert a conflict.

Across the 24 seeded domains the engine reports exactly one consistency
finding: the conflict the seed deliberately introduces.

## Access segregation

Routes name a permission, never a role, so the matrix in
`server/src/middleware/auth.js` is the single place access is decided.

Two rules are enforced beyond the matrix:

- **A document cannot be approved by its own owner.** Authorship and approval
  must be separate people.
- **Published documents are read-only.** They must be moved to Under Revision
  first, so the version in force is never edited in place.
