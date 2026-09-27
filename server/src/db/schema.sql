-- ============================================================================
-- AutGRC — Cybersecurity Governance Documentation Platform
-- Relational schema. Every governance object carries provenance so that
-- regulatory source material is never confused with generated content.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- identity --
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN
                    ('admin','grc_manager','cyber_user','reviewer','approver','auditor','read_only')),
  job_title       TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  failed_logins   INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  last_login_at   TEXT,
  -- The platform applies to itself the multi-factor requirement its own
  -- policies mandate. The secret is the TOTP shared key; recovery codes are
  -- stored hashed, never in the clear.
  mfa_secret      TEXT,
  mfa_enabled     INTEGER NOT NULL DEFAULT 0,
  mfa_enrolled_at TEXT,
  mfa_recovery_codes TEXT,
  -- Set by an administrator's password reset; while set, the session may do
  -- nothing but choose a new password.
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash  TEXT NOT NULL,
  user_agent    TEXT,
  ip            TEXT,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  revoked_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  at            TEXT NOT NULL,
  user_id       TEXT,
  user_email    TEXT,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  summary       TEXT,
  detail        TEXT,
  ip            TEXT,
  outcome       TEXT NOT NULL DEFAULT 'success'
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- ------------------------------------------------------- organisation data --
CREATE TABLE IF NOT EXISTS org_profile (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  org_name              TEXT NOT NULL,
  org_type              TEXT,
  industry              TEXT,
  size                  TEXT,
  country               TEXT,
  regulators            TEXT,      -- JSON array
  operating_model       TEXT,
  technology_env        TEXT,      -- JSON array
  risk_appetite         TEXT,
  -- Comma-separated roles that may not sign in without a second factor.
  mfa_required_roles    TEXT,
  business_requirements TEXT,
  data_classifications  TEXT,      -- JSON array
  logo_data_url         TEXT,
  updated_at            TEXT NOT NULL
);

-- ------------------------------------------------------------- frameworks --
CREATE TABLE IF NOT EXISTS frameworks (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  publisher     TEXT,
  version       TEXT,
  kind          TEXT NOT NULL DEFAULT 'framework'
                  CHECK (kind IN ('regulation','framework','standard','benchmark')),
  jurisdiction  TEXT,
  description   TEXT,
  source_note   TEXT,
  is_mandatory  INTEGER NOT NULL DEFAULT 0,
  -- A framework is published in editions. When a new one arrives the old one
  -- is superseded rather than replaced: an organisation stays certified
  -- against the edition it was assessed under until it migrates.
  edition_status TEXT NOT NULL DEFAULT 'current'
                  CHECK (edition_status IN ('current','superseded','draft')),
  supersedes_id TEXT REFERENCES frameworks(id) ON DELETE SET NULL,
  published_on  TEXT,
  retires_on    TEXT,
  created_at    TEXT NOT NULL
);

-- Authoritative source requirements. provenance is always regulatory/framework.
CREATE TABLE IF NOT EXISTS framework_requirements (
  id            TEXT PRIMARY KEY,
  framework_id  TEXT NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  ref           TEXT NOT NULL,            -- e.g. "2-2-3-4", "A.8.2", "PR.AA-05"
  parent_ref    TEXT,
  title         TEXT NOT NULL,
  statement     TEXT,
  domain_key    TEXT,
  level         INTEGER NOT NULL DEFAULT 1,
  provenance    TEXT NOT NULL DEFAULT 'framework_guidance'
                  CHECK (provenance IN ('regulatory_requirement','framework_guidance')),
  source_status TEXT NOT NULL DEFAULT 'reference'
                  CHECK (source_status IN ('reference','verified_official','user_imported')),
  created_at    TEXT NOT NULL,
  UNIQUE (framework_id, ref)
);
CREATE INDEX IF NOT EXISTS idx_fwreq_domain ON framework_requirements(domain_key);
CREATE INDEX IF NOT EXISTS idx_fwreq_fw ON framework_requirements(framework_id);

