# API 4.0 frontend handoff

## Scope and release boundary

HR and Candidate default to `VITE_APP_MODE=api4-connected`. API4 business UI lives in `app/shared/api4`; the existing black/gold and light/gold shell, resource explorer and card editor remain shared. No new dependency or backend implementation is introduced.

The original frontend implementation started from main `80d153b` and consumed the frozen backend contract at `ff053cbcb70fff230020913e76e2fafe4402dd12` (backend PR14). PR16 is now integrated into PR14 for joint verification; the current checkout contains both API4 implementations. `app/shared/api4-types.ts` is a generated handoff artifact, not a separately designed schema. Release requires a compatible API4 backend/content set and independent v4 database. Current API3 production is not an API4 server. User-approved code integration does not include deployment or database replacement.

Historical modes remain explicit: `api3-connected`, `connected` (API2), `revision5-preview`, `standalone`. They are not fallback data sources for API4. Run API3 with its historical executable, content and database together; the new backend is not an API3 compatibility server.

## What changed

- The first identity is selected from `/api/demo/comparison`; explicit invalid/old links require an explicit switch. New IDs are Amy Chen, Ann Li, David Liu and Jamie Parker. Display names, scores, versions and task templates come from API responses.
- Company facts now use Harbour Retail's supplied JD. Nineteen requirements are grouped into Essential, Desirable and Responsibilities. Person-specific claims, work evidence and unknowns coexist; there is no invented full-JD percentage.
- Original CV extracts, original PDF downloads and synthetic work companions are labelled separately. Task data and immutable submitted V1/V2 remain distinct. Quote ownership checks include candidate, snapshot, fingerprint, source, location and exact UTF-16 range.
- PDF downloads prepend the configured API base, including `/gateway` in production. Supplied PDF bytes are not rewritten. Extracted text and original PDF hashes have different meanings.
- Comparison counts use `applicationsReviewed` and `candidatesWithCompleteCoreEvidence`. NE is reviewed but not zero. Core percentages remain server-owned. Supporting evidence is expandable; the leading gap uses server priority and current assessment binding instead of the first NE.
- Structured application gaps lead to source inspection or an optional HR-confirmed target. Existing-material clarification comes first. No automatic send, new messaging endpoint, forced timer or third submission is introduced.
- Evidence review, rubric assessment and shortlist remain independent. Reconfirmation and application-score reuse retain their original version bindings.
- Draft namespaces include contract, session, content/JD/rubric/dataset versions, person, task and submission version. Old storage is retained for explicit public-prose export, never automatically migrated or submitted. Private notes are excluded from exports and request DTOs.
- 401 keeps the exact original request/key for explicit retry after same-origin editing access. 409 preserves editor input and reloads the saved basis. Uncertain writes use the same receipt. A successful save followed by failed refresh does not enable a stale view.
- The UI shows actual analysis mode and AI-authored/human-calibration provenance. Reports include source disclosures and full JD alignment separately from analytical scores.

## Local setup and verification

Node 24 LTS and the existing lockfiles are used. Install each app with its own `npm ci`. Do not install new versions or copy `.env` / credentials from another checkout.

Set `EB_API4_BACKEND_ROOT` to the current repository root (not `app/backend`). Install its backend dependencies. The browser runner builds that backend, then opens a temporary SQLite database on loopback. It reads no `.env` and calls no external model. Test reset is confined to that temporary database; its synthetic test token never reaches frontend code. The external frozen-backend setup was only required before PR14/PR16 integration; see [API contract testing](API_CONTRACT_TESTING.md) for the current and historical targets.

PowerShell example, from this frontend root:

```powershell
$env:EB_API4_BACKEND_ROOT = (Get-Location).Path
npm ci --prefix app/candidate
npm ci --prefix app/hr
npm ci --prefix "$env:EB_API4_BACKEND_ROOT/app/backend"
python "$env:EB_API4_BACKEND_ROOT/scripts/frontend-types-v4.py" --check
npm test --prefix app/candidate
npm test --prefix app/hr
npm run build --prefix app/candidate
npm run build --prefix app/hr
npm run test:api4 --prefix app/candidate
python scripts/check_repository.py
git diff --check
```

