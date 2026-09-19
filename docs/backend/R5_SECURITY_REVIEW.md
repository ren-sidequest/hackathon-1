# Revision 5 security and integrity review

Scope: local four-candidate demo, API 3.0 DTOs, persisted ownership, evidence provenance, rule scoring, shortlist basis and administrator reset. This is an implementation review plus automated synthetic adversarial testing, not an external audit or production certification. No `.env` secret or formal database was read for this review.

## Boundary checks

| Boundary | Verified behavior / evidence |
|---|---|
| Candidate/task/session | Explicit candidate query; every write binds owner/session/job/dataset/task/target; cross-person submission and same-sourceId references fail without mutation |
| Evidence | Person + snapshot + fingerprint + sourceId/location + UTF-16 quote equality; Chinese/newline/emoji; V1 refs rejected for V2; 35 preset positive references checked |
| Idempotency | Same request replays once; changed request or other owner conflicts; reset invalidates old operation receipts; interrupted analysis receipt settles to an explicit failure |
| Assessment | Full atomic group and optimistic revision; final invalid item saves nothing; immutable baseline and history; no client total; 0/NE/pending differ; explicit current application reuse only |
| Shortlist | Independent from review and score; explicit reason/basis and revision; new work, direct basis assessment or reused-application dependency requires reconfirmation without changing old rationale/history |
| Private notes | Extra DTO fields, including nested notes, fail; private sentinel excluded from state, responses and structured logs; deliberate text in a public summary remains public material |
| Local service | Only loopback listener, exact Host/Origin, no wildcard CORS, 128 KiB body limit, 40 findings/100 events/2000-character public comment limits |
| Reset | Server-only 24–256-character token; constant-time comparison; wrong token preserves all four states; reset creates a new session and restores baselines; old asynchronous results fail |
| Storage | Private file modes, single-process lock, atomic state+receipt transaction, startup domain checks, copy-only migration and immutable legacy archive; source preserved on conversion failure |
| Analysis | SQL/DA/BPS-specific dimensions; exact output citations; null/undefined/generic exceptions settle failure; trusted timeout status/retryability preserved; live missing configuration is unavailable rather than simulated |
| Process recovery | Owned HTTP service restarted, pending TEST-STUB process killed, stale lock reclaimed; saved work remains and interrupted analysis is retryable with a new key |

Execution results and exact counts are recorded in [R5_TEST_RESULTS.md](R5_TEST_RESULTS.md). The matrix distinguishes tested code behavior from the product boundaries below.

## Findings addressed during development

1. **Initial report status:** draft projection mixed the preset provenance label with evidence status. Final projection uses the application’s supported/uncertain baseline and updates only the task’s current reviewed target.
2. **Migration/startup domain validation:** row metadata alone was insufficient. Strict state shapes and semantic checks now cover private fields, baseline/history drift, submission IDs/fingerprints, review ownership, task templates, assessment/reuse scores, shortlist transitions, timestamps and original legacy analysis quotes before migration publication and on restart.
3. **Asynchronous error normalization:** thrown null/undefined values and trusted provider status/retryability receive explicit handling, preventing a permanently running analysis or a lost timeout contract.
4. **Indirect shortlist dependency:** a retained task assessment that explicitly reused an older application assessment now becomes stale when that application revision changes; reassessment with the current reuse is required before reconfirming that composite basis.

5. **Withdraw from stale basis:** remove is permitted against an owned historical viewed basis, including an outdated reused application assessment; retaining/reconfirming still requires current evidence. Withdrawing never requires a fresh score. Repeated retain is rejected in both service and persisted-state rules.
6. **Report provenance:** a task review binds its actual submission snapshot/fingerprint and does not inherit application citations. Original application findings remain separately available.

These are AI-agent engineering reviews. Two-human rubric calibration, external security review and model-effectiveness evaluation remain pending.

## Known product boundaries

- Candidate selection is a data binding, not authenticated identity. There is no production account/tenant authentication, cross-computer service or public deployment in this delivery.
- Client-reported process events do not verify independent authorship or prevent cheating.
- SQL is statically reviewed, never executed. Formula/code/text correctness beyond the inspected sample is not certified.
- Synthetic rubric and preset annotations have no established hiring-prediction validity. Human evidence review, numeric assessment and shortlist are separate; none is an automated hiring decision.
- Existing trusted local filesystem access can alter application code and database files. Startup integrity checks detect many invalid states but are not cryptographic authentication against a malicious local administrator.
- Actual model calls, real candidate data, network deployment, production authentication and operating-system hardening are outside these automated tests.

## Dependency snapshot

Backend production dependency `npm audit --omit=dev` reported zero vulnerabilities for this run. The unchanged HR lockfile reports one high Vite 7.1.7 advisory group; retained in [fixture/baseline validation](R5_FIXTURES.md). No dependency or lockfile was silently upgraded. Frontend maintainers should assess and update it with their own regression; this remains an inherited risk, not a claim that this implementation is production-secure.
