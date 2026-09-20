import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync, openSync, writeFileSync, closeSync, readSync, readFileSync, unlinkSync, realpathSync, existsSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { ApiError } from '../errors.js';

export type StoredResponse = { status: number; body: unknown };
export type Receipt = StoredResponse & { hash: string };
export const DATABASE_FORMAT_VERSION = 4;

/** Header-only check: even a read-only SQLite connection may create WAL shared-memory files. */
export function inspectDatabaseHeader(path: string): number | null {
  if (!existsSync(path)) return null;
  if (!statSync(path).isFile()) throw new Error('Database path must be a regular file');
  const fd = openSync(path, 'r'); const header = Buffer.alloc(100);
  try {
    const length = readSync(fd, header, 0, header.length, 0);
    if (length === 0) return 0;
    if (length < 100 || header.subarray(0, 16).toString('ascii') !== 'SQLite format 3\0')
      throw new Error('Invalid SQLite header; preserve the existing file');
    return header.readUInt32BE(60);
  } finally { closeSync(fd); }
}

function inspectRevisionTables(db: DatabaseSync, validateExisting?: (state: unknown) => void): number {
  const format = db.prepare('PRAGMA user_version').get() as { user_version: number };
  const objects = db.prepare("SELECT name,type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all() as { name: string; type: string }[];
  if (format.user_version !== DATABASE_FORMAT_VERSION && (format.user_version !== 0 || objects.length !== 0))
    throw new Error('Incompatible database format; preserve this file and initialize a separate revision-6 DATABASE_PATH');
  if (format.user_version === DATABASE_FORMAT_VERSION) {
    for (const [table, columns] of [
      ['revision_state', ['id', 'state_json']],
      ['revision_receipts', ['session_id', 'candidate_id', 'path', 'key', 'request_hash', 'status', 'body_json']],
    ] as const) {
      if (!objects.some(object => object.name === table && object.type === 'table')) throw new Error('Stored database schema is incomplete; preserve it for diagnosis');
      const actual = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (columns.some(column => !actual.some(item => item.name === column))) throw new Error('Stored database schema is incomplete; preserve it for diagnosis');
    }
    const rows = db.prepare('SELECT id,state_json FROM revision_state').all() as { id: number; state_json: string }[];
    if (rows.length > 1 || (rows[0] && rows[0].id !== 1)) throw new Error('Stored database has unexpected aggregate rows; preserve it for diagnosis');
    const row = rows[0];
    if (!row && Number((db.prepare('SELECT count(*) AS n FROM revision_receipts').get() as { n: number }).n) !== 0)
      throw new Error('Stored database has receipts without its aggregate; preserve it for recovery');
    if (row && validateExisting) validateExisting(JSON.parse(row.state_json) as unknown);
  }
  return format.user_version;
}

export class ReceiptOwnershipError extends ApiError {
  constructor() { super('IDEMPOTENCY_OWNER_MISMATCH', 409, 'Idempotency key belongs to a different operation owner.'); }
}

/** Use the same PID/nonce protocol as the v2 process, including its reclaim guard. */
export function acquireDatabaseLock(path: string): () => void {
  if (path === ':memory:') return () => undefined;
  const lockPath = `${path}.lock`; const nonce = randomUUID();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let fd: number;
    try { fd = openSync(lockPath, 'wx', 0o600); }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
      const reclaimPath = `${lockPath}.reclaim`;
      const reclaimFd = openSync(reclaimPath, 'wx', 0o600);
      let stale = false;
      try {
        const prior = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid: number };
        if (!Number.isInteger(prior.pid) || prior.pid <= 0) throw new Error('Invalid database lock; inspect it before removal');
        try { process.kill(prior.pid, 0); }
        catch (probe) {
          if (probe && typeof probe === 'object' && 'code' in probe && probe.code === 'ESRCH') { unlinkSync(lockPath); stale = true; }
        }
      } finally { closeSync(reclaimFd); unlinkSync(reclaimPath); }
      if (stale) continue;
      throw new Error('Database is already open by a live process');
    }
    try { writeFileSync(fd, JSON.stringify({ pid: process.pid, nonce })); } finally { closeSync(fd); }
    return () => {
      try {
        const owned = JSON.parse(readFileSync(lockPath, 'utf8')) as { nonce: string };
        if (owned.nonce === nonce) unlinkSync(lockPath);
      } catch { /* Preserve unexpected ownership and diagnostic files. */ }
    };
  }
  throw new Error('Database lock acquisition failed');
}

export function canonicalDatabasePath(path: string): string {
  if (path === ':memory:') return path;
  const absolute = resolve(path);
  return existsSync(absolute) ? realpathSync(absolute) : resolve(realpathSync(dirname(absolute)), basename(absolute));
}

