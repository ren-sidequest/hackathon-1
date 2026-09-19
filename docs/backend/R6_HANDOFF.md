# Revision 6 / API 4.0 — backend handoff

> **Publication follow-up (2026-09-20):** the user has now authorized committing, pushing and opening a draft backend handoff PR. The local-only statements below record the original implementation/acceptance phase, not the current publication scope. API4 frontend integration, human calibration, merge and deployment remain separate. See [publication status](R6_PUBLICATION.md).

**Contract frozen for local frontend integration, 2026-09-19.** See [acceptance](R6_ACCEPTANCE.md) for executed results and remaining gates. This is an uncommitted local delivery, not a deployed release. Human calibration, compatible frontend/browser acceptance and release approval remain separate.

## 1. Baseline, ownership and compatibility

Branch `codex/revision6-backend` starts at `dbbcad9` (includes PR12/13, newer than the original coordination baseline `24c1810`). Original worktrees and Xiaofu's frontend source remain intact. Backend owns runtime/content/tests, schema/OpenAPI/examples and generated API4 types. Xiaofu owns both UIs, the API client/controller and browser interaction tests.

The new closed applicant enum is a **breaking API 4.0 contract**, even though the existing endpoint responsibilities remain. Existing API3 clients and old stored drafts need explicit version handling, not type casts or renamed identities. Old API3 types and OpenAPI stay unchanged as historical contracts; the current executable is not an API3 compatibility server. Historical operation requires its historical executable, frontend, content and database together.

| Boundary | Frozen value |
|---|---|
| API / `schemaVersion` | `4.0` |
| Applicants | `amy-chen`, `ann-li`, `david-liu`, `jamie-parker` |
| Company / job | Harbour Retail / `junior-data-analyst` / Junior Data Analyst |
| Fixture | `harbour-retail-applications-v1` |
| JD | `harbour-retail-junior-analyst-jd-v1` |
| Rubric | `harbour-retail-junior-analyst-rubric-v1` |
| Task dataset | `harbour-retail-2026-09-v1` |
| SQLite physical format / default path | `4` / `var/evidencebridge-v4.sqlite` |

No old person, score, submission, review, shortlist or receipt is remapped to a new person. An explicit old database path fails the compatibility check before legacy SQLite bytes/permissions are changed. See [storage and rollback](R6_STORAGE.md).

## 2. First reads and exact display fields

| Frontend need | Authoritative field / endpoint |
|---|---|
| Four-person list | `GET /api/demo/comparison` → `data.candidates` |
| One person's complete context | `GET /api/demo?candidateId=amy-chen` → `data` |
| Current application assessment | `data.assessment.application_review`; immutable authored starting point is `application.baseline` |
| Original JD and full requirements | `data.job.jd.source`, `data.job.jd.requirements` |
| Person-specific JD evidence matrix | `data.application.jdAlignment` (19 requirement rows per person) |
| Current application gaps | `data.gapSuggestions`, derived from the latest `application_review` assessment |
| Application review completion | `data.assessmentComplete`; comparison `applicationsReviewed` (initially 4) |
| Full numerical core evidence | `assessment.application_review.score.complete`; comparison `candidatesWithCompleteCoreEvidence` (initially 2) |
| Three independent skill results | `score.skills[]`; NE makes that skill incomplete, not zero |
| Whole-core numerical result | `score.overallPercentage`, null if any criterion is NE; `accruedScore` and `coveragePercent` are different measures |
| Mode and write access scope | `capabilities.analysisMode`, `analysisModeLabel`, `analysisAvailable`, `analysisUnavailableReason`, `authenticationScope`, `writeAccess` |

Display the rubric label **Core analytical evidence match**. It covers SQL / Data Analysis / Business Problem Solving at 30/30/40, not the entire JD, hiring likelihood or measured workplace ability. The wider JD matrix has no extra percentage. CV claims, work samples and remaining unknowns can coexist; do not convert the statuses to a verified/unverified binary.

All 40 authored judgments have been checked and are present, including NE. Initial core percentages are Amy 82.5, Ann 70, David null, Jamie null. These are content-derived results, not ranks or hardcoded frontend constants. Fetch them. Initial `annotationMode: ai_authored` and `operatorLabel: AI-authored demo assessment · Human calibration pending` stay visible. A later explicit operator assessment uses `human`; this identifies an action, not an authenticated identity or retrospective calibration of every baseline.

Gap suggestions carry priority/reason, criterion/target, mark, checked sources, snapshot and assessment revision. Observed problems, missing evidence and minor clarifications have distinct labels. They are **application-stage** suggestions, not automatic task-V1/V2 reassessments. HR selects a target explicitly; no default BPS or name-based priority. Material clarification precedes an optional 20-minute task; there is no hard countdown or general upload API.

## 3. Sources, PDFs and quotes

