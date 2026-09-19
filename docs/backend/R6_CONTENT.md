# R6 content, evidence and assessment handoff

**Local content implementation. AI-authored demo assessment · Human calibration pending. Not deployed.**

Current source: user-confirmed fictional Harbour Retail JD and Amy Chen / Ann Li / David Liu / Jamie Parker CVs, plus eight explicitly synthetic companion work samples. This is a new content domain, not renamed Alex/Maya/Leo/Sam history.

## 1. Versions and authoritative files

| Boundary | Version |
|---|---|
| API | `4.0` (new closed candidate enum; old-client compatibility is explicit) |
| Application fixture | `harbour-retail-applications-v1` |
| JD | `harbour-retail-junior-analyst-jd-v1` |
| Rubric | `harbour-retail-junior-analyst-rubric-v1` |
| Company task dataset | `harbour-retail-2026-09-v1` |
| Material | per-person `application-r6-v1`, materialVersion `1`; independent source fingerprint |

Portable content directory: [content/r6](../../app/backend/content/r6/README.md). It includes the original five PDFs, original extracts, public CV extracts, eight companions, [manifest](../../app/backend/content/r6/manifest.json), [19 JD requirement records](../../app/backend/content/r6/jd-requirements.json), [76 JD evidence records](../../app/backend/content/r6/jd-alignment.json), [40 authored judgments](../../app/backend/content/r6/annotations.json), [generated assessment audit](../../app/backend/content/r6/assessment-audit.json) and [calibration questions](../../app/backend/content/r6/review-disputes.md).

Runtime sources: [content.ts](../../app/backend/src/r5/content.ts), [fixtures.ts](../../app/backend/src/r5/fixtures.ts), [rubric.ts](../../app/backend/src/r5/rubric.ts), [task-seed.ts](../../app/backend/src/r5/task-seed.ts). Runtime material loading verifies the manifest SHA-256 before constructing source snapshots. Original legacy [seed.ts](../../app/backend/src/seed.ts) is unchanged. Source changes require a new version, new hash and regenerated offsets, not reuse of an old assessment identity.

## 2. JD facts versus task assumptions

The JD supplies Harbour Retail, Sydney NSW, Full-time, Entry Level / Junior, Data & Analytics, cross-functional collaboration and support from experienced analysts. It does not supply a headcount, named manager, hiring budget, recruiter structure, product catalogue, conversion dataset or scoring weights. Those old company-profile fields are removed.

`job.jd.source.text` preserves the full page-marked JD extraction. `job.jd.requirements` contains 6 responsibility groups, 8 essential requirements and 5 desirable requirements with exact text, page and UTF-16 range. It includes Excel/spreadsheets, reporting/visualisation, written and verbal communication, degree, learning, accuracy, Python/R, BI, analytical experience and digital metrics. The narrower ten-item core rubric retains SQL 30 / Data Analysis 30 / Business Problem Solving 40 as a **prior team demo policy**, not JD-specified weights.

Every application has all 19 `jdAlignment` rows: `jdRequirementId`, multiple `statuses`, `summary`, `remainingUnknowns` and owned `sourceRefs`. Claims, a limited work artifact and further-evidence needs may coexist; none is a binary "verified" flag. No second overall-JD percentage exists.

## 3. Actual initial judgments

Criteria order: S1 / S2 / S3; D1 / D2 / D3; B1 / B2 / B3 / B4.

| Applicant | SQL marks | DA marks | BPS marks | Core overall | Accrued support | Evidence coverage |
|---|---|---|---|---:|---:|---:|
| Amy Chen | 4 / 4 / 4 | 4 / 4 / 4 | 2 / 3 / 2 / 2 | 82.5 | 82.5 | 100% |
| Ann Li | 4 / 2 / 3 | 4 / 2 / 4 | 2 / 3 / 2 / 2 | 70.0 | 70.0 | 100% |
| David Liu | 4 / NE / 4 | NE / NE / NE | NE / NE / NE / NE | null | 20.0 | 20% |
| Jamie Parker | NE / NE / NE | 4 / 2 / 4 | 3 / 3 / 1 / 2 | null | 47.5 | 70% |

These are consequences of the new written judgments, not intended ranks or arithmetic-vector targets. Mark contributions are `mark / 4 × 10`; the existing deterministic scorer supplies totals. All **40 items are assessed** and `assessmentComplete=true`; only two core overall scores are complete. An NE skill remains incomplete, while Jamie's complete DA/BPS skills remain available. No normalisation over only known criteria occurs.

Each numerical mark has owned source evidence; every NE records all checked source IDs and the precise absent scope. The generated audit contains each rationale, support, gap, uncertainty, next step, source/snapshot/fingerprint and UTF-16 quote range. Source refs reject wrong ownership, stale fingerprints, mismatched locations, ambiguous authored excerpts and offsets splitting a surrogate pair. Literal validity establishes traceability, not the correctness of the judgment.

