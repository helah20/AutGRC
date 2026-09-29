# Research alignment: an expert review of *Automating Cybersecurity Governance*

A critical review of Alharthi, Alyami, Almasabi, Muthanna and Alburaiki,
**"Automating Cybersecurity Governance: An AI-Driven System for Customized
Security Policy Development"**, supervised by Dr. Abdulwahab Alazeb, Najran
University, Department of Information Systems, 26 August 2026, produced under
National Cybersecurity Authority Grant Agreement **CRPG-25-1063** — and a
decision, idea by idea, about what AutGRC should adopt from it.

---

## How to read this document

**Citations.** Every claim attributed to the paper carries a section and the
**printed page number** as it appears in the document body, not the PDF page
index — `(§5.6, p. 19)`. Tables are cited by their own number and page,
`(Table 9, p. 29)`.

**Evidence and recommendation are separated.** Two markers appear throughout:

> **PAPER** — something the paper states, measures or reports. Traceable to a
> section or page. Nothing is attributed to the paper that it does not say.

> **ASSESSMENT** — my own professional judgement as a GRC practitioner. Not
> the paper's finding, and not a requirement of any standard.

**Nothing here is a regulatory requirement.** Requirements from NCA ECC-2:2024,
ISO/IEC 27001:2022, ISO/IEC 27005 and ISO 22301 remain what they were: source
material in the catalogue, read-only, referenced and never rewritten. Ideas
derived from this paper are organisational content, and where one was
implemented it is labelled as the platform's own. The governance rules that
enforce that separation are in [GOVERNANCE.md](GOVERNANCE.md) and were not
relaxed to accommodate anything in this review.

**Where the paper's system is stronger than AutGRC, this says so. Where AutGRC
is stronger, it says that too, with the evidence.** An idea is not adopted
because it is novel; it is adopted when it produces a measurable improvement
in something AutGRC currently does worse.

---

## Assumptions

Where I did not have the information, the assumption is recorded here rather
than invented in the text.

| # | Assumption | Why it matters | If wrong |
| --- | --- | --- | --- |
| A1 | The paper is the reviewer's own research or closely related to it: the first author's name matches the repository owner (`helah20`), and AutGRC implements a substantially overlapping scope. | Determines whether "the current approach" means AutGRC, a separate consulting practice, or both. | The mapping in Part 3 still holds against AutGRC as the artefact; only the framing of Part 8 changes. |
| A2 | AutGRC as it stands in this repository is the current approach. I assessed the code, not a described process. | Every "current approach" cell in Part 6 is evidenced by a file, not by report. | Where an offline consulting process exists outside the platform, its steps are unknown to me and Part 6 understates what is already in place. |
| A3 | The consulting engagement model — who drafts, who reviews, who signs off — follows the roles already in the platform: GRC Manager drafts, Reviewer and Auditor review, CISO/Approver approves. | Determines the owner column in the roadmap. | Reassign the owner column; no other part changes. |
| A4 | The paper's system and AutGRC are not intended to merge into one product. They are treated as two implementations of one problem, and ideas move between them. | Keeps the recommendation about adopting ideas rather than adopting architecture. | If a merge is intended, Part 8 section C would need to be revisited as a migration question rather than a rejection. |
| A5 | No licensed copy of ECC-2:2024, ISO/IEC 27001:2022 or any other publication is held in the repository. The catalogue is reference metadata and is stamped as such. | Determines that the catalogue import is a capability gap and not a content gap. | If licensed copies are held, Part 7 Phase 1 becomes a data-loading task rather than a build task. |

---

## Part 1 — Review of the paper

### 1.1 Objective and problem addressed

> **PAPER.** Cybersecurity policy development is described as "a high-stakes
> governance activity" requiring accurate interpretation of evolving
> regulation, organisational context and consistent documentation, where
> "conventional manual workflows can be time-consuming and dependent on
> specialist expertise, while general-purpose generative models may produce
> plausible but unsupported statements" (§1.1, p. 2). The paper names two
> failure modes it sets out to address: **knowledge obsolescence**, the drift
> of a model's fixed training corpus away from the current regulatory
> landscape, and **hallucination**, "the generation of plausible but unfounded
> content" (§1, p. 1). Its stated objective is a Retrieval-Augmented
> Generation framework producing "complete, structured policy documents that
> are both regulatory-compliant and organizationally contextualized" (§4,
> p. 6), grounded primarily in NCA requirements and ISO/IEC 27001:2022, and
> traceable back to source controls.

Three research questions are posed (§1.2, p. 2): the effect of model
capability, retrieval depth, embedding strategy, vector database, dataset
format and temperature on output quality (RQ1); the generalisability of an
agentic RAG architecture across domains and across generation and audit modes
(RQ2); and whether the framework can produce complete, structured policies
while maintaining framework alignment and traceability to source controls
(RQ3).

### 1.2 Methodology

> **PAPER.** Five stages (§5, p. 6): collection of governance documents and
> standards; cleaning and restructuring; implementation of the agentic RAG
> retrieval pipeline; experimentation across configurations; and evaluation
> against NCA and ISO coverage.

**Corpus.** The full published NCA control set — ECC, TCC, OSMACC, DCC, CCC
and OTCC — supplemented with ISO/IEC 27001, merged into a single structured
dataset in Excel "in order to facilitate cross-framework analysis", with
controls "normalized into common terminological categories and aligned across
shared cybersecurity capability areas" and duplicates "resolved through
consolidation" (§5.2, pp. 9-10). The paper is explicit that ISO/IEC standards
"are not freely accessible and typically require purchase or institutional
access, which may limit their direct use in building publicly available or
reproducible datasets" (§5.1, p. 7).

**The five-field schema.** Preprocessing was manual, "because it is the most
reliable method for handling this type of data". Legislative content was
reformulated into policy statements, one per row, each record carrying five
fields: **Policy Statement, Purpose, Relevant Standards, Control Number and
Capability Name** (§5.3.1, p. 10). The resulting corpus was published on Kaggle
(§5.3.1, p. 11).

**Ingestion.** An event-driven n8n pipeline watching Google Drive, with six
stages: file event detection, metadata management, download and format routing,
aggregation and summarisation, schema inference and update, and vector
embedding and storage (§5.3.2, pp. 11-12). Three PostgreSQL tables support it —
a document table with embeddings, a document metadata table, and a document
rows table holding Excel data row by row "enabling precise searches directly
through SQL without requiring embeddings" (§5.3.3, p. 12).

**Retrieval and generation.** OpenAI GPT models via the n8n OpenAI Chat Model
node, chosen for instruction following, long context, native n8n integration
and embedding consistency (§5.4.2, pp. 13-14). Embeddings with
`text-embedding-ada-002` into a shared semantic space, retrieved by cosine
similarity (§5.4.2-5.4.3, p. 14) — though the experimental table records
`text-embedding-3-small` for every GPT configuration and `all-MiniLM-L6-v2` for
the open-source ones (Table 3, p. 18). Supabase with pgvector provides
approximate nearest-neighbour search, storing control number, capability name,
associated standard and source document identifier as metadata (§5.4.3, p. 14).
Postgres conversation memory supports multi-turn refinement (§5.4.4, p. 14).

**Agentic RAG.** Rather than a fixed retrieve-then-generate chain, "the LLM
acts as a reasoning unit capable of making autonomous decisions regarding which
tools to invoke", with three tools — List Documents, Get File Contents and
Query Document Rows — plus vector search for general queries (§5.4.5, pp. 14-15).

**The three prompt constraints** (§5.4.6, p. 17) are the paper's clearest
governance contribution:

| Constraint | What it requires |
| --- | --- |
| Retrieval-Based Grounding | All policy statements based solely on retrieved control content; any statement not supported by retrieved context "is not permitted" |
| Formatting Constraint | A standardised structure: title, purpose, scope, policy statements linked to control identifiers, and a references section citing the selected controls |
| Traceability Constraint | Each policy section linked to its source by control number and capability name, "enabling clear traceability for auditors and Governance, Risk, and Compliance (GRC) analysts" |

**Experiments.** Twenty configurations in two phases (§5.5, pp. 17-19). Phase 1,
EXP-01 to EXP-15, varied model, embedding model, vector store, Top-k,
temperature and dataset format, all generating an Access Management Policy
evaluated against ECC section 2-2 controls. Phase 2, EXP-16 to EXP-20, applied
the EXP-15 architecture to Asset Management (ECC 2-1), Human Resources Security
(1-9), Cloud Security (4-2), Cybersecurity Requirements in BCM (3-1) and — in a
different mode — an audit of an existing Email Security Policy against ECC 2-4
(Table 4, p. 19).

**Evaluation.** Two stages (§5.6, pp. 19-20). LangSmith LLM-as-a-Judge scored
outputs on **Alignment, Coverage, Groundedness, Traceability and Completeness**,
1 to 5. Three domain experts — a GRC consultant with seven years' experience, a
senior GRC consultant and certified lead auditor, and a CISO with fourteen
years' experience — independently scored all twenty outputs on **Policy
Alignment with Best Practices and Regulatory Standards, Clarity of Roles and
Responsibilities, Applicability and Ease of Implementation, Governance and
Compliance Level, and Completeness of Controls and Procedures**, 1 to 5, for a
maximum of 25. Descriptive statistics, Krippendorff's α with an ordinal distance
function, Fleiss' κ, and an exploratory Spearman comparison against the
LLM-as-a-Judge scores on seven matched outputs were then applied (§5.6, p. 20).

### 1.3 Key concepts

| Concept | Where | In one line |
| --- | --- | --- |
| Knowledge obsolescence | §1, p. 1 | A model's fixed corpus drifts away from the regulation it is meant to reflect |
| Hallucination as a compliance risk | §7.1, p. 32 | In policy, a plausible false statement causes audit gaps, violations and legal liability |
| Retrieval-Augmented Generation | §1, p. 1 | Change what the model can see at generation time rather than what it was trained on |
| Agentic RAG | §5.4.5, p. 14 | The model chooses which retrieval tool to use per query instead of a fixed chain |
| Normalisation across frameworks | §5.1, p. 7 | "privileged user", "elevated access" and "administrator" must become one term or the model produces unclear content |
| The five-field record | §5.3.1, p. 10 | One control per row: Policy Statement, Purpose, Relevant Standards, Control Number, Capability Name |
| Each record as one chunk | §7.2, p. 33 | A regulatory requirement is treated as a self-contained retrieval unit |
| Capability matching | §6.1.6, p. 24 | The request is embedded, capabilities are matched semantically, and their controls are retrieved |
| Organisational contextualisation | §6.1.2, p. 22 | Sector, size, activities and data types are inputs to generation, not decoration |
| Dual evaluation | §5.6, pp. 19-20 | An automated evaluator for reference-based scoring, a human panel for practical quality |
| Hybrid governance | §6.9.2, p. 32 | LLMs accelerate drafting and mapping; approval and customisation stay human |