`application.sources[]` includes `sourceId`, `location`, `text`, `kind` and provenance. `kind: application` is minimized CV text; `kind: work_sample` is a synthetic past-project companion inside the same owned application snapshot, not a formal task submission. Provenance records portable `filePath`, displayed-text SHA-256, page numbers, origin, disclosure, optional redaction record and original PDF download.

`job.jd.sha256` hashes original PDF bytes. `job.jd.source.sha256` hashes extracted UTF-8 text; these differ intentionally. JD ranges index `job.jd.source.text`; assessment/JD-alignment sourceRefs bind person, evidenceSnapshotId, fingerprint, sourceId, location and exact UTF-16 start/end (end exclusive). Use JavaScript `slice(start,end)` on the unchanged source. Translation or text edits invalidate old ranges; surrogate-pair boundaries are validated.

`downloadUrl` is **service-relative**, starting `/api/demo/materials/`. Prepend the configured API base: `/gateway` in the existing gateway, or the isolated backend origin locally. A bare production `/api/...` link omits the required gateway prefix.

Only the original JD and four fictional CV PDFs are allowlisted. Downloads are exact/hash-checked attachments. Default CV text omits unnecessary contacts; the explicitly labelled original fictional PDF preserves its original contact fields. Original extracts, manifest, arbitrary paths and private notes are not downloadable through this endpoint. See [content provenance and disputes](R6_CONTENT.md).

## 4. Writes and lifecycle

All writes use `Content-Type: application/json` and `Idempotency-Key` (8–100 ASCII letters/digits/underscore/hyphen). Every business write binds current `schemaVersion`, `sessionId`, `candidateId`, `jobId`, `datasetVersion`. Fetch current IDs; generated example IDs are not reusable sessions. JSON schemas reject extra fields.

| Endpoint under `/api/demo` | Additional binding and behavior |
|---|---|
| `POST /task/send` | `taskId`, `targetRequirementId`, matching `templateId`, instructions and `gapReason`; one target per person, locked after sending |
| `POST /submission` | task binding; V1 or permitted V2; `previousSubmissionId`/fingerprint (null for V1), summary/findings/processEvidence; 201 |
| `POST /analysis` | task + current submissionId/contentFingerprint; 200 result or 202 running; no scoring or shortlist effect |
| `POST /review` | current submission binding + decision + required comment; only V1 `needs_more_evidence` opens one V2 |
| `POST /assessment` | stage, snapshot/fingerprint, submission fields or null, rubricVersion, expectedAssessmentRevision, complete criterion group, optional explicit application reuse, operatorLabel; 201 |
| `POST /shortlist` | retain/remove/reconfirm, reason, viewed stage/snapshot/assessmentRevision/rubricVersion, expectedShortlistRevision, operatorLabel |
| `POST /reset` | schemaVersion + sessionId; separate admin token, disabled by default and excluded at public gateway; not a normal UI action |

V1 Confirm/Insufficient ends the task. V1 More requires specific feedback and permits one V2; V2 permits only terminal decisions and there is no V3. Historical versions stay immutable. Evidence review, rubric assessment and shortlist are independent: Confirm neither adds points nor retains someone. New work or a changed assessment basis marks retained entries `needs_reconfirmation`; old reasons/bases remain in history. Reusing non-target application skills requires explicit current application revision/snapshot/fingerprint.

Limits: 128 KiB request body; 0–40 findings; at most 100 process events; nonblank summary ≤8000; task instructions ≤4000; required review comment ≤2000; gapReason ≤2000. Finding title ≤300/detail ≤4000; event title ≤200/detail ≤1000. Frontend must check both field limits and UTF-8 serialized body bytes. Private notes remain browser-local and are absent from DTO/model/logs/HR/export.

## 5. Errors, retry and access behavior

- Optional header `X-EvidenceBridge-Schema-Version: 4.0` enables early negotiation. Old explicit header/body version → 409 `SCHEMA_MISMATCH`; the four old candidate query IDs also return 409. Other malformed/unknown IDs → 400. Approved origins receive CORS headers on the version error.
- 400 `INVALID_REQUEST` / `INVALID_ASSESSMENT`: correct the local draft; source validation is strict. Field-level validation paths are not added in this release.
- 409 includes `STALE_SESSION`, `DATASET_MISMATCH`, `STALE_SUBMISSION`, `ASSESSMENT_CONFLICT`, `SHORTLIST_CONFLICT`, `STALE_REUSE`, `IDEMPOTENCY_CONFLICT` and finite-workflow conflicts. Re-read current state and show the conflict; do not silently replace a newer record or copy an old draft to a new person.
- Retry an uncertain **identical** request with the same key; a changed body/operation needs a new key. Replayed successful receipts may show their original snapshot, so re-read after success. A failed/closed/interrupted analysis attempt has a settled receipt; a deliberate new analysis attempt uses a new key.
- 413 is the body-size limit; 415 is content type/encoding. Analysis 502/503/504 leaves the formal submission available for manual review. `disabled` returns `AI_DISABLED`; manual simulation is explicitly rule-based, not a live model experiment.
- `authentication:false` means no application role accounts. `writeAccess.status:unknown` / `enforcement:deployment_defined` does not grant public write access. In the existing gateway, viewing is public and modifications require the shared password. Handle gateway 401 `WRITE_AUTH_REQUIRED`, preserve unsaved input, offer same-origin `/gateway/write-access`, then let the user explicitly retry. Login itself performs no mutation; do not probe access by issuing a business write.
- The backend is loopback-only, with explicit local origins. The gateway owns public HTTPS, shared write access, origin checks and reset exclusion. Its prepared [English-only patch](r6/deployment/README.md) is not applied by this delivery.