-- -------------------------------------------------------------- documents --
CREATE TABLE IF NOT EXISTS documents (
  id              TEXT PRIMARY KEY,
  reference       TEXT NOT NULL UNIQUE,   -- e.g. "POL-IAM-001"
  title           TEXT NOT NULL,
  doc_type        TEXT NOT NULL CHECK (doc_type IN
                    ('policy','standard','procedure','guideline','framework',
                     'roles','raci','control_matrix','work_instruction')),
  domain_key      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                    ('draft','under_review','approved','published','under_revision','retired')),
  classification  TEXT NOT NULL DEFAULT 'internal'
                    CHECK (classification IN ('public','internal','confidential','secret','top_secret')),
  version         TEXT NOT NULL DEFAULT '0.1',
  owner_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  approver_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewer_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  effective_date  TEXT,
  review_date     TEXT,
  retired_date    TEXT,
  summary         TEXT,
  parent_id       TEXT REFERENCES documents(id) ON DELETE SET NULL,
  package_id      TEXT,
  generation_meta TEXT,                  -- JSON: inputs, assumptions, provider
  provenance      TEXT NOT NULL DEFAULT 'organizational_policy',
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_doc_domain ON documents(domain_key);
CREATE INDEX IF NOT EXISTS idx_doc_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_doc_package ON documents(package_id);

