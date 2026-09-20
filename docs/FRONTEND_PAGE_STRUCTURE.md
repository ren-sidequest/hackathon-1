# API4 frontend page structure — local review, 2026-09-20

## Scope

User-approved order: first remove repeated global demo/status blocks, then separate page responsibilities. This change preserves the existing light/dark gold visual system, API4 contract, rubric, evidence sources, V1/V2 bounds and three independent human decisions. It is not a backend change or a deployment.

## Shell

- Compact header: connection status, last successful read time, Refresh data and Workspace info.
- A dismissible one-line shared-demo notice appears once per browser session/API origin. This is a browser preference, not an authentication or database flag.
- Workspace info holds the full explanation and collapsed connection diagnostics. Connection/action failures remain visible when they occur; pending receipt retries remain available. Refresh is a read, not a reset.
- Material provenance stays beside the material, annotation provenance beside assessment, and simulation mode beside analysis. Moving global explanations does not conceal synthetic inputs or imply real-model verification.
- Candidate switcher appears on HR detail/task pages and Candidate pages, not on company/comparison/list pages where a current-person toolbar was misleading.

## HR navigation

| Route | Responsibility |
|---|---|
| `#company` | Company, job requirements, role success criteria, rubric |
| `#comparison` | Four-person application comparison and sorting; no second duplicate dashboard |
| `#evidence` | Candidate dossier, with Assessment / Materials & JD / Submission history sections |
| `#tasks` | Four-person task queue, task preparation/send, original work, analysis and human evidence review |
| `#shortlist` | Retained-first navigator, reconfirmation filter, and All; every person can be inspected here |

Assessment is mounted once after first visit and kept hidden across navigation to preserve its draft. The task screen has an explicit Open V1/V2 assessment handoff rather than a duplicate assessment form. That handoff resets the stage to the requested version; an earlier application-criterion focus must not override a task version. Historical stages remain read-only under existing guards.

The retained workspace presents each person’s own source-backed support, gaps, saved basis, human reason and next step. Filters default to Retained, then Reconfirmation needed, then All. Removing a decision does not remove the person from comparison or delete an application.

## Candidate navigation

| Route | Responsibility |
|---|---|
| `#application` | CV and companion materials, optional full JD |
| `#tasks` | Task instructions, feedback and start/continue available draft |
| `#workspace` | Resources, reasoning cards, private notebook and public summary; brief collapsed |
| `#history` | Formal immutable V1/V2 snapshots, feedback and export |

Submitted work is not repeated as another full snapshot in the workspace. The workspace links to history once no draft is editable. Workflow history appears in Work & feedback rather than every page.

## Regression checks

`npm test --prefix app/candidate`, `npm test --prefix app/hr`, both frontend builds, and the complete isolated `npm run test:api4 --prefix app/candidate` suite. Tests retain source binding, independent assessment/shortlist decisions, V1/V2, lost response retries, conflicts, resets and storage checks; selectors were updated to the new navigation/status ownership. Added T41 (compact shell and dossier separation) and T42 (exact task-stage handoff after application detail entry).

Browser regressions use temporary SQLite on 8894 and frontends 6474/6487; never point them at user practice or public databases.

## Release boundary

The deployed application is English. Display-only Chinese review assets, local practice databases and machine-specific QA outputs are not part of the release. Both frontend bundles must come from the same reviewed commit with the API4 gateway base. Backend data, scoring and deployment configuration remain unchanged.

## Smooth identity switching

The shared display-only presentation preserves the last accepted snapshot during identity-strict reads. Pending content stays visibly labelled with its actual owner and is inert; selectors and task navigation remain live. Incoming person/task/version keys preserve editor isolation. Roles and session/fixture/JD/rubric/dataset boundaries invalidate the hold. This is not a relaxation of controller write authorization. There is no whole-page fade or same-page scroll-to-top. Reduced-motion preferences are respected.

New regressions cover snapshot ownership, delayed HR reads, and Candidate draft round trips. The isolated browser suite owns its temporary database; never run it against the public gateway.

## Tradeoff

Keep stable route IDs and current React modules instead of introducing a new router, dependency or backend schema immediately before the presentation. The comparison table fits 1280/1440px desktop viewports; smaller content regions keep overflow inside the table instead of shrinking all text. Disclosure is contextual and expandable, not removed.

## Visual scope correction