## 6. Minimal isolated startup

From this repository root, with existing Node >=22.23.0 (24 LTS recommended) and Python 3. Dependency versions/lockfile remain unchanged. On a fresh checkout, install the pinned backend dependencies with `npm ci --prefix app/backend`; do not copy credentials or old `.env` files.

```sh
npm run typecheck --prefix app/backend
npm run build --prefix app/backend
# POSIX/macOS local example: use a NEW directory and port; no current demo is replaced.
R6_DIR=$(mktemp -d /tmp/evidencebridge-r6.XXXXXX)
node app/backend/scripts/manage-r6-database.mjs init --database "$R6_DIR/demo-v4.sqlite" --dry-run
node app/backend/scripts/manage-r6-database.mjs init --database "$R6_DIR/demo-v4.sqlite"
DEMO_CONTRACT=4.0 DATABASE_PATH="$R6_DIR/demo-v4.sqlite" PORT=8896 \
 ANALYSIS_MODE=manual_simulation OPENAI_API_KEY= OPENAI_MODEL= DEMO_ADMIN_TOKEN= \
 ALLOWED_ORIGINS=http://127.0.0.1:6473,http://127.0.0.1:6486 \
 node app/backend/dist/r5/server.js
# In a second terminal:
curl --fail http://127.0.0.1:8896/healthz
curl --fail 'http://127.0.0.1:8896/api/demo?candidateId=amy-chen'
```

This example deliberately invokes the built server without loading `.env`, leaves reset disabled and avoids real-model calls. Check the chosen port is free first. Stop only the process started for this isolated session. PowerShell needs equivalent environment syntax; Windows runtime/maintenance was not exercised here. Existing API3 UI should display a version mismatch until Xiaofu provides compatible API4 client/controller code; this delivery does not start or replace those UI previews.

## 7. Portable contract and generated examples

- [Frozen OpenAPI](r6/openapi.json) and [executed request manifest](r6/examples/manifest.json).
- [Independent generated API4 types](../../app/shared/api4-types.ts), generated by [frontend-types-v4.py](../../scripts/frontend-types-v4.py). Existing API3 generator/types remain unchanged.
- Initial four-person `initial-*.response.json`, `comparison-initial.response.json`; JD and sources are inside those real DTOs.
- `*-send`, `*-v1-submission`, `*-v1-analysis`, `*-v1-assessment`, `*-v1-more`, `*-v2-submission`, `*-v2-terminal` cover SQL/DA/BPS.
- Application assessment revision and shortlist retain/reconfirm examples show stale-basis handling.
- Error files cover old ID/contract, private-note rejection, V2 More and disabled analysis. Other limits/concurrency/invalid-source cases are executable tests.

The exporter actually executed **45 isolated in-memory API requests**, producing **81 example files including the manifest**, with zero model calls. Random IDs/times/receipts are run-local. Regenerate with `npm run docs:generate --prefix app/backend`, then `python3 scripts/frontend-types-v4.py` and its `--check`; do not edit generated types by hand.

## 8. Frontend handoff checklist

1. Read all people/company/JD/assessments/materials from API4; remove old identity, company, score and dataset copies.
2. Namespace drafts by contract/session/person/task/version. Preserve legacy drafts for explicit export, not automatic re-submission.
3. Separate reviewed counts from complete numerical evidence; retain all people and display NE/unranked honestly.
4. Show JD claims, synthetic sample provenance, AI-authored/human-pending label and limitation text; use exact owned citations and gateway-prefixed downloads.
5. Select SQL/DA/BPS from structured gaps with HR confirmation; preserve finite V1/V2, required feedback and separate assessment/shortlist actions.
6. Handle network waiting, 401, 409 and retry receipts before reporting save success; keep public-read/write-access semantics.
7. After adaptation, run frontend builds, shared/client tests and isolated dual-browser acceptance including 401 login/retry and old-draft/version handling. These remain **pending frontend**, not covered by backend HTTP checks.

Release requires explicit authorization, a frozen compatible frontend/backend/content set, a consistent backup, separate new v4 database, public-read/protected-write smoke checks and whole-release rollback. No commit, push, PR, merge, server connection or deployment was performed in this R6 delivery.