The browser suite uses backend `8894`, Candidate `6474`, HR `6487`. Override with `EB_API4_TEST_BACKEND_PORT`, `EB_API4_TEST_CANDIDATE_PORT`, `EB_API4_TEST_HR_PORT`. It refuses to reuse an occupied service. Screenshots and failure traces are in `.ci-results/api4-ui/`. Backend restart control is test-only, under `.ci-results/api4-test-control.json`.

For an interactive preview, follow the frozen backend's isolated startup instructions using a separate v4 database, no administrator token and `manual_simulation`. Start each frontend with `VITE_APP_MODE=api4-connected` and `VITE_API_BASE_URL` pointing to that service. With gateway deployment the base is `/gateway`; never bundle passwords or model credentials. No production write/reset is part of local acceptance.

The independent `API4 frontend integration` workflow now tests the current combined PR tree, checks OpenAPI/generated types and runs frontend builds plus real browser workflows. Historical API3 remains pinned to its matching executable, with all test cases retained. Do not substitute a past API4 backend for the current code under review.

## Acceptance and demonstration

Browser coverage includes four people, SQL/DA/BPS targets, actual V1/More/V2/terminal operations, assessment revisions, explicit reuse, shortlist reconfirmation, owned quotations, simultaneous/late responses, 401 receipt retry, 409 stale state, offline drafts, temporary database restart, JD status combinations, source PDFs, old identities/content versions and dynamic list bootstrap. Desktop light/dark themes are in scope. Mobile work is deferred by user instruction; existing historical mobile code/documents are retained.

Suggested 3–5 minute demonstration: company/JD → compare four → inspect a criterion and original source → full JD evidence/unknowns → optional targeted task → Candidate submits work → HR gives feedback and reviews allowed V2 → separate assessment/shortlist choice → export the selected report. Label preloaded materials and `Rule-based simulation` honestly; do not call a simulated analysis a live model run.

Human calibration, real model quality, real hiring effectiveness, production gateway patching, release backup/restore and deployment approval are separate team responsibilities. Browser interception tests for authentication errors do not prove production gateway deployment.

## Original frontend-only acceptance (before PR14 integration)

At frontend baseline `80d153b` plus this working change, against the unchanged backend `ff053cb`:

| Check | Actual result |
| --- | --- |
| `npm test --prefix app/candidate` | 102 passed, including 16 API4 unit cases |
| `npm test --prefix app/hr` | 8 passed |
| Both frontend `npm run build` commands | Passed, Candidate includes TypeScript checking |
| `npm run test:api4 --prefix app/candidate` | 36 browser cases passed using isolated API4 SQLite |
| Final visual follow-up, `--grep 'T01 \|T26 \|T29 \|T31 '` | 4 passed after sidebar company-name and spacing fixes |
| Home-link follow-up, `--grep 'T01 \|T36 '` | 2 passed after mapping the shared logo to the API4 home page; both builds passed again |
| Frozen backend `frontend-types-v4.py --check` | Passed; copied generated types have identical SHA-256 |
| `python scripts/check_repository.py` | 20 collaboration documents and links passed |
| `git diff --check` | Passed |

After the final visual fixes, both builds and all 102 unit cases passed again. Desktop preview screenshots of the comparison, company, JD and Candidate materials were inspected; both roles produced zero JavaScript page errors. Local browser logs and traces are under `.ci-results/`, which is excluded from source control. These results do not imply GitHub Actions have run.

Actual frontend file groups: `app/shared/api4/` (independent client/controller, views, materials/JD, gap suggestions, draft recovery, reports and scoped styles); generated `app/shared/api4-types.ts`; both app entry points and `Api4App.tsx` wrappers; optional `workspaceName` in shared `ui.tsx`; Candidate API4 unit/browser tests and runners; Candidate package test command; the API4 CI workflow; this handoff and `AGENTS.md` command guidance. Existing backend source, dependencies, lockfiles and historical API3 business code are unchanged.

The interactive local preview uses HR `6686`, Candidate `6673` and an isolated backend `8898`, with `manual_simulation` and reset disabled. Its independent database is `.ci-results/api4-preview.sqlite` in the frontend checkout. No production connection, code push, PR, merge or deployment was performed by this frontend implementation.