### 1.4 Findings

> **PAPER.** Model capability dominated. Small open-source models scored 13.3
> to 17.7 of 25; Mistral variants 17-19; GPT-4.1-mini 19-20; GPT-5-mini 20-23
> (§6.3, p. 25 and Table 7, p. 26). The best configuration, **EXP-13**
> (gpt-5-mini, `text-embedding-3-small`, Supabase, Top-k 3, temperature 0.5,
> PDF dataset), averaged **23.0 of 25** across the three experts (§6.3, p. 25;
> Table 3, p. 18; Table 6, p. 21).
>
> The automated evaluator ranked model families the same way, GPT-5-mini
> highest at **3.20 of 5** overall (Table 5, p. 20).
>
> Retrieval depth of 4 or 5 "generally produced more comprehensive and
> contextually aligned policies", and lower temperatures "tended to generate
> more deterministic and regulation-oriented outputs" (§6.4, p. 26).
>
> Across the twenty configurations the overall expert mean was **3.67 of 5**
> (18.34 of 25), SD 0.51. At criterion level: Role Clarity 3.82, Completeness
> of Controls 3.78, Policy Alignment 3.65, Applicability 3.55, Governance &
> Compliance 3.55 (Table 8, p. 28).
>
> Generalisation held: EXP-16 to EXP-20 scored 18.3 to 20.3 "despite targeting
> previously unseen policy domains" (§6.5, p. 27). The audit mode, EXP-20,
> scored **18 of 25** (§6.5.2, p. 27).
>
> **Inter-rater reliability was at or below chance on every criterion.**
> Krippendorff's α ran from −0.194 to 0.025 and Fleiss' κ from −0.120 to
> −0.011 (Table 9, p. 29). The paper reports the illustrative case: on EXP-19
> the three experts assigned totals of **23, 24 and 10 of 25** (§6.7, p. 29).
> It states clearly that "negative coefficients do not indicate negative policy
> quality" and that reliability "should be interpreted separately from overall
> quality scores" (§6.7, p. 29).
>
> On the seven outputs scored by both the panel and the automated evaluator,
> Spearman's ρ = 0.782 with an exact two-sided permutation p = 0.0476, which
> the paper describes as exploratory given n = 7 (§6.7, p. 30).
>
> Generated documents "lacked organizational document management features such
> as version control mechanisms, approval workflows, and formal authorization
> tracking", so AI-generated policies "may not fully satisfy enterprise
> governance requirements without integration into organizational Document
> Management Systems (DMS) or Governance, Risk, and Compliance (GRC)
> platforms" (§6.9.1, p. 32).
>
> The conclusion positions LLMs as "policy-assistance technologies rather than
> fully independent governance solutions" (§6.9, p. 31) and prioritises three
> directions: automated regulatory document extraction, a dedicated policy
> verification mechanism, and regulatory-oriented evaluation metrics (§8, p. 35).

### 1.5 Tools and technologies

| Layer | Choice | Where |
| --- | --- | --- |
| Orchestration | n8n, on-premises capable | §5.4.1, p. 13 |
| Source repository | Google Drive, event-triggered | §5.3.2, p. 11 |
| Structured store | PostgreSQL — documents, metadata, rows, conversation memory | §5.3.3, p. 12; §5.4.4, p. 14 |
| Vector store | Supabase pgvector; also ChromaDB and Pinecone in Phase 1 | §5.4.3, p. 14; Table 3, p. 18 |
| Embeddings | `text-embedding-ada-002` (text), `text-embedding-3-small` and `all-MiniLM-L6-v2` (experiments) | §5.4.2, p. 14; Table 3, p. 18 |
| Generation | gpt-5-mini, gpt-4.1-mini; Mistral-7B-Instruct-v0.2, Qwen2.5-1.5B, SmolLM3-3B, gemma-2-2b-it, Meta-Llama-3-8B | Table 3, p. 18 |
| Evaluation | LangSmith LLM-as-a-Judge; three-expert rubric; Krippendorff's α, Fleiss' κ, Spearman's ρ | §5.6, pp. 19-20 |
| Delivery | Web interface, AR/EN, logo and font options, PDF export | §6.1, pp. 20-24 |

### 1.6 Strengths

1. **The governance boundary is designed in, not bolted on.** The three prompt
   constraints (§5.4.6, p. 17) name grounding, structure and traceability as
   requirements of the system rather than qualities hoped for from the model.
   The traceability constraint in particular — control number *and* capability
   name on every section — is exactly what an auditor needs and exactly what
   general-purpose policy generation omits.
2. **Honest reporting of an unflattering result.** The paper publishes negative
   inter-rater reliability (Table 9, p. 29) and the 23/24/10 split on EXP-19
   (§6.7, p. 29) rather than reporting the mean alone. Most work of this kind
   does not measure agreement at all.
3. **Dual evaluation, correctly motivated.** §7.5 (p. 34) explains why BLEU and
   ROUGE are the wrong instruments — "a policy may achieve a high BLEU score by
   closely matching the wording of control statements, yet still fail to
   correctly capture required elements" — and the two-stage design follows from
   that argument rather than from convention.
4. **The dataset is the contribution most likely to outlast the system.** A
   normalised, cross-framework, five-field control corpus with duplicates
   consolidated (§5.2, pp. 9-10; §5.3.1, p. 10) is reusable independently of
   any model or vector store, and it was published (§5.3.1, p. 11).
5. **Saudi regulatory coverage is treated as primary, not as a localisation
   afterthought.** Six NCA frameworks plus ISO/IEC 27001 (§5.2, p. 9), and the
   competitor comparison (Table 1, p. 7) is explicit that the platforms in the
   market cover CSCC, TCC and CCC poorly or not at all.
6. **Cross-domain generalisation was actually tested**, and with the audit mode
   as a genuinely different task (Table 4, p. 19), rather than claimed from a
   single domain.

### 1.7 Limitations

> **ASSESSMENT.** These are my findings about the paper, substantiated from its
> own text. They are not the paper's stated limitations, which are in §7 and
> which I accept as far as they go.

1. **One output per configuration.** Each of the twenty cells in Table 6 (p. 21)
   is a single generated document. The conclusion that "model capability
   emerged as the dominant determinant of policy quality" (§8, p. 35) is drawn
   from n = 1 per condition, so configuration effects cannot be separated from
   single-sample variance. Three or five generations per configuration would
   have cost little and would have made the ranking defensible.
2. **The configurations are confounded, and the abstract over-reads them.** The
   summary states that "GPT-based configurations paired with structured Excel
   datasets and semantic vector retrieval achieve the strongest regulatory
   coverage" (p. i), and §5.3.1 (p. 11) says "the results obtained using the
   Excel format were more reliable". But **EXP-13, the highest-scoring
   configuration at 23.0, used the PDF dataset** (Table 3, p. 18). The
   XLSX configuration, EXP-15, scored 21.3. Model, vector store, embedding
   model and dataset format all change together between EXP-10, EXP-11 and
   EXP-13, so none of their contributions is separable — and on the paper's own
   numbers the Excel claim is not supported by its best result.
3. **The panel's disagreement invalidates the ranking the paper goes on to
   report.** The paper is right that negative α does not mean negative quality
   (§6.7, p. 29). What it does not draw is the consequence: when three experts
   agree at below chance, a mean of their three scores cannot separate EXP-13
   (23.0) from EXP-15 (21.3), and possibly not from EXP-10 (19.7). EXP-19 —
   scored 23, 24 and 10 — is the proof: its mean of 19.0 describes no rater's
   view. The paper nevertheless calls EXP-13 "the highest-performing
   configuration" in §6.3 (p. 25), §6.8 (p. 30) and the conclusion (p. 35). The
   defensible finding is narrower and still valuable: GPT-class models are
   clearly better than sub-8B open-weight models, and within the GPT class the
   experiment cannot rank configurations.
4. **The automated evaluator contradicts the human panel on the three things
   the architecture exists to deliver, and the paper does not engage with it.**
   In Table 5 (p. 20) GPT-5-mini — the best family — scores **Coverage 5 and
   Completeness 5 but Alignment 2, Groundedness 2 and Traceability 2**. The
   whole point of retrieval grounding and the traceability constraint is
   alignment, groundedness and traceability. The same outputs received 20-23
   of 25 from the human panel. Either the automated evaluator is misconfigured,
   or the outputs are comprehensive but weakly grounded and the panel did not
   detect it. Both readings matter; neither is discussed. This is, in my
   assessment, the most consequential unexamined result in the paper.
5. **The agentic layer is never ablated.** §5.4.5 (p. 14) argues for an
   agent-driven architecture over a fixed chain, and RQ2 asks about agentic
   generalisation, but no experiment compares agentic retrieval with
   retrieve-then-generate. The benefit of the agent is asserted throughout and
   measured nowhere. The cross-domain results (§6.5, p. 27) demonstrate that the
   *configuration* generalises, which is a different claim.
6. **Audit mode is scored with a generation rubric.** EXP-20 is a gap analysis,
   scored 18 of 25 on criteria including Clarity of Roles and Responsibilities
   and Completeness of Controls and Procedures (§6.5.2, p. 27). Role clarity is
   not a property of a gap analysis. The paper identifies the absence of
   regulatory-oriented metrics as a challenge (§7.5, p. 34) and then reports
   this number as "comparable quality to generation-mode outputs" anyway.
7. **Groundedness is instructed, not verified.** Retrieval-Based Grounding is a
   sentence in a system prompt (§5.4.6, p. 17). §7.1 (p. 33) concedes the
   constraint "does not guarantee complete error prevention" when retrieval
   misses. No post-generation check confirms that each statement traces to a
   retrieved control — which is why §8 (p. 35) lists "a dedicated policy
   verification mechanism" as future work. Until that exists, the traceability
   claim rests on the model's compliance with an instruction.
8. **Scalability is bounded by the very step the paper says is essential.**
   Manual preprocessing is defended as "the most reliable method" (§5.3.1,
   p. 10) and simultaneously identified as the constraint on supporting more
   frameworks (§7.3, p. 33; §7.4, p. 34). Both are true, and the tension is
   left unresolved.
