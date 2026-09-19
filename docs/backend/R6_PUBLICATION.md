# Revision 6 backend — GitHub handoff publication

**2026-09-20 · Backend PR14, updated with PR16 for joint integration. Deployment remains separate.**

The user subsequently approved integrating main `9b1d192` (PR15 and PR16), correcting the test-target bindings, then merging PR14 after latest-head CI passes. The current working change contains Xiaofu's API4 frontend without business-code rewrites. The sections headed “at publication” below record the earlier backend-only handoff, not a pending frontend delivery. Current test targets and commands are in [API contract testing](../API_CONTRACT_TESTING.md). Merge status is authoritative in [PR14](https://github.com/ren-sidequest/hackathon-1/pull/14); this note does not announce deployment.

The user authorized uploading the completed backend to GitHub after its local acceptance. Publish branch `codex/revision6-backend` against `main` of `ren-sidequest/hackathon-1`; the implementation baseline is `dbbcad921f2f2f33135721dc387bdb7dcdd4ee00` (including PR12/13). Check the PR head and CI for the exact uploaded version. Earlier “uncommitted / local only” statements in the September 19 reports describe that completed phase.

## Included and preserved

- Harbour Retail / four new fictional applicants, API4 contract, independent generated types, disclosed synthetic materials and evidence-based demo annotations.
- Original source PDFs, 19 JD requirements × four applicants, 40 judgments, 145 references, deterministic calculation, scoped task / V1 / V2 / assessment / shortlist state and new-database protection.
- Portable [integration contract](R6_HANDOFF.md), [content and calibration questions](R6_CONTENT.md), [implementation acceptance](R6_ACCEPTANCE.md), [storage and rollback](R6_STORAGE.md), OpenAPI and executed examples.
- Publication-only additions: this status note, phase clarification in handoff/acceptance, backend CI checks for the API4 schema, generated types and content audit, and scoped `.gitattributes` preserving hash-checked fixture bytes. No new runtime feature or frontend adaptation was added during upload preparation.
- Dependencies, lockfiles, existing API3 frontend/client/controller and historical API3 generated types remain unchanged. Logs, databases, local configuration and credentials are excluded.

## Verification at publication

Publication checks actually reran on macOS / Node v22.23.2:

| Check | Result |
|---|---|
| `npm run typecheck --prefix app/backend` | Passed |
| `npm test --prefix app/backend` (includes build) | 282/282 passed; zero failures/skips |
| `node app/backend/scripts/verify-r6.mjs` | 27/27 isolated HTTP checks passed |
| `python3 scripts/frontend-types-v4.py --check` | Passed |
| `python3 scripts/frontend-types-v3.py --check` | Passed; historical contract preserved |
| `node app/backend/content/r6/generate-audit.mjs --check` | 4 applicants / 40 judgments / 145 references / 27 file hashes passed |
| In-memory application `swagger()` versus stored API4 OpenAPI | Exact match; original executed examples preserved |
| `python3 scripts/check_repository.py` | 20 collaboration documents and their local links passed |
| `git diff --check` and targeted publishable-file scan | Passed; runtime/private artifacts excluded |

Local logs remain in ignored `.ci-results/r6-publication/` and `.ci-results/r6-http/`. No external model calls or real-server operations were used. Coverage numbers in the earlier implementation acceptance belong to that run; this publication did not repeat coverage. CI status is separate from local results and must be read against the current head.

The first staged whitespace check caught original PDF-extraction layout spaces that the earlier unstaged check had not covered. The extraction bytes, hashes and citation offsets were deliberately preserved. Scoped attributes exempt only trailing/EOF layout whitespace in the original/public extraction text; ordinary code and authored-document whitespace checks remain. All hash-checked R6 assets disable checkout EOL conversion to preserve exact bytes across Git settings. This is not a claim of a Windows runtime test.

Backend CI retains legacy/current schema checks and now also checks `docs/backend/r6/openapi.json`, `frontend-types-v4.py --check`, `generate-audit.mjs --check` and `verify-r6.mjs`. Executed examples contain run-specific IDs/times: schema/types/audit must be stable, while example timestamps are not compared byte-for-byte across reruns.

At the initial upload, Candidate CI failed because `test:api3` used the current API4 server for the historical schema 3.0 client. The integration revision resolves this by selecting the matching `80d153b` backend, analyzer and reset CLI for all 30 historical cases. API4's 36 browser cases now test the current combined checkout instead of a frozen backend. No test is suppressed and no assertion is weakened.

## Original handoff boundary and current remaining gates

### Joint integration local recheck

On macOS / Node v22.23.2, the combined tree passed Candidate 102 unit tests, HR 8 unit tests, both frontend builds, all 30 historical API3 browser cases and all 36 current API4 browser cases. Backend typecheck, a build followed by `node --test --test-concurrency=1 test/*.test.mjs` from `app/backend` (282/282, zero skips/cancellations), all 27 isolated HTTP checks, generated types, and the 4-person / 40-item / 145-citation / 27-file content audit also passed. The API3 runner's negative check confirmed that selecting the current API4 executable exits with the expected contract-mismatch setup error. The project-local GitNexus index was refreshed without changing global configuration.

The first simultaneous local run had a genuine historical reset-CLI target mismatch and timing failures while running multiple heavy suites. The CLI now resolves from the same historical root as its server. Full browser suites and the full backend suite then passed separately, with original assertions and timeout values retained. CI still runs the ordinary backend `npm test` command on its own Linux/Node24 runner. Logs are ignored under `.ci-results/r6-integration/`; latest-head GitHub Checks are separate evidence and must pass before merge.

The initial upload was a **draft backend handoff PR** for Xiaofu. His PR16 frontend is now integrated for joint verification. Preserve prior local drafts and old data; do not rename old applicants into the new cohort or point the new executable at the old database.

Latest-head integration CI and code review are merge gates. Human calibration of AI-authored initial judgments, any claimed live-model validation, and a separately approved release with coherent frontend/backend/content/database versions, backup and rollback remain distinct responsibilities. API4 desktop acceptance is in scope; mobile enhancement remains deferred as recorded by the frontend handoff. No server connection, live write, migration/reset, gateway application, service restart or deployment occurs in this integration task.
