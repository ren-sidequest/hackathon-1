# Revision 6 — independent agent QA review

Status: independent backend checks completed locally on 2026-09-19. This is an AI-agent technical/content self-check, not independent human calibration, external expert approval, hiring validation or deployment approval.

## Scope and baseline

Worktree: `codex/revision6-backend`, starting at `dbbcad9`. The inspected requirements are the user-approved Revision 6 unified plan and backend checklist (R6-B00–B12), the original four-page Harbour Retail Junior Data Analyst JD, four fictional CVs, and eight disclosed synthetic companions. Existing backend state-machine architecture is retained; the applicant enum is a breaking API 4.0 change. No prior candidate scores are used as expected new candidate outcomes.

QA owns only the new `app/backend/test/r6-content.test.mjs`, `app/backend/test/r6-contract.test.mjs`, `app/backend/scripts/verify-r6.mjs` and this report. Separate storage verification belongs to `r6-storage.test.mjs`; consolidated results belong to `R6_ACCEPTANCE.md`.

## Independent content review

All four extracted CVs and eight companions were read before reviewing the proposed marks. The original JD extract was read across all four page markers. The new annotations are AI-authored; any agreement below remains **Human calibration pending**.

| Material | Checks and conclusions | Limit / calibration issue |
|---|---|---|
| Amy channel SQL and report | 4,000/5,000 sessions; 200/225 orders; 5.0%/4.5% conversion; Paid Search share 37.5%/48%; channel counts reconcile. Window labels and the static prepared-table SQL agree. The text asks for campaign/device breakdowns and explicitly avoids causal certainty. | These are Amy's independent past-project figures, not the company task. Source extraction, execution and actual workbook remain unverified. B3's request lacks contrasting outcomes; a partial mark is justified, not a full discriminating-test claim. |
| Ann cohort extract and method note | 6,750 + 38,250 = 45,000; 31,500 + 6,750 + 6,750 = 45,000; positive allocation 4,725 + 1,012 + 1,013 = 6,750. Majority baseline and recall warning are correct. Internship AUC 0.82 is explicitly separate. | Proposed splits/preprocessing are not run results. S2=2 versus NE is a genuine calibration boundary: an as-of date is shown, but no comparative extraction or feature-building SQL is supplied. Do not award a period-comparison implementation claim. |
| David application query and note | Many-to-one join follows stated keys; bound user ID, empty result, duplicate and source-ID checks are reviewable. Project dates and scope match the CV. | S3=4 versus 3 depends on whether bounded functional checks fully satisfy the static criterion. The proposed checks have no run log. No sales metrics, period comparison, business investigation or outcome are invented; these remain unobserved rather than automatic zeroes. |
| Jamie tracker and campaign brief | Interaction sums 400/520; follower changes 100/80; AUD 120+120+60 budget=300. Reach and action populations are distinguished. Contribution remains marketing/reporting, without invented SQL. | A Markdown table and formula description are not a functioning Excel workbook or actual chart. Written clarity does not verify oral communication. Basic visible calculations can meet bounded D1/D3 without certifying spreadsheet proficiency. |

Additional JD requirements remain distinct from the 30/30/40 core rubric. Excel, reporting/visualisation, written and verbal communication, education, learning/accuracy, Python/R, BI exposure and analysis/digital background need explicit source status and remaining unknowns. A second JD match percentage is not justified. Institution reputation, advanced algorithms, experience length and prose polish are not independent scoring bonuses.

### Findings raised during implementation

1. **UTF-16 boundary hardening:** the prior validator accepted a slice consisting of half a surrogate pair when the quote carried the same lone surrogate. A regression test now requires valid emoji/newline offsets and rejects split-pair boundaries. Root/content owner was notified before implementation.
2. **No fabricated company facts:** old headcount, recruiting structure and named budget/hiring roles are not in the new JD. New public defaults should omit or explicitly mark those unknown rather than inherit the old fixture.
3. **Source boundaries:** private contact fields are excluded from default public extracted CV text; original PDF bytes remain unchanged, with publication/download scope disclosed. Static SQL is never reported as executed.
4. **Gap ordering:** key gaps must derive from the current assessment and severity with an explanation. Tests deliberately place an observed B2 problem after earlier S-criteria and require it to be prioritised; two different names with identical marks produce the same criteria priorities.
5. **Shared analysis truncation defect (final check):** the separate shared analysis path still truncated its 500-code-unit quote inside an emoji when the input began with 499 ASCII characters followed by an emoji. Root added shared start/end surrogate-boundary validation and made manual truncation back off one code unit. Independent spot reproduction now returns a well-formed quote ending at offset 499; a complete emoji is accepted while split-start and split-end references are rejected. This complements, rather than replaces, the application-assessment citation checks.

### English output and original-source scope

Server-authored instructions, labels, explanations and manual-simulation `statement`, `scope` and `uncertainty` remain English. The three target model profiles now explicitly request English generated prose while preserving literal quotations in the source's original language and retaining whole UTF-16 character boundaries. Source PDFs and original quotations are not translated or rewritten to satisfy a UI language rule. A Chinese/newline/emoji source quote was preserved verbatim with identical UTF-16 code units in the independent spot check. The live-model English instruction is a prompt contract, not evidence of a paid/live provider's actual compliance; no live call or automatic translation was exercised.

## Verification design

