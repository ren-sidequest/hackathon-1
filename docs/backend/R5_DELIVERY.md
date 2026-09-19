# Revision 5 backend delivery status

> Historical backend-only delivery record. For the subsequent completed API3 frontend integration and updated acceptance counts, see [frontend integration](../FRONTEND_API3_INTEGRATION.md#6-整合发布验收记录2026-09-19). GitHub publication/merge status is tracked by the integration PR; no database migration or deployment is implied.
Baseline: main `e9d6de634c9a6c384d780e89145ead8fa4b56a07` (merged PR #7). Implementation belongs to local branch `codex/revision5-backend`; independent fixture, storage and QA work used separate worktrees. This task makes no new commit, push, PR, merge, public deployment or real-database migration. Original planning files and HR/Candidate business UI remain unchanged.

## B00–B12 status and remaining owner

“Backend verified” means implemented and exercised with synthetic API/storage tests. It does not mark an entire cross-team gate complete.

| Item | Backend delivery | Remaining dependency / owner |
|---|---|---|
| B00 | Actual baseline identified; PR #7 integration preserved; explicit API2 compatibility retained | Small Fu signs off actual frontend branch and R5 browser linkage |
| B01 | API3 strict schema, versioned OpenAPI, actual request/response examples, explicit four-person selection and errors | Small Fu generates API3 types and signs off contract |
| B02 | HarbourCart/job, four independent materials, ten-criterion rubric, three templates and synthetic preset assessments; 35 positive source refs independently checked | Two human annotators conduct and record calibration; current review was by AI agents |
| B03 | Owner-isolated SQLite state/receipts, copy-only v2→v3 migration, old Alex history, restart and rollback verification on synthetic files | Any actual demo-database migration remains a separate explicit operator action |
| B04 | Four candidates × three templates use the same finite V1/V2 rules; weak work accepted; current target only updated | Alex BPS, Maya SQL and DA browser workflows / Small Fu |
| B05 | A–D arithmetic, 0/NE/pending distinction, unrounded calculation and backend-only score derivation verified | Correct front-end formatting, tie/NE presentation / Small Fu |
| B06 | Atomic criterion groups, immutable baseline/history, exact owned UTF-16 citations, explicit non-target reuse and fresh V2 target assessment | Click-through criterion→quote→reason→contribution UI / Small Fu |
| B07 | All four application assessments returned; task stages separate, no automatic mixed ranking or hiring threshold | Same-skill comparable sorting and fourth-person discoverability / Small Fu |
| B08 | Retain/remove/reconfirm, reasons/basis/history, all-four retention, stale direct/indirect assessment basis and new-material detection persisted | UI operations, refresh and stale confirmation / Small Fu |
| B09 | Target-specific observation profiles, disabled/live configuration boundaries, TEST-STUB/manual failure, timeout/replay/late-result tests | Approved actual model experiment; zero real model calls in this task |
| B10 | Strict public DTOs/private-note exclusion, exact loopback Origin/Host, server-only reset secret, four-person reset and stale-session rejection | Browser draft/session separation regression / Small Fu |
| B11 | New independent API tests and real HTTP process/migration/crash verification, separate from old baseline | R5 browser acceptance, CI for a future submitted change, actual model evaluation |
| B12 | Contract, fixtures, source explanation, migration/startup/reset, acceptance/security/test records and this handoff | Joint frontend sign-off, internal user study, rehearsal/recording and competition submission |

Actual execution counts and final integrated-suite results belong in [R5_TEST_RESULTS.md](R5_TEST_RESULTS.md). Traceability and test design are in [R5_ACCEPTANCE.md](R5_ACCEPTANCE.md); integrity findings and limits are in [R5_SECURITY_REVIEW.md](R5_SECURITY_REVIEW.md).

## Four distinct implementation facts

- **Real backend operations:** SQLite persistence, API identity checks, formal work versions, human-operation records, deterministic scores, provenance and shortlist history.
- **Preset content:** synthetic company/job, four application materials and baseline annotations, rubric, templates and shared task dataset. `preset_human` is a product category; provenance explicitly says AI-authored/reviewed fixture and human calibration pending.
- **Simulated engineering inputs:** manual extraction rules, TEST-STUB provider responses/failures and disposable databases. SQL text is reviewed rather than executed.
- **Not executed:** actual model-quality experiment, R5 browser/UI acceptance, two-human calibration, real hiring/ROI study, demo rehearsal/recording, actual database switch, deployment or competition submission.

## Recipient actions

1. Small Fu implements the R5 UI against the new versioned contract, while old API2 regressions remain explicitly on the legacy entry point.
2. Both developers verify Alex BPS and Maya SQL end-to-end with unique text and original quotes, then the third template, candidate switching, errors, reset and shortlist persistence.
3. Human participants separately perform rubric calibration and internal usability evaluation; no synthetic test percentage is reused as an accuracy or business-impact claim.
4. Freeze a reviewed version and record the demo only after the above results exist. Commit/push/merge/deployment remain separate steps.
