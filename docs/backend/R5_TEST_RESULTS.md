# Revision 5 test results

> Historical backend-only delivery record. For the subsequent completed API3 frontend integration and updated acceptance counts, see [frontend integration](../FRONTEND_API3_INTEGRATION.md#6-整合发布验收记录2026-09-19). GitHub publication/merge status is tracked by the integration PR; no database migration or deployment is implied.
Date: 2026-09-19. Baseline: `e9d6de634c9a6c384d780e89145ead8fa4b56a07`; local uncommitted implementation on `codex/revision5-backend`, with separate fixture/storage/QA worktrees. Node.js `v22.23.2`; SQLite emits its documented experimental warning on this runtime.

## Actual results

| Command / activity | Result | Scope / executor |
|---|---|---|
| `npm run build --prefix app/backend` | Passed | Strict TypeScript; integrated R5 app/service/state schema copied into independent QA worktree |
| `node --test app/backend/test/r5-api.test.mjs` | **48/48 passed**, 0 failed/skipped; 118.5 s | Independent API3 injection tests; QA agent |
| `node --test --test-name-pattern='four-person shortlist' app/backend/test/r5-api.test.mjs` | **1/1 passed** | Final added repeated-retain assertion; same 48-case suite, not an extra test count |
| `node app/backend/scripts/verify-r5.mjs` | **65/65 checks passed** | Actual HTTP against owned independent Node processes and disposable SQLite files; QA agent |
| Independent fixture citation audit | **35 positive refs / 40 items checked** | Four owned snapshots, literal UTF-16 quotes, B3 2/4→5/10; AI-agent review only |
| Legacy `verify-revisions.mjs` | **42/42 passed** | Root agent; explicit API2 compatibility, not R5 UI acceptance |
| Existing API2 browser suite | **11/11 passed** | Fixture agent; latest shared analyzer SHA verified equal to root; 44.9 s, no retries. Legacy UI only, not API3 browser integration |
| Candidate unit / HR workflow / both builds | **27/27**, **8/8**, both builds passed | Fixture agent; unchanged frontend baseline |
| API3 contract exporter | **43 executed calls / 78 generated files** | Root agent; versioned actual examples and OpenAPI |
| Legacy OpenAPI preservation | Passed, unchanged | Root agent |
| `python3 scripts/check_repository.py` | **18 collaboration documents and local links passed** | Both root and QA copies; no claim of application/UI correctness |
| `git diff --check` | Passed | QA owned changes and copied runtime files |
| `npm audit --omit=dev` | **0 reported vulnerabilities** | Root agent; dependency advisory snapshot, not a security certification |
| `npm run test:coverage --prefix app/backend` | **237/237 passed**, 0 failed/skipped; 193.9 s | Final root source including removal from stale/historical basis; 145 legacy + 92 new tests |
| `npm test --prefix app/backend` | **237/237 passed**, 0 failed/skipped; 128.8 s | Independent final plain run on the same integrated source |

The known old 145 backend tests and 11 API2 browser tests are baseline regressions. They are not counted as proof that the newly requested four-person UI works.

### Local evidence

Independent QA worktree: `revision5-qa` (a separate checkout based on the same commit).

- `.ci-results/r5-qa/api-48.log`
- `.ci-results/r5-qa/shortlist-final.log`
- `.ci-results/r5-qa/http-65.log`
- `.ci-results/r5-http/run-0aApxq/report.json` and sanitized `server-cli.log`

These are generated local artifacts, not source deliverables. The final HTTP report records `status: passed`, `modelCalls: 0`, `temporaryServicesStopped: true`, and `temporaryDatabasesRemoved: true`.

One intermediate strengthened HTTP run reached 63 checks then stopped during **test setup**: the existing immutable-submission trigger prevented deliberate corruption of a disposable copy. The verifier was corrected to drop that one trigger only in its owned corruption fixture, leaving the original source and migrated archives protected. The complete rerun then passed all 65 checks. No production failure is hidden by this correction.

Root final-source HTTP rerun also passed **65/65** at `.ci-results/r5-http/run-q8PZCC/report.json`; all temporary processes and databases were removed. Final root browser compatibility log: `/tmp/evidencebridge-r5-api2-current-analyzer-browser.log`.

## New API3 acceptance exercised

- Four people × all three templates complete thin V1 → explicit public More → separate V2 → terminal. Each person also exercises both V1 terminal decisions, with no V2 permission despite spare capacity. V2 More, V3, historical review and second task fail.
- Explicit candidate selection, full identity bindings, interleaved writes, same-sourceId cross-person/version attacks, idempotent replay/conflict and post-reset stale receipts preserve isolation.
- Independent A–D arithmetic expectations; 0 vs NE vs pending; full target/application groups; server-derived totals; exact Chinese/newline/emoji references; failed final criterion is atomic; old baseline and assessment revisions remain intact.
- Explicit non-target application reuse records its source; V2 starts unassessed; review remains closed while current-stage scores are revised. Task and application comparison stages stay separate.
- All four can be retained; remove/re-retain/reconfirm and optimistic revisions work. New work, a basis-stage assessment revision or the explicitly reused application dependency marks an old shortlist basis stale without rewriting its rationale/history.
- SQL/DA/BPS observation dimensions match the selected target. Disabled/unconfigured live and malformed provider output fail honestly while human review remains available. Null/undefined/generic thrown values settle failure; trusted timeout preserves 504/retryable; delayed completions after review/reset/V2 are ignored.
- Private fields, limits, Host/Origin, administrator token and all-four reset are exercised. A real child process killed during a pending TEST-STUB analysis is recovered with `AI_INTERRUPTED`, settled receipt and fresh-key retry.
- A synthetic API2 Alex two-version database is created through HTTP, copied and migrated. IDs/fingerprints/work/analysis/review and raw receipts remain; source bytes stay unchanged, backup reopens with API2, archives reject writes, wrong generation fails, malformed legacy quotes/private fields stop before destination publication.

## Coverage and final-source details

Native coverage for the full run: all-file lines **97.06%**, branches **94.93%**, functions **97.63%**. This aggregate includes loaded tests/scripts, so it is not presented as production-only coverage. Selected implementation modules: R5 service lines **95.93%** / branches **92.98%**; scorer **100%** lines/branches/functions; store **100%** lines / **95.24%** branches; state validation **97.13%** lines / **96.61%** branches. Process-only HTTP tests are separate and not added to these percentages.

The 92 new tests are 48 API, 24 storage/domain, 15 rubric/fixture/scoring, and 5 provider-transport/profile tests. Provider transport is TEST-STUB: all three target schemas, owner context, private-note exclusion, wrong-dimension rejection, and the actual bounded timeout path; there were no external model calls. The final API tests additionally verify removal without first repairing stale indirect scores, and removal against an owned historical V1 basis after V2.

The six initially dense new root modules were formatted using an already-installed local TypeScript printer; parsed AST structure, literal contents and comments were checked equivalent before applying, followed by the full strict build/tests. No formatter dependency was added. GitNexus was refreshed for the actual `revision5-backend` worktree in index-only mode; the migration→validation→citation/scoring paths were queried, with source and tests used as the final evidence.

Root artifacts are outside tracked source in the task’s `.artifacts/revision5-qa/`: `coverage-final-with-removal.log`, `tests-final.log`, `http-final.log`, `legacy-http.log`, `contract-final.log`, `backend-audit.json`, and `format-ast-verification.log`. GitNexus diagnostics are `index-after.log` / `impact-query.json` in that directory. Original planning files, main checkout, PR7 worktree and frontend business source were checked untouched.

## Explicitly not executed

Actual R5 browser integration; real external model calls or model-quality experiment; two-person human rubric calibration; external expert validation; internal usability/ROI study; demo rehearsal/recording; real local database migration; public deployment; new PR/CI/merge/competition submission.

All new automated analysis uses TEST-STUB or `manual_simulation`. **External model calls: 0.** Human decisions in test fixtures are API actions performed by test code, not evidence that human evaluators reviewed the materials. See [delivery status](R5_DELIVERY.md) for B00–B12 ownership and [security review](R5_SECURITY_REVIEW.md) for limits.
