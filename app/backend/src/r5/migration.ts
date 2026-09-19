import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import { closeSync, copyFileSync, existsSync, fsyncSync, linkSync, lstatSync, openSync, readFileSync, unlinkSync, chmodSync, constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { State } from '../store.js';
import type { Submission } from '../schema.js';
import { acquireDatabaseLock, canonicalDatabasePath, createRevisionTables } from './store.js';

export type LegacySubmissionRow = {
  id: string; session_id: string; submission_version: number; content_fingerprint: string; snapshot_json: string;
};
export type LegacyReceiptRow = {
  session_id: string; path: string; key: string; request_hash: string; status: number; body_json: string;
};
export type OldMigrationPayload = {
  legacyState: State;
  submissions: Submission[];
  receipts: { sessionId: string; path: string; key: string; hash: string; status: number; body: unknown }[];
  raw: { stateJson: string; submissionRows: LegacySubmissionRow[]; receiptRows: LegacyReceiptRow[] };
  source: { path: string; fingerprint: string; schema: unknown[] };
};
export type ConvertedMigration = { state: unknown; sourceMap?: unknown };
export type MigrationOptions = {
  source: string; destination: string; backup: string;
  /** The domain converter validates old bindings and builds/validates the four-candidate aggregate. */
  convert: (payload: OldMigrationPayload) => ConvertedMigration;
};
export type MigrationReport = {
  source: string; destination: string; backup: string; sourceFingerprint: string;
  archivedSubmissions: number; archivedReceipts: number; formatVersion: 3;
};
export class MigrationError extends Error {
  constructor(message: string, public readonly diagnosticPaths: string[], options?: ErrorOptions) { super(message, options); }
}

function syncFile(path: string): void { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } }
function sha256(path: string): string { return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`; }
function ensureAbsent(path: string): void {
  // lstat also detects dangling symlinks; the final hard-link publication is exclusive as well.
  try { lstatSync(path); }
  catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return; throw error; }
  throw new Error(`Destination already exists: ${path}`);
}
function inspectV2(db: DatabaseSync): void {
  const format = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (format.user_version !== 2) throw new Error('Migration source must be database format 2');
  const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(row => row.name);
  if (!['demo_state', 'submissions', 'idempotency'].every(name => names.includes(name))) throw new Error('Source v2 schema is incomplete');
  if (names.some(name => name.startsWith('legacy_v2_') || name.startsWith('revision_'))) throw new Error('Source contains reserved migration tables');
  const integrity = db.prepare('PRAGMA integrity_check').all();
  if (integrity.length !== 1 || integrity[0]?.['integrity_check'] !== 'ok') throw new Error('Source integrity check failed');
}
function readPayload(db: DatabaseSync, source: string, fingerprint: string): OldMigrationPayload {
  const states = db.prepare('SELECT id,state_json FROM demo_state').all() as { id: number; state_json: string }[];
  if (states.length !== 1 || states[0]?.id !== 1) throw new Error('Source must contain exactly one initialized v2 state');
  const stateJson = states[0].state_json;
  const legacyState = JSON.parse(stateJson) as State;
  if (legacyState.schemaVersion !== '2.0' || typeof legacyState.sessionId !== 'string' || !Array.isArray(legacyState.versions))
    throw new Error('Source workflow is not a v2 state');
  const submissionRows = db.prepare('SELECT * FROM submissions ORDER BY submission_version').all() as LegacySubmissionRow[];
  const receiptRows = db.prepare('SELECT * FROM idempotency ORDER BY session_id,path,key').all() as LegacyReceiptRow[];
  const submissions = submissionRows.map(row => {
    const sub = JSON.parse(row.snapshot_json) as Submission;
    if (sub.submissionId !== row.id || sub.sessionId !== row.session_id || sub.submissionVersion !== row.submission_version
      || sub.contentFingerprint !== row.content_fingerprint || sub.sessionId !== legacyState.sessionId)
      throw new Error('Source submission metadata is inconsistent');
    return sub;
  });
  if (legacyState.versions.length !== submissions.length || legacyState.versions.some((version, index) => version.submissionId !== submissions[index]?.submissionId))
    throw new Error('Source version history is inconsistent');
  const receipts = receiptRows.map(row => ({ sessionId: row.session_id, path: row.path, key: row.key,
    hash: row.request_hash, status: row.status, body: JSON.parse(row.body_json) as unknown }));
  return { legacyState, submissions, receipts, raw: { stateJson, submissionRows, receiptRows },
    source: { path: source, fingerprint, schema: db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all() } };
}
function verifyArchive(db: DatabaseSync, original: OldMigrationPayload): void {
  const row = db.prepare('SELECT state_json FROM legacy_v2_demo_state WHERE id=1').get() as { state_json: string };
  const submissions = db.prepare('SELECT * FROM legacy_v2_submissions ORDER BY submission_version').all();
  const receipts = db.prepare('SELECT * FROM legacy_v2_idempotency ORDER BY session_id,path,key').all();
  if (row.state_json !== original.raw.stateJson || JSON.stringify(submissions) !== JSON.stringify(original.raw.submissionRows)
    || JSON.stringify(receipts) !== JSON.stringify(original.raw.receiptRows)) throw new Error('Migration archive verification failed');
}

/** Copy-only migration: original stays format 2, backup is a WAL-safe format-2 snapshot. */
export async function migrateV2Database(options: MigrationOptions): Promise<MigrationReport> {
  for (const name of ['source', 'destination', 'backup'] as const) {
    if (!options[name] || options[name] === ':memory:') throw new Error(`An explicit filesystem ${name} path is required`);
  }
  const source = canonicalDatabasePath(options.source);
  if (!lstatSync(source).isFile()) throw new Error('Migration source must be an existing regular file');
  const destinationInput = resolve(options.destination); const backupInput = resolve(options.backup);
  ensureAbsent(destinationInput); ensureAbsent(backupInput);
  const destination = canonicalDatabasePath(destinationInput); const backup = canonicalDatabasePath(backupInput);
  if (new Set([source, destination, backup]).size !== 3) throw new Error('Source, destination and backup must be distinct paths');
  for (const path of [destination, backup]) for (const suffix of ['-wal', '-shm', '-journal']) ensureAbsent(`${path}${suffix}`);

  const releaseSource = acquireDatabaseLock(source);
  const releaseOtherLocks: (() => void)[] = [];
  let sourceDb: DatabaseSync | undefined; let stageDb: DatabaseSync | undefined;
  const diagnosticPaths: string[] = [];
  try {
    // A v2 process may use a file symlink without canonicalizing its sidecar lock.
    const suppliedSource = resolve(options.source);
    if (canonicalDatabasePath(`${suppliedSource}.lock`) !== `${source}.lock`)
      releaseOtherLocks.push(acquireDatabaseLock(suppliedSource));
    releaseOtherLocks.push(acquireDatabaseLock(backup));
    releaseOtherLocks.push(acquireDatabaseLock(destination));
    ensureAbsent(destination); ensureAbsent(backup);
    sourceDb = new DatabaseSync(source, { readOnly: true }); inspectV2(sourceDb);
    const backupStage = `${backup}.migration-${randomUUID()}.tmp`;
    const fd = openSync(backupStage, 'wx', 0o600); closeSync(fd); diagnosticPaths.push(backupStage);
    // The native SQLite backup API includes committed WAL contents; raw copyFile(source) does not.
    await sqliteBackup(sourceDb, backupStage);
    sourceDb.close(); sourceDb = undefined;
    chmodSync(backupStage, 0o600); syncFile(backupStage);
    const snapshot = new DatabaseSync(backupStage, { readOnly: true });
    let payload: OldMigrationPayload;
    try { inspectV2(snapshot); payload = readPayload(snapshot, source, sha256(backupStage)); }
    finally { snapshot.close(); }
    linkSync(backupStage, backup); diagnosticPaths.push(backup); unlinkSync(backupStage); syncFile(dirname(backup));

    const stage = `${destination}.migration-${randomUUID()}.tmp`;
    copyFileSync(backup, stage, constants.COPYFILE_EXCL); chmodSync(stage, 0o600); diagnosticPaths.push(stage);
    // Preserve an independent copy: converters receive no way to mutate the archive verification baseline.
    const converted = options.convert(structuredClone(payload));
    const stateJson = JSON.stringify(converted.state); const sourceMap = JSON.stringify(converted.sourceMap ?? null);
    if (!stateJson || stateJson === 'null') throw new Error('Domain converter must produce initialized JSON state');
    if (!sourceMap) throw new Error('Migration source map must be JSON-serializable');
    stageDb = new DatabaseSync(stage);
    stageDb.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
    try {
      stageDb.exec(`
        ALTER TABLE demo_state RENAME TO legacy_v2_demo_state;
        ALTER TABLE submissions RENAME TO legacy_v2_submissions;
        ALTER TABLE idempotency RENAME TO legacy_v2_idempotency;
      `);
      createRevisionTables(stageDb);
      stageDb.exec(`CREATE TABLE legacy_v2_migration (
        id INTEGER PRIMARY KEY CHECK(id=1), migrated_at TEXT NOT NULL, source_path TEXT NOT NULL,
        source_fingerprint TEXT NOT NULL, source_schema_json TEXT NOT NULL, source_map_json TEXT NOT NULL
      );`);
      stageDb.prepare('INSERT INTO revision_state VALUES(1,?)').run(stateJson);
      stageDb.prepare('INSERT INTO legacy_v2_migration VALUES(1,?,?,?,?,?)').run(new Date().toISOString(), source,
        payload.source.fingerprint, JSON.stringify(payload.source.schema), sourceMap);
      for (const table of ['legacy_v2_demo_state', 'legacy_v2_submissions', 'legacy_v2_idempotency', 'legacy_v2_migration']) {
        for (const action of ['INSERT', 'UPDATE', 'DELETE']) stageDb.exec(`CREATE TRIGGER ${table}_${action.toLowerCase()}_immutable
          BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'immutable v2 migration archive'); END;`);
      }
      verifyArchive(stageDb, payload);
      const integrity = stageDb.prepare('PRAGMA integrity_check').all();
      if (integrity.length !== 1 || integrity[0]?.['integrity_check'] !== 'ok') throw new Error('Migrated integrity check failed');
      stageDb.exec('COMMIT');
    } catch (error) { stageDb.exec('ROLLBACK'); throw error; }
    stageDb.close(); stageDb = undefined;
    syncFile(stage);
    // link is atomic and fails if anything appeared at destination; rename would overwrite it.
    linkSync(stage, destination); diagnosticPaths.push(destination); syncFile(dirname(destination)); unlinkSync(stage);
    return { source, destination, backup, sourceFingerprint: payload.source.fingerprint,
      archivedSubmissions: payload.submissions.length, archivedReceipts: payload.receipts.length, formatVersion: 3 };
  } catch (error) {
    throw new MigrationError(`Copy migration stopped; original source preserved. ${error instanceof Error ? error.message : String(error)}`,
      diagnosticPaths.filter(path => existsSync(path)), { cause: error });
  } finally {
    try { sourceDb?.close(); } finally {
      try { stageDb?.close(); } finally {
        for (const release of releaseOtherLocks.reverse()) release(); releaseSource();
      }
    }
  }
}
