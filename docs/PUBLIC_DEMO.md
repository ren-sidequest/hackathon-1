# Current public demonstration

## Active product scope

The running API4 demo contains only Harbour Retail / Junior Data Analyst with Amy Chen, Ann Li, David Liu and Jamie Parker. Their supplied fictional CVs, explicitly synthetic companions, current submissions, assessments and reviews remain intact. No database reset or person-to-person migration is part of this cleanup.

Both workspaces are public: visitors can send tasks, submit work, assess evidence and save human decisions without signing in. All visitors share the same demo state. This is not individual accounts, tenant isolation or production role authorization. Website source, server configuration and administrative reset are outside public business access.

## Retired links and browser storage

- An obsolete or unknown `candidateId` is removed from the URL before any per-person API request. The page shows four current candidates and asks the visitor to select one explicitly. It does not alias an old person to a new one or send a write request.
- A normal link without `candidateId` retains its existing service-list bootstrap. Valid current links are unchanged; other query parameters and the page fragment survive recovery.
- On mount, only `evidencebridge.api3.draft.*`, `evidencebridge.api3.receipt.*` and `evidencebridge.api3.analysis-receipt.*` are removed from that origin's browser local/session storage. Storage restrictions are tolerated. API4 drafts, pending receipts and visual preferences are preserved.
- The current draft recovery panel only offers API4 drafts. It never imports retired material into a current person. Existing current-person drafts from another task/version remain separate and recoverable.
- Old development code, historical regression fixtures and deployment backups are not active product data. This change does not erase Git history, disable historical tests or delete server backup files.

## Public access UX and gateway settings

The frontend no longer probes `/gateway/write-access`, including on window focus. It has no Enable editing / Check editing access buttons or sign-in instructions. A short English notice explains the shared-write behavior. An unexpected 401 preserves form input and the original idempotency key, explains the service restriction, and asks the host to check the gateway rather than starting a login flow.

The deployment gateway must permit public business operations under `/gateway/api/demo` without `auth_basic`. The compatibility page `/gateway/write-access` may remain public with an explanation; the app no longer depends on it. Continue blocking `/gateway/api/demo/reset`, stripping forwarded authorization/admin tokens, checking Origin / cross-site requests, limiting request bodies, and binding the backend to loopback. These checks do not prevent deliberate visitors from changing public demo data.

## Verification and deployment

Run Candidate unit tests, both frontend builds, HR tests and the full API4 browser suite. T33 checks removal of retired drafts while retaining current content-version isolation; T37 covers old/unknown URL recovery in both roles, zero retired person requests, zero capability probes, no automatic writes, and unchanged service data. The existing 401 exact-request retry test remains in place.

Publish both frontend bundles from the same reviewed Git commit using `VITE_APP_MODE=api4-connected`, `VITE_API_BASE_URL=/gateway` and the correct `/hr/` / `/candidate/` build bases. Switch the frontend release atomically after validation. No backend restart or database replacement is necessary. Preserve the previous frontend release for rollback, and compare the current four case snapshots before/after non-mutating public browser checks. Keep environment-specific deployment receipts outside Git.

## Candidate-scoped rehearsal restart

The sidebar Reset demo now exposes /gateway/api/demo/rehearsal/restart as an explicitly confirmed shared synthetic operation. It archives and restarts only the selected candidate, with task/revision guards and no running analysis. Other candidates are untouched. Global /gateway/api/demo/reset remains blocked and administrator-only. See [rehearsal design](DEMO_REHEARSAL.md).