| Requirement | Independent check |
|---|---|
| Source immutability | Pinned original PDF and historical task-snapshot SHA-256; final manifest checks; eight disclosure labels |
| Forty judgments | Four exact identities × ten exact rubric IDs, nonblank rationale/support/gap/uncertainty/next-step, source scopes, owned quote offsets and deterministic recomputation |
| Junior-role and provenance | English server text, scoped labels, AI-authored status, pending human calibration, no copied old scores or invented company fields |
| Arithmetic | Separate A–D vectors; all-zero, all-NE and pending-null distinctions; no rank target for new people |
| Compatibility | New enum and schema4; old identities, old versions, dataset/session conflicts; rejection preserves all four states |
| Tasks | Three target templates; owned real-HTTP processes exercise all four people with SQL/DA/BPS and V1 More→V2 terminal |
| State independence | Review leaves assessment/shortlist separate, assessment changes trigger reconfirmation, comparison remains application stage |
| Request/privacy limits | 128 KiB, 40 cards, 100 events, comment limits; private-note fields rejected and excluded from logger |
| Citations | Wrong person/snapshot/fingerprint/source/location/range/text rejected atomically; numerical zero still needs a source |
| Persistence | Owned child process restart compares complete four-person snapshots and application-stage comparison |

## Executed results

Executed on Node.js v22.23.2 with isolated in-memory/temporary SQLite, no external model calls:

| Actual command | Result | Evidence |
|---|---|---|
| `npm run build --prefix app/backend` | Passed | TypeScript compile before the new test run |
| `node --test app/backend/test/r6-content.test.mjs app/backend/test/r6-contract.test.mjs` | **30/30 passed**, 0 failed/skipped (11 content + 19 contract/scoring) | `.ci-results/r6-qa/independent-tests.log` |
| `node app/backend/scripts/verify-r6.mjs` | **27/27 HTTP checks passed**, owned server stopped cleanly | `.ci-results/r6-http/run-FuY8sJ/report.json` and `process.log` |
| `node --check` for all three new JavaScript files | Passed | Syntax checked before execution |
| `node app/backend/content/r6/generate-audit.mjs --check` | **27** final declared files matched hash and size; 40 annotations, 19 JD requirements, 76 alignment rows, 145 owned UTF-16 references; audit and active task snapshot match runtime fixtures | Final content recheck; includes the newly declared Harbour Retail task snapshot |
| `node app/backend/scripts/verify-r5.mjs` | **27/27 passed** on final code via the retained command-name alias | `.ci-results/r6-http/run-RhOFWn/report.json`; same API4 verifier, not historical API3 migration |
| `node --test app/backend/test/r6-content.test.mjs` | **11/11 passed** on the final 27-file pack | `.ci-results/r6-qa/content-final.log` |
| `node --test --test-name-pattern='PDF downloads\|version negotiation' app/backend/test/r6-contract.test.mjs` | **2/2 selected tests passed** on final PDF integrity/response-guard changes | `.ci-results/r6-qa/app-guard-final.log` |
| `node --test --test-name-pattern='manual analysis truncates\|analysis rejects both split' app/backend/test/analysis.test.mjs` | **2/2 selected regressions passed** after shared-analysis boundary fix | `.ci-results/r6-qa/analysis-regression-final.log` |
| Independent inline Node spot reproduction of shared-analysis boundary and language contracts | Five spot checks passed; full/split emoji range cases verified; zero model calls | `.ci-results/r6-qa/analysis-boundary-final.log` |

These are new R6 execution results, not the old Revision 5 counts. Do not add 30 to the consolidated test-suite count when those same files are already included. The HTTP check count is a separate process-level acceptance measure, not a browser-test count.

The new full test run caught and resolved two integration defects: two Amy JD quotes were ambiguous because `GROUP BY period_start, channel` appeared in a query and a check comment; the content owner extended those exact quotes and refreshed the manifest. Separately, the application-source response schema still required `kind: application` for the eight new synthetic work samples; the root owner widened it to `application | work_sample`, while preserving snapshot ownership and provenance. One test assumption was corrected: Jamie's original has no contact header, so an empty redaction list is truthful and valid. Final reruns passed all of the above.

The exact PDF download bytes, traversal/undeclared-file rejection, schema mismatch CORS headers, same-key cross-person protection, concurrent writes, all three targets, V1 terminal alternatives, shortlist reconfirmation and disabled-analysis manual review are included in the 30 tests.

Final read-only inspection of `src/r5/app.ts` found no high-impact issue in the reviewed changes: downloads use a fixed five-PDF allowlist and hash the exact bytes before sending them; only the dedicated materials route is excluded from the JSON-envelope guard. The API envelope guard remains active elsewhere. Approved-origin CORS headers are attached before version mismatch handling; rejected origins receive no access header. Error payloads expose safe English descriptions, codes and request IDs rather than file paths, stack traces or submitted body text. Reset still requires the separately configured timing-safe token check. This is a bounded review, not a claim that every possible failure or deployment configuration was tested.

## Explicit non-results

- No human calibration or independently verified applicant capability.
- No execution of the original applicant SQL samples against MySQL/PostgreSQL/SQLite, and no model training/AUC execution. Backend SQLite persistence was exercised separately as documented.
- No paid/external model calls; test analysis is explicitly manual simulation.
- No compatible Revision 6 UI/browser acceptance; that remains Xiaofu's frontend integration dependency.
- No commits, pushes, PRs, server configuration changes, live database writes or deployment by this QA task.
