# Revision 6 backend — GitHub handoff publication

**2026-09-20 · Backend branch / draft PR, not a merged or deployed release.**

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

The unchanged Candidate workflow still ends with `npm run test:api3`. Its client expects schema 3.0 and historical applicant IDs, whereas the current backend is intentionally API4. This integration check is expected to remain incompatible until the separately owned API4 frontend work is completed. It is not disabled, marked successful or bypassed in this backend handoff. Record its actual outcome when CI runs.

## Remaining gates and next action

This is a **draft backend handoff PR** for Xiaofu to integrate against, not approval to merge the mismatched frontend/backend set. Start from the frozen handoff fields and generated API4 types. Preserve prior local drafts and old data; do not rename old applicants into the new cohort or point the new executable at the old database.

Still pending: API4 frontend/client/controller and genuine dual-browser/mobile acceptance; human calibration of AI-authored initial judgments; any claimed live-model validation; review and merge authorization; and separately approved release with coherent frontend/backend/content/database versions, backup and rollback. No server connection, live write, migration/reset, gateway application, service restart or deployment occurs in this publication task.