The rubric is translated into English at junior-role scope. Complexity, university prestige and text length earn no bonus. A proposed check is assessed as a proposed check, never as a run. In particular:

- Amy's own 4,000 → 5,000 session exercise is separate from the employer's million-session task.
- Ann's prepared 45,000-customer cohort is separate from her CV's internship AUC 0.82. No new model result is fabricated.
- David's task-list retrieval supports limited static SQL criteria, not demonstrated business metrics or analysis.
- Jamie's written SUM/subtraction worksheet is not an inspected Excel workbook or chart. No SQL claim is added.

### Inspectable B3 example

Amy's current source says: “I would request campaign and device breakdowns for the same two periods.” It gives concrete additional data, but no comparison method or contrasting implications. B3 is therefore **2**, contributing **5 / 10**. The `B3_EXPLANATION` export binds this exact source to Amy's new snapshot. The follow-up asks for missing reasoning, not a prefilled answer.

## 4. Review status and disputed scopes

Actual annotation: `ai_agent_authored_fixture`; actual check: `ai_agent_review`; `annotationMode: ai_authored`; displayed label: **AI-authored demo assessment · Human calibration pending**. This is internal agent authoring/review. No human reviewer, external expert or calibration approval is invented.

[Review disputes](../../app/backend/content/r6/review-disputes.md) records Ann S2 (2 versus NE for a single as-of extract), Ann B3 (specific implementation evidence versus business-hypothesis scope), David S3 (4 versus 3 for written functional expectations), Jamie B3 and the boundary of full marks for simple static calculations. These remain genuine human-calibration questions, not program-test failures. A future human change must create an actual assessment revision, not overwrite the original authored label.

All eight companions were read against CV scope and chronology. Only Amy's obsolete HarbourCart boundary wording was changed to a neutral shared-employer boundary, with original/new hashes and a rationale; no numerical or analytical evidence was added. The other seven companions and all original PDFs retain input bytes.

## 5. Public source and original-PDF boundary

Application sources contain optional `provenance`: `origin`, repository-relative `filePath`, displayed-text `sha256`, `pageNumbers`, `disclosure`, optional `downloadUrl` and `redaction`. The CV redaction record includes removed field categories and the original PDF hash. Default display omits unnecessary contact headers; original extracts remain repository-only.

Allowlisted original downloads:

- `/api/demo/materials/job-description.pdf`
- `/api/demo/materials/amy-chen/cv.pdf`
- `/api/demo/materials/ann-li/cv.pdf`
- `/api/demo/materials/david-liu/cv.pdf`
- `/api/demo/materials/jamie-parker/cv.pdf`

The original CV download is visibly **unredacted fictional original**, not a claim that the PDF was scrubbed. These are fixed files, not general uploads, OCR or arbitrary path access. Source downloads/exports should use the supplied content; do not create a separate UI material copy. Private notes and secrets are absent from these fixtures and assessment sources.

## 6. Corrected common task data

The unchanged historical `harbourcart-task-dataset.json` remains available for provenance. The active [Harbour Retail snapshot](../../app/backend/content/r6/harbour-retail-task-dataset.json) is separately versioned and contains no applicant identity/history.

- `channel_comparison.csv` accurately names a channel comparison, replacing misleading `campaigns.csv`.
- `current_paid_search_devices.csv` names a current-period Paid Search device partition, replacing misleading `landing_pages.csv`.
- Context, `resource.id`, `name`, table rows, CSV text, templates and downloadable content agree.
- Two whole four-week periods remain; no five-week trend, page-speed measurement or historical device trend is invented.
- Company products and campaign/investment details are explicitly synthetic task assumptions, not facts from the JD.
- SQL/DA/BPS templates remain equally available to every person. Suggestions come from actual gaps; HR confirms a single target. Existing-material clarification is encouraged before the optional short task.

## 7. Verification and remaining work

Executed in the R6 worktree: backend `typecheck` and `build`; runtime import/binding of all 40 judgments and 76 JD rows; SHA/page preservation checks and independent arithmetic/range checks. The generated audit has **145 applicant-owned source citations**. The independent QA suite additionally checks bad fingerprints/owners/ranges, dataset consistency and public text boundaries; its exact final results are recorded in R6_ACCEPTANCE by the coordinating task, not inferred from this document.

Not performed for these source materials: original SQL execution, model training/inference or measured AUC, CV employment/degree verification, human rubric calibration or external expert validation. Frontend API4 adaptation and browser acceptance belong to the frontend integration step. No content, database, gateway or application deployment was performed in this content subtask.

Reproducible generated-artifact check (from repository root after build):

```sh
node app/backend/content/r6/generate-audit.mjs --check
```

This local command rechecks all 27 declared file hashes/sizes and 145 citation bindings, then requires the stored audit and current task snapshot to equal actual fixture output. It performs no database, network or model operation.
