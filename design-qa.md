# Gilded Evidence local design QA — 2026-09-19

final result: passed

## Scope and visual truth

This is the selected third black/gold art direction applied to the existing EvidenceBridge workflow, with the user's additional square background and Dashboard 11 layout reference. It is not a pixel-identical replacement of the product with the generated mock's fictional SQL chart or three assessment standards. The ten existing criteria, mock disclosure, candidate switching, source binding and assessment draft boundary remain functional.

- Source: `.ci-results/gilded-preview/selected-reference.png` (the third displayed generated image).
- HR implementation: `.ci-results/revision5-ui/revision5-anchored-B3-exac-685ee-ce-when-switching-candidate/hr-evidence-dark.png`.
- Other views: `.ci-results/revision5-ui/revision5-four-person-comp-abb4b--ties-and-the-fourth-person/hr-comparison-dark-gold.png`, sibling `hr-comparison-light-gold.png`, and `.ci-results/revision5-ui/revision5-resource-search--6577c-source-and-private-boundary/candidate-data-workspace.png`, sibling `candidate-workspace-light-gold.png` and `candidate-workspace-mobile.png`.
- Browser viewport: 1536 × 1050 CSS px, DPR 1; HR full-page capture 1536 × 1719. Mobile 390 × 844. Source 1484 × 1060 pixels; generated design has no intrinsic CSS density. Images were opened together for comparison; assess shared visual regions proportionally by width, not full-page height or pixel-diff scores.
- State: dark HR evidence review, B3 selected with its exact original quotation. Capture uses Maya after testing isolation from Alex; the visual target uses illustrative Alex/SQL content. Content/state differences are explicit and intentional, so no claim of exact content matching. Live production-build preview at 6186 was also opened in the in-app browser; user subsequently navigated to the light targeted-task view, which was left intact.

## Findings and iteration history

1. P2: previous hover replaced the metallic button with flat fill. Replaced with a coordinated metallic hover gradient, retained invariant geometry, and separated focus ring from hover. Regression holds the cursor one pixel inside the edge for 20 frames and verifies stable bounds, background and hover state, then clicks the same coordinate successfully.
2. P1: initial custom select reopened after mouse selection because the containing label activated its trigger again. Commit selection from the captured click, prevent label default activation, and retain native button keyboard semantics. Keyboard, drag, touch, Escape, Tab and outside dismissal now pass.
3. P2: initial evidence context panels consumed excessive vertical space. Removed a redundant heading and consolidated stage/action/history into a compact toolbar; made role/identity labels inline. Subsequent HR evidence capture places the main three-column review surface higher, with all existing context accessible. Full revision5 suite rerun after this change: 15/15.

No remaining actionable P0/P1/P2 issue was identified within the approved style-and-workflow adaptation scope.

## Fidelity surfaces

- Typography: existing system sans and monospace source text retained; large warm-white heading, small spaced gold eyebrow, restrained labels. No remote font dependency or rasterized text.
- Layout: fine gold outer frame encloses standard navigation, original evidence, and judgment; source content remains readable and scrollable. Responsive criteria navigation becomes a horizontal strip; no persistent controls spill beyond the mobile viewport. More vertical content than the mock is expected because all ten criteria and full passages remain available.
- Color: pure-black page, almost-black surfaces, warm white, metallic highlights, fine gold borders. Day uses ivory and darker gold. Both roles pass tested text contrast pairs ≥4.5:1; this is not a claim of an exhaustive accessibility audit.
- Assets: existing EvidenceBridge mark retained. No stock photography or generated mock embedded as UI. Background squares are independently implemented Canvas geometry, as explicitly approved by the user; no Pro code or license registry used.
- Copy/data: actual existing synthetic fixtures and API boundaries retained. No invented conversion chart, staffing demand series, hiring decision or AI output added. Dashboard coverage is explicitly not a score; hiding reminders does not resolve or delete evidence.
- Interactions: shared theme/sidebar, reduced motion, mobile focus trap, source lookup, assessment draft validation, four candidate V1/More/V2 loops all pass. Test pageerror handlers found no errors. Manual preview was rendered in the in-app browser; production-build console was not separately exhaustively inspected.

## Validation

- `npm test --prefix app/candidate`: 42/42.
- `npm run test:ui --prefix app/candidate -- --workers=2`: 12/12.
- `npm run test:revision5 --prefix app/candidate`: 15/15 after final UI changes.
- `npm run test:api --prefix app/candidate`: 11/11, isolated backend, no external model calls.
- Candidate and HR default builds and explicit revision5-preview builds passed.
- `python scripts/check_repository.py`: 19 documents passed. `git diff --check`: passed.

