# Revision 6 local backend acceptance

> **Publication follow-up (2026-09-20):** the user has now authorized committing, pushing and opening a draft backend handoff PR. The local-only statements below record the original implementation/acceptance phase, not the current publication scope. API4 frontend integration, human calibration, merge and deployment remain separate. See [publication status](R6_PUBLICATION.md).

**2026-09-19 · Local implementation and contract handoff, not a deployed release.**

Baseline `dbbcad9`, branch `codex/revision6-backend`. The prior worktrees and PR12/13 frontend source are preserved. No commit, push, PR, merge, server connection, live database operation, reset/migration of an existing demo or deployment was performed. Generated examples and tests use independent in-memory/temporary databases. Dependencies and lockfile are unchanged; Node v22.23.2 was used (native SQLite emitted its experimental warning).

## 1. Requirements → evidence

| Checklist | Local outcome | Evidence / remaining boundary |
|---|---|---|
| B00 protection/scope | Pass | Dedicated branch/worktree from newer main; project-scoped GitNexus; no UI/client/controller edits |
| B01 identity/materials | Pass | Harbour Retail, four new IDs, five original PDFs, eight disclosed companions, 27 hash/size-declared files; old people are not remapped |
| B02 complete JD | Pass | 19 exact JD requirement ranges × four people = 76 evidence-matrix rows, explicit remaining unknowns, no second match percentage |
| B03 forty judgments | Implementation and traceability pass; human calibration pending | 40 AI-authored Mark/NE records, 145 owned citations, rationale/support/gap/uncertainty/next step; review disputes preserved |
| B04 deterministic scoring/source binding | Pass | New-content recomputation, independent A–D arithmetic vectors, zero/NE/null/ties, cross-person/version and UTF-16 negative checks |
| B05 frozen contract | Pass | Runtime schema + API4 OpenAPI + independent generated types; 45 executed example requests/81 files; API3 snapshots preserved |
| B06 storage/old data | Pass locally | Header/content preflight, new-format sessions, first-run crash/restart, atomic receipts, locks, WAL-aware backup/restore, no-overwrite publication and disabled old migration |
| B07 targeted gaps | Pass | Structured assessment-derived priorities, no name/default-BPS logic, SQL/DA/BPS templates; all three targets exercised over real local HTTP |
| B08 complete state machine | Pass | Four isolated people; V1 More→one V2, terminal alternatives/no V3; separate review/assessment/shortlist; reconfirmation, stale references, receipts and restarts |
| B09 English/access patch | Backend/static checks pass; live model and release checks pending | English new content/labels, literal original-language quotes, clear modes; only translated gateway copy in prepared patch; no gateway change applied |
| B10 backend regression | Pass | 282/282 full suite; 90/90 reused-business and 45/45 new-content/storage subsets; 27/27 separate HTTP checks |
| B11 executable handoff | Pass for backend; frontend pending | [R6_HANDOFF](R6_HANDOFF.md), [content](R6_CONTENT.md), [storage](R6_STORAGE.md), OpenAPI/examples/types; existing API3 UI not presented as API4-compatible |
| B12 close/release boundary | Pass locally; release pending | Changes stay uncommitted; future whole-release switch/backup/rollback described, not executed |

## 2. Actual verification commands

All commands below ran from the R6 repository root. Repeated subsets are **not additive** to the full suite.