9. **Editorial defects that affect verifiability.** §5.3.3 (p. 12) repeats
   §5.3.2's Database Initialization text verbatim. §5.6 (p. 19) refers to
   "Table 5.6" and §6.7 (p. 29) to "Table 5" where Table 6 is meant. §6.6
   (p. 27) states that higher scores appeared in "Role Clarity and Completeness
   of Controls, while lower scores were occasionally observed in Applicability
   and Governance Compliance", then in the next paragraph that "lower scores
   were occasionally observed in Applicability and **Completeness of
   Controls**" — the two statements contradict each other about CC, and Table 8
   (p. 28) supports the first. Table 2 is introduced as "Table 1" in the body
   (§5.1, p. 7).
10. **Phase 2's baseline configuration is stated two ways.** §5.5 (p. 19) says
    EXP-16 to EXP-20 each share "the same configuration as EXP-15", and the note
    under Table 4 (p. 19) repeats it with the parameters spelled out
    (temperature 1.0, XLSX). §6.5 (p. 26) says Phase 2 "evaluated whether the
    highest-performing Phase 1 configuration (**EXP-13**) maintains output
    quality", and §6.5.1 (p. 27) refers to "the EXP-13 architecture". EXP-13 and
    EXP-15 differ in both temperature (0.5 against 1.0) and dataset format (PDF
    against XLSX) (Table 3, p. 18), so the generalisation results cannot be
    attributed to a known configuration.
11. **Table 1 compares against undisclosed proprietary behaviour.** The paper
    acknowledges that the commercial platforms "do not publicly disclose the
    full technical details of their underlying architectures" (§3, p. 5) and
    then scores five of them with ✓ and × across seven features (Table 1, p. 7),
    including "AI-assisted policy generation ×" for OneTrust, whose policy
    management is described one paragraph earlier as having "AI-powered
    workflows across more than 55 frameworks" (§3, p. 5). The table
    contradicts the text.

### 1.8 Assumptions the paper makes

| Assumption | Where | Stated or implicit |
| --- | --- | --- |
| Each regulatory requirement is a self-contained retrieval unit | §7.2, p. 33 | Stated, and flagged as an open question |
| Restricting the corpus to NCA and ISO controls the confounds | §5.2, p. 10 | Stated |
| Expert judgement is a reliable measure of policy quality | §5.6, p. 19 | Implicit — and contradicted by the paper's own Table 9 |
| A model instructed to ground its output does so | §5.4.6, p. 17 | Implicit |
| Normalising terminology across frameworks does not lose regulatory meaning | §5.1, p. 7 | Implicit |
| Organisational context supplied in a form is sufficient to contextualise a policy | §6.1.2, p. 22 | Implicit |
| The published reformulation of a control may stand in for the control | §5.3.1, p. 10 | Implicit, and the licensing constraint is acknowledged separately at §5.1, p. 7 |

---

## Part 2 — Applicable ideas, classified

Four classifications, applied on one test: does adopting this produce a
**measurable** improvement in something AutGRC currently does worse? Novelty is
not a reason. Where AutGRC already does the thing, the idea is recorded as a
duplicate and not re-implemented.

### Summary

| # | Idea | Paper source | Classification |
| --- | --- | --- | --- |
| A1 | Five-criterion assessment rubric | §5.6, p. 19; Table 8, p. 28 | **Applicable – Apply** |
| A2 | Per-reviewer scoring with agreement measured | §5.6, p. 20; Table 9, p. 29 | **Applicable – Apply** |
| A3 | Structured five-field control schema as an import format | §5.3.1, p. 10; §7.3, p. 33 | **Applicable – Apply** |
| A4 | Low generation temperature for regulatory output | §6.4, p. 26 | **Applicable – Apply** |
| B1 | LLM-as-a-Judge as a second opinion | §5.6, p. 19; Table 5, p. 20; §6.7, p. 30 | **Applicable with Modification** |
| B2 | Semantic capability matching from a policy topic | §6.1.6, p. 24 | **Applicable with Modification** |
| B3 | Event-driven ingestion that keeps the store synchronised | §5.3.2, p. 11 | **Applicable with Modification** |
| B4 | Organisational context fields as generation inputs | §6.1.2, p. 22 | **Applicable with Modification** — largely duplicate |
| C1 | RAG as the generation mechanism | §1, p. 1; §4, p. 6 | **Not Applicable** |
| C2 | Chat as the primary interaction model | §5.4.5, p. 14 | **Not Applicable** |
| C3 | Supabase / pgvector / PostgreSQL stack | §5.4.3, p. 14 | **Not Applicable** |
| C4 | Conversational memory for iterative refinement | §5.4.4, p. 14 | **Not Applicable** — duplicate |
| C5 | Cloud LLM as the default path | §5.4.2, p. 13 | **Not Applicable** |
| C6 | PDF as a dataset format | Table 3, p. 18 | **Not Applicable** |
| C7 | BLEU / ROUGE | §7.5, p. 34 | **Not Applicable** — and the paper agrees |
| C8 | Terminological normalisation across frameworks | §5.1, p. 7; §5.2, p. 10 | **Not Applicable** as stated — conflicts with a governance rule |
| D1 | Automated regulatory document extraction | §7.3, p. 33; §8, p. 35 | **Future consideration** |
| D2 | A dedicated policy verification mechanism | §8, p. 35; §7.1, p. 33 | **Future consideration** |
| D3 | Regulatory-oriented evaluation metrics | §7.5, p. 34; §8, p. 35 | **Future consideration** |
| D4 | Locally hosted model and on-premises embeddings | §7.6, pp. 34-35 | **Future consideration** — partly already true |
| D5 | Chunking-granularity research | §7.2, p. 33 | **Future consideration** |

### A1 — Five-criterion assessment rubric · *Apply*

**What.** Report governance quality across Policy Alignment, Role Clarity,
Applicability, Governance & Compliance and Completeness of Controls, each 1-5,
instead of as one aggregate.

**Why.**

> **PAPER.** The rubric is defined at §5.6, p. 19. Its value is demonstrated at
> Table 8, p. 28: the aggregate mean of 3.67 conveys nothing, while the
> criterion-level breakdown identifies Applicability and Governance &
> Compliance at 3.55 as the weak dimensions and Role Clarity at 3.82 as the
> strongest. §6.6 (p. 27) attaches a cause to it — experts "noted that some
> generated policies lacked operational implementation details and procedural
> specificity required for real-world institutional deployment".

> **ASSESSMENT.** AutGRC's readiness score is a single 0-100 figure computed by
> subtracting severity weights (`scoreOf` in `server/src/services/review.js`).
> It has the exact defect Table 8 exposes: a domain that loses twenty points
> because nothing is accountable is indistinguishable from one that loses twenty
> points because two documents disagree on a review frequency, and those need
> different people to fix them. The engine already produces the raw material —
> nine finding categories across six check families — so this is a reporting
> change, not a new measurement. That is what makes it cheap and worth doing.

**Where.** `server/src/services/scorecard.js`, surfaced on the document quality
tab and the domain hierarchy view.

**Benefit.** A reader can act on the profile without reading the finding list.
Measurable: the weakest criterion is named, and a domain's five bands are
comparable over time and across domains.

**Complexity.** Low. One service, two route fields, one component.

**Inputs required.** None beyond what the engine already emits.

**Risks.** Two, both mitigated in the implementation: a five-point band derived
from rule weights could be mistaken for the paper's human rating, so it is
labelled as derived from platform checks everywhere it appears; and a finding
category left out of the mapping would silently score nothing, so unmapped
categories are reported in the payload and a test fails if one exists.

### A2 — Per-reviewer scoring with agreement measured · *Apply*

**What.** Let more than one reviewer score a document on the same five criteria,
hold the ratings separately, and report the spread as well as the mean.

**Why.**

> **PAPER.** Three experts scored the same twenty outputs (§5.6, p. 20).
> Krippendorff's α ran −0.194 to 0.025 and Fleiss' κ −0.120 to −0.011 on every
> criterion (Table 9, p. 29). On EXP-19 the totals were 23, 24 and 10 of 25
> (§6.7, p. 29). The paper concludes that "the perceived quality of the same
> policy output varied considerably across evaluators" and that this "highlights
> the importance of measuring the level of agreement among experts when
> evaluating generated policy outputs" (§6.7, p. 29).

> **ASSESSMENT.** This is the single most useful finding in the paper for a GRC
> platform, and its implication is uncomfortable: **a single reviewer's
> approval of generated governance text is a weak quality signal.** AutGRC
> records that a review happened and what it decided (`document_approvals`); it
> records nothing about what the reviewer thought. Two reviewers reaching
> opposite judgements leave identical traces. The paper's own measurement design
> is the fix — hold the ratings per person and report the range — and the cost
> of not doing it is that a mean of 19.0 gets reported for a document one
> reviewer scored 10.
>
> Note what is *not* being claimed. The paper's negative reliability
> coefficients say nothing about AutGRC's output, which is deterministically
> generated from a curated model rather than sampled from an LLM. The finding
> transfers to the **review process**, not to the generator.

**Where.** `document_reviews` table; `assessmentOf` and `compareBases` in
`server/src/services/scorecard.js`; `GET`/`PUT /documents/:id/assessment`.

**Benefit.** Disagreement becomes visible instead of averaged away. A KRI fires
when the panel spans two bands or more on any criterion.

**Complexity.** Medium. One table, two routes, one permission, one panel.

**Inputs required.** At least two independent assessors per document for the
measurement to mean anything. Under assumption A3 the natural panel is GRC
Manager, Reviewer/Auditor and CISO — which is close to the paper's own panel
composition (§5.6, pp. 19-20).

**Risks.** A panel of one reported as agreement would be worse than no
measurement; divergence is therefore only asserted with two or more raters, and
the test suite asserts it. A reviewer rating their own draft would inflate the
figure without adding a judgement, so the document's owner is refused.

### A3 — The five-field schema as a licensed-catalogue import format · *Apply*

**What.** Accept a spreadsheet of a publication's controls — including in the
paper's Policy Statement / Purpose / Relevant Standards / Control Number /
Capability Name layout — and write it into the framework catalogue as the
organisation's licensed copy.

**Why.**

> **PAPER.** The schema is defined at §5.3.1, p. 10, and the corpus built in it
> was published (§5.3.1, p. 11). §7.3 (p. 33) and §7.4 (p. 34) identify the
> manual work of producing such a file as the constraint on supporting further
> frameworks. §5.1 (p. 7) notes that ISO/IEC standards are not freely
> accessible and "typically require purchase or institutional access".

> **ASSESSMENT.** AutGRC had a documented capability that did not exist.
> GOVERNANCE.md rule 1 says authoritative rows are written "only by the seed or
> by an import the customer performs from their licensed copy"; rule 6 tells an
> organisation wanting official Arabic framework text to import it; the README's
> limitations say "import your licensed copies to replace them". No such path
> existed — `framework_requirements` was written only by the seed and by the
> edition-copy route. The paper does not create this gap or notice it, but it
> supplies the thing that was missing: a concrete, already-populated target
> schema, so the import is not designed against a hypothetical file.
>
> This is also the change with the largest compliance consequence. Until it
> exists, every framework reference in the platform is reference metadata and
> cannot be relied on for regulatory attestation — which the platform says
> plainly, and which is a real constraint on using it for an NCA or ISO
> submission.

