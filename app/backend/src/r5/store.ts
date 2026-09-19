import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync, openSync, writeFileSync, closeSync, readFileSync, unlinkSync, realpathSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { ApiError } from '../errors.js';

export type StoredResponse = { status: number; body: unknown };
export type Receipt = StoredResponse & { hash: string };

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

/** Caller owns the transaction. Also used by the explicit copy-only migrator. */
export function createRevisionTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE revision_state (id INTEGER PRIMARY KEY CHECK (id=1), state_json TEXT NOT NULL);
    CREATE TABLE revision_receipts (
      session_id TEXT NOT NULL, candidate_id TEXT NOT NULL, path TEXT NOT NULL, key TEXT NOT NULL,
      request_hash TEXT NOT NULL, status INTEGER NOT NULL, body_json TEXT NOT NULL,
      PRIMARY KEY(session_id,path,key)
    );
    PRAGMA user_version = 3;
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

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
    path = canonicalDatabasePath(path);
    this.releaseLock = acquireDatabaseLock(path);
    let opened: DatabaseSync | undefined;
    try {
      opened = new DatabaseSync(path); this.db = opened;
      // Read-only inspection precedes journal settings, permissions, DDL and format changes.
      const format = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
      const objects = this.db.prepare("SELECT name,type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all() as { name: string; type: string }[];
      if (format.user_version !== 3 && (format.user_version !== 0 || objects.length !== 0))
        throw new Error('Incompatible database format; preserve this file and use the explicit v2-to-v3 copy migration or a new DATABASE_PATH');
      if (format.user_version === 3) {
        for (const [table, columns] of [
          ['revision_state', ['id', 'state_json']],
          ['revision_receipts', ['session_id', 'candidate_id', 'path', 'key', 'request_hash', 'status', 'body_json']],
        ] as const) {
          if (!objects.some(object => object.name === table && object.type === 'table')) throw new Error('Stored database schema is incomplete; preserve it for diagnosis');
          const actual = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
          if (columns.some(column => !actual.some(item => item.name === column))) throw new Error('Stored database schema is incomplete; preserve it for diagnosis');
        }
      }
      if (path !== ':memory:') chmodSync(path, 0o600);
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
      if (format.user_version === 0) this.transaction(() => createRevisionTables(this.db));
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
  clearReceipts(): void { this.db.exec('DELETE FROM revision_receipts'); }
  health(): boolean { return !this.closed && Boolean(this.db.prepare('SELECT 1 AS ready').get()); }
  close(): void { if (this.closed) return; this.closed = true; try { this.db.close(); } finally { this.releaseLock(); } }
}
