# API reference

All routes are under `/api`. Every route except `/api/health` and
`/api/auth/*` requires a bearer access token.

Authorisation is by permission, not role. A denied request returns `403` with
the permission that was required:

```json
{ "error": "You do not have permission to perform this action",
  "required": "generate:run", "yourRole": "read_only" }
```

## Authentication

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/login` | Returns the access token and sets the refresh cookie. Rate limited. |
| POST | `/auth/refresh` | Rotates the refresh token. |
| POST | `/auth/logout` | Revokes the session. |
| GET | `/auth/me` | Current user, permissions and organisation profile. |
| POST | `/auth/change-password` | Revokes every session on success. |
| GET/DELETE | `/auth/sessions` | List or revoke the user's sessions. |

## Generation

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/generator/options` | — |
| GET | `/generator/domains/:key` | — |
| POST | `/generator/preview` | `generate:run` |
| POST | `/generator/generate` | `generate:run` |
| GET | `/generator/packages` | — |

`POST /generator/generate`

```json
{ "domainKey": "iam",
  "docTypes": ["policy", "standard", "procedure", "roles", "raci", "control_matrix"],
  "frameworkCodes": ["NCA-ECC", "ISO-27001"],
  "parameterOverrides": { "accessReviewFrequency": "monthly" },
  "classification": "confidential" }
```

Creates the documents, their sections, a version snapshot, the controls, the
evidence register, the framework mappings, the hierarchy links and the RACI
matrix in one transaction.

## Documents

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/documents` | `document:read` |
| GET | `/documents/:id` | `document:read` |
| POST | `/documents` | `document:create` |
| PATCH | `/documents/:id` | `document:update` |
| DELETE | `/documents/:id` | `document:delete` |
| POST/PUT/DELETE | `/documents/:id/sections…` | `document:update` |
| GET | `/documents/:id/transitions` | `document:read` |
| POST | `/documents/:id/transition` | varies by target status |
| GET | `/documents/:id/compare?from=…` | `document:read` |
| POST | `/documents/:id/comments` | `comment:write` |
| POST | `/documents/:id/links` | `document:update` |
| GET | `/documents/:id/assessment` | `document:read` |
| PUT | `/documents/:id/assessment` | `assessment:write`, and never the document's own owner |

Lifecycle transitions are validated server-side. Each target status requires
its own permission, a document cannot be approved by its owner, and
publishing issues a whole version number and schedules the next review.

## Quality and AI

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/ai/provider` | — |
| POST | `/ai/review/document/:id` | `ai:use` |
| POST | `/ai/review/domain/:key` | `ai:use` |
| POST | `/ai/rewrite` | `ai:use` |
| POST | `/ai/draft` | `ai:use` |
| GET | `/ai/runs` | — |

Reviews persist their findings. A finding that no longer reproduces is closed
as resolved rather than deleted, so the audit trail shows it was raised and
cleared.

## Control environment

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/controls`, `/controls/:id` | `document:read` |
| POST/PATCH/DELETE | `/controls…` | `control:write` |
| GET | `/frameworks` | — |
| GET | `/frameworks/:code/requirements` | — |
| GET | `/frameworks/requirements/:id/trace` | — |
| GET | `/frameworks/coverage` | — |
| POST | `/frameworks/:code/catalogue` (multipart; `confirm=true` to write) | `settings:write` |
| GET/POST/DELETE | `/frameworks/crosswalks…` | `mapping:write` to write |
| POST/DELETE | `/frameworks/mappings…` | `mapping:write` |
| POST | `/frameworks/requirements/:id/suggest` | `ai:use` |
| GET/PATCH/DELETE | `/evidence…` | `evidence:write` to write |

`GET /frameworks/requirements/:id/trace` returns the full chain — source
requirement, mapped controls, policy, standard, procedure, evidence — plus
the cross-framework equivalences.

## Roles and RACI

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/roles`, `/roles/:id`, `/roles/:id/coverage` | `document:read` |
| POST | `/roles`, `/roles/from-library` | `role:write` |
| PATCH/DELETE | `/roles/:id`, `/roles/:id/items…` | `role:write` |
| GET | `/raci`, `/raci/:id`, `/raci/:id/validate` | `document:read` |
| POST/PATCH/DELETE | `/raci…` | `raci:write` |
| PUT | `/raci/:id/assign` | `raci:write` |

Every mutating RACI call returns the rehydrated matrix with fresh validation.

## Assurance and reporting

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST/PATCH/DELETE | `/assessments…` | `gap:write` to write |
| GET/POST/PATCH | `/findings…` | `finding:write` to write |
| GET | `/search?q=…` | `document:read` |
| GET | `/dashboard` | `document:read` |
| GET | `/reports`, `/reports/:key` | `document:read` |
| GET | `/reports/:key/export.{xlsx,pdf}` | `export:run` |

## Export

| Path | Produces |
| --- | --- |
| `/export/documents/:id.docx` | Word with cover page, document control, approval and version tables, contents, headers, footers and page numbering |
| `/export/documents/:id.pdf` | The same structure as PDF |
| `/export/controls.xlsx` | Control matrix with an evidence sheet |
| `/export/raci/:id.xlsx` | RACI matrix, legend and validation findings |
| `/export/mappings.xlsx` | Framework mapping with a coverage summary |
| `/export/gap/:id.xlsx` | Gap assessment with a status summary |
| `/export/register.xlsx` | Document register |

## Import

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/imports`, `/imports/:id` | `document:read` |
| POST | `/imports` | `import:write` |
| POST | `/imports/:id/reanalyse` | `import:write` |
| POST | `/imports/:id/promote` | `document:create` |
| DELETE | `/imports/:id` | `import:write` |

Accepts `.docx`, `.pdf`, `.xlsx`, `.csv`, `.txt`, `.md` and `.html` up to
15 MB. Returns coverage against the domain model, the requirements addressed
and not addressed, document-control metadata presence, and findings covering
duplicate, conflicting, ambiguous and outdated content.

## Administration

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST/PATCH | `/admin/users…` | `user:manage` |
| GET | `/admin/directory` | `document:read` |
| GET | `/admin/org` | `document:read` |
| PUT | `/admin/org` | `settings:write` |
| GET | `/admin/audit` | `audit:read` |
| GET | `/admin/system` | `document:read` |

## Errors

| Status | Meaning |
| --- | --- |
| 400 | Validation failed; `issues` lists the offending paths |
| 401 | No or expired token — the client refreshes once and retries |
| 403 | Permission denied; the response names the permission required |
| 404 | Not found |
| 409 | Conflict, such as editing a published document or an invalid transition |
| 422 | The uploaded file could not be read |
| 429 | Rate limited |