**Where.** `server/src/services/import-framework.js`;
`POST /frameworks/:code/catalogue`; the Frameworks page.

**Benefit.** The catalogue can hold the publisher's own wording, stamped
`user_imported`, which is the precondition for using AutGRC output in a
regulatory submission. It also unlocks official Arabic framework text without
breaking the no-translation rule.

**Complexity.** Medium. Header-alias parsing, a dry run, and an idempotent
writer.

**Inputs required.** A licensed copy of the publication as XLSX or CSV
(assumption A5: none is held today).

**Risks.** This writes to the one table the platform treats as authoritative, so
three limits are enforced: nothing is deleted — a catalogue row absent from the
file is reported and left alone, because control mappings and gap items point at
requirement ids; a superseded edition cannot be rewritten, because an
organisation stays assessed against the edition it was certified under; and a
"Relevant Standards" cell does not become a crosswalk, because a name in a
spreadsheet is not a reviewed equivalence.

### A4 — Low generation temperature for regulatory output · *Apply*

**What.** Pin the Claude provider's temperature low rather than leaving the API
default.

**Why.**

> **PAPER.** "Lower temperature values tended to generate more deterministic and
> regulation-oriented outputs, while higher temperatures occasionally introduced
> variability in terminology and policy formulation" (§6.4, p. 26).

> **ASSESSMENT.** AutGRC's `callClaude` set `max_tokens` and no temperature, so
> it ran at the API default. Variability in terminology is precisely what the
> platform's consistency engine exists to catch, and generating it deliberately
> is indefensible. This is a one-line change with a cited rationale. It is worth
> noting that the paper's evidence here is qualitative — it reports a tendency
> without a statistic — so this is adopted on the argument, not on a measured
> effect size, and that is stated in the code.

**Where.** `server/src/services/ai.js`.

**Benefit.** Two runs over the same requirement model produce closer wording,
which reduces false consistency findings after an AI-assisted edit.

**Complexity.** Trivial.

**Inputs required.** None. The built-in engine is unaffected — it is already
deterministic.

**Risks.** None material. Lower temperature slightly reduces phrasing variety in
the rewrite feature, which is an acceptable trade in governance text.

### B1 — LLM-as-a-Judge as a second opinion · *Apply with modification*

> **PAPER.** LangSmith evaluators scored outputs on Alignment, Coverage,
> Groundedness, Traceability and Completeness (§5.6, p. 19; Table 5, p. 20). On
> seven matched outputs the automated and human rankings correlated at
> ρ = 0.782, p = 0.0476, described as exploratory (§6.7, p. 30).

> **ASSESSMENT.** AutGRC already has an AI review path (`aiReview` in
> `server/src/services/ai.js`) that returns findings. The modification worth
> making is to have it also return the five criteria as scores, so the AI view,
> the rule view and the human panel sit on one scale.
>
> Two things must not be adopted. First, the automated evaluator must never be
> the approval gate: the paper's Table 5 shows its scores diverging sharply
> from the panel's on exactly the dimensions that matter (limitation 4 above),
> and ρ = 0.782 on n = 7 is not a licence to substitute one for the other — the
> paper says as much by labelling the comparison exploratory. Second, an AI
> score must be provenance-labelled `ai_recommendation` like every other
> generated artefact.
>
> **Not implemented in this change.** It requires an API key to exercise, so it
> cannot be covered by the offline test suite, and its value is second-order
> once the rule-based profile and the human panel exist. Scheduled in Phase 2 of
> the roadmap. The scorecard's `basis` field already distinguishes measurement
> sources so a third can be added without a schema change.

### B2 — Semantic capability matching · *Apply with modification*

> **PAPER.** "The system then invokes the capability matching mechanism to
> identify the capabilities most closely associated with the policy topic and
> uses the retrieved capabilities to guide the retrieval of their corresponding
> controls… rather than relying solely on direct textual matching" (§6.1.6,
> p. 24). Twenty-one capability categories are offered (§6.1.4, pp. 22-23).

> **ASSESSMENT.** AutGRC's generator takes an explicit domain from a list of 24.
> The paper's approach is better at discovery — a user who types "protecting
> customer data on laptops" gets somewhere — and worse at governance, because
> the scope of a generated policy would then depend on an embedding.
>
> The defensible modification: keep the explicit domain as the thing that
> governs, and add topic matching as a **suggestion** in the wizard. The user
> still chooses. Scheduled in Phase 2; the value is convenience, not
> correctness, which is why it is not in this change.

### B3 — Event-driven ingestion · *Apply with modification*

> **PAPER.** The n8n pipeline is triggered by file events in Google Drive,
> deletes superseded rows to prevent duplication, and keeps the vector store
> "continuously synchronized with the source policy data" (§5.3.2, p. 11).

> **ASSESSMENT.** The property worth taking is *the store cannot silently go
> stale*, not the mechanism. A Drive watcher is wrong for this platform: it
> would put licensed regulatory publications in third-party cloud storage, which
> §7.6 (pp. 34-35) itself warns against. The modification is to make re-import
> idempotent so a corrected file can simply be re-applied — implemented, and
> tested: re-importing the same catalogue changes nothing and preserves every
> requirement id.
>
> Note also that the paper's pipeline *deletes* old rows before re-inserting
> (§5.3.2, p. 11, step 2). For AutGRC that would be destructive, because control
> mappings, gap items and crosswalks reference requirement ids. Matching by
> reference and updating in place is the equivalent behaviour without the
> collateral damage — an instance where the requirements of a GRC platform
> diverge from those of a retrieval pipeline.

### B4 — Organisational context as generation input · *Largely duplicate*

> **PAPER.** Organisation name, sector, employee count, primary activities and
> data types are collected and "transmitted to the backend together with the
> remaining user inputs to support the customization of the generated policy"
> (§6.1.2, p. 22).

> **ASSESSMENT.** AutGRC already does this — the organisation profile feeds
> generation, and `{{orgName}}` and the domain parameter set resolve into
> document text. The one element AutGRC handles better is worth stating: where
> the profile does not supply something the generator needed, AutGRC records an
> explicit assumption on the package and shows it in the wizard before
> generation (GOVERNANCE.md rule 4). The paper has no equivalent, and without
> one a contextualised policy cannot be distinguished from a policy that guessed
> at the context. **No change.**

### C1-C8 — Not applicable, with reasons

**C1 — RAG as the generation mechanism.** AutGRC generates deterministically
from a canonical requirement model: one model per domain, and Policy, Standard,
Procedure, RACI, control matrix and evidence register are projections of it, so
cross-document agreement is structural. Replacing that with retrieval plus an
LLM would trade a guarantee for a probability. The paper's own evidence supports
declining: hallucination remains a residual risk under RAG (§7.1, p. 33),
groundedness scored 2 of 5 even for the best model family (Table 5, p. 20), and
the conclusion positions LLM generation as assistance rather than a governance
solution (§6.9, p. 31). **Where the paper is stronger:** it can produce a policy
for a framework AutGRC has no requirement model for. That is a real capability
gap, and the honest answer is that it is bought with the guarantees above.

**C2 — Chat as the primary interaction model.** Users "interact with the system
through the n8n chat interface" (§5.4.5, p. 16). A governance document needs a
lifecycle, an owner, an approver and a version, none of which a chat transcript
has. This is the same observation the paper makes about its own outputs at
§6.9.1 (p. 32).

**C3 — Supabase / pgvector / PostgreSQL.** No vector search is performed, so no
vector store is needed. SQLite suits the single-node deployment; the data access
layer is confined to `server/src/db/` if that changes.

**C4 — Conversational memory.** §5.4.4 (p. 14) adds multi-turn refinement.
AutGRC refines through document versions, a change note and an approval trail —
which is the same capability in the form an auditor can read. Duplicate.

**C5 — Cloud LLM by default.** §5.4.2 (p. 13) selects OpenAI GPT models as the
generation engine. AutGRC's default is the offline built-in engine and the
Claude provider is opt-in, which already satisfies the concern the paper raises
at §7.6 (pp. 34-35) about "transmitting and processing sensitive organizational
data through third-party infrastructure". **AutGRC is stronger here and should
not move.**

**C6 — PDF as a dataset format.** PDF appears in EXP-11 to EXP-14 (Table 3,
p. 18) and §7.4 (p. 34) describes the extraction problems it causes. AutGRC's
catalogue importer accepts spreadsheets only, deliberately: guessing a control
hierarchy out of a PDF layout and writing the result into authoritative source
material is not a risk worth taking. Document *import* for analysis already
accepts PDF, which is a different and non-authoritative path.

**C7 — BLEU / ROUGE.** The paper argues against them itself (§7.5, p. 34) and I
agree. AutGRC's checks are rule-based and reference-free.

**C8 — Terminological normalisation across frameworks.** §5.1 (p. 7) argues that
"privileged user", "elevated access" and "administrator" must be normalised or
"an AI model may become confused, or worse, generate unclear or inaccurate
policy content", and §5.2 (p. 10) reports duplicate controls "resolved through
consolidation".

> **ASSESSMENT.** Necessary for a retrieval corpus; not permissible for a
> catalogue. Rewriting an NCA control into a normalised vocabulary and
> presenting it as the control is the thing GOVERNANCE.md rule 1 forbids, and
> the same reasoning keeps framework text untranslated under rule 6. AutGRC
> achieves the analytical benefit differently and, in my assessment, more
> safely: each publisher's own wording is preserved and equivalence is asserted
> **outside** the text, in 89 curated cross-framework crosswalks, where it can
> be reviewed, disputed and versioned. Normalisation bakes an interpretation
> into the record; a crosswalk states it as a claim.

### D1-D5 — Future consideration

**D1 — Automated regulatory extraction.** "There is therefore a need to develop
methods to automate the data processing phase, such as an LLM-based extraction
tool capable of converting raw regulatory documents into structured data"
(§7.3, p. 33; repeated §7.4, p. 34; prioritised at §8, p. 35). Now that the
catalogue import exists, extraction has a target to write into, which makes this
a bounded next step rather than an open problem: PDF or DOCX in, five-field
spreadsheet out, human review before import. Keep the human review — the import
route's dry run is where it belongs.

