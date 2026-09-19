import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync, openSync, writeFileSync, closeSync, readFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import type { AnalysisState, ReviewRecord, Submission } from './schema.js';

/** Single local process per database; a crashed process leaves a recoverable PID lock. */
function lockDatabase(path: string): () => void {
  if (path === ':memory:') return () => undefined;
  const lockPath = `${path}.lock`; const nonce = randomUUID();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let fd: number;
    try { fd = openSync(lockPath, 'wx', 0o600); }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
      // Serialize stale-owner cleanup so concurrent restarts never unlink a new owner's lock.
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
      } catch { /* Preserve an unexpected lock; never delete someone else's ownership. */ }
    };
  }
  throw new Error('Database lock acquisition failed');
}

export type TaskState = { taskId: string; status: 'draft' | 'sent' | 'submitted' | 'reviewed'; instructions: string; sentAt: string | null };
export type State = {
  schemaVersion: '1.0'; sessionId: string; datasetVersion: string; revision: number;
  task: TaskState; submissionId: string | null; analysis: AnalysisState; review: ReviewRecord | null;
};
export type StoredResponse = { status: number; body: unknown };
export class Store {
  private readonly db: DatabaseSync;
  private readonly releaseLock: () => void;
  private closed = false;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.releaseLock = lockDatabase(path);
    let opened: DatabaseSync | undefined;
    try {
    opened = new DatabaseSync(path); this.db = opened;
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS demo_state (id INTEGER PRIMARY KEY CHECK (id=1), state_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE, content_fingerprint TEXT NOT NULL, snapshot_json TEXT NOT NULL
      );
      CREATE TRIGGER IF NOT EXISTS submissions_immutable BEFORE UPDATE ON submissions
        BEGIN SELECT RAISE(ABORT, 'immutable submission'); END;
      CREATE TABLE IF NOT EXISTS idempotency (
        session_id TEXT NOT NULL, path TEXT NOT NULL, key TEXT NOT NULL, request_hash TEXT NOT NULL,
        status INTEGER NOT NULL, body_json TEXT NOT NULL, PRIMARY KEY(session_id,path,key)
      );
    `);
    } catch (error) { opened?.close(); this.releaseLock(); throw error; }
  }
  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  getState(): State | null {
    const row = this.db.prepare('SELECT state_json FROM demo_state WHERE id=1').get() as { state_json: string } | undefined;
    return row ? JSON.parse(row.state_json) as State : null;
  }
  setState(state: State): void {
    this.db.prepare('INSERT INTO demo_state VALUES(1,?) ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json').run(JSON.stringify(state));
  }
  insertSubmission(submission: Submission): void {
    this.db.prepare('INSERT INTO submissions VALUES(?,?,?,?)').run(submission.submissionId, submission.sessionId, submission.contentFingerprint, JSON.stringify(submission));
  }
  getSubmission(id: string): Submission {
    const row = this.db.prepare('SELECT snapshot_json FROM submissions WHERE id=?').get(id) as { snapshot_json: string } | undefined;
    if (!row) throw new Error('Stored submission is missing');
    return JSON.parse(row.snapshot_json) as Submission;
  }
  getIdempotency(session: string, path: string, key: string): (StoredResponse & { hash: string }) | null {
    const row = this.db.prepare('SELECT request_hash,status,body_json FROM idempotency WHERE session_id=? AND path=? AND key=?').get(session, path, key) as { request_hash: string; status: number; body_json: string } | undefined;
    return row ? { hash: row.request_hash, status: row.status, body: JSON.parse(row.body_json) as unknown } : null;
  }
  saveIdempotency(session: string, path: string, key: string, hash: string, response: StoredResponse): void {
    this.db.prepare(`INSERT INTO idempotency VALUES(?,?,?,?,?,?) ON CONFLICT(session_id,path,key)
      DO UPDATE SET status=excluded.status,body_json=excluded.body_json`).run(session, path, key, hash, response.status, JSON.stringify(response.body));
  }
  /** Reset removes past data; retain at most the most recent reset receipt. */
  clear(): void { this.db.exec('DELETE FROM submissions; DELETE FROM idempotency;'); }
  interruptPending(session: string, attemptId: string): void {
    this.db.prepare("UPDATE idempotency SET status=503,body_json=? WHERE session_id=? AND path='/api/demo/analysis' AND status=202")
      .run(JSON.stringify({ error: { code: 'AI_INTERRUPTED', message: 'Analysis was interrupted. Read the saved case and retry with a new key.', requestId: attemptId, retryable: true } }), session);
  }
  health(): boolean { return Boolean(this.db.prepare('SELECT 1 AS ready').get()); }
  close(): void { if (this.closed) return; this.closed = true; try { this.db.close(); } finally { this.releaseLock(); } }
}
