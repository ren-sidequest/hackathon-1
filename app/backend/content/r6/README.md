# Harbour Retail application content v1

**Local implementation. AI-authored demo assessment · Human calibration pending. Not deployed.**

This version introduces Amy Chen, Ann Li, David Liu and Jamie Parker as new identities. No old applicant score, task, review or history is renamed or inherited.

## Files and publication

- `job-description.pdf`: byte-identical user-supplied four-page demonstration JD.
- `job-description-extracted.txt`: page-marked text extracted with pypdf; the exact source of JD UTF-16 citations. Extraction retains original wording, including grammatical quirks.
- Each candidate's `cv.pdf`: unchanged one-page user-supplied fictional CV, available only through an explicit Original CV download action. It may include fictional contacts.
- Each `cv-extracted.txt`: retained input extraction. Repository content, not the default public source.
- Each `cv-public.txt`: displayed and assessed CV text. Amy, Ann and David's contact-header lines are omitted, including email, placeholder phone and location. Jamie's CV has no contact header to remove. All other supplied text is retained, not silently polished. The manifest and API provenance identify the original PDF hash and removed field category.
- Eight `.sql` / `.md` companions: AI-authored synthetic demo work samples consistent with the scope in each CV. They were not part of the original PDFs and are not evidence of independently completed employment work.
- `annotations.json`: 40 newly authored criterion judgments and literal quote specifications.
- `jd-requirements.json`: 19 requirement groups with exact JD ranges (6 responsibilities, 8 essential requirements, 5 desirable requirements).
- `jd-alignment.json`: 76 candidate-specific requirement-evidence records. Claims, limited artifacts and unresolved evidence may coexist. No additional JD percentage is calculated.
- `assessment-audit.json`: deterministic material-snapshot binding, UTF-16 citations, 40 judgments, current scores and 76 JD records generated from the actual runtime fixtures. Recreate it after any source or annotation change.
- `harbourcart-task-dataset.json`: unchanged historical snapshot, never an applicant project and not the active company version.
- `harbour-retail-task-dataset.json`: separately versioned current company-task snapshot. It reuses checked integer task facts with corrected resource names; it does not copy old applicants.
- `manifest.json`: portable file paths, SHA-256, page counts, origin, publication boundary and the single companion edit reason.
- `review-disputes.md`: concrete calibration choices and remaining human questions, not approval signatures.

Original PDFs are user-confirmed fictional materials. The API default text is minimised; explicitly serving an original is not redaction of that PDF. No arbitrary file path is exposed by the backend. A real-data deployment would require a separate publication decision.

## Distinct data domains

| Domain | Meaning |
|---|---|
| Company task | 1,000,000 → 1,180,000 sessions; 34,000 → 30,680 orders; two four-week periods |
| Amy past project | 4,000 → 5,000 sessions; 200 → 225 orders; two independent channels |
| Ann past project | 45,000 customers; prepared class split and method, no new measured AUC |
| David past project | Application task records and a retrieval query; no invented sales/analytics outcome |
| Jamie past project | Reach, interaction actions, followers and a campaign plan; no website conversion or SQL evidence |

The company task's products, campaign changes and budget question are labelled demonstration assumptions, not claims from the JD. Neither task data nor a reference answer is counted as applicant-owned evidence.

## Assessment boundary

The existing ten-item 30/30/40 rubric is translated to junior-role English without rewarding complexity, degree prestige or long text. Marks are source-based assessments of visible materials. A proposed static check can satisfy a static-review criterion; it is never described as executed. `NE` means the checked material is insufficient for that criterion, not an observed error. All 40 items are reviewed; only two complete core scores are available. Human calibration remains pending.

Runtime source changes require new content/material versions, updated hashes and regenerated citations. Do not edit the original PDFs, retain stale hashes or change material to obtain a preferred score.

## Reproduce the inspectable audit

From the repository root after a backend build:

```sh
node app/backend/content/r6/generate-audit.mjs --check
# Explicitly regenerate audit/snapshot from the built fixtures when needed:
node app/backend/content/r6/generate-audit.mjs --write
```

The command validates the 27 declared content-file hashes and all 145 bound applicant citations before checking/writing the audit and current task snapshot. It does not call a model, open a database, contact a server, assign new marks or change manifest expectations. Markdown notes, this tooling and the generated audit are not self-hashed by the manifest. PDF page counts are checked separately using the unchanged originals.