**D2 — A dedicated policy verification mechanism.** §8 (p. 35) lists it as
future work; §7.1 (p. 33) explains why it is needed; the literature review notes
that RAGent achieved an F1 of 80.6% by adding "a novel policy verification and
refinement mechanism" (§2, p. 3). For AutGRC the equivalent is a check that
every clause in a generated document resolves to a requirement key in the
canonical model — feasible, because unlike a retrieval system AutGRC knows
exactly which requirement each clause came from.

**D3 — Regulatory-oriented evaluation metrics.** §7.5 (p. 34) and §8 (p. 35).
The five-criterion profile implemented here is a step toward it and not a
substitute: it measures what rules can see. A real regulatory metric would
measure whether a document satisfies a control, which needs the control's own
text — i.e. it needs D1 and A3 first.

**D4 — Local model and on-premises embeddings.** §7.6 (pp. 34-35). Already true
for the default path; would matter if AI-assisted generation became the primary
mode, which C1 recommends against.

**D5 — Chunking granularity.** §7.2 (p. 33) leaves it open. Not applicable while
there is no retrieval layer. Relevant if D1 is built, since an extraction tool
faces the same segmentation problem.

---

## Part 3 — Mapping to the existing work

Where each of the paper's concepts already sits in AutGRC, ISO/IEC 27001:2022,
ISO/IEC 27005, ISO 22301 and NCA ECC-2:2024.

| Paper concept | Where it sits in AutGRC today | Related standard clause | Status |
| --- | --- | --- | --- |
| Complete structured policy document generation (§4, p. 6) | `server/src/services/generator.js` — a package of policy, standard, procedure, guideline, roles, RACI, control matrix and framework mapping from one requirement model | ISO 27001 5.2, 7.5.1 | **Already stronger** — nine document types, not one |
| Traceability to control number and capability (§5.4.6, p. 17) | `refs` on every requirement; `control_mappings`; the trace chain endpoint | ISO 27001 6.1.3(c), Annex A; NCA ECC 1-1 | **Already stronger** — the chain runs on to evidence, not just to the control |
| Formatting constraint: a standard document structure (§5.4.6, p. 17) | `REQUIRED_SECTIONS` in `server/src/services/review.js` — checked, not merely requested | ISO 27001 7.5.2 | **Already stronger** — a missing section is a finding |
| Grounding: no statement unsupported by source (§5.4.6, p. 17) | GOVERNANCE.md rule 3; the load-time validator rejects a placeholder with no parameter | ISO 27001 7.5.3 | **Already stronger** — enforced structurally, not by instruction |
| Bilingual AR/EN generation (Table 1, p. 7; §6.1.1, p. 20) | `server/src/knowledge/ar/`, `doc-strings.js`, RTL Word export | — | **Equivalent**, with a stricter rule: framework text is never translated (GOVERNANCE.md rule 6) |
| Organisational contextualisation (§6.1.2, p. 22) | `org_profile`, `{{orgName}}`, domain parameter sets, plus a recorded assumption where an input was missing | ISO 27001 4.1, 4.2 | **Already stronger** — assumptions are explicit |
| Multi-framework selection (§6.1.3, p. 22) | 14 frameworks, 482 requirement references, 89 crosswalks | ISO 27001 Annex A; ISO 22301 8.1 | **Equivalent** |
| Capability categories as the retrieval unit (§6.1.4, pp. 22-23) | 24 domains in `server/src/knowledge/domains.js` | NCA ECC domain structure | **Equivalent** — 24 against 21 |
| Regulatory audit mode (§6.5.2, p. 27) | `server/src/services/import.js` analysis; the gap assessment module | ISO 27001 9.2; NCA ECC 1-8 | **Already stronger** — findings carry severity, an owner and a corrective action |
| Version control, approval workflow, authorisation tracking — named as **missing** from the paper's output (§6.9.1, p. 32) | `documents` lifecycle, `document_versions`, `document_approvals`, `audit_log`, SoD on approval | ISO 27001 7.5.3(b)(c); NCA ECC 1-3 | **Already stronger — this is the paper's stated gap and AutGRC's strength** |
| Hybrid governance: human approval retained (§6.9.2, p. 32) | Provenance taxonomy; `ai_recommendation` → `user_input` on edit; approval by a different person | ISO 27001 5.3 | **Equivalent**, enforced in code |
| Risk as an output of policy work | `server/src/services/risk.js` — 5×5 matrix, unassessed residual reported as unassessed | **ISO 27005**; ISO 27001 6.1.2, 6.1.3 | **Absent from the paper** — it generates policy, not risk |
| Business continuity requirements as a domain (EXP-19, Table 4, p. 19) | `business_continuity`, `disaster_recovery`, `backup_recovery` domains | **ISO 22301** 8.2-8.4 | **Equivalent** — three domains against one experiment |
| Statement of Applicability | `soa_decisions`, with a mandatory reason for every exclusion | ISO 27001 6.1.3(d) | **Absent from the paper** |
| Evidence register | `evidence`, `evidence_files`, verification by someone other than the collector | ISO 27001 9.1, 9.2 | **Absent from the paper** |
| KPI per control | `kpi` on every requirement in the canonical model | ISO 27001 9.1 | **Absent from the paper** |
| Five-criterion expert rubric (§5.6, p. 19) | *Was absent* → `server/src/services/scorecard.js` | ISO 27001 9.1 | **Adopted — A1** |
| Inter-rater agreement (Table 9, p. 29) | *Was absent* → `document_reviews`, `assessmentOf` | ISO 27001 9.2(c) | **Adopted — A2** |
| Five-field control schema (§5.3.1, p. 10) | *Was absent* → `server/src/services/import-framework.js` | ISO 27001 7.5.3(d) "control of documented information of external origin" | **Adopted — A3** |
| Temperature control (§6.4, p. 26) | *Was unset* → `config.ai.temperature` | — | **Adopted — A4** |
| LLM-as-a-Judge (§5.6, p. 19) | `aiReview` returns findings, not criterion scores | ISO 27001 9.1 | **Partial** — Phase 2 |
| Automated regulatory extraction (§7.3, p. 33) | Not present | ISO 27001 7.5.3(d) | **Absent** — Phase 3 |
| Retrieval-augmented generation (§1, p. 1) | Not present, deliberately | — | **Declined — C1** |
| Terminological normalisation (§5.1, p. 7) | Crosswalks instead, asserted outside the text | ISO 27001 Annex A mapping practice | **Declined — C8** |

**The overlap is substantial and it is worth being blunt about what that means.**
Of the twenty-two paper concepts above, thirteen were already present in AutGRC
and eight of those are implemented more completely — including, notably, the
three features the paper identifies as missing from its own output at §6.9.1
(p. 32). Four ideas were genuinely absent and worth adopting. The rest are
architecture decisions that belong to a retrieval system and do not transfer.

---

## Part 4 — Applying the ideas

Four changes, each with the current approach, the proposed improvement, the
revised approach and the exact files. Everything described here is implemented
and tested; what is deferred is marked as deferred and appears in Part 7.

### 4.1 Assessment method — the five-criterion quality profile *(A1)*

**Current approach.** `scoreOf(findings)` in `server/src/services/review.js`
subtracts a severity weight per finding from 100 and returns the remainder as a
readiness score, with counts by category and severity. Six check families feed
it: completeness, consistency, accountability, auditability, compliance and
ambiguity.

**Gap.** The score conflates unlike problems. It cannot tell a reader whether the
domain has an accountability problem or a measurability problem, and it is not
comparable between a domain with eleven documents and a domain with three.

**Proposed improvement.** Report the same findings across the paper's five
criteria (§5.6, p. 19), normalised per document.

**Revised approach.** Each of the nine finding categories is assigned to exactly
one criterion. The per-document penalty is banded 1-5. Both figures are returned
together and derived from one finding list, so they cannot disagree.

| Criterion | Fed by | Band read from |
| --- | --- | --- |
| Policy Alignment (PA) | `compliance` | penalty ÷ documents |
| Role Clarity (RC) | `accountability`, `ownership` | ″ |
| Applicability (AP) | `ambiguity`, `consistency`, `duplication` | ″ |
| Governance & Compliance (GC) | `auditability`, `currency` | ″ |
| Completeness of Controls (CC) | `completeness` | ″ |

Bands: 0 penalty → 5; ≤5 → 4; ≤15 → 3; ≤30 → 2; above → 1.

**Exact changes.**

| File | Change |
| --- | --- |
| `server/src/services/scorecard.js` | New. `CRITERIA`, `scorecard()`, `KRI_THRESHOLDS` |
| `server/src/services/review.js` | `reviewDocument` and `reviewDomain` return `scorecard` |
| `server/src/routes/ai.js` | Both review routes return it; the document route builds it from engine **and** provider findings, so it agrees with the score printed beside it |
| `client/src/components/Scorecard.jsx` | New. `<Scorecard>` renders the profile |
| `client/src/pages/DocumentDetail.jsx`, `Hierarchy.jsx` | Profile shown under the readiness score |
| `client/src/i18n/en.js`, `ar.js` | `scorecard.*` in both languages |
| `server/test/scorecard.test.js` | New. 14 assertions |
| `server/test/workflow.test.js` | End-to-end: the profile agrees with the score and places every category |

**Two safeguards, both tested.** A finding category assigned to no criterion
would score nothing and nothing in the output would say so — `unmapped` is
returned, rendered as a warning, and the test suite fails if any category the
engine or the importer emits is missing. And the profile is labelled as derived
from the platform's own checks everywhere it appears, because a five-point band
computed from rule weights must not be mistaken for the human rating the paper
collected.

### 4.2 Process and workflow — reviewer assessment and divergence *(A2)*

**Current approach.** `document_approvals` records the transition, the actor and
an optional comment. The reviewer's judgement of the document is not recorded.

**Gap.** Two reviewers reaching opposite conclusions leave identical traces, and
a single reviewer's approval is treated as a quality signal. The paper measured
that signal and found expert agreement at or below chance (Table 9, p. 29).

**Proposed improvement.** Record each reviewer's rating separately against the
same five criteria and report the spread, not only the mean.

**Revised approach — the workflow.**

```
Draft ─► Under review ─┬─► Reviewer A records PA/RC/AP/GC/CC (1-5) ──┐
                       ├─► Auditor    records PA/RC/AP/GC/CC ────────┤
                       └─► CISO       records PA/RC/AP/GC/CC ────────┤
                                                                     ▼
                                  range ≥ 2 on any criterion?  ── yes ─► KRI: reconcile
                                                                     │     before approval
                                                                     no
                                                                     ▼
                       Approved (by someone other than the owner) ─► Published
```

**Exact changes.**

