import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, realpathSync, statSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { RevisionStore, acquireDatabaseLock } from '../dist/r5/store.js';
import { freshState, RevisionService } from '../dist/r5/service.js';
import { validateState } from '../dist/r5/state-schema.js';
import { createTargetAnalyzer } from '../dist/r5/analysis.js';

const script = new URL('../scripts/manage-r6-database.mjs', import.meta.url).pathname;
function temporary(t) { const dir = realpathSync(mkdtempSync(join(tmpdir(), 'evidencebridge-r6-storage-'))); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; }
function cli(...args) { return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 30000 }); }
function ok(result) { assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`); return JSON.parse(result.stdout); }
function fail(result, pattern) { assert.notEqual(result.status, 0); assert.match(result.stderr, pattern); }
function readDb(path, fn) { const db = new DatabaseSync(path, { readOnly: true }); try { return fn(db); } finally { db.close(); } }
function fileSnapshot(dir) { return Object.fromEntries(readdirSync(dir).sort().map(name => { const path = join(dir, name); return [name, { bytes: readFileSync(path).toString('base64'), mode: statSync(path).mode, mtimeMs: statSync(path).mtimeMs }]; })); }
function makeLegacy(path, version = 3, leaveWalOpen = false) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE historical_content(id TEXT PRIMARY KEY, value TEXT); PRAGMA user_version=${version}`);
  db.prepare('INSERT INTO historical_content VALUES(?,?)').run('alex-chen', 'Unchanged historical identity and results');
  if (leaveWalOpen) { db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;'); db.prepare('INSERT INTO historical_content VALUES(?,?)').run('wal-row', 'committed only in WAL'); return db; }
  db.close(); return null;
}
function initialized(path) { const store = new RevisionStore(path, validateState); const state = freshState(); store.transaction(() => store.setState(state)); return { store, state }; }

test('R6 rejects legacy formats before SQLite opens or changes permissions/main/WAL/SHM', t => {
  for (const version of [1, 2, 3, 5]) {
    const dir = temporary(t); const path = join(dir, 'old.sqlite'); const db = makeLegacy(path, version, true);
    chmodSync(path, 0o644); const before = fileSnapshot(dir);
    try { assert.throws(() => new RevisionStore(path, validateState), /Incompatible database format/); assert.deepEqual(fileSnapshot(dir), before); }
    finally { db.close(); }
  }
});

test('R6 header preflight rejects malformed files and does not adopt orphan journals', t => {
  const dir = temporary(t); const path = join(dir, 'bad.sqlite'); writeFileSync(path, 'not a sqlite file');
  const before = fileSnapshot(dir); assert.throws(() => new RevisionStore(path), /Invalid SQLite header/); assert.deepEqual(fileSnapshot(dir), before);
  const missing = join(dir, 'missing.sqlite'); writeFileSync(`${missing}-wal`, 'orphan');
  assert.throws(() => new RevisionStore(missing), /journal sidecars/); assert.equal(existsSync(missing), false);
});

test('R6 read-only domain preflight rejects mismatched content before chmod or journal-mode changes', t => {
  const dir = temporary(t); const path = join(dir, 'wrong-fixture.sqlite');
  const { store, state } = initialized(path); store.close();
  state.fixtureVersion = 'harbourcart-old-applications';
  const db = new DatabaseSync(path); db.exec('PRAGMA journal_mode=DELETE'); db.prepare('UPDATE revision_state SET state_json=?').run(JSON.stringify(state)); db.close(); chmodSync(path, 0o644);
  const before = fileSnapshot(dir); assert.throws(() => new RevisionStore(path, validateState), /Stored revision6 integrity/); assert.deepEqual(fileSnapshot(dir), before);
});

