# Revision 5 backend acceptance and traceability

## Scope and evidence rules

Authoritative input: the Revision 5 total plan and the backend/frontend implementation checklists dated 2026-09-19. Those original planning files remain unchanged. The implementation extends API 2.0 rather than treating its old Alex-only acceptance as four-person acceptance.

Executed backend evidence is recorded in [R5_TEST_RESULTS.md](R5_TEST_RESULTS.md); external UI/model/human gates remain explicitly separate. HTTP tests use synthetic fixtures and TEST-STUB/manual rules with zero model calls. A developer/agent review is not the two-person human calibration exercise, a browser test, or a hiring-validity study.

| Item | Product obligation | Independent acceptance evidence | Remaining external handoff |
|---|---|---|---|
| B00 | Identify baseline, preserve prior integration | Baseline commit/worktree recorded; explicit legacy mode regression | Small Fu confirms actual branch; R5 browser unique text / V1→V2 |
| B01 | Versioned four-person contract, strict bindings, limits, UTF-16 refs | OpenAPI/request tests; missing candidate query; every POST identity; exact error envelope; fixtures checked against live server | Frontend contract sign-off |
| B02 | Company/job, four independent evidence sets, fixed rubric and dataset | Fixture ownership/fingerprint/source audit; immutable baseline tests; sourceId collision | Two human annotators record calibration disagreements |
| B03 | Isolated persistence and safe migration | Interleaved writes, receipts, restart, synthetic old-Alex migration and rollback checks | Explicit operator migration of a real local copy, if requested |
| B04 | Four people, three fixed templates, finite V1/V2 | Each candidate × template: V1 More→V2; V1 terminal decisions; V2 More/V3 errors; one task; target-only report update | Alex BPS and Maya SQL browser paths plus DA |
| B05 | Ten-item deterministic Mark/NE calculation | Independent A–D oracles; zero vs NE; no rounded intermediate arithmetic; invalid marks/items/totals | Numeric and explanation UI |
| B06 | Atomic versioned assessments and exact evidence refs | Current/history immutability; bad final item causes no partial save; UTF-16 Chinese/newline/emoji; cross-person/version errors; explicit non-target reuse | Click-through source and criterion UI |
| B07 | Application comparison, no mixed-stage auto-ranking | Four people always returned; default application stage; task stage separate; complete/incomplete skills explicit | Same-skill tie/NE handling and fourth-person discoverability |
| B08 | Independent human shortlist and stale basis | Four retained; remove/re-retain/reconfirm; exact reason/basis/history; new assessment/new work stales previous basis; restart | Frontend interactions and refresh |
| B09 | Bound analysis with real mode/failure semantics | Target-specific observations, disabled/failure human review, late completion after review/reset/V2, invalid refs | Real model experiment with approved configuration |
| B10 | Private notes excluded, local origins, controlled reset | Strict DTOs, nested unknown fields, limits, exact origin/host, token redaction, four-person reset/stale receipt tests | Browser local draft/session separation |
| B11 | New business regression distinct from old baseline | R5 test suite and independent-process HTTP verifier; coverage recorded honestly | R5 browser and live-model results separately |
| B12 | Reproducible final handoff and honest statuses | Contract, examples, test/security report, delivery matrix, startup/migration/reset instructions | Human sign-off, demo rehearsal/recording, competition delivery |

## Adversarial test plan

1. **Identity and ownership** — omit candidateId; unknown ID; swap candidate/task/job/target; collide sourceId across persons; copy source refs without changing their owner; collide idempotency key across candidate/path/request; reset then replay old receipts. Assert both relevant people remain byte-for-byte unchanged on errors.
2. **Version state machine** — submit before send; V2 before More; repeat send; change template/target after send; review historical V1 after V2; attempt V2 More/V3; mutate client objects after submit; analysis completion after review/reset/newer version. Test all four names through shared rules, not one privileged path.
3. **Scoring** — reproduce A–D from independently written expected numbers; 0 distinct from NE and not_started; invalid/out-of-range/fractional mark; duplicate/missing criterion; forged totals; mixed rubric/stage/source snapshot; one final invalid item after valid preceding items. Full rollback and unchanged revision/history are required.
4. **Citations** — use `text.slice(start, end) === quote` with UTF-16 Chinese/newline/emoji; stale snapshot/fingerprint; another person's same sourceId; V1 ref in V2; nonexistent source; shared dataset instead of personal evidence. NE records still name inspected scope and missing evidence.
5. **Shortlist** — retain all four, remove and re-retain, evidence review does not auto-retain/remove, assessment changes do not overwrite previous rationale/basis, new V1/V2 materials require reconfirmation, forged/stale basis fails, SQLite restart preserves events.
6. **Failure and privacy** — disabled/failed analyzer then human review; pending analysis plus reset/review; private notes at every accepted object depth; event/finding/comment/body limits; unexpected fields; exact Origin and Host; malicious provider text/errors never echo sensitive payloads. No `.env`, real database, external model, or real candidate material participates.
7. **Process boundary** — launch only an owned loopback child server with a new temporary database and explicit synthetic config; interact over real HTTP; terminate and restart the child; compare full state; clean up the owned database; save sanitized report.

## Contract questions resolved during implementation

- API 3.0 `GET /api/demo` requires an explicit `candidateId`; legacy API 2.0 is an explicit compatibility mode, not a missing-query default.
- Candidate's new materials stale an existing shortlist basis even when the original retained basis was the application snapshot. A task basis also becomes stale when its explicitly reused application assessment changes; an unrelated stage with no dependency does not invalidate it.
- Task target criteria start not_started; non-target scores are reused only through an explicit, validated application-assessment reference with revision, snapshot, fingerprint and rubric provenance.
- Preset assessments are labelled synthetic. No human-calibration completion is inferred from generating or code-reviewing fixtures.
- Confirmation/evidence-insufficient, criterion marks, and shortlist decisions are independent state machines.