| File | Change |
| --- | --- |
| `server/src/db/schema.sql` | New `document_reviews` table: five 1-5 columns with CHECK constraints, bound to `document_version`, unique per reviewer per version |
| `server/src/services/scorecard.js` | `assessmentOf(documentId)` — panel, per-criterion mean, min, max, range, divergence; `compareBases()` — engine band against reviewer mean |
| `server/src/routes/documents.js` | `GET` and `PUT /documents/:id/assessment`, and `canAssess` computed server-side |
| `server/src/middleware/auth.js` | New `assessment:write` — admin, GRC manager, reviewer, approver, auditor |
| `client/src/components/Scorecard.jsx` | `<AssessmentPanel>` — panel, ranges, divergence callout, rating form, comparison |
| `server/test/scorecard.test.js`, `workflow.test.js` | The panel, the divergence case modelled on EXP-19, the version binding, the range rules and both refusals |

**Three rules the implementation enforces.**

1. **A panel of one is not agreement.** Divergence is only asserted with two or
   more ratings. A single rating has a range of zero, and reporting that as
   agreement is the overstatement Table 9 (p. 29) warns against.
2. **A rating belongs to a version.** Ratings are read for the document's
   current version only. A rating of wording since rewritten is history, not the
   panel's view of the text in front of the reader.
3. **A document cannot be assessed by its own owner** — the same segregation of
   duties that stops the owner approving it. The route returns 409 and the API
   tells the client not to offer the form.

**Permission design, and why it is wider than `document:review`.** The paper's
panel was a GRC consultant, a senior consultant and lead auditor, and a CISO
(§5.6, pp. 19-20). In AutGRC's role model those are GRC Manager, Auditor and
Approver — and `document:review` covers only admin, GRC manager and reviewer,
which would have excluded two of the three. `assessment:write` covers all five
review-capable roles and excludes the authoring role, so the panel can actually
be assembled.

### 4.3 Procedure and template — licensed catalogue import *(A3)*

**Current approach.** `framework_requirements` is written by the seed and by the
edition-copy route. No import path existed, despite GOVERNANCE.md rule 1, rule 6
and the README all describing one.

**Gap.** The catalogue could not hold the publisher's own wording, so no output
could be relied on for regulatory attestation, and official Arabic framework text
could not be loaded.

**Proposed improvement.** An import that accepts a licensed publication as a
spreadsheet, including the paper's five-field layout (§5.3.1, p. 10).

**Revised approach — the procedure.**

| Step | Who | What |
| --- | --- | --- |
| 1 | GRC Manager / Administrator | Obtain the licensed publication and export its controls to XLSX or CSV |
| 2 | — | Columns: a reference (`Control Number`, `Reference`, `Clause`…) and a title or statement. The five-field layout is recognised: `Policy Statement`, `Purpose`, `Relevant Standards`, `Control Number`, `Capability Name` |
| 3 | Platform | Upload → **dry run**. Reports inserts, updates, rejected rows with reasons, catalogue rows not covered, unresolved capability names and crosswalk candidates. Nothing is written |
| 4 | GRC Manager | Review the preview, correct the file, repeat |
| 5 | GRC Manager | Confirm. Rows are written, stamped `user_imported`, and the action is audited |
| 6 | GRC Manager | Accept any crosswalk candidates through Framework Mapping, individually |

**The column template**, as the importer reads it:

| Target field | Accepted headers |
| --- | --- |
| Reference | Control Number, Control, Control ID, Reference, Ref, Requirement Ref, Clause, ID |
| Title | Title, Control Title, Name, **Purpose**, Objective, Control Objective |
| Statement | Statement, **Policy Statement**, Requirement, Control Statement, Text, Description |
| Domain | **Capability Name**, Capability, Domain, Area, Control Domain, Category |
| Parent | Parent Ref, Parent, Parent Control, Parent Number |
| Level | Level, Depth — or derived from the reference's depth (`2-2-3-1` → 4) |
| Cross-references | **Relevant Standards**, Related Standards, Standards, Mappings, Cross Reference |

**Exact changes.**

| File | Change |
| --- | --- |
| `server/src/services/import-framework.js` | New. `analyseCatalogue()`, `applyCatalogue()`, `matchDomain()` |
| `server/src/routes/frameworks.js` | `POST /:code/catalogue`, multipart, `settings:write`, dry run by default |
| `client/src/pages/Frameworks.jsx` | **Import licensed copy** — file picker, preview, confirm; `source_status` shown per requirement row |
| `client/src/i18n/{en,ar}.js`, `labels.js` | `frameworks.import*`, `sourceStatus.*`, `labels.sourceStatus()` |
| `server/test/framework-import.test.js` | New. Both layouts, CSV, rejections, the apply path, idempotence |
| `server/test/workflow.test.js` | End-to-end against a throwaway edition: dry run writes nothing, confirm preserves ids, superseded is refused |

**Four protections on authoritative data.** Nothing is deleted — a catalogue row
absent from the file is reported and left alone, because control mappings, gap
items and crosswalks point at requirement ids. Existing rows are matched by
reference and **updated in place**, so those ids survive and so does every
mapping built on them. A superseded edition cannot be rewritten. And a "Relevant
Standards" cell does not become a crosswalk: the values are returned as
candidates for a person to accept.

### 4.4 AI workflow — deterministic generation settings *(A4)*

**Current approach.** `callClaude`'s request body set `model`, `max_tokens`,
`system` and `messages`. No temperature, so the API default applied.

**Revised approach.** `config.ai.temperature`, default **0.2**, overridable with
`AI_TEMPERATURE`, cited to §6.4 (p. 26) in the code — including the caveat that
the paper's evidence there is a stated tendency rather than a measured effect.

**Exact changes.** `server/src/config.js`, `server/src/services/ai.js`,
`.env.example`.

### 4.5 KPIs and KRIs

> **ASSESSMENT.** The paper defines no KPIs or KRIs; it is a research
> evaluation, not an operating model. These are my recommendation. What the paper
> contributes is the reason to set indicators **per criterion rather than on an
> average**: Table 8 (p. 28) shows that its best system still sat near 3.5 on
> Applicability and Governance & Compliance while the aggregate read 3.67, so a
> threshold on the aggregate would have caught nothing.

**KPIs — already in the platform, unchanged.** Every requirement in the canonical
model carries a KPI (`kpi` on each requirement in `server/src/knowledge/req-*.js`),
and the gap assessment reports a compliance rate. Nothing here changes them.

**KRIs — new, implemented as `KRI_THRESHOLDS` in `scorecard.js`.**

| # | Indicator | Threshold | Status | Where it fires |
| --- | --- | --- | --- | --- |
| KRI-1 | Any criterion's engine band | ≤ 2 | Breach | `criteria[].status`, `breaches[]` |
| KRI-2 | Any criterion's engine band | = 3 | Attention | `criteria[].status`, `attention[]` |
| KRI-3 | Reviewer range on any criterion | ≥ 2 bands | Divergent | `assessment.divergence` |
| KRI-4 | Engine band minus reviewer mean | ≥ 2 either way | Measurement conflict | `comparison.material` |
| KRI-5 | Findings in no criterion | ≥ 1 | Instrument failure | `scorecard.unmapped` |

KRI-4 and KRI-5 are the two that matter most and neither is obvious. KRI-4 says
that when the rules and the humans disagree by two bands, one of them is
measuring the wrong thing — the rules are blind to something a reader can see, or
a rule is firing on something a reader does not care about. Either is a finding
about the instrument. KRI-5 is the guard against the instrument going quiet: a
finding category counted nowhere would make the profile look better than the
evidence supports, and nothing in a clean-looking profile would reveal it.

**Thresholds are the platform's proposal, not a regulatory requirement, and an
organisation may move them.** The 3-band floor is not calibrated against
anything; it is the midpoint of a five-point scale.

### 4.6 What was deliberately not changed

- **The generator.** No retrieval, no LLM in the default path. Reasons in C1.
- **The risk model.** 5×5 likelihood × impact per ISO/IEC 27005, with severe
  impact never banding below high. The paper offers nothing about risk.
- **The framework catalogue's content.** No requirement text was added, edited or
  translated. 482 references and 89 crosswalks are as they were.
- **Roles and terminology.** All 14 roles, all 24 domains, every status name and
  every Arabic term unchanged. One Arabic page string was touched and then
  restored to its original wording when I noticed it was a needless change.
- **The provenance taxonomy and every governance rule.** Two rules gained text
  describing the new behaviour; none was relaxed.

---

## Part 5 — Preservation and standards alignment

### 5.1 Nothing regulatory was removed, added or reworded

| Check | Before | After |
| --- | --- | --- |
| Frameworks in the catalogue | 14 | 14 |
| Framework requirement references | 482 | 482 |
| Cross-framework crosswalks | 89 | 89 |
| Canonical organisational requirements | 218 across 24 domains | 218 across 24 domains |
| Distinct framework references cited by the canonical model | 419 | 419 |
| Roles | 14 | 14 |
| Domains | 24 | 24 |

No row in `framework_requirements` was edited by these changes. The catalogue
import writes to that table **only when a person uploads their own licensed copy
and confirms it**, which is the customer exercising rule 1, not the platform
generating regulatory text. Every row it writes is stamped `user_imported`, and
rows it does not touch keep `reference`.

### 5.2 The standard / paper-idea boundary

Every idea adopted from the paper is organisational content. None of it is
presented as a requirement of any framework, and the paper is never cited as
requiring something it does not require.

| Artefact | What it is | What it is not |
| --- | --- | --- |
| The five criteria | A reporting structure the paper used for **its own expert evaluation** (§5.6, p. 19). Adopted as vocabulary | Not a control, not an ISO clause, not something the paper says a platform must do |
| The 1-5 bands | AutGRC's own penalty bands, derived from its rule weights | **Not** the paper's human Likert ratings. Labelled as platform-derived everywhere it is shown |
| KRI thresholds | The platform's proposal, adjustable | Not a regulatory threshold. The paper sets none |
| The five-field import layout | A file format the paper defined and published (§5.3.1, p. 10) | Not a schema any regulator mandates |
| Temperature 0.2 | Adopted on the paper's qualitative argument (§6.4, p. 26) | Not a measured optimum. The code says so |
| Reviewer divergence ≥ 2 bands | My threshold, informed by the paper's finding that agreement was at or below chance (Table 9, p. 29) | **Not** a claim that the paper recommends 2 bands. It recommends measuring agreement; it sets no threshold |

Three statements the paper does **not** make, and which are not implied anywhere
above: it does not say that expert review is unreliable in general (it reports low
agreement on its own twenty outputs and explicitly separates reliability from
quality, §6.7, p. 29); it does not recommend any particular platform
architecture; and it does not evaluate AutGRC, which it does not mention.

### 5.3 Alignment with the standards in scope

