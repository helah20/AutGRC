# Platform assessment and roadmap

An assessment of AutGRC against an enterprise GRC scope: Governance, Risk,
Compliance, Audit, Business Continuity, Assets and Third Parties. This file
records what exists, what is missing and the order the gaps are closed in.
Each increment ships working logic end to end: database, API, interface,
tests. Nothing is shown in the interface before it works.

Status key: **Built**, **Partial** (the record exists, parts of the lifecycle
are missing), **Missing**.

## 1. What exists today

| Module | Capability | Status |
|---|---|---|
| Governance | Policies, standards, procedures, baselines (MBSS) generated from one requirement model, in Arabic and English | Built |
| | Lifecycle: draft, review, approval, publication, revision, retirement, with segregation of duties | Built |
| | Version history, comparison, approval record | Built |
| | Roles and RACI matrices | Built |
| | Management reviews: inputs computed from the platform, decisions raising tracked actions, closed minutes | Built |
| | Quality review and scorecard, with links to where each finding is fixed | Built |
| Risk | Register with inherent and residual positions on a 5×5 matrix, treatment, owner | Built |
| | Formal acceptance with approver, rationale and expiry | Built |
| | Risk-to-control links | Built |
| | Current risk (after existing controls), control effectiveness, risk source, action owner, target date, last and next review | Built (increment 1) |
| | Configurable methodology (scales, matrix, appetite, review cycles) | Built (increment 1) |
| | Separate enterprise, cyber and operational registers | Partial: one register with categories and domains |
| Compliance | Framework library: Saudi (NCA ECC, CCC, DCC, CSCC, TCC, OTCC, OSMACC, NCNICC, NCS; SAMA CSF, IT Governance, BCM; SDAIA PDPL) and international (ISO/IEC 27001, 27002, 27005, 27017, ISO 22301, NIST CSF, 800-53, 800-171, CIS v8, COBIT, SOC 2, PCI DSS, HIPAA Security Rule, GDPR) | Built (reference text; publishers' full text imported under licence) |
| | Full control text from the official publications: ECC-2:2024 (English edition), CSCC-2:2026 and NCNICC-1:2025 (Arabic only), NCS-1:2020, OSMACC-1:2021, SAMA CSF, ITGF and BCM, PDPL (Arabic), NIST SP 800-171 r3, HIPAA Security Rule. Quoted in generated policies as the publisher's words. SOC 2, PCI DSS (12 principal requirements), GDPR (articles with obligations) and ISO/IEC 27017 (cloud controls) held as identifiers with titles, because their text is licensed or not reachable | Built |
| | Not added, rather than written from memory: CSA CCM (moving to v4.1; download behind a form), ISO/IEC 27018 and 27701 (licensed; 27701 has a new edition), CST Cybersecurity Regulatory Framework (no file found on the CST site) | Missing |
| | Cross-framework mapping and crosswalks, one control answering many frameworks | Built |
| | Gap assessment, Statement of Applicability, evidence with collection and verification | Built |
| | Control owner (a person), design and operating effectiveness, last and next assessment | Built (increment 1) |
| | Regulatory change: new editions supersede old ones without disturbing records (CSCC-1:2019 replaced by CSCC-2:2026 at startup) | Partial |
| Audit | Assessments, findings, corrective actions with root cause and independent verification, internal audit report | Built |
| | Audit universe, annual audit plan, engagements | Missing → increment 4 |
| Business continuity | BIA, BCP, DRP with RTO and RPO, exercises and lessons learned | Missing → increment 3 (policy documents exist; no records) |
| Assets | Inventory, classification, ownership, criticality, links to risks and controls | Missing → increment 2 (risks hold the affected asset as text) |
| Third parties | Vendor register, classification, due diligence, questionnaires, assessments, contracts and SLA, periodic review | Missing → increment 2 |
| Automation | Document review-due and evidence-verification notifications, swept every 6 hours | Built |
| | Deadline reminders at configurable intervals (30, 15, 5 days), escalation of overdue work, risk review cycles, acceptance expiry, control assessments, evidence collection due | Built (increment 1) |
| | Risk status-change notifications | Built (increment 1) |
| Dashboards | One dashboard plus My Work | Partial |
| | Separate executive, GRC manager, risk owner, control owner and auditor views | Missing → increment 5 |
| Security | RBAC by permission, segregation of duties, TOTP MFA, session management, audit log, password policy | Built |
| | Roles: risk manager, compliance manager, control owner, risk owner, executive | Missing → increment 5 (needs a users-table migration) |
| | Reporting lines (a manager to escalate to) | Missing: escalation goes to users who can verify actions until reporting lines exist |

## 2. Weaknesses found

- **Risk scoring is fixed in code.** The 5×5 bands, the scales and the review
  cycle can't be changed by an administrator.
- **There is no "current" risk.** The register jumps from inherent to residual
  and ignores how effective the existing controls are.
- **Controls have no named owner and no effectiveness record**, so no reminder
  can reach anyone, and a risk can't take account of how well its controls
  work.
- **Deadlines are passive.** Corrective actions, risk reviews and acceptance
  expiries are shown in lists, but nobody is reminded, and overdue work is
  never escalated.
- **Assets, vendors and continuity records live only as free text** inside
  policies and risks, so they can't be traced.

## 3. Increments

1. **Risk methodology, control effectiveness and deadline automation.** *Built.*
   - A configurable 5×5 matrix with scale wording, the highest rating that
     may be accepted, a review cycle per rating, and how much each level of
     control effectiveness reduces likelihood.
   - Current risk calculated from the inherent position and control
     effectiveness, with a suggested effectiveness drawn from linked controls.
   - Risk source, action owner, target date, recorded reviews that set the
     next review date.
   - Control owner, design and operating effectiveness, and recorded control
     assessments.
   - Reminders at configurable intervals before deadlines and when overdue:
     corrective actions, risk reviews, acceptance expiries, control
     assessments, evidence collection. Escalation of overdue work.
   - Risk status-change notifications.
2. **Asset inventory and third-party risk.**
   - Assets: classification, owner, criticality, links to risks and controls.
   - Vendor register: classification, due diligence, questionnaire,
     assessment, contract and SLA dates, periodic review.
3. **Business continuity.** BIA per business service (RTO, RPO, MTPD,
   dependencies on assets and vendors), BCP and DRP records tied to the BIA,
   exercises with findings and lessons learned.
4. **Audit planning.** Audit universe from domains, processes and vendors;
   annual plan; engagements that hold findings and reuse corrective actions.
5. **Roles and role dashboards.**
   - Risk manager, compliance manager, control owner, risk owner, executive.
   - Reporting lines for escalation.
   - A dashboard for each audience.
   - The visual identity on the requested navy palette.

## 4. Principles kept throughout

- **No regulatory text is invented.** Control wording comes from the
  publisher's catalogue when imported, otherwise from a cited reference.
- **One control answers many frameworks**, and nothing is assessed twice.
- **Traceability is kept** between risk, control, framework requirement,
  evidence, policy and finding. New records (assets, vendors, continuity)
  link into it, never sit beside it.
- **Prototypes are labelled.** A feature that is not fully implemented says
  so in the interface and in this file.
