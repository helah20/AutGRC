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

`POST /frameworks/:code/catalogue` is how they do it: a spreadsheet of the
publication's own controls, analysed first and written only on confirmation,
stamped `user_imported` row by row. It is the only path other than the seed that
writes `framework_requirements`, so rule 1 still holds — no generation path
reaches that table.

Three constraints make it safe to point at source material:

- **Nothing is deleted.** A catalogue row the file does not mention is reported
  and left alone. Control mappings, gap items and crosswalks point at
  requirement ids, and replacing a row rather than updating it would take the
  traceability built on it too. Existing rows are matched by reference and
  updated in place, keeping their ids.
- **A superseded edition cannot be rewritten.** An organisation stays assessed
  against the edition it was certified under, so only the current or draft
  edition accepts an import.
- **A cross-reference column does not become a crosswalk.** A "Relevant
  Standards" cell naming ISO 27001 A.5.15 is somebody's note, not a reviewed
  equivalence. The values are returned as candidates for a person to accept
  through the crosswalk route.

**6. Regulatory text is not translated.**
The platform is bilingual, and the boundary sits in the same place as every
other rule here. Its own words exist in Arabic — the interface, the labels, and
the whole of a generated package: policy clauses, standard requirements,
procedure steps, role definitions, RACI activities, control names and evidence
requirements. A framework requirement does not: rendering an NCA ECC control
into Arabic and presenting it as the framework's own wording would be writing
regulatory text, which rule 1 forbids whatever the language.

The same rule decides what happens to the gap that leaves. The catalogue holds
51 of the 114 controls the NCA ECC entry itself describes, and thirteen of its
subdomains carry no controls at all. The tempting fix — writing the missing
titles — is the prohibited one, because a title composed here and displayed
beside real identifiers is indistinguishable from the publication to everyone
downstream. So the shortfall is reported instead: per framework, with the
subdomains named, on the Frameworks page and in `verify:knowledge`. A gap an
organisation can see is a gap it can close by importing its licensed copy; a
gap filled with plausible text is one nobody knows is there.

An organisation that needs the official Arabic publication imports it, the same
way it replaces any reference catalogue entry with its licensed copy. Until
then the English reference text is shown as English text, bidi-isolated so it
reads correctly inside an Arabic page, and visibly not a translation.

**7. A translation carries the same commitment, not a similar one.**
Arabic and English are two expressions of one decision. A numeric value is
never written into a translated sentence: both languages carry the same
`{{placeholder}}`, and the value comes from the one agreed parameter set, in
Arabic wording for an Arabic document. The knowledge-base check fails if a
translation drops, adds or moves a placeholder, because a policy that commits
the organisation to a quarterly review in one language and an annual review in
the other has two positions and no way to tell which governs.

The same principle applies to a domain with no translation yet: it generates in
English and records the document's language as English. A half-translated
document labelled Arabic would misrepresent what the reader is holding. All
twenty-four domains are now translated, so nothing takes that path in the
shipped set; the fallback and its test both stay, because the next domain added
will take it before its Arabic is written.

It also applies to the checks. The consistency engine reads Arabic through an
Arabic vocabulary written out for the purpose, and the test suite asserts that
no parameter it compares is missing one. An engine that reports a clean result
on documents it could not read is the failure mode that matters here, because
nothing about the output distinguishes it from a real pass.

The same reasoning keeps Arabic out of the PDF export. The PDF engine cannot
join Arabic letters, so an Arabic PDF would be a governance document nobody
could read properly. The export refuses and names the format that works rather
than producing something that looks like a deliverable and is not.


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

### How the same findings are reported per criterion

The 0-100 readiness score says how much work is outstanding. It cannot say what
kind: a domain that loses twenty points because nothing is accountable and a
domain that loses twenty points because two documents state different review
frequencies produce the same number, and they need different people to fix them.

The findings are therefore also reported across five criteria, each fed by the
checks above and scored 1 to 5:

| Criterion | Fed by | Asks |
| --- | --- | --- |
| Policy Alignment | Compliance | Do the adopted framework requirements have controls behind them? |
| Role Clarity | Accountability, ownership | Is every activity accountable to one role, and every document owned? |
| Applicability | Ambiguity, consistency, duplication | Are the obligations measurable, and do the documents agree on them? |
| Governance and Compliance | Auditability, currency | Can each control be evidenced, and is the document itself under control? |
| Completeness of Controls | Completeness | Are the required sections present and populated? |

Every category any check emits is assigned to exactly one criterion, and the
test suite fails if one is left out — a category counted nowhere would quietly
stop mattering. The band is read from the penalty **per document**, so a domain
of eleven documents is comparable with a domain of three; the readiness score
beside it remains the domain total, and the two are derived from one finding
list so they cannot disagree about whether there is a problem.

The five criteria are not the platform's invention, and the profile is not a
regulatory rating. It is labelled as derived from the platform's own checks
wherever it is shown. Its provenance and the reasoning behind adopting it are in
[RESEARCH-ALIGNMENT.md](RESEARCH-ALIGNMENT.md).

### Human assessment is recorded per reviewer, not averaged

The lifecycle records that a review happened and what it decided. It does not
record what the reviewer thought, so two reviewers who reach opposite judgements
leave identical traces.

Any account holding `assessment:write` — administrator, GRC manager, reviewer,
approver or auditor — may rate a document 1 to 5 on the same five criteria. The
ratings are held separately, bound to the document version they were given
against, and the platform reports the **spread** as well as the mean. Where the
panel spans two bands or more on any criterion, the assessment is flagged as
materially divergent rather than presented as a score.

Two rules constrain it:

- **A rating is not a vote.** Revising your own rating replaces it; it never
  adds a second voice to the panel.
- **A document cannot be assessed by its own owner**, for the same reason it
  cannot be approved by its own owner. A self-rating is not an independent
  assessment, and averaging it in would raise the figure without adding a
  judgement.

The platform's own checks and the panel are shown side by side and neither is
reconciled into the other. A gap of two bands means one of them is measuring the
wrong thing, and which one it is is worth knowing.

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
- **A document cannot be assessed by its own owner.** The same reasoning applied
  to the five-criterion assessment.
- **Published documents are read-only.** They must be moved to Under Revision
  first, so the version in force is never edited in place.