| Command/check | Actual result | Local evidence |
|---|---|---|
| `npm run typecheck --prefix app/backend` | Passed | Final TypeScript no-emit check |
| `npm run build --prefix app/backend` | Passed | TypeScript build; also run before every suite/export |
| `npm test --prefix app/backend` | **282/282**, 0 failures/skips | `.ci-results/r6/full-tests-final.log` |
| `npm run test:coverage --prefix app/backend` | **282/282**, 0 failures/skips | `.ci-results/r6/coverage-release-candidate.log` |
| `npm run test:r5 --prefix app/backend` | **90/90**, 0 failures/skips | `.ci-results/r6/reused-suite-final.log` |
| `npm run test:r6 --prefix app/backend` | **45/45**, 0 failures/skips | `.ci-results/r6/new-suite-final.log` |
| `node --test app/backend/test/r6-content.test.mjs app/backend/test/r6-contract.test.mjs` | **30/30**, 0 failures/skips | `.ci-results/r6-qa/independent-tests.log`; independent agent-run assertions, not human signoff |
| `node --test app/backend/test/r5-storage.test.mjs app/backend/test/r6-storage.test.mjs` | **32/32**, 0 failures/skips | Storage-agent execution; final new-storage rerun **15/15**, including --help/no-write behavior |
| `node --test app/backend/test/analysis.test.mjs app/backend/test/r5-analysis.test.mjs` | **63/63**, 0 failures/skips | `.ci-results/r6/unicode-final.log`; includes both final UTF-16 regressions |
| `node app/backend/scripts/verify-r6.mjs` | **27/27** independent real-HTTP checks | `.ci-results/r6-http/run-JUtwe3/report.json` (final root rerun) |
| `node app/backend/scripts/verify-r5.mjs` | **27/27** current API4 HTTP checks via documented alias | `.ci-results/r6-http/run-RhOFWn/report.json`; same check set, not another 27 distinct tests |
| `npm run docs:generate --prefix app/backend` | **45 actual requests / 81 example files**, 0 model calls | `.ci-results/r6/contract-final.log`; `docs/backend/r6/examples/manifest.json` |
| `python3 scripts/frontend-types-v4.py --check` | Passed | Generated API4 types match current OpenAPI |
| `python3 scripts/frontend-types-v3.py --check` | Passed | Historical API3 types/OpenAPI remain unchanged |
| `app/backend/node_modules/.bin/tsc --noEmit --strict --skipLibCheck app/shared/api4-types.ts` | Passed | Independent generated browser types compile |
| `node app/backend/content/r6/generate-audit.mjs --check` | Passed: **27 files / 40 judgments / 145 citations** | Runtime audit/current dataset match stored artifacts; zero network/database/model operations |
| Original PDF review | **5 PDF hashes/pages preserved; all 8 pages visually reviewed** | Four-page JD + four single-page fictional CVs; local `.ci-results/r6/pdf-review/` images |
| English/new-cohort output scan | 0 old-identity/company/CJK-label matches in current initial/comparison and generated responses | Content agent inspected 11,117 initial/comparison strings and 80,046 strings across all responses; request negative fixtures are intentional |
| Gateway patch local dry-run/application | Passed; original local files unchanged | `.ci-results/r6/gateway-patch-final.log`; only 401 message copy changed in Nginx, exact English login page/valid JSON |
| `python3 scripts/check_repository.py` | **20 collaboration documents passed** | Its local-link scope is documented; separate new R6 document links also checked |
| `git diff --check` | Passed | Includes final source/docs and generated artifacts |

Final Node aggregate coverage: **97.84% lines / 95.94% branches / 97.92% functions**. Project-scoped final GitNexus refresh passed (4,828 nodes/12,112 edges); its static graph has index budget limits and does not replace executed tests. Coverage measures exercised code, not judgment quality, security certification or production readiness. Node's aggregate coverage table includes test/script files; it is not presented as a source-only percentage.

## 3. Defects found and resolved during this run

- Two authored Amy JD SQL excerpts matched both a query and its check comment: expanded exact contextual quotes and refreshed content hashes/bindings.
- Runtime response schema initially accepted only `kind:application`, causing new synthetic work-sample serialization failures: aligned strict schema to the actual owned `application | work_sample` model.
- Early schema-version 409 omitted approved-origin CORS: moved CORS headers before version negotiation; regression checks the readable error.
- A fresh format marker could remain only in WAL after an immediate process crash: commit format4 DDL in DELETE/FULL before enabling WAL. The real child-process SIGKILL test preserves session/submission and settles interrupted analysis.
- Both assessment and analysis citation checks needed whole-character UTF-16 bounds. Assessment rejects split pairs; shared analysis now also rejects split starts/ends and avoids truncating a 500-unit simulated quote in the middle of an emoji. The original `499 × a + emoji` reproducer now emits a valid 499-unit quote.
- Maintenance docs exposed `--help` before the CLI accepted it: added read-only `--help`/`-h`, regression and native-platform absolute path recognition.
- Old regression expectations still treated API4 as an unknown reset contract and expected the retired company headcount: replaced only those obsolete expectations with API99 rejection and the actual JD-sourced company boundary, retaining the zero-write/compatibility assertions.