/** Caller owns the transaction. New sessions only; historical identity conversion is retired. */
export function createRevisionTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE revision_state (id INTEGER PRIMARY KEY CHECK (id=1), state_json TEXT NOT NULL);
    CREATE TABLE revision_receipts (
      session_id TEXT NOT NULL, candidate_id TEXT NOT NULL, path TEXT NOT NULL, key TEXT NOT NULL,
      request_hash TEXT NOT NULL, status INTEGER NOT NULL, body_json TEXT NOT NULL,
      PRIMARY KEY(session_id,path,key)
    );
    PRAGMA user_version = 4;
  `);
}

function json(value: unknown): string {
  const result = JSON.stringify(value);
  if (result === undefined) throw new TypeError('Persistent state must be JSON-serializable');
  return result;
}

/** Aggregate state and its receipt commit together; business history validation belongs to the service. */
export class RevisionStore {
  private readonly db: DatabaseSync;
  private readonly releaseLock: () => void;
  private closed = false;
  private inTransaction = false;

  constructor(path: string, validateExisting?: (state: unknown) => void) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
    path = canonicalDatabasePath(path);
    this.releaseLock = acquireDatabaseLock(path);
    let opened: DatabaseSync | undefined;
    try {
      if (path !== ':memory:') {
        const headerVersion = inspectDatabaseHeader(path);
        if (headerVersion !== null && headerVersion !== 0 && headerVersion !== DATABASE_FORMAT_VERSION)
          throw new Error('Incompatible database format; preserve this file and initialize a separate revision-6 DATABASE_PATH');
        if ((headerVersion === null || headerVersion === 0) && ['-wal', '-shm', '-journal'].some(suffix => existsSync(`${path}${suffix}`)))
          throw new Error('Uninitialized database has journal sidecars; preserve all files for recovery');
        if (headerVersion !== null && statSync(path).size > 0) {
          const preflight = new DatabaseSync(path, { readOnly: true });
          try { inspectRevisionTables(preflight, validateExisting); } finally { preflight.close(); }
        }
      }
      opened = new DatabaseSync(path); this.db = opened;
      // Read-only inspection precedes journal settings, permissions, DDL and format changes.
      const formatVersion = inspectRevisionTables(this.db, validateExisting);
      if (path !== ':memory:') chmodSync(path, 0o600);
      this.db.exec('PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
      if (formatVersion === 0) {
        // Commit the format marker to the main header before enabling WAL. A first-run crash
        // must not leave header=0 with the only format-4 marker in an orphaned WAL.
        this.db.exec('PRAGMA journal_mode=DELETE;');
        this.transaction(() => createRevisionTables(this.db));
      }
      this.db.exec('PRAGMA journal_mode=WAL;');
    } catch (error) { opened?.close(); this.releaseLock(); throw error; }
  }

  transaction<T>(work: () => T): T {
    if (this.inTransaction) throw new Error('Nested transactions are not supported');
    if (work.constructor.name === 'AsyncFunction') throw new TypeError('Database transactions require a synchronous callback');
    this.db.exec('BEGIN IMMEDIATE'); this.inTransaction = true;
    try {
      const result = work();
      if (result && typeof result === 'object' && 'then' in result) throw new TypeError('Database transactions require a synchronous callback');
      this.db.exec('COMMIT'); return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    finally { this.inTransaction = false; }
  }

  getState<T>(): T | null {
    const row = this.db.prepare('SELECT state_json FROM revision_state WHERE id=1').get() as { state_json: string } | undefined;
    return row ? JSON.parse(row.state_json) as T : null;
  }
  setState(state: unknown): void {
    this.db.prepare('INSERT INTO revision_state VALUES(1,?) ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json').run(json(state));
  }
  getReceipt(sessionId: string, candidateId: string, path: string, key: string): Receipt | null {
    const row = this.db.prepare('SELECT candidate_id,request_hash,status,body_json FROM revision_receipts WHERE session_id=? AND path=? AND key=?')
      .get(sessionId, path, key) as { candidate_id: string; request_hash: string; status: number; body_json: string } | undefined;
    if (!row) return null;
    if (row.candidate_id !== candidateId) throw new ReceiptOwnershipError();
    return { hash: row.request_hash, status: row.status, body: JSON.parse(row.body_json) as unknown };
  }
  saveReceipt(sessionId: string, candidateId: string, path: string, key: string, hash: string, response: StoredResponse): void {
    const prior = this.getReceipt(sessionId, candidateId, path, key);
    if (prior && prior.hash !== hash) throw new ApiError('IDEMPOTENCY_CONFLICT', 409, 'Idempotency key was already used with different content.');
    this.db.prepare(`INSERT INTO revision_receipts VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id,path,key)
      DO UPDATE SET status=excluded.status,body_json=excluded.body_json`).run(sessionId, candidateId, path, key, hash, response.status, json(response.body));
  }
  settleAnalysisReceipts(sessionId: string, candidateId: string, attemptId: string, response: StoredResponse): void {
    this.db.prepare(`UPDATE revision_receipts SET status=?,body_json=? WHERE session_id=? AND candidate_id=? AND status=202
      AND json_extract(body_json,'$.data.analysis.attemptId')=?`).run(response.status, json(response.body), sessionId, candidateId, attemptId);
  }
  archiveCandidate(sessionId: string, candidateId: string, state: unknown): void {
    if (!this.inTransaction) throw new Error('Archive requires an active transaction');
    // Additive table: previous releases can still open format 4 during rollback.
    this.db.exec(`CREATE TABLE IF NOT EXISTS rehearsal_archives (
      archive_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, candidate_id TEXT NOT NULL,
      created_at TEXT NOT NULL, state_json TEXT NOT NULL, receipts_json TEXT NOT NULL)`);
    const receipts = this.db.prepare('SELECT * FROM revision_receipts WHERE session_id=? AND candidate_id=?').all(sessionId, candidateId);
    this.db.prepare('INSERT INTO rehearsal_archives VALUES(?,?,?,?,?,?)')
      .run(randomUUID(), sessionId, candidateId, new Date().toISOString(), json(state), json(receipts));
    this.db.prepare('DELETE FROM revision_receipts WHERE session_id=? AND candidate_id=?').run(sessionId, candidateId);
  }
  clearReceipts(): void { this.db.exec('DELETE FROM revision_receipts'); }
  health(): boolean { return !this.closed && Boolean(this.db.prepare('SELECT 1 AS ready').get()); }
  close(): void { if (this.closed) return; this.closed = true; try { this.db.close(); } finally { this.releaseLock(); } }
}
