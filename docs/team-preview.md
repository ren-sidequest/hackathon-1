# Team preview on GitHub Pages

Published entry points (available after the Pages deployment succeeds):

- [Candidate](https://ren-sidequest.github.io/hackathon-1/candidate/)
- [HR](https://ren-sidequest.github.io/hackathon-1/hr/)
- [Role selector](https://ren-sidequest.github.io/hackathon-1/)

These are public, independent frontend demos with synthetic data. Each visitor's progress is stored in their browser. HR sending a task does not update Candidate; Candidate submitting does not update HR. Use the demo controls in each app. No backend, authentication, paid AI API, or shared database is deployed.

## Release and recovery

The [preview workflow](../.github/workflows/pages-preview.yml) checks out the already merged application release `31edc5319ee40b1d5d6e9e658a1526d7a3ab2f35` ([PR #5](https://github.com/ren-sidequest/hackathon-1/pull/5)), runs both test suites, Candidate browser tests and shared UI tests, builds the apps with separate Vite base paths, and uploads only the static artifact. This release adds shared day/night themes and a theme-aware collapsible sidebar, with the theme switch in the sidebar. Generated files are not committed. The exact deployed application SHA is available at [source-commit.txt](https://ren-sidequest.github.io/hackathon-1/source-commit.txt).

The initial deployment runs when this workflow is pushed to `codex/pages-preview`. Changes to `main` do not automatically replace the shared demo. A future release needs an explicitly approved merged application SHA, an update of the workflow's checkout `ref`, and a successful workflow run. Workflow dispatch becomes available from the Actions UI after the workflow is merged into the default branch; merging remains a separate decision.

Pages settings use **GitHub Actions** as the source. The previous known-good application is `8b0231e9592052223e1512125387b14188fcda26`, published by workflow commit `1babdd21cf957a2b63916e5499e96cb0a9af2032`. To roll back this release, restore `.github/workflows/pages-preview.yml` and this document from that workflow commit, then commit and push to `codex/pages-preview`. Restore the full previous workflow: the old application does not have the new `test:ui` command. The workflow commit and application SHA are separate: use `source-commit.txt` for application provenance.

## Local checks

From the repository root, after each application's `npm ci`:

```sh
npm test --prefix app/candidate
npm test --prefix app/hr
npm run test:e2e --prefix app/candidate
npm run test:ui --prefix app/candidate
npm run build --prefix app/candidate -- --base=/hackathon-1/candidate/
npm run build --prefix app/hr -- --base=/hackathon-1/hr/
```

Candidate browser tests require Chromium (`npx playwright install chromium` inside `app/candidate`). Build success does not prove the live deployment works: open both public links, check navigation and refresh, and inspect browser Network/Console for missing assets or runtime errors. Build/deployment failures are in the **Publish team preview** Actions run. A 404 at both entry points usually means the deployment has not completed or Pages is disabled. A blank app with asset 404s usually means an incorrect Vite base path. Unexpected demo progress can be cleared with Candidate's **Reset all demo work** or HR's **Reset demo**.
