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

export type TaskState = { taskId: string; status: 'draft' | 'sent' | 'submitted' | 'awaiting_revision' | 'reviewed'; instructions: string; sentAt: string | null };
export type VersionState = { submissionId: string; analysis: AnalysisState; review: ReviewRecord | null };
export type State = {
  schemaVersion: '2.0'; sessionId: string; datasetVersion: string; revision: number;
  task: TaskState; versions: VersionState[];
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
    // Inspect before any DDL/PRAGMA writes: v1 files are preserved, never silently reset or migrated.
    const format = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
    if (format.user_version !== 2 && (format.user_version !== 0 || tables.length !== 0))
      throw new Error('Incompatible demo database format; preserve it and select a new DATABASE_PATH for schema 2.0');
    if (format.user_version === 2 && !['demo_state', 'submissions', 'idempotency'].every(name => tables.some(t => t.name === name)))
      throw new Error('Stored database schema is incomplete; preserve it for diagnosis');
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS demo_state (id INTEGER PRIMARY KEY CHECK (id=1), state_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL, submission_version INTEGER NOT NULL CHECK(submission_version IN (1,2)),
        content_fingerprint TEXT NOT NULL, snapshot_json TEXT NOT NULL, UNIQUE(session_id,submission_version)
      );
      CREATE TRIGGER IF NOT EXISTS submissions_immutable BEFORE UPDATE ON submissions
        BEGIN SELECT RAISE(ABORT, 'immutable submission'); END;
      CREATE TABLE IF NOT EXISTS idempotency (
        session_id TEXT NOT NULL, path TEXT NOT NULL, key TEXT NOT NULL, request_hash TEXT NOT NULL,
        status INTEGER NOT NULL, body_json TEXT NOT NULL, PRIMARY KEY(session_id,path,key)
      );
      PRAGMA user_version = 2;
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
    this.db.prepare('INSERT INTO submissions VALUES(?,?,?,?,?)').run(submission.submissionId, submission.sessionId, submission.submissionVersion, submission.contentFingerprint, JSON.stringify(submission));
  }
  getSubmission(id: string): Submission {
    const row = this.db.prepare('SELECT * FROM submissions WHERE id=?').get(id) as {
      id: string; session_id: string; submission_version: number; content_fingerprint: string; snapshot_json: string;
    } | undefined;
    if (!row) throw new Error('Stored submission is missing');
    const sub = JSON.parse(row.snapshot_json) as Submission;
    if (sub.submissionId !== row.id || sub.sessionId !== row.session_id || sub.submissionVersion !== row.submission_version
      || sub.contentFingerprint !== row.content_fingerprint) throw new Error('Stored submission metadata is inconsistent');
    return sub;
  }
  submissionIds(): string[] {
    return (this.db.prepare('SELECT id FROM submissions ORDER BY submission_version').all() as { id: string }[]).map(row => row.id);
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
  interruptPending(session: string, attemptId: string, code = 'AI_INTERRUPTED', status = 503): void {
    this.db.prepare("UPDATE idempotency SET status=?,body_json=? WHERE session_id=? AND path='/api/demo/analysis' AND status=202 AND json_extract(body_json,'$.data.analysis.attemptId')=?")
      .run(status, JSON.stringify({ error: { code,
        message: code === 'AI_REVIEW_CLOSED' ? 'Human review closed this analysis attempt. Read the version history.' : 'Analysis was interrupted. Read the saved case and retry with a new key.',
        requestId: attemptId, retryable: code === 'AI_INTERRUPTED' } }), session, attemptId);
  }
  health(): boolean { return Boolean(this.db.prepare('SELECT 1 AS ready').get()); }
  close(): void { if (this.closed) return; this.closed = true; try { this.db.close(); } finally { this.releaseLock(); } }
}