## Follow-up polish / limits

- Native Popover API verified on current Chromium only; Safari/Firefox not separately tested.
- Human assessment editing remains a dialog and stores a local draft, rather than implying the mock's inline button publishes a reviewed score.
- The selected mock's strong bloom is restrained in the working app to keep source text clear. Further glow intensity is an aesthetic follow-up.

Implementation checklist complete for local preview. No commit, push, merge or deployment performed in this turn.
# React Bits interaction follow-up

## Rubric cards and evidence layout

The company rubric is now a ten-unit weight strip plus three equal-height frosted skill cards, using the existing 3/3/4 criteria. Percentages are labelled as fixed rubric weights, not personal results. Desktop, light mode and 390px mobile screenshots are generated by the rubric visualization regression.

Evidence criteria now sit above two independent source/judgment cards. Desktop tests check top alignment and ordering at 1536px and 1100px; mobile checks stacked cards and no horizontal overflow. Source precedes judgment in DOM order as well as visually. Selecting a criterion scrolls only the source pre element (the explicit Locate exact source action still reveals the quotation in the page); opening a rubric rule scrolls only the dialog. New assertions check unchanged page scroll position, exact rule and quote, and keyboard focus restoration.

During verification, restored dialog focus initially failed and was fixed in StandardsOverview. The initial mobile overflow assertion ran during the existing sidebar width transition; it now waits for margin-left=0 before measuring, without disabling the check. Full-page captures wait two paint frames after returning to the top, avoiding stale backdrop-compositor tiles.

## Contrast and frosted surface revision

The user subsequently requested brighter dark surfaces, coordinated empty-state buttons and background depth. Verified new HR dashboard/evidence, Candidate investigation, and both empty-state dark/light screenshots from the current browser run. Reading surfaces are charcoal; outer frames have subtle gold-tinted glass; original quotations, tables and form inputs stay opaque. The two reported buttons now have metallic gold primary styling and retain fixed hover geometry. Static ambient gradients supplement the existing square backdrop without extra dependencies.

Current verification supersedes the earlier counts: revision5 17/17, shared UI 12/12; default and preview builds of both apps passed. Text token contrast is at least 4.5:1 on reading backgrounds, fallback backgrounds and conservatively composited glass stops. This does not claim exhaustive accessibility certification or cross-browser/performance coverage.

Only GlideSelect, SpotlightCard and StarBorder remain. ClickSpark was cancelled by the user and removed before final verification. The new effects are adaptations using existing React/CSS, not dependency installations.

Reviewed actual HR dark/light and Candidate reduced-motion screenshots in `.ci-results/revision5-ui/revision5-gold-card-effect-5fe92-and-stop-for-reduced-motion/`. Gold lighting remains subtle; panel bounds and text layout are unchanged. Thin top/bottom streaks highlight the queue and task entry only. No animation is applied to button geometry.

Verification: revision5 browser suite 16/16 and shared UI suite 12/12 passed. The added browser test verifies pointer transparency, stable panel bounds, dark/light glow tokens, source and queue actions, reduced motion, and absence of spark elements. Candidate TypeScript/default build and both preview builds passed. Chromium was tested; other browser engines were not.

The standards rail now uses a darker backing and brighter unselected cards, with gold border/glow transitions on hover and no geometry transforms. Material stage uses the existing theme-aware GlideSelect instead of the native blue option menu. Regression coverage includes opening the menu in dark/light modes and using task V2 in all four candidate workflows.

## 2026-09-20 — English frontend release candidate

Scope: completed HR company/comparison/evidence/task/retention redesign and shared HR/Candidate identity transitions. The separately in-progress Candidate four-page redesign is excluded. No backend/schema/fixture changes or local Chinese translation assets.

Local verification on the isolated release tree: Candidate unit tests 162/162; HR workflow tests 8/8; Candidate TypeScript/Vite and HR Vite builds passed; repository documentation and API4 generated-type checks passed. Internal CUA checks covered slow candidate reads, identity-bound readonly content, rapid task selection, error/retry recovery, and main navigation on the matching local implementation. New browser regression cases are included; remote CI results must be checked on this exact PR head before merging. No local browser-CLI execution is claimed.

Release procedure: build both English bundles from the merged commit using `VITE_APP_MODE=api4-connected`, `VITE_API_BASE_URL=/gateway`, and `/hr/` / `/candidate/` bases; atomically select a new frontend release, keep the previous release and old hashed assets, preserve the live backend/database, and perform read-only HTTPS checks. Machine-specific deployment receipts stay outside Git.