**NCA ECC-2:2024 and the other NCA frameworks.** Unaffected. The catalogue holds
ECC, CSCC, DCC, TCC and CCC as before. The import path is what finally lets an
organisation replace the reference entries with the NCA's published wording,
including the Arabic publication — which strengthens ECC alignment rather than
disturbing it, because it removes the caveat that every reference is unverified
metadata. ECC 1-3 (cybersecurity policies and procedures, with documented
approval and periodic review) is served better than before: the reviewer
assessment adds a recorded, per-person quality judgement to the approval trail
that 1-3 already required.

**ISO/IEC 27001:2022.** Three clauses are more fully served:

- **9.1 Monitoring, measurement, analysis and evaluation** — the clause requires
  the organisation to determine *what* needs to be monitored and *by what
  methods*. A single 0-100 readiness score answers neither well. Five named
  criteria with stated thresholds and a stated derivation is a defensible answer
  to "by what methods".
- **9.2 Internal audit** — 9.2(c) requires objectivity and impartiality of the
  audit process. Recording each assessor's rating separately, refusing a
  self-assessment by the document owner, and reporting divergence is direct
  evidence of impartiality rather than an assertion of it.
- **7.5.3 Control of documented information** — 7.5.3(d) covers documented
  information of external origin. The catalogue import is the control for it:
  identified, version-bound to a framework edition, and stamped with its source
  status.

**ISO/IEC 27005.** Untouched. The 5×5 likelihood-by-impact model, the bands, the
treatment options and the rule that an unassessed residual reports no reduction
are exactly as they were. The paper contains nothing about risk assessment, so
there was nothing to adopt and nothing to reconcile.

**ISO 22301.** Untouched. The paper's EXP-19 generated a BCM-requirements policy
against ECC 3-1 (Table 4, p. 19); AutGRC's business continuity, disaster recovery
and backup domains and their ISO 22301 references are unchanged.

### 5.4 Terminology and roles

All 14 role names, all 24 domain names, every lifecycle status, every provenance
value and every Arabic term are unchanged. The new permission is additive
(`assessment:write`) and grants nothing that was previously denied elsewhere. The
five criteria introduce five new labels, and they are the paper's own wording,
translated into Arabic in the same register as the rest of the interface. Where I
changed an existing Arabic string by accident I restored it.

---

## Part 6 — Gap and improvement table

Priority: **High** = fixes something currently wrong or missing that affects
compliance defensibility. **Medium** = measurable improvement to an existing
capability. **Low** = convenience or research.

| Paper idea | Current approach | Gap / opportunity | Proposed improvement | Applicable standard / requirement | Priority | Effort | Expected benefit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Five-field structured control schema (§5.3.1, p. 10) + automation of preprocessing named as the scalability constraint (§7.3, p. 33) | `framework_requirements` written only by the seed and the edition-copy route. GOVERNANCE.md rule 1, rule 6 and the README all describe a licensed-copy import that did not exist | **A documented capability was absent.** Without it every framework reference stays reference metadata and cannot support regulatory attestation, and official Arabic framework text cannot be loaded | Catalogue import accepting a publisher layout or the five-field layout; dry run first; nothing deleted; `user_imported` per row | ISO 27001 **7.5.3(d)** documented information of external origin; NCA ECC 1-1 | **High** | Medium | Output becomes usable for an NCA or ISO submission; Arabic framework text possible without breaking rule 6 |
| Five-criterion expert rubric (§5.6, p. 19) and its demonstrated value at criterion level (Table 8, p. 28) | `scoreOf()` returns one 0-100 figure | A single score cannot distinguish an accountability failure from a measurability failure, and is not comparable across domains of different size | Report the same findings across PA/RC/AP/GC/CC, banded 1-5 per document, beside the existing score | ISO 27001 **9.1** — "by what methods" | **High** | Low | The weakest dimension is named; trendable and comparable; no new measurement needed |
| Three experts scored the same outputs; agreement measured at or below chance (§5.6, p. 20; Table 9, p. 29) | `document_approvals` records the decision, not the judgement | A single reviewer's approval is treated as a quality signal. Two reviewers disagreeing leave identical traces. EXP-19's 23/24/10 shows what a mean hides | `document_reviews` per reviewer per version; report mean **and** range; flag divergence ≥ 2 bands; refuse the owner | ISO 27001 **9.2(c)** objectivity and impartiality; ECC 1-3 | **High** | Medium | Disagreement becomes a governance signal instead of noise; impartiality is evidenced |
| Lower temperature gives more deterministic, regulation-oriented output (§6.4, p. 26) | No temperature set on the Claude request; API default applied | Terminology drift between runs is exactly what the consistency engine reports as a finding | `config.ai.temperature` default 0.2, overridable | — (platform quality) | **Medium** | Trivial | Fewer false consistency findings after an AI-assisted edit |
| Groundedness scored 2/5 by the automated evaluator even for the best model family (Table 5, p. 20); a verification mechanism named as future work (§8, p. 35) | No check that a clause traces to a requirement key | AutGRC can do what the paper cannot: it knows which requirement every clause came from, so verification is a lookup, not an inference | A check that every generated clause resolves to a requirement key in the canonical model | ISO 27001 **7.5.3**; ECC 1-1 | **Medium** | Medium | Traceability becomes verified rather than asserted |
| LLM-as-a-Judge on five named criteria (§5.6, p. 19); human/automated ranking correlation ρ = 0.782, exploratory (§6.7, p. 30) | `aiReview` returns findings, no criterion scores | Three views of quality — rules, AI, humans — cannot be compared because only two are on a scale | Have the AI review return the five criteria as scores, on the same scale, labelled `ai_recommendation`, never as the approval gate | ISO 27001 **9.1** | **Medium** | Low | A third opinion on one scale; the paper's own Table 5 divergence becomes detectable in AutGRC's own output |
| Semantic capability matching from a free-text policy topic (§6.1.6, p. 24) | Explicit domain selection from 24 | A user who does not know the domain vocabulary cannot find the right domain | Suggest domains from a typed topic; the user still chooses. Never automatic | — (usability) | **Low** | Low | Faster start for a non-specialist; no change to what governs scope |
| 21 security capability categories (§6.1.4, pp. 22-23) | 24 domains | None — AutGRC's coverage is wider | No change. Compared and recorded | — | — | — | — |
| Event-driven ingestion keeping the store synchronised (§5.3.2, p. 11) | No re-import path existed | A corrected source file needs a safe, repeatable re-application | Idempotent re-import: match by reference, update in place, preserve ids. **Not** the paper's delete-then-insert, which would destroy mappings | ISO 27001 7.5.3(c) | **Medium** | — (delivered with the import) | A correction is one upload; traceability survives it |
| Automated regulatory document extraction (§7.3, p. 33; §8, p. 35) | Import analyses *organisational* documents; nothing structures a regulatory publication | Producing the import file is manual, which is the paper's own stated bottleneck | Extraction tool: PDF/DOCX in, five-field spreadsheet out, human review before import | ISO 27001 7.5.3(d) | **Low** | High | Adding a framework becomes hours, not weeks |
| Regulatory-oriented evaluation metrics (§7.5, p. 34; §8, p. 35) | Rule-based checks; now a five-criterion profile | A rule cannot tell whether a document *satisfies* a control | Control-satisfaction scoring, which needs the control's own text — so it depends on the import and extraction above | ISO 27001 9.1 | **Low** | High | Measures compliance, not document hygiene |
| Local model, on-premises embeddings (§7.6, pp. 34-35) | Default engine is offline and deterministic; cloud is opt-in | None — AutGRC already satisfies the concern | No change | ISO 27001 A.5.14, A.8.12 | — | — | — |
| Version control, approval workflow, authorisation tracking — the paper's own stated gap (§6.9.1, p. 32) | Full lifecycle, versions, approvals, audit log, SoD | **None. AutGRC is stronger and this is where it is stronger** | No change. Recorded as validation of the existing architecture | ISO 27001 7.5.3(b)(c); ECC 1-3 | — | — | — |
| RAG as the generation mechanism (§1, p. 1; §4, p. 6) | Deterministic projection of a canonical requirement model | AutGRC cannot generate for a framework it has no model for; the paper can | **Declined.** The cost is the structural consistency guarantee, hallucination risk (§7.1, p. 33) and weak measured groundedness (Table 5, p. 20). Revisit only if model coverage becomes the binding constraint | — | — | — | — |
| Terminological normalisation across frameworks (§5.1, p. 7; §5.2, p. 10) | Publisher wording preserved; equivalence asserted in 89 reviewable crosswalks | None | **Declined.** Rewriting a control into a normalised vocabulary is writing regulatory text (GOVERNANCE.md rule 1) | ISO 27001 Annex A mapping practice | — | — | — |

---

## Part 7 — Implementation roadmap

### Phase 1 — Quick wins *(complete)*

| Activity | Deliverable | Owner | Dependencies | Expected outcome |
| --- | --- | --- | --- | --- |
| Map the six check families onto the five criteria and band them per document | `server/src/services/scorecard.js`; the profile on the document and domain views | GRC Manager (as platform owner) | None — uses existing findings | The weakest dimension is named on every review |
| Define KRI thresholds per criterion | `KRI_THRESHOLDS`, five indicators, documented as the platform's proposal | GRC Manager | Profile above | A breach is visible without reading the finding list |
| Guard the instrument | `unmapped` reported; a test fails if any category maps to no criterion | GRC Manager | Profile above | The profile cannot quietly stop counting a check |
| Pin generation temperature | `config.ai.temperature` = 0.2, `AI_TEMPERATURE` override | GRC Manager | None | Less terminology drift between AI-assisted runs |
| Document the provenance of every borrowed idea | This document; GOVERNANCE.md and README updated | GRC Manager | All of the above | Nobody mistakes a platform-derived band for a regulatory rating |

### Phase 2 — Process improvements