test('R6 fresh databases have separate sessions, identities, tasks and empty receipts; restart preserves existing state', t => {
  const dir = temporary(t); const first = initialized(join(dir, 'one.sqlite')); const second = initialized(join(dir, 'two.sqlite'));
  assert.deepEqual(Object.keys(first.state.people), ['amy-chen', 'ann-li', 'david-liu', 'jamie-parker']);
  assert.notEqual(first.state.sessionId, second.state.sessionId);
  for (const id of Object.keys(first.state.people)) { assert.notEqual(first.state.people[id].task.taskId, second.state.people[id].task.taskId); assert.equal(first.state.people[id].versions.length, 0); }
  const saved = first.state; first.store.close(); second.store.close();
  const reopened = new RevisionStore(join(dir, 'one.sqlite'), validateState); try { assert.deepEqual(reopened.getState(), saved); assert.equal(reopened.getReceipt('old-session', 'amy-chen', '/submit', 'key'), null); } finally { reopened.close(); }
  assert.equal(readDb(join(dir, 'one.sqlite'), db => db.prepare('PRAGMA user_version').get().user_version), 4);
});

test('R6 store ownership locks cover canonical file aliases, maintenance commands and stale-lock recovery', t => {
  const dir = temporary(t); const path = join(dir, 'current.sqlite'); const { store } = initialized(path); const alias = join(dir, 'alias.sqlite'); symlinkSync(path, alias);
  try {
    assert.throws(() => new RevisionStore(alias), /live process/);
    fail(cli('backup', '--source', alias, '--destination', join(dir, 'blocked.sqlite')), /live process/);
    fail(cli('inspect', '--database', path), /live process/);
  } finally { store.close(); }
  const dead = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' }).pid;
  writeFileSync(`${path}.lock`, JSON.stringify({ pid: dead, nonce: 'stale-test' }));
  const reopened = new RevisionStore(path, validateState); reopened.close(); assert.equal(existsSync(`${path}.lock`), false);
  const release = acquireDatabaseLock(path); const prior = readFileSync(`${path}.lock`); writeFileSync(`${path}.lock`, JSON.stringify({ pid: process.pid, nonce: 'new-owner' })); release();
  assert.notDeepEqual(readFileSync(`${path}.lock`), prior); assert.equal(JSON.parse(readFileSync(`${path}.lock`, 'utf8')).nonce, 'new-owner');
});

test('R6 old-person, old-session and duplicate cross-person key attempts preserve all other candidates', t => {
  const dir = temporary(t); const { store } = initialized(join(dir, 'current.sqlite'));
  try {
    const service = new RevisionService(store, createTargetAnalyzer({ mode: 'disabled' }));
    assert.throws(() => service.read('alex-chen'), { code: 'UNKNOWN_CANDIDATE' });
    const data = service.read('amy-chen').data; const before = store.getState();
    const request = { schemaVersion: '4.0', sessionId: 'old-session', candidateId: 'amy-chen', jobId: data.job.id,
      datasetVersion: data.datasetVersion, taskId: data.task.taskId, targetRequirementId: 'sql', templateId: 'harbour-retail-sql-v1',
      instructions: 'Provide query grain and checks.', gapReason: 'SQL checks need more evidence.' };
    assert.throws(() => service.send(request, 'old-session-key'), error => error.status === 409);
    assert.deepEqual(store.getState(), before);
    store.saveReceipt(data.sessionId, 'amy-chen', '/test', 'same-key', 'hash', { status: 200, body: { data: 'Amy only' } });
    assert.throws(() => store.getReceipt(data.sessionId, 'ann-li', '/test', 'same-key'), { code: 'IDEMPOTENCY_OWNER_MISMATCH' });
    assert.equal(store.getReceipt('other-session', 'ann-li', '/test', 'same-key'), null);
    assert.throws(() => store.transaction(() => { store.setState({ changed: true }); store.saveReceipt(data.sessionId, 'amy-chen', '/test', 'same-key', 'different', { status: 200, body: {} }); }), { code: 'IDEMPOTENCY_CONFLICT' });
    assert.deepEqual(store.getState(), before);
  } finally { store.close(); }
});