CREATE TABLE IF NOT EXISTS document_sections (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_key  TEXT NOT NULL,
  heading      TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',   -- sanitised HTML
  position     INTEGER NOT NULL DEFAULT 0,
  provenance   TEXT NOT NULL DEFAULT 'ai_recommendation',
  source_refs  TEXT,                       -- JSON array of source pointers
  locked       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sec_doc ON document_sections(document_id, position);

CREATE TABLE IF NOT EXISTS document_versions (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version      TEXT NOT NULL,
  snapshot     TEXT NOT NULL,   -- JSON of document + sections
  change_note  TEXT,
  change_type  TEXT NOT NULL DEFAULT 'revision',
  author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name  TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ver_doc ON document_versions(document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS document_approvals (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,        -- submitted | reviewed | approved | rejected | published | retired
  from_status  TEXT,
  to_status    TEXT,
  actor_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name   TEXT,
  actor_role   TEXT,
  comment      TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appr_doc ON document_approvals(document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_id   TEXT REFERENCES document_sections(id) ON DELETE CASCADE,
  author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name  TEXT,
  body         TEXT NOT NULL,
  quote        TEXT,
  resolved     INTEGER NOT NULL DEFAULT 0,
  resolved_by  TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comment_doc ON comments(document_id, created_at DESC);

-- Explicit relationships: hierarchy + traceability edges between documents.
CREATE TABLE IF NOT EXISTS document_links (
  id           TEXT PRIMARY KEY,
  from_id      TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  to_id        TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  link_type    TEXT NOT NULL DEFAULT 'implements'
                 CHECK (link_type IN ('implements','supports','supersedes','references','derived_from')),
  note         TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (from_id, to_id, link_type)
);

-- ------------------------------------------------------------------ roles --
CREATE TABLE IF NOT EXISTS roles (
  id                TEXT PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  short_name        TEXT,
  category          TEXT,
  purpose           TEXT,
  reporting_line    TEXT,
  authority         TEXT,
  domain_key        TEXT,
  competencies      TEXT,   -- JSON array
  interfaces        TEXT,   -- JSON array [{role, nature}]
  document_id       TEXT REFERENCES documents(id) ON DELETE SET NULL,
  provenance        TEXT NOT NULL DEFAULT 'organizational_policy',
  is_demo           INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_items (
  id          TEXT PRIMARY KEY,
  role_id     TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN
                ('responsibility','accountability','activity','approval','escalation')),
  text        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  domain_key  TEXT,
  provenance  TEXT NOT NULL DEFAULT 'ai_recommendation',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roleitem ON role_items(role_id, kind, position);

-- ------------------------------------------------------------------- raci --
CREATE TABLE IF NOT EXISTS raci_matrices (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  domain_key   TEXT,
  mode         TEXT NOT NULL DEFAULT 'raci' CHECK (mode IN ('raci','rasci')),
  description  TEXT,
  document_id  TEXT REFERENCES documents(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS raci_roles (
  id          TEXT PRIMARY KEY,
  matrix_id   TEXT NOT NULL REFERENCES raci_matrices(id) ON DELETE CASCADE,
  role_id     TEXT REFERENCES roles(id) ON DELETE SET NULL,
  label       TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS raci_activities (
  id            TEXT PRIMARY KEY,
  matrix_id     TEXT NOT NULL REFERENCES raci_matrices(id) ON DELETE CASCADE,
  activity      TEXT NOT NULL,
  phase         TEXT,
  control_id    TEXT,
  position      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS raci_assignments (
  id           TEXT PRIMARY KEY,
  matrix_id    TEXT NOT NULL REFERENCES raci_matrices(id) ON DELETE CASCADE,
  activity_id  TEXT NOT NULL REFERENCES raci_activities(id) ON DELETE CASCADE,
  role_col_id  TEXT NOT NULL REFERENCES raci_roles(id) ON DELETE CASCADE,
  value        TEXT NOT NULL CHECK (value IN ('R','A','S','C','I','')),
  UNIQUE (activity_id, role_col_id)
);

-- --------------------------------------------------------------- controls --
CREATE TABLE IF NOT EXISTS controls (
  id                TEXT PRIMARY KEY,
  control_id        TEXT NOT NULL UNIQUE,   -- e.g. IAM-001
  name              TEXT NOT NULL,
  domain_key        TEXT NOT NULL,
  description       TEXT,
  requirement       TEXT,
  control_type      TEXT CHECK (control_type IN
                      ('preventive','detective','corrective','deterrent','compensating','directive')),
  control_nature    TEXT CHECK (control_nature IN ('technical','administrative','physical','hybrid')),
  implementation    TEXT,
  responsible_role  TEXT,
  accountable_role  TEXT,
  frequency         TEXT,
  kpi               TEXT,
  risk              TEXT,
  risk_rating       TEXT CHECK (risk_rating IN ('low','medium','high','critical')),
  maturity          INTEGER DEFAULT 0,
  testing_method    TEXT,
  policy_ref        TEXT,
  standard_ref      TEXT,
  procedure_ref     TEXT,
  policy_id         TEXT REFERENCES documents(id) ON DELETE SET NULL,
  standard_id       TEXT REFERENCES documents(id) ON DELETE SET NULL,
  procedure_id      TEXT REFERENCES documents(id) ON DELETE SET NULL,
  requirement_key   TEXT,                  -- link back to the canonical requirement
  status            TEXT NOT NULL DEFAULT 'proposed'
                      CHECK (status IN ('proposed','approved','implemented','retired')),
  provenance        TEXT NOT NULL DEFAULT 'organizational_policy',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ctrl_domain ON controls(domain_key);

CREATE TABLE IF NOT EXISTS evidence (
  id             TEXT PRIMARY KEY,
  evidence_id    TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  description    TEXT,
  evidence_type  TEXT,
  domain_key     TEXT,
  control_id     TEXT REFERENCES controls(id) ON DELETE CASCADE,
  frequency      TEXT,
  owner_role     TEXT,
  source_system  TEXT,
  retention      TEXT,
  status         TEXT NOT NULL DEFAULT 'required'
                   CHECK (status IN ('required','collected','verified','missing','expired')),
  last_collected TEXT,
  file_id        TEXT,
  provenance     TEXT NOT NULL DEFAULT 'organizational_policy',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ev_control ON evidence(control_id);

-- Collected evidence artefacts. An evidence item recurs (monthly access
-- review, quarterly firewall rule review), so each collection is its own row:
-- the register records what is required, this records what was actually
-- produced, by whom, and who checked it.
CREATE TABLE IF NOT EXISTS evidence_files (
  id            TEXT PRIMARY KEY,
  evidence_id   TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  mime          TEXT,
  size_bytes    INTEGER,
  sha256        TEXT,
  note          TEXT,
  period        TEXT,          -- the collection period this artefact covers
  collected_at  TEXT NOT NULL,
  uploaded_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_at   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evfile_evidence ON evidence_files(evidence_id, collected_at DESC);

-- ------------------------------------------------------------ risk -------
-- The risk register is a projection of the same canonical requirement model
-- the policies come from: each canonical requirement already states the risk
-- it exists to address, so a risk and the controls that treat it share an
-- origin rather than being maintained as two separate truths.
CREATE TABLE IF NOT EXISTS risks (
  id                 TEXT PRIMARY KEY,
  risk_id            TEXT NOT NULL UNIQUE,     -- e.g. RSK-IAM-004
  title              TEXT NOT NULL,
  description        TEXT,
  domain_key         TEXT NOT NULL,
  requirement_key    TEXT,                     -- back to the canonical requirement
  category           TEXT NOT NULL DEFAULT 'operational'
                       CHECK (category IN ('confidentiality','integrity','availability',
                                           'compliance','operational','third_party','financial','reputational')),
  threat             TEXT,
  vulnerability      TEXT,
  affected_asset     TEXT,

  -- Inherent: before any control. 1-5 each, scored as the product.
  inherent_likelihood INTEGER NOT NULL DEFAULT 3 CHECK (inherent_likelihood BETWEEN 1 AND 5),
  inherent_impact     INTEGER NOT NULL DEFAULT 3 CHECK (inherent_impact BETWEEN 1 AND 5),

  -- Residual: after the controls actually in place. Seeded equal to inherent
  -- and flagged unassessed, because a residual rating nobody has worked out
  -- must not read as an improvement somebody achieved.
  residual_likelihood INTEGER NOT NULL DEFAULT 3 CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact     INTEGER NOT NULL DEFAULT 3 CHECK (residual_impact BETWEEN 1 AND 5),
  residual_assessed   INTEGER NOT NULL DEFAULT 0,

  treatment          TEXT NOT NULL DEFAULT 'mitigate'
                       CHECK (treatment IN ('mitigate','accept','transfer','avoid')),
  treatment_summary  TEXT,
  owner_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  owner_role         TEXT,
  status             TEXT NOT NULL DEFAULT 'identified'
                       CHECK (status IN ('identified','assessed','treated','accepted','closed')),
  review_date        TEXT,

  -- Accepting a risk is a decision with a name on it, not a status change.
  accepted_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  accepted_by_name   TEXT,
  accepted_at        TEXT,
  acceptance_rationale TEXT,
  acceptance_expires TEXT,

  provenance         TEXT NOT NULL DEFAULT 'ai_recommendation',
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_risk_domain ON risks(domain_key, status);

-- Which controls treat which risk. A control generated from the same canonical
-- requirement is linked automatically; anything else is a human judgement.
CREATE TABLE IF NOT EXISTS risk_controls (
  id           TEXT PRIMARY KEY,
  risk_id      TEXT NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  control_id   TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  effect       TEXT NOT NULL DEFAULT 'reduces_likelihood'
                 CHECK (effect IN ('reduces_likelihood','reduces_impact','both','detects')),
  note         TEXT,
  provenance   TEXT NOT NULL DEFAULT 'organizational_policy',
  created_at   TEXT NOT NULL,
  UNIQUE (risk_id, control_id)
);

-- --------------------------------------------------- corrective actions ---
-- What somebody is actually going to do about a finding, a gap or a risk, by
-- when. Findings were raised and then nothing held them.
CREATE TABLE IF NOT EXISTS corrective_actions (
  id            TEXT PRIMARY KEY,
  action_id     TEXT NOT NULL UNIQUE,          -- e.g. CA-0007
  title         TEXT NOT NULL,
  description   TEXT,
  source_type   TEXT NOT NULL CHECK (source_type IN ('finding','gap_item','risk','assessment','manual')),
  source_id     TEXT,
  domain_key    TEXT,
  owner_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  due_date      TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','blocked','completed','cancelled')),
  progress      INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  blocked_reason TEXT,
  completed_at  TEXT,
  -- Closing your own action is not verification; the route enforces that too.
  verified_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_at   TEXT,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_action_owner ON corrective_actions(owner_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_action_source ON corrective_actions(source_type, source_id);

-- ------------------------------------------- statement of applicability ---
-- ISO/IEC 27001 requires a reasoned decision per Annex A control, including
-- for the ones excluded. Coverage is derived from the mappings; only the
-- decision and its justification are stored, so the two cannot disagree.
CREATE TABLE IF NOT EXISTS soa_decisions (
  id             TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL UNIQUE REFERENCES framework_requirements(id) ON DELETE CASCADE,
  framework_id   TEXT NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  applicable     INTEGER NOT NULL DEFAULT 1,
  justification  TEXT,
  decided_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_by_name TEXT,
  decided_at     TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_soa_framework ON soa_decisions(framework_id);

-- ---------------------------------------------------------- notifications --
-- What is waiting on a named person. The dashboard already counted documents
-- past their review date; nothing told the person who owns them.
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,   -- review_requested | approval_requested | ready_to_publish
                               -- | approved | published | comment | finding | review_due
                               -- | evidence_verification
  title       TEXT NOT NULL,
  body        TEXT,
  entity_type TEXT,
  entity_id   TEXT,
  url         TEXT,            -- the client route that resolves it
  severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','danger')),
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name  TEXT,
  -- Set on anything raised by a repeating sweep, so a review falling due does
  -- not produce one notification per sweep for the rest of the year.
  dedupe_key  TEXT,
  read_at     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_inbox ON notifications(user_id, read_at, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedupe ON notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- ---------------------------------------------------------------- mapping --
CREATE TABLE IF NOT EXISTS control_mappings (
  id                TEXT PRIMARY KEY,
  control_id        TEXT REFERENCES controls(id) ON DELETE CASCADE,
  requirement_id    TEXT REFERENCES framework_requirements(id) ON DELETE CASCADE,
  coverage          TEXT NOT NULL DEFAULT 'covered'
                      CHECK (coverage IN ('covered','partial','not_covered','not_applicable')),
  rationale         TEXT,
  confidence        TEXT DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  mapped_by         TEXT,
  provenance        TEXT NOT NULL DEFAULT 'ai_recommendation',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (control_id, requirement_id)
);
CREATE INDEX IF NOT EXISTS idx_map_req ON control_mappings(requirement_id);

-- Cross-framework equivalences (ECC 2-2-3-4 <-> ISO A.8.2 <-> NIST PR.AA-05)
CREATE TABLE IF NOT EXISTS crosswalks (
  id            TEXT PRIMARY KEY,
  source_id     TEXT NOT NULL REFERENCES framework_requirements(id) ON DELETE CASCADE,
  target_id     TEXT NOT NULL REFERENCES framework_requirements(id) ON DELETE CASCADE,
  relation      TEXT NOT NULL DEFAULT 'equivalent'
                  CHECK (relation IN ('equivalent','broader','narrower','related')),
  note          TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE (source_id, target_id)
);

-- ---------------------------------------------------------- gap assessment --
CREATE TABLE IF NOT EXISTS assessments (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  framework_id TEXT REFERENCES frameworks(id) ON DELETE SET NULL,
  scope        TEXT,
  status       TEXT NOT NULL DEFAULT 'in_progress'
                 CHECK (status IN ('planned','in_progress','completed','archived')),
  owner_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  started_at   TEXT,
  due_at       TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gap_items (
  id              TEXT PRIMARY KEY,
  assessment_id   TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  requirement_id  TEXT REFERENCES framework_requirements(id) ON DELETE SET NULL,
  requirement_ref TEXT,
  requirement_txt TEXT,
  current_state   TEXT,
  target_state    TEXT,
  gap             TEXT,
  risk            TEXT,
  risk_rating     TEXT CHECK (risk_rating IN ('low','medium','high','critical')),
  recommendation  TEXT,
  owner           TEXT,
  due_date        TEXT,
  status          TEXT NOT NULL DEFAULT 'non_compliant' CHECK (status IN
                    ('compliant','partially_compliant','non_compliant','not_applicable')),
  evidence_ref    TEXT,
  document_id     TEXT REFERENCES documents(id) ON DELETE SET NULL,
  control_id      TEXT REFERENCES controls(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gap_assess ON gap_items(assessment_id);

-- ------------------------------------------------------- quality findings --
CREATE TABLE IF NOT EXISTS findings (
  id            TEXT PRIMARY KEY,
  scope_type    TEXT NOT NULL,   -- document | package | domain | matrix | import
  scope_id      TEXT,
  category      TEXT NOT NULL CHECK (category IN
                  ('completeness','consistency','accountability','auditability',
                   'compliance','ambiguity','duplication','currency','ownership')),
  severity      TEXT NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  title         TEXT NOT NULL,
  detail        TEXT,
  location      TEXT,
  recommendation TEXT,
  evidence      TEXT,            -- JSON: the conflicting statements
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','acknowledged','resolved','accepted_risk','false_positive')),
  source        TEXT NOT NULL DEFAULT 'engine',  -- engine | ai | user
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_find_scope ON findings(scope_type, scope_id);

-- --------------------------------------------------------------- imports --
CREATE TABLE IF NOT EXISTS uploads (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  mime          TEXT,
  size_bytes    INTEGER,
  sha256        TEXT,
  kind          TEXT,         -- policy | procedure | standard | control_matrix | framework | evidence
  domain_key    TEXT,
  status        TEXT NOT NULL DEFAULT 'uploaded'
                  CHECK (status IN ('uploaded','analyzed','imported','failed')),
  extracted_text TEXT,
  analysis      TEXT,         -- JSON report
  uploaded_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);

-- ------------------------------------------------------------ ai activity --
CREATE TABLE IF NOT EXISTS ai_runs (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,     -- generate | review | rewrite | map | analyze
  provider    TEXT NOT NULL,
  model       TEXT,
  scope_type  TEXT,
  scope_id    TEXT,
  input       TEXT,
  output      TEXT,
  assumptions TEXT,
  duration_ms INTEGER,
  status      TEXT NOT NULL DEFAULT 'success',
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_airun_scope ON ai_runs(scope_type, scope_id);

-- --------------------------------------------------------- search indexing --
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  entity_type,
  entity_id UNINDEXED,
  title,
  body,
  domain_key,
  badge UNINDEXED,
  url UNINDEXED,
  tokenize = 'porter unicode61'
);