| Activity | Deliverable | Owner | Dependencies | Expected outcome |
| --- | --- | --- | --- | --- |
| Reviewer assessment capture *(complete)* | `document_reviews`; `GET`/`PUT /documents/:id/assessment`; the panel view; `assessment:write` | Reviewer, Auditor, CISO record; GRC Manager operates | Phase 1 profile | Divergence between assessors is recorded and flagged |
| Licensed catalogue import *(complete)* | `import-framework.js`; `POST /frameworks/:code/catalogue`; the Frameworks import dialogue | Administrator or GRC Manager | Licensed publication (assumption A5: not held today) | Catalogue can carry the publisher's own wording, stamped `user_imported` |
| **Load the licensed ECC-2:2024 and ISO/IEC 27001:2022 catalogues** | Two editions at `source_status: user_imported`; the reference caveat withdrawn for them | GRC Manager | Licensed copies obtained; the import above | Output becomes usable for a regulatory submission |
| **Adopt a three-assessor panel as standing practice** | A procedure naming GRC Manager, Auditor and CISO as the panel for any policy entering review; the divergence KRI as a gate before approval | CISO sets, GRC Manager operates | Reviewer capture above | The first real agreement data on the organisation's own documents |
| **Criterion scores from the AI review** *(B1)* | `aiReview` returns PA/RC/AP/GC/CC as `ai_recommendation`; a third `basis` on the scorecard | GRC Manager | An API key; the Phase 1 profile | Three views on one scale; KRI-4 becomes measurable against the AI view too |
| **Clause-to-requirement verification** *(D2)* | A check that every generated clause resolves to a requirement key | GRC Manager | None | Traceability verified rather than asserted — the paper's §8 gap, closed in the one architecture that can close it |
| **Topic-to-domain suggestion** *(B2)* | A suggestion in the generator wizard; the user still chooses the domain | GRC Manager | None | A non-specialist can start without knowing the domain vocabulary |

### Phase 3 — Advanced

| Activity | Deliverable | Owner | Dependencies | Expected outcome |
| --- | --- | --- | --- | --- |
| **Automated regulatory extraction** *(D1)* | A tool converting a regulatory PDF/DOCX into a five-field spreadsheet for review and import | GRC Manager, with the CISO approving each framework added | The catalogue import (done); extraction needs the import as its target | Adding a framework becomes hours of review rather than weeks of transcription — the paper's own top priority (§8, p. 35) |
| **Control-satisfaction scoring** *(D3)* | A measure of whether a document satisfies a control, not whether it is well formed | CISO owns the definition; GRC Manager implements | Licensed control text (Phase 2); extraction above | A regulatory metric rather than a document-hygiene metric |
| **Agreement statistics over accumulated ratings** | Krippendorff's α and Fleiss' κ across the organisation's own review history, as the paper computed them (§5.6, p. 20) | GRC Manager | Twelve months of three-assessor panel data | Whether the organisation's reviewers agree — currently unknown, and the paper's evidence says do not assume it |
| **Arabic requirement models for the remaining domains** | 18 domains beyond the six translated | GRC Manager | None — unrelated to this paper, tracked separately | Full Arabic packages across all 24 domains |
| Revisit RAG for uncovered frameworks | A decision record, not an implementation | CISO | Model coverage becoming the binding constraint | Only worth reopening if a customer needs a framework with no requirement model |

---

## Part 8 — Final recommendation

### A. Apply immediately — *done in this change*

1. **The five-criterion quality profile.** Low effort, no new measurement, and it
   fixes a real defect: one number cannot tell a reader what is wrong. The paper's
   Table 8 (p. 28) is the evidence that criterion-level resolution reveals what
   an aggregate hides.
2. **Per-reviewer assessment with divergence reported.** The paper's most valuable
   finding for a GRC platform (Table 9, p. 29) and its cheapest to act on. A
   single reviewer's approval of generated governance text is a weak signal, and
   AutGRC was treating it as a strong one.
3. **The licensed catalogue import.** The highest-consequence item here, and
   strictly speaking not the paper's idea — it closes a gap AutGRC had documented
   and not built. The paper's contribution is the target schema (§5.3.1, p. 10)
   and the argument that producing such a file is the real constraint (§7.3,
   p. 33).
4. **Temperature 0.2 on the Claude provider.** One line, cited, and it removes a
   source of the exact drift the consistency engine exists to report.

### B. Modify before applying

1. **LLM-as-a-Judge (B1).** Adopt the five criteria as scores; never as the
   approval gate. The paper's own Table 5 (p. 20) shows its automated evaluator
   rating Groundedness, Alignment and Traceability at 2/5 for outputs the human
   panel scored 20-23/25 — and ρ = 0.782 on seven outputs (§6.7, p. 30), which
   the paper itself calls exploratory, is not a licence to substitute one for the
   other.
2. **Capability matching (B2).** As a suggestion, never as automatic scope
   selection. A generated policy's scope must not depend on an embedding.
3. **Event-driven synchronisation (B3).** Take the property — the store cannot go
   stale — not the mechanism. And invert the paper's delete-then-insert step
   (§5.3.2, p. 11): match by reference and update in place, because AutGRC's
   mappings, gap items and crosswalks reference requirement ids and a delete
   would take them with it.
4. **Three-assessor panel as practice.** The paper's panel composition (§5.6,
   pp. 19-20) maps onto GRC Manager, Auditor and CISO. This needs a procedure and
   people's time, not code — the code is now in place.

### C. Do not apply, and why

1. **RAG as the generation mechanism.** AutGRC's guarantee is structural: Policy,
   Standard, Procedure, RACI, control matrix and evidence register are
   projections of one requirement model, so they agree by construction.
   Retrieval plus an LLM replaces that with a probability. The paper's own
   evidence argues against the swap — residual hallucination under RAG (§7.1,
   p. 33), Groundedness at 2/5 for the best model family (Table 5, p. 20), and a
   conclusion that positions LLM generation as assistance rather than a
   governance solution (§6.9, p. 31). **Where the paper is genuinely stronger:**
   it can produce a policy for a framework nobody has modelled. That is a real
   capability AutGRC does not have, and it is bought by giving up the guarantee.
2. **Terminological normalisation of control text.** Necessary for a retrieval
   corpus, impermissible for a catalogue. Rewriting an NCA control into a
   normalised vocabulary and presenting it as the control is writing regulatory
   text, which GOVERNANCE.md rule 1 forbids. AutGRC's crosswalks achieve the
   analytical benefit while leaving the interpretation visible and disputable.
3. **Chat as the primary interface.** A transcript has no owner, version,
   approver or review date. This is the same deficiency the paper identifies in
   its own output at §6.9.1 (p. 32).
4. **Conversational memory for refinement.** Duplicate. AutGRC refines through
   versions, change notes and an approval trail, which is the same capability in
   a form an auditor can read.
5. **Cloud LLM as the default.** AutGRC's default is offline and deterministic,
   which already answers the paper's own privacy concern (§7.6, pp. 34-35).
   Moving would be a regression.
6. **Supabase, pgvector, PostgreSQL, ChromaDB, Pinecone, n8n, Google Drive.**
   Infrastructure for a retrieval pipeline that does not exist here. Following C1.
7. **PDF as an authoritative dataset format.** §7.4 (p. 34) documents the
   extraction problems; guessing a control hierarchy from a PDF layout and
   writing it into source material is not a risk worth taking. Document import
   for *analysis* already accepts PDF, which is a different path with no
   authority.
8. **BLEU and ROUGE.** The paper argues against them (§7.5, p. 34) and I agree.

### D. Keep for future consideration

1. **Automated regulatory extraction** (§7.3, p. 33; §8, p. 35) — now a bounded
   task rather than an open problem, because the import gives it a target.
2. **A dedicated policy verification mechanism** (§8, p. 35) — and AutGRC is the
   architecture that can actually build it, because it knows which requirement
   each clause came from rather than having to infer it.
3. **Regulatory-oriented evaluation metrics** (§7.5, p. 34) — depends on holding
   licensed control text first.
4. **Agreement statistics on accumulated review data** — twelve months of panel
   ratings makes Krippendorff's α computable on the organisation's own documents.
5. **Chunking granularity** (§7.2, p. 33) — only if extraction is built.

### E. Overall impact

> **ASSESSMENT.**

**What the paper contributes to AutGRC.** Four things, in descending order of
value. A **measurement vocabulary** that turns one opaque score into a profile a
CISO and an auditor can both act on. An **uncomfortable empirical finding** — that
three qualified experts scoring the same twenty governance documents agreed at or
below chance (Table 9, p. 29) — which invalidates the assumption that a single
reviewer's sign-off measures quality, and which AutGRC had built on. A **concrete
import schema** that turned a documented-but-absent capability into a week's work.
And a **cited argument** for deterministic generation settings.

**What AutGRC contributes to the paper.** The paper's §6.9.1 (p. 32) states its own
most serious limitation: generated documents "lacked organizational document
management features such as version control mechanisms, approval workflows, and
formal authorization tracking", and concluded that such output "may not fully
satisfy enterprise governance requirements without integration into organizational
Document Management Systems (DMS) or Governance, Risk, and Compliance (GRC)
platforms". **AutGRC is that platform, and it already has all three.** It also has
four things the paper's system has no analogue for: a risk register scored on ISO
27005's 5×5 model, a Statement of Applicability that insists on a reason for every
exclusion, an evidence register whose artefacts are verified by someone other than
the collector, and a provenance taxonomy on every stored object. If the two lines
of work are related — assumption A1 — the honest summary is that the research
proved the generation approach and the platform solved the governance problem the
research identified as unsolved.

**The most important thing in the paper, which the paper itself does not draw
out.** Table 5 (p. 20) reports the automated evaluator scoring GPT-5-mini —
the best family — at **Coverage 5, Completeness 5, Alignment 2, Groundedness 2,
Traceability 2**, while the human panel scored the same outputs 20-23 of 25. The
architecture exists to deliver alignment, groundedness and traceability. On the
paper's own automated measure it delivered the two things that are easy to produce
and the three that are hard were rated poorly, and the human panel did not notice.
Combined with the negative inter-rater reliability, the defensible reading is that
**neither evaluation instrument could see whether the output was actually
grounded** — which is exactly why §8 (p. 35) is right to prioritise a verification
mechanism, and exactly why AutGRC should keep generating from a model where the
provenance of every clause is known rather than inferred.

**Net effect of this change on AutGRC.** Quality reporting moved from one number
to five dimensions with named thresholds. Review moved from a recorded decision to
a recorded judgement per assessor with disagreement surfaced. The framework
catalogue can now hold licensed text, which is the precondition for using any
output in a regulatory submission. Nothing regulatory was added, removed or
reworded; no governance rule was relaxed; 137 tests pass. The generator, the risk
model, the roles, the domains and the terminology are untouched, because they were
working.

**What I would not do.** Adopt the paper's generation architecture. AutGRC's
consistency guarantee is its distinguishing property and the paper's own numbers
do not justify trading it.

---

## Source

Alharthi, H., Alyami, R., Almasabi, S., Muthanna, A., and Alburaiki, F.
*Automating Cybersecurity Governance: An AI-Driven System for Customized Security
Policy Development.* Supervised by Dr. Abdulwahab Alazeb. Najran University,
Department of Information Systems, 26 August 2026. National Cybersecurity
Authority, Cybersecurity Research and Innovation Pioneers Grant Initiative, Grant
Agreement CRPG-25-1063. 42 pages; citations in this document use the printed page
numbers of the document body.