test('R6 CLI requires explicit absolute paths and dry-run creates no files, locks or sessions', t => {
  const dir = temporary(t); const path = join(dir, 'new.sqlite');
  for (const flag of ['--help', '-h']) { const help = ok(cli(flag)); assert.match(help.usage, /Usage:/); assert.deepEqual(help.commands, ['inspect', 'init', 'backup', 'restore']); assert.equal(help.changes, 0); }
  assert.deepEqual(readdirSync(dir), []);
  fail(cli(), /Usage:/); fail(cli('init', '--database', 'relative.sqlite'), /absolute/);
  const report = ok(cli('init', '--database', path, '--dry-run')); assert.equal(report.changes, 0); assert.equal(report.schemaVersion, '4.0'); assert.deepEqual(readdirSync(dir), []);
  const old = join(dir, 'old.sqlite'); makeLegacy(old); const before = fileSnapshot(dir);
  const inspect = ok(cli('inspect', '--database', old)); assert.equal(inspect.inspection, 'header_only'); assert.equal(inspect.currentContractCompatible, false);
  ok(cli('backup', '--source', old, '--destination', join(dir, 'backup.sqlite'), '--dry-run')); assert.deepEqual(fileSnapshot(dir), before);
});

test('R6 CLI initializes only a new path, refuses files/symlinks/sidecars, and reports frozen versions', t => {
  const dir = temporary(t); const path = join(dir, 'new.sqlite'); const report = ok(cli('init', '--database', path));
  assert.equal(report.databaseFormat, 4); assert.equal(report.schemaVersion, '4.0'); assert.equal(report.fixtureVersion, 'harbour-retail-applications-v1');
  assert.equal(report.existingDataConverted, false); assert.equal(report.receiptCount, 0); assert.equal(statSync(path).mode & 0o777, 0o600);
  const before = readFileSync(path); fail(cli('init', '--database', path), /already exists/); assert.deepEqual(readFileSync(path), before);
  const alias = join(dir, 'dangling.sqlite'); symlinkSync(join(dir, 'missing'), alias); fail(cli('init', '--database', alias), /already exists/);
  const sidecarPath = join(dir, 'orphan.sqlite'); writeFileSync(`${sidecarPath}-wal`, 'keep'); fail(cli('init', '--database', sidecarPath), /already exists/); assert.equal(readFileSync(`${sidecarPath}-wal`, 'utf8'), 'keep');
  const inspect = ok(cli('inspect', '--database', path)); assert.equal(inspect.sessionId, report.sessionId);
});

test('R6 native backup includes committed legacy WAL and does not convert old identities', t => {
  const dir = temporary(t); const path = join(dir, 'legacy.sqlite'); const backup = join(dir, 'backup.sqlite'); const db = makeLegacy(path, 3, true);
  const before = readFileSync(path); const walBefore = readFileSync(`${path}-wal`);
  try {
    const report = ok(cli('backup', '--source', path, '--destination', backup));
    assert.equal(report.databaseFormat, 3); assert.equal(report.currentContractCompatible, false); assert.equal(report.method, 'sqlite_online_backup');
    assert.equal(readDb(backup, value => value.prepare('SELECT value FROM historical_content WHERE id=?').get('wal-row').value), 'committed only in WAL');
    assert.deepEqual(readFileSync(path), before); assert.deepEqual(readFileSync(`${path}-wal`), walBefore);
  } finally { db.close(); }
  fail(cli('restore', '--source', backup, '--destination', join(dir, 'invalid-r6.sqlite')), /format-4 backup/); assert.equal(existsSync(join(dir, 'invalid-r6.sqlite')), false);
});

