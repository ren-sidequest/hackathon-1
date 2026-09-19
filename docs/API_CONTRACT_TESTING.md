# Current and historical API integration tests

After PR16 is integrated with backend PR14, the current frontend and backend both use API4. Historical API3 UI remains an explicit mode, not a fallback. Different contract generations require matching executables and independent test databases.

## API4: test the current combined tree

The `API4 frontend integration` workflow installs and builds `app/backend` from the current PR checkout. It regenerates and checks API4 OpenAPI and generated browser types, builds both frontends and runs all 36 API4 browser cases. It no longer substitutes the frozen `ff053cb` handoff backend for the code being reviewed.

From the repository root, after installing each app's locked dependencies:

```sh
python3 scripts/frontend-types-v4.py --check
EB_API4_BACKEND_ROOT="$PWD" npm run test:api4 --prefix app/candidate
```

PowerShell equivalent:

```powershell
$env:EB_API4_BACKEND_ROOT = (Get-Location).Path
npm run test:api4 --prefix app/candidate
```

## API3: preserve the full historical regression

The `Candidate application` workflow also checks out the last matching API3 backend at `80d153bc487201c193dd416c606d20f3210766fe`, under ignored `.api3-contract`. It verifies its generated API3 types match the retained frontend types. The **current checkout's** explicit API3 frontend and all 30 browser cases run against that historical executable. The server, analyzer, and reset CLI all resolve from `EB_API3_BACKEND_ROOT`.

Local setup (choose an unused path; inspect/reuse an existing checkout rather than overwriting it):

```sh
git worktree add --detach ../evidencebridge-api3-regression 80d153bc487201c193dd416c606d20f3210766fe
npm ci --prefix ../evidencebridge-api3-regression/app/backend
EB_API3_BACKEND_ROOT="$(cd ../evidencebridge-api3-regression && pwd)" npm run test:api3 --prefix app/candidate
```

PowerShell, after creating/installing that checkout:

```powershell
$env:EB_API3_BACKEND_ROOT = (Resolve-Path ../evidencebridge-api3-regression).Path
npm run test:api3 --prefix app/candidate
```

`build-api3-backend.mjs` builds the selected backend and probes `/healthz` in memory for schema 3.0 before any browser database is opened. Merely retaining `api3-types.ts` is not runtime compatibility. Selecting the current API4 backend for this suite intentionally fails early with a setup explanation.

## Coverage and isolation

- Current API4: current PR backend, generated contract, both builds and API4 browser scenarios.
- Candidate: unit/build, standalone, shared UI, revision5 preview, retained API2 implementation, and historical API3 regression remain enabled.
- Backend, HR and repository workflows retain their existing checks. No case is skipped, assertion relaxed or job marked `continue-on-error` to achieve a green status.
- Runners read no `.env` or model credentials, use temporary SQLite and loopback ports, and do not contact production. Port overrides are documented in the respective frontend handoffs. On constrained local machines run browser suites separately from the full backend suite to avoid resource-contention timeouts; CI jobs use separate runners.
- Code merge, production deployment, database replacement, human calibration and real-model validation are separate operations.