The user explicitly reaffirmed that the existing visual style must remain unchanged. The initial structure stylesheet also restyled the header, person bar and subnavigation; those visual overrides have been removed. `structure.css` now contains layout/wrapping only. Existing `eb-panel`, `eb-action`, `primary`, `r5-person-bar`, `r5-state` and `eb-tabs` supply typography, dimensions, border, radius, background and effects. Shared design-token, theme and base component CSS files are unchanged by this restructuring. The navigation and page-ownership improvements remain.

## Two core screens: presentation hierarchy pass

- Preserve theme tokens, font families, original gold buttons/cards, theme toggle and selected-criterion effects. `presentation.css` sets a consistent 26/18/16/14/13px hierarchy and spacing, not a new visual identity.
- Comparison: superseded by the selected visual comparison implementation below; retain service-calculated scores and independent human decisions.
- Dossier: the candidate name and switcher share one heading. Compact assessment context is followed by ten keyboard-accessible criterion chips (full accessible name/title, mark); the active full title and observable job standard stay in the judgment panel. Source and judgment occupy the main two-column reading area. Provenance kind stays visible; longer provenance, technical bindings and history remain expandable.
- NE is missing evidence, not zero. Incomplete core totals remain absent. No scoring, sources, quote offsets, candidate data, API or workflow changed.
- T26 now opens Scoring & scope for the selected person before checking independent server values and owned criterion links. T40 validates accessible chips and non-overflowing desktop decisions rather than requiring the retired oversized cards and horizontal scrolling. T43 covers the read-only filter and direct evidence entry.
- This pass completes the comparison/dossier redesign first. Company-page sizing received shared typography fixes; task preparation, candidate workbench and other pages are not declared a finished redesign.

T44 checks unassessed task chips (—, accessible Not assessed) separately from NE and zero; T45 checks 1024px reading-pane scroll containment. These are display states only.

## Selected visual comparison: scalable list + contextual evidence

- Implement the user-approved composite image, not another visual direction. Retain original theme tokens, sidebar, logo and gold controls. Compare at 1568×1003; validate English long labels at 1280px.
- Left: search, filter, sorting, fixed-height candidate rows, core evidence match and aligned SQL/DA/BPS bars. No repeated evidence paragraphs in every row. Short profile labels describe the supplied fictional CV scope; they are not generated assessment verdicts.
- Right: selected candidate and criterion, observable job requirement, verified quotation, next question, full evidence and separate human-retain entry. Clicking a skill selects its real prioritized gap (or first criterion); initial preview is B3, not a claim that B3 is the highest priority.
- Preview quotes are validated with the existing candidate/application/source binding. A missing valid quotation gets a truthful missing state. Chinese reading translations keep the original-source entry.
- Search supports English names/IDs; Chinese copy additionally supports translated names. Filter and pagination operate on the already-loaded snapshot. Empty results remove the prior person's preview. No API request is needed to change preview or page.
- Page sizes 3/10/20/50 show accurate ranges and disabled boundaries. Four real configured candidates remain; a 101-row helper unit test validates layout-model pagination, not a new backend multi-candidate capability.
- NE is dashed/missing, never zero or NE/4. Core percentage remains absent for incomplete evidence; stable ties and unranked states preserve the previous sorting semantics.
- Scoring & scope keeps all ten criterion links, independently computed coverage/accrued points, revision, full rubric/JD entries and score limitations. It is contextual disclosure, not removed evidence.
- Human retain decision only navigates to the existing decision form: reason, explicit save and reconfirmation rules remain. No selection or pagination writes business state.
- Desktop retains the side preview. Below 930px of workspace content it stacks below the list; very narrow tables scroll inside their region. Explicit normal text wrapping prevents legacy table styles from crowding English headings.
- New T46 verifies search, empty results, 3+1 paging, candidate ownership, no background requests and no automatic retention. T26/T29/T32/T40/T43 reflect the new ownership of controls without weakening business assertions.

### Compact type follow-up

User requested smaller comparison typography: title24px, preview name20px, core16px, skill15px, names/body14px. Rows104px; preserve hit targets and existing tokens. Scoped CSS synchronized to Chinese copy. T40 (1280/1440) and T46 pass; English and Chinese HR builds pass. Other four HR page images are proposals only, not implemented new structures or authoritative data.

## Approved four-page layouts and shared type system (2026-09-20)