test('R6 consistent backup/restore preserve complete state and receipts, while a separate init creates a new session', t => {
  const dir = temporary(t); const source = join(dir, 'source.sqlite'); const backup = join(dir, 'backup.sqlite'); const restored = join(dir, 'restored.sqlite'); const fresh = join(dir, 'fresh.sqlite');
  const initial = ok(cli('init', '--database', source)); const store = new RevisionStore(source, validateState); const state = store.getState();
  store.transaction(() => store.saveReceipt(state.sessionId, 'amy-chen', '/api/demo/example', 'receipt-key', 'sha256-test', { status: 200, body: { data: 'unchanged receipt' } })); store.close();
  const backupReport = ok(cli('backup', '--source', source, '--destination', backup)); assert.equal(backupReport.receiptCount, 1);
  const restoredReport = ok(cli('restore', '--source', backup, '--destination', restored)); assert.equal(restoredReport.sessionId, initial.sessionId); assert.equal(restoredReport.sessionPreserved, true);
  const reopened = new RevisionStore(restored, validateState); try { assert.deepEqual(reopened.getState(), state); assert.deepEqual(reopened.getReceipt(state.sessionId, 'amy-chen', '/api/demo/example', 'receipt-key').body, { data: 'unchanged receipt' }); } finally { reopened.close(); }
  const freshReport = ok(cli('init', '--database', fresh)); assert.notEqual(freshReport.sessionId, initial.sessionId); assert.equal(freshReport.receiptCount, 0);
  const before = readFileSync(restored); fail(cli('restore', '--source', backup, '--destination', restored), /already exists/); assert.deepEqual(readFileSync(restored), before);
});

test('R6 restore rejects incompatible content and corrupted current schema without publishing a destination', t => {
  const dir = temporary(t); const source = join(dir, 'bad.sqlite'); ok(cli('init', '--database', source));
  const db = new DatabaseSync(source); const state = JSON.parse(db.prepare('SELECT state_json FROM revision_state').get().state_json);
  state.people['alex-chen'] = state.people['amy-chen']; db.prepare('UPDATE revision_state SET state_json=?').run(JSON.stringify(state)); db.close();
  const before = readFileSync(source); const destination = join(dir, 'restored.sqlite'); fail(cli('restore', '--source', source, '--destination', destination), /integrity/);
  assert.equal(existsSync(destination), false); assert.deepEqual(readFileSync(source), before); assert.equal(existsSync(`${source}.lock`), false);
  assert.equal(readdirSync(dir).some(name => name.includes('.tmp') || name.endsWith('.lock')), false);
});