Earlier integration runs were red (201/278, then 277/279); they were diagnostic, not the final acceptance claim. Final source includes the subsequent fixes and two new analysis tests. Obsolete migration-success expectations were replaced with explicit no-conversion/unchanged-source checks for the new cohort. Diagnostic logs remain locally available; dependency versions were not upgraded.

## 4. Interpretation and pending work

### Content

- Initial judgments are **AI-authored demo assessment · Human calibration pending**. Ann S2/B3, David S3, Jamie B3 and static-evidence full-mark boundaries require human calibration; see the dispute file. Literal quote correctness and arithmetic correctness do not settle these judgments.
- Original fictional CV claims, degree/employment, authorship and actual competency are not independently verified.
- SQL snippets were statically reviewed, not executed in MySQL/PostgreSQL/SQLite; AUC/model experiments were not run. No measured model quality is invented.
- Generated analysis prose is requested in English; original source quotes remain verbatim. Provider-stub prompt tests verify the contract, not real-provider compliance.

### Integration/runtime

- **Pending frontend:** Xiaofu's API4 enum/client/controller/pages, per-session draft separation, updated JD/source/mode/completion displays, endpoint prefixing, actual dual-browser build/interaction acceptance and mobile review. Existing API3 browser green results are not reused here.
- **Pending live-model validation:** zero external model calls this round. Manual simulation and transport stubs are labelled accordingly. Analysis disabled/failure still permits manual review.
- **Pending release/access validation:** English gateway patch is only prepared. Nginx is not installed locally; `nginx -t`, HTTPS/public-read/protected-write/foreign-origin/reset checks and real login/retry belong to a separately approved release.
- Shared-password access is not RBAC or independently authenticated reviewer identity. Backend write-access status is deliberately unknown rather than probed through a business mutation.
- The local maintenance implementation was exercised on macOS/Node22. Windows path admission uses native `isAbsolute`, but Windows hardlink/fsync/runtime behavior and Node24 were not executed.
- Field-specific validation paths, arbitrary file upload, live task generation, a generic recruitment platform and additional scoring are outside this delivery.

## 5. Operational handoff and later release gates

Runtime request flow: Fastify Host/Origin/version/body checks → service binding/state-machine/idempotency checks → source/assessment validation and deterministic scoring → SQLite aggregate+receipt transaction → strict response validation. Fixed content is hash-checked and never treated as model/system instructions. Analysis reads the saved public submission and cannot alter review/shortlist. Logs contain generated request IDs, route, method, status and error code, not request bodies, notes or credentials.

Three likely operational failures and local reproduction:

1. **Old client/draft:** request with old ID/schema or stale session/revision → 409; read current state, preserve the draft, correct explicit version bindings. Logs show SCHEMA_MISMATCH/STALE_SESSION/ASSESSMENT_CONFLICT without private payloads.
2. **Wrong/held database:** use a format3 path or start a second writer → startup failure while preserving existing data; inspect with the maintenance CLI, select a separate v4 path, retain historical code+data. Local storage/process logs and exit status diagnose the lock/version boundary.
3. **Interrupted/disabled analysis:** disabled mode → AI_DISABLED; stop only an isolated test child while analysis runs → reopened state AI_INTERRUPTED, original work retained. Use a new analysis key for a deliberate new attempt; review manually if needed.

Local logs live under ignored `.ci-results/r6/`, `.ci-results/r6-qa/`, `.ci-results/r6-http/`; runtime standard output is metadata-only. No such local logs, databases or credentials belong in a public source submission.

Future release: freeze compatible frontend/backend/content hashes, review diff and new CI, explicitly approve release, take a consistent old backup, initialize a separate v4 file, switch the whole version set, run guest/protected-write and workflow smoke checks, retain both old and new data, and roll back by restoring the old executable+frontend+content+old DB together. [R6_STORAGE](R6_STORAGE.md) has the exact local backup/restore semantics. None of those production steps was executed here.
