# Revision 6 storage, local initialization and recovery

Status: **local implementation; not deployed**. All examples use deliberately explicit local paths. There is no server connection, automatic migration, reset, identity remapping or overwrite in these commands. Human content calibration and frontend integration are separate gates.

## Version boundaries

| Boundary | Revision 6 value | Meaning |
| --- | --- | --- |
| API / aggregate schema | `4.0` | New closed candidate enum; API3 clients must not submit old contracts. |
| Physical SQLite format | `PRAGMA user_version = 4` | Separate from the API string. |
| Application fixture | `harbour-retail-applications-v1` | Amy Chen, Ann Li, David Liu and Jamie Parker only. |
| Job | `junior-data-analyst` | Harbour Retail's junior role; source JD version and hash are in the content manifest. |
| Rubric | `harbour-retail-junior-analyst-rubric-v1` | Ten criteria and deterministic 30/30/40 core scoring. |
| Company task dataset | `harbour-retail-2026-09-v1` | Shared company task facts, never a person's previous project. |
| Session | Generated UUID | New on explicit fresh initialization/reset, preserved by restart/backup/restore. |
| Evidence / assessment | Snapshot fingerprint, submission V1/V2, stage and assessment revision | Every person's history remains separately bound. |

The executable defaults to contract `4.0` and `./var/evidencebridge-v4.sqlite`. `DEMO_CONTRACT=2.0` / the legacy entrypoint retain historical API2 operation on their separate v2 files. `DEMO_CONTRACT=3.0` is rejected; preserve the historical API3 executable, frontend, content and database together to run that release. An old `.env` can override a default path, so inspect it before starting.

Historical identities are **not** renamed. The old v2-to-v3 migration entrypoint and domain converter fail before filesystem work in revision 6. They do not create a backup or destination. For historical conversion, use its historical release separately. Revision 6 provides fresh initialization and non-transforming backup/restore instead.

## Startup protections

1. Canonicalize the file path and acquire the existing PID/nonce ownership lock. A live process or file symlink alias blocks a second writer. Stale PID locks are reclaimed; malformed or unexpectedly replaced locks are retained for diagnosis.
2. Read only the 100-byte SQLite header. Any nonzero format other than 4 is rejected **before opening SQLite**. A read-only SQLite connection itself may create shared-memory sidecars, which is why a header check is required for historical files.
3. Reject uninitialized paths with orphan `-wal`, `-shm` or `-journal` files. Preserve them for explicit recovery rather than silently starting a new case.
4. For existing current-format databases, read-only schema and full domain validation happen before permission or journal configuration changes. The app passes `validateState` into `RevisionStore`; wrong fixture, candidate ownership, baseline, fingerprints or history fail closed.
5. Only a compatible database is opened for writing and changed to owner-only permissions. For a new file, tables and the format-4 marker are first committed with DELETE journaling and synchronous FULL, before WAL is enabled; the main header is therefore 4 even after a first-run crash. Existing current data then uses WAL, synchronous FULL, foreign keys and a busy timeout. State and idempotency receipts commit in one transaction. A missing aggregate with surviving receipts is diagnosed, never silently initialized.

No identity conversion is attempted on startup. A failed compatibility check leaves legacy main/WAL/SHM bytes and file permissions intact. Schema validation is not a substitute for keeping the old version's backup.

## Local CLI

Build first, from the repository root:

```sh
npm run build --prefix app/backend
mkdir -p /tmp/evidencebridge-r6-local
# Header-only historical inspection; no SQLite connection or migration.
node app/backend/scripts/manage-r6-database.mjs inspect --database /absolute/old-v3.sqlite
# Dry-run checks explicit path/non-overwrite preconditions without creating a database, lock or session.
node app/backend/scripts/manage-r6-database.mjs init --database /tmp/evidencebridge-r6-local/demo-v4.sqlite --dry-run
node app/backend/scripts/manage-r6-database.mjs init --database /tmp/evidencebridge-r6-local/demo-v4.sqlite
# Stop only your isolated local application before full maintenance commands.
node app/backend/scripts/manage-r6-database.mjs inspect --database /tmp/evidencebridge-r6-local/demo-v4.sqlite
node app/backend/scripts/manage-r6-database.mjs backup --source /tmp/evidencebridge-r6-local/demo-v4.sqlite --destination /tmp/evidencebridge-r6-local/backup-v4.sqlite --dry-run
node app/backend/scripts/manage-r6-database.mjs backup --source /tmp/evidencebridge-r6-local/demo-v4.sqlite --destination /tmp/evidencebridge-r6-local/backup-v4.sqlite
node app/backend/scripts/manage-r6-database.mjs restore --source /tmp/evidencebridge-r6-local/backup-v4.sqlite --destination /tmp/evidencebridge-r6-local/restored-v4.sqlite
```