test('R6 exclusive publication preserves a destination that appears after preflight', t => {
  const dir = temporary(t); const destination = join(dir, 'raced.sqlite');
  const harness = `
    import fs from 'node:fs'; import { syncBuiltinESMExports } from 'node:module';
    const original = fs.linkSync; fs.linkSync = (stage, target) => {
      fs.writeFileSync(target, 'concurrent-owner', { flag: 'wx' }); return original(stage, target);
    }; syncBuiltinESMExports();
    process.argv = [process.execPath, ${JSON.stringify(script)}, 'init', '--database', ${JSON.stringify(destination)}];
    await import(${JSON.stringify(script)});
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', harness], { encoding: 'utf8', timeout: 30000 });
  fail(result, /EEXIST/); assert.equal(readFileSync(destination, 'utf8'), 'concurrent-owner');
  assert.deepEqual(readdirSync(dir), ['raced.sqlite']);
});

test('R6 default server rejects explicit API3 contract without opening or changing its database', t => {
  const dir = temporary(t); const path = join(dir, 'old.sqlite'); makeLegacy(path); const before = fileSnapshot(dir);
  const server = new URL('../dist/r5/server.js', import.meta.url).pathname;
  const result = spawnSync(process.execPath, [server], { cwd: dir, env: { ...process.env, DEMO_CONTRACT: '3.0', DATABASE_PATH: path }, encoding: 'utf8', timeout: 15000 });
  fail(result, /startup failed/); assert.deepEqual(fileSnapshot(dir), before);
});

test('R6 first-run SIGKILL preserves the format marker, committed WAL case, session and interrupted-analysis receipt', t => {
  const dir = temporary(t); const path = join(dir, 'crashed.sqlite');
  const storeModule = new URL('../dist/r5/store.js', import.meta.url).href;
  const serviceModule = new URL('../dist/r5/service.js', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { RevisionStore } from ${JSON.stringify(storeModule)};
    import { RevisionService } from ${JSON.stringify(serviceModule)};
    const store = new RevisionStore(${JSON.stringify(path)});
    const service = new RevisionService(store, async () => await new Promise(() => {}), 'manual_simulation');
    let data = service.read('amy-chen').data;
    const binding = { schemaVersion:'4.0', sessionId:data.sessionId, candidateId:'amy-chen', jobId:data.job.id,
      datasetVersion:data.datasetVersion, taskId:data.task.taskId, targetRequirementId:'sql' };
    service.send({...binding,templateId:data.taskTemplates.sql.templateId,instructions:'Inspect query grain.',gapReason:'Request explicit validation.'},'crash-send');
    data = service.submit({...binding,submissionVersion:1,previousSubmissionId:null,previousContentFingerprint:null,
      summary:'The query counts unique sessions; missing IDs need a separate check.',findings:[],processEvidence:[]},'crash-submit').body.data;
    const request = {...binding,submissionId:data.submission.submissionId,contentFingerprint:data.submission.contentFingerprint};
    void service.analyze(request,'crash-analysis');
    data = service.read('amy-chen').data;
    process.stdout.write(JSON.stringify({sessionId:data.sessionId,request,analysis:data.analysis}), () => process.kill(process.pid,'SIGKILL'));
  `], { encoding: 'utf8', timeout: 15000 });
  assert.equal(child.signal, 'SIGKILL', child.stderr); const before = JSON.parse(child.stdout);
  assert.equal(before.analysis.status, 'running'); assert.equal(readFileSync(path).readUInt32BE(60), 4);
  assert.ok(existsSync(`${path}-wal`)); assert.ok(existsSync(`${path}.lock`));
  const store = new RevisionStore(path, validateState);
  try {
    const service = new RevisionService(store, createTargetAnalyzer({ mode: 'disabled' })); const data = service.read('amy-chen').data;
    assert.equal(data.sessionId, before.sessionId); assert.equal(data.submission.submissionId, before.request.submissionId);
    assert.equal(data.analysis.status, 'failed'); assert.equal(data.analysis.errorCode, 'AI_INTERRUPTED');
    assert.equal(data.analysis.attemptId, before.analysis.attemptId); validateState(store.getState());
    const receipt = store.getReceipt(data.sessionId, 'amy-chen', '/analysis', 'crash-analysis');
    assert.equal(receipt.status, 503); assert.equal(receipt.body.error.code, 'AI_INTERRUPTED');
    for (const id of ['ann-li','david-liu','jamie-parker']) assert.equal(service.read(id).data.currentSubmissionVersion, null);
  } finally { store.close(); }
  assert.equal(existsSync(`${path}.lock`), false);
});

test('R6 missing aggregate with surviving receipts is diagnosed rather than silently initialized', t => {
  const dir = temporary(t); const path = join(dir, 'incomplete.sqlite'); const { store, state } = initialized(path);
  store.saveReceipt(state.sessionId, 'amy-chen', '/submission', 'key', 'hash', { status: 200, body: {} }); store.close();
  const db = new DatabaseSync(path); db.exec('PRAGMA journal_mode=DELETE; DELETE FROM revision_state;'); db.close();
  const before = fileSnapshot(dir); assert.throws(() => new RevisionStore(path, validateState), /receipts without its aggregate/);
  assert.deepEqual(fileSnapshot(dir), before);
});
