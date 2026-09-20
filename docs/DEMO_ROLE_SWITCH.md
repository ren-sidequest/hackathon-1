# Demo role switching

The English API4 workspaces expose a compact, collapsible `Demo · HR ⇄` / `Demo · Candidate ⇄` control at the bottom right. The sidebar and top navigation keep their existing layout. The menu identifies the selected candidate before navigating. This is a shared-demo viewing tool, not login or role-based authorization.

## Navigation and data boundaries

- Production stays in the same browser tab, between `/hr/` and `/candidate/` on the current origin. The target URL carries only the explicit current candidate and validated light/dark, collapsed/expanded presentation hints; hints are removed after arrival.
- Candidate first opens My materials if no task has been sent, otherwise My task. HR first opens Tasks & review when submitted work exists, otherwise Candidate details. A prior visit in that tab restores the remembered role page, scroll position, HR detail section and assessment standard/stage.
- Navigation memory is scoped by API base, schema, session, candidate, task and content/JD/rubric/dataset versions. It contains no private notes, evidence text, scores or request bodies. Both roles reload their own current state from API4. Returning from the browser's back/forward cache also refreshes data.
- Theme and sidebar width transfer before the target React app mounts. A shared HTML entry placeholder and React loading shell reduce blank/white frames. Cross-directory navigation is still a document load, not a persistent single-page shell; network failure remains visible and retryable.
- Candidate drafts keep the existing local, version-bound storage. Failed draft storage, unsent HR task edits and unsaved review/assessment edits receive a leave warning. Only explicit discard permits losing unsaved edits. Pending/uncertain writes disable role switching until resolved; switching never sends a task, submits work or retries a write automatically.
- The control is keyboard accessible; Escape closes the menu and restores focus. The action toast is raised above the collapsed control. No dependency, backend schema, scoring or database change is introduced.

## Local development and validation

The deployed same-origin defaults need no configuration. For two independent loopback dev servers, set `VITE_HR_WORKSPACE_URL=http://127.0.0.1:<hr-port>/` in Candidate and `VITE_CANDIDATE_WORKSPACE_URL=http://127.0.0.1:<candidate-port>/` in HR. Cross-origin overrides are rejected in production; only explicitly configured loopback HTTP peers are allowed in development. The existing API4 Playwright configuration supplies these values automatically.

From repository root:

```sh
npm test --prefix app/candidate
npm test --prefix app/hr
npm run build --prefix app/candidate
npm run build --prefix app/hr
npm run test:api4 --prefix app/candidate
python scripts/check_repository.py
git diff --check
```

T61–T66 cover same-candidate round trips, theme/sidebar/criterion continuity, private draft isolation, explicit discard, slow/offline arrival, storage failure and pending receipts followed by a real isolated submission. All browser writes use the test runner's temporary SQLite database. Runtime errors and screenshots/traces are recorded under ignored `.ci-results/api4-ui/`.

Deployment requires both merged-commit builds in API4 mode with `/gateway` and their respective `/hr/` / `/candidate/` asset bases. Preserve the previous static release; never reset/reseed the shared case just to demonstrate switching. Existing open tabs may keep older HTML until refreshed.