All commands require absolute explicit paths. Parents must already exist. `init` creates the four new application baselines, new per-person task IDs and a fresh session with no inherited submissions, reviews, shortlist history or receipts. It validates the complete state before atomic publication. Baselines remain honestly labelled AI-authored / human calibration pending.

`inspect` is header-only for old formats, or with `--dry-run`; its report explicitly distinguishes this from a full integrity check. Full current-format inspection validates the content/state and acquires the process lock. Dry-run is preflight, not proof of successful backup, integrity or restoration.

`backup` supports recognized historical and current SQLite formats without transforming identities. It uses Node's native SQLite backup API, including committed WAL pages, then verifies the independent result and publishes using an exclusive hard link. It is **not** a `copyFile` of an actively written main file. Maintenance locks deliberately reject an active app; schedule a brief stop of the selected local process. WAL leftovers from a prior crash or a raw SQLite test writer are handled by the native backup engine.

`restore` accepts only a validated format-4/current-content snapshot into a **new** destination. It preserves the session, workflow state and receipts exactly; it is recovery, not creation of a fresh demo. Existing files, symlinks and destination sidecars block both initialization and restoration. Publication does not overwrite a concurrently appearing destination. On pre-publication failure, temporary files and owned locks are cleaned; the original and any existing destination remain intact. The directory entry and file are fsynced for publication durability.

Reports contain versions, paths, session and counts, not applicant content, credentials or notes. A generated SHA-256 identifies the resulting backup file; it is not a substitute for protecting that file. Keep backups owner-only and outside public/download roots.

## Future release / rollback plan — not executed

1. Freeze backend, generated contract/types, content manifest and compatible frontend commit as a release set. Keep historical API3 release and data untouched.
2. Record the selected old and new database paths. Obtain a consistent old snapshot with the maintenance command only during a separately approved operation. Do not copy only an active WAL main file.
3. Initialize a separate new v4 file. Verify the four new IDs, API4, English mode labels, no inherited history, private-note exclusion, gateway public-read/protected-write rules and disabled public reset.
4. Switch the complete app/frontend/contract/content/database selection together only after explicit release permission. Do not send an API3 frontend to API4 or reuse the old v3 path.
5. If the new release fails, preserve its v4 file for investigation. Point the historical executable **and** historical frontend/content back to the preserved historical v3 database. A v4 backup restores only to the compatible v4 release; do not downgrade its format number or rewrite identities.
6. Verify each selected release's health, schema, session and known readonly case after a switch. Keep recovery files until a human decides the retention policy.

## Validation commands and scope

```sh
npm run build --prefix app/backend
node --test app/backend/test/r5-storage.test.mjs app/backend/test/r6-storage.test.mjs
```

The storage suites cover generic atomic receipts/rollback, state/history corruption, retired migration rejection, physical-format rejection before legacy WAL/permission changes, strict content preflight, independent new sessions, canonical aliases, live/stale/replaced locks, no-write dry-runs, non-overwriting init, consistent WAL backup, old identity preservation, exact state/receipt restoration and invalid restore rejection. Process-level HTTP/state-machine validation belongs to `scripts/verify-r6.mjs`; storage tests alone do not prove frontend integration, production access control, real model quality or human calibration. Actual storage run on 2026-09-19: Node.js `v22.23.2`; backend build passed; these two suites passed **32/32**, with no skips. This includes a real first-run child-process SIGKILL with a committed submission and running analysis in WAL: reopening preserved the session/submission, reclaimed only the dead lock and settled the pending analysis receipt as `AI_INTERRUPTED`. The publication-race test verified that a destination appearing after preflight survives unchanged. SQLite's experimental warning on Node 22 was present; it was not treated as a test failure. Final combined results are recorded in `R6_ACCEPTANCE.md` by the integrating owner.