The selected Company & Role target is the user's `codex-clipboard-47a70805-3c18-45f9-882d-8c250693044f.png`, not the alternate company mockup. Its company/job strip, requirement matrix and complete rating legend are implemented by `company-workspace.tsx`. Actual company text, criteria, weights, marks and JD remain server-owned. The generated image's “0 = no evidence” is intentionally replaced by the authoritative rubric; missing evidence is NE.

`workspace-system.css` is shared by both API4 apps and loaded after the earlier presentation layer. It defines title 24px, section 18px, subtitle 15px, body 14px, metadata 12px; primary controls have 40px minimum height, common panel padding/gaps are 20px. It reuses existing theme tokens and preserves the historical standalone modes. Chinese review carries the same component/CSS edits and separate translation entries.

- Company: compact company/job strip; left evidence matrix with ten functional standard links; right 30/30/40 weights and every backend mark definition, full JD/rubric dialogs.
- Dossier: grouped vertical standards, original source in the middle, judgment/next action on the right; existing stage/history, exact citation and independent human-assessment controls remain. Narrow screens adapt without document overflow.
- Tasks: candidate queue on the left, selected candidate/progress/work/review on the right. Evidence review is beside the work. V2 is optional: a final V1 shows V2 not requested, not a fictitious completed second submission. Human evidence review and independent numerical assessment stay separate.
- Retained: superseded by the faithful-reference pass below. The backend already supports editing an existing retained reason through `reconfirm`; the earlier description calling this unsupported was incorrect.
- Candidate: the same type/control/spacing scale applies to application, task, workspace and feedback screens. Material, local draft and submitted snapshot boundaries are unchanged.

Tests T47 and T48 cover cross-route heading/overflow consistency, authoritative company rubric rendering, read-only navigation and optional-V2 progress. T23/T25 were updated for matrix selectors and awaited actual dossier visibility; their rubric/focus/scroll/flow assertions remain.

## Reference-fidelity correction: three screens (2026-09-20)

The user rejected an approximately similar composition. Exact selected targets are `output/hr-page-mocks/{evidence,tasks,shortlist}-proposal.png` in the parent project, not a new visual direction.

- Dossier: standards rail, scrollable source and evidence judgment in aligned columns; compact score summary beside the subnavigation; primary actions stay in the judgment footer. Chinese reading/original toggle preserves raw original segments and backend UTF-16 references. Stage/history/export remain below the main reading area.
- Tasks: queue / work / inline human review. Three decision options, feedback textarea and save action remain visible alongside actual work. Summary/findings/process tabs and complete-work dialog are functional. Independent analysis and numerical assessment remain separate from review. Binding captured when editing prevents a refreshed submission from silently receiving an older decision.
- Retained: actual saved rows with reason/status and working evidence entry; inline right-side reason editor. Existing `reconfirm` updates reasons with history; stale revision conflicts preserve the draft. Dirty inputs are not replaced by a background refresh. Removal keeps its confirmation dialog.
- `reference-layout.css` supplies scoped structure after `workspace-system.css`, reusing existing black/white-gold tokens and the already-approved compact type scale. Company/comparison layouts are unchanged. No backend contract change.

T49 verifies retained reason update, history and stale-write protection; T50 verifies aligned desktop columns, inline controls, work tabs and complete-source access. Full API4 suite: 52 passed. Layout fixtures use independent 6605/6595/8935 and explicitly tagged synthetic records; practice 6603/6593/8933 was not seeded, reset or written for matching an image.

## Rejected approximation corrected (2026-09-20, second fidelity pass)

The user again rejected visual fidelity. Prior passing reports did not cover the default unsent task view, which still used a full-width wizard. Task preparation now also has queue / live brief preview / action form; waiting and review share that same skeleton. The queue is the candidate switcher; its actual task-state/name sort replaces the redundant top-level switcher. The single-version menu is replaced by an explicit version-history entry; multi-version selection remains available.

Source-pane duplicate provenance cards and repeated usage disclosures are removed from the main reading area. Full origin information remains in Materials & JD. The file header uses a small segmented language control; source ownership, original text, quote offsets and scoring do not change. Judgment sections use matched outline icons and compact source-location links instead of repeating the quotation. Criterion display labels are shortened, with full titles retained in accessible names and the current judgment.

`reference-layout.css` was rewritten for owned panels, explicit desktop proportions and consistent responsive overrides, rather than another competing layer of broad panel rules. New T51 covers draft/waiting three-column states and task-brief access. T52 verifies the compact source toolbar and continued material-library access. Existing flow/conflict/version assertions remain. Real saved content supersedes illustrative mock copy.
