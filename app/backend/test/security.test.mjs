import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Value } from '@sinclair/typebox/value';
import { Store } from '../dist/store.js';
import { DemoService } from '../dist/service.js';
import { createAnalyzer } from '../dist/analysis.js';
import { EventSchema } from '../dist/schema.js';
import { createApp } from '../dist/app.js';
import { EnvelopeSchema } from '../dist/response-schema.js';
import { baseUrl } from '../scripts/demo.mjs';

const analyzer = createAnalyzer({ mode: 'manual_simulation' });
function setup(t) {
  const store = new Store(':memory:');
  t.after(() => store.close());
  const service = new DemoService(store, analyzer);
  const d = service.read().data;
  const binding = { schemaVersion: '2.0', sessionId: d.sessionId, taskId: d.task.taskId, datasetVersion: d.datasetVersion };
  service.send({ ...binding, instructions: d.task.instructions }, 'security-send-key');
  service.submit({ ...binding, candidateId: d.candidate.id, submissionVersion: 1, previousSubmissionId: null, previousContentFingerprint: null, summary: 'Security restore fixture: observe before attributing cause.',
    findings: [], processEvidence: [{ id: 'event-1', at: '2026-09-19T02:00:00.000Z', title: 'Opened data; client-reported only.' }] }, 'security-submit-key');
  const submitted = service.read().data.submission;
  const target = { ...binding, submissionId: submitted.submissionId, contentFingerprint: submitted.contentFingerprint };
  return { store, service, target, requirementId: d.task.requirementId };
}

test('TypeBox persistence validation accepts valid date-time values but rejects malformed dates', () => {
  assert.equal(Value.Check(EventSchema, { id: 'event-1', at: '2026-09-19T02:00:00.000Z', title: 'Opened source' }), true);
  assert.equal(Value.Check(EventSchema, { id: 'event-1', at: 'not-a-date', title: 'Opened source' }), false);
});

test('well-formed persisted event and final review survive integrity validation', t => {
  const { store, service, target, requirementId } = setup(t);
  service.review({ ...target, requirementId, decision: 'confirm', comment: 'Human reviewed the bounded evidence.' }, 'security-review-key');
  const before = service.read().data;
  const restored = new DemoService(store, analyzer).read().data;
  assert.deepEqual(restored, before);
});

const corruptions = {
  'review submission': state => { state.versions[0].review.submissionId = 'another-submission'; },
  'review requirement': state => { state.versions[0].review.requirementId = 'sql'; },
  'review fingerprint': state => { state.versions[0].review.contentFingerprint = '0'.repeat(64); },
  'review session': state => { state.versions[0].review.sessionId = 'another-session'; },
  'review task': state => { state.versions[0].review.taskId = 'another-task'; },
  'review dataset': state => { state.versions[0].review.datasetVersion = 'another-dataset'; },
  'workflow status': state => { state.task.status = 'draft'; },
  'orphaned review': state => { state.versions = []; },
};
for (const [name, corrupt] of Object.entries(corruptions)) {
  test(`persisted ${name} mismatch is rejected rather than restoring verified evidence`, t => {
    const { store, service, target, requirementId } = setup(t);
    service.review({ ...target, requirementId, decision: 'confirm', comment: 'Human reviewed the bounded evidence.' }, 'security-review-key');
    assert.doesNotThrow(() => new DemoService(store, analyzer), 'uncorrupted baseline must restore first');
    const state = store.getState(); corrupt(state); store.setState(state);
    assert.throws(() => new DemoService(store, analyzer));
  });
}

test('persisted analysis metadata must reference the current immutable submission', async t => {
  const { store, service, target } = setup(t);
  assert.equal((await service.analyze(target, 'security-analyze-key')).status, 200);
  assert.doesNotThrow(() => new DemoService(store, analyzer), 'uncorrupted baseline must restore first');
  const state = store.getState(); state.versions[0].analysis.submissionId = 'another-submission'; store.setState(state);
  assert.throws(() => new DemoService(store, analyzer));
});

test('SQLite files holding public work are owner-only on POSIX systems', { skip: process.platform === 'win32' }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-security-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'private-data', 'demo.sqlite');
  const store = new Store(file);
  try {
    new DemoService(store, analyzer);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.equal((await stat(join(dir, 'private-data'))).mode & 0o777, 0o700);
    for (const suffix of ['-wal', '-shm']) {
      try { assert.equal((await stat(file + suffix)).mode & 0o077, 0); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  } finally { store.close(); }
});

test('request headers, private fields and raw URL queries are absent from responses and structured logs', async t => {
  const token = 'security-fixture-admin-token-ONLY';
  const secret = 'SECURITY_PRIVATE_FIELD_HEADER_QUERY_SENTINEL';
  const logs = [];
  const app = await createApp({ databasePath: ':memory:', adminToken: token, log: entry => logs.push(entry) });
  t.after(() => app.close());
  const read = await app.inject({ method: 'GET', url: `/api/demo?debug=${secret}`, headers: {
    host: '127.0.0.1:8787', authorization: `Bearer ${secret}`, 'x-demo-admin-token': token, 'x-request-id': secret,
  } });
  assert.equal(read.statusCode, 200);
  assert.equal(Value.Check(EnvelopeSchema, read.json()), true);
  const d = read.json().data;
  const rejected = await app.inject({ method: 'POST', url: `/api/demo/task/send?private=${secret}`, headers: {
    host: '127.0.0.1:8787', 'content-type': 'application/json', 'idempotency-key': 'security-rejected-key',
  }, payload: { schemaVersion: '2.0', sessionId: d.sessionId, taskId: d.task.taskId, datasetVersion: d.datasetVersion,
    instructions: d.task.instructions, notes: secret } });
  assert.equal(rejected.statusCode, 400);
  assert.equal(rejected.json().error.code, 'INVALID_REQUEST');
  for (const output of [read.body, rejected.body, JSON.stringify(logs)]) {
    assert.equal(output.includes(secret), false);
    assert.equal(output.includes(token), false);
  }
  assert.ok(logs.length > 0);
  assert.ok(logs.every(entry => Object.keys(entry).every(key => ['requestId', 'method', 'route', 'status', 'code'].includes(key))));
  assert.equal(read.headers['cache-control'], 'no-store');
  assert.equal(read.headers['x-content-type-options'], 'nosniff');
});

test('untrusted browser origins and DNS-rebinding Host names fail before case access', async t => {
  const app = await createApp({ databasePath: ':memory:' }); t.after(() => app.close());
  for (const headers of [
    { host: '127.0.0.1.attacker.invalid:8787' },
    { host: '127.0.0.1:8787', origin: 'null' },
    { host: '127.0.0.1:8787', origin: 'http://localhost:5173.attacker.invalid' },
    { host: '127.0.0.1:8787', 'sec-fetch-site': 'cross-site' },
  ]) {
    const response = await app.inject({ method: 'GET', url: '/api/demo', headers });
    assert.equal(response.statusCode, 403);
    assert.equal(Object.hasOwn(response.json(), 'data'), false);
  }
  const preflight = await app.inject({ method: 'OPTIONS', url: '/api/demo/reset', headers: {
    host: '127.0.0.1:8787', origin: 'http://127.0.0.1:5173',
    'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization',
  } });
  assert.equal(preflight.statusCode, 403);
});

test('reset remains disabled without an explicitly configured server-side admin token', async t => {
  const app = await createApp({ databasePath: ':memory:' }); t.after(() => app.close());
  const before = (await app.inject({ method: 'GET', url: '/api/demo', headers: { host: '127.0.0.1:8787' } })).json().data;
  const response = await app.inject({ method: 'POST', url: '/api/demo/reset', headers: {
    host: '127.0.0.1:8787', 'content-type': 'application/json', 'idempotency-key': 'security-disabled-reset',
  }, payload: { schemaVersion: '2.0', sessionId: before.sessionId } });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, 'RESET_DISABLED');
  const after = (await app.inject({ method: 'GET', url: '/api/demo', headers: { host: '127.0.0.1:8787' } })).json().data;
  assert.equal(after.sessionId, before.sessionId);
});

test('database lock rejects a live duplicate process and normal close releases ownership', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-lock-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'demo.sqlite');
  const store = new Store(file);
  try {
    assert.throws(() => new Store(file), /already open|lock/i);
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { Store } from ${JSON.stringify(new URL('../dist/store.js', import.meta.url).href)};
      try { const s = new Store(${JSON.stringify(file)}); s.close(); process.exit(9); }
      catch { process.stdout.write('LOCKED'); }
    `], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, 'LOCKED');
  } finally { store.close(); }
  const reopened = new Store(file); reopened.close();
  await assert.rejects(stat(`${file}.lock`), { code: 'ENOENT' });
});

test('a crashed analysis process leaves a reclaimable lock and a failed, retryable receipt', { timeout: 10000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-crash-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'demo.sqlite');
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { Store } from ${JSON.stringify(new URL('../dist/store.js', import.meta.url).href)};
    import { DemoService } from ${JSON.stringify(new URL('../dist/service.js', import.meta.url).href)};
    const store = new Store(${JSON.stringify(file)});
    const service = new DemoService(store, () => new Promise(() => {}));
    let d = service.read().data;
    const b = {schemaVersion:'2.0',sessionId:d.sessionId,taskId:d.task.taskId,datasetVersion:d.datasetVersion};
    service.send({...b,instructions:d.task.instructions},'crash-send-key');
    service.submit({...b,candidateId:d.candidate.id,submissionVersion:1,previousSubmissionId:null,previousContentFingerprint:null,summary:'Crash recovery sample.',findings:[],processEvidence:[]},'crash-submit-key');
    d=service.read().data;
    void service.analyze({...b,submissionId:d.submission.submissionId,contentFingerprint:d.submission.contentFingerprint},'crash-analysis-key');
    process.stdout.write('READY'); setInterval(() => {}, 1000);
  `], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const [ready] = await once(child.stdout, 'data'); assert.equal(ready.toString(), 'READY');
  const exiting = once(child, 'exit'); child.kill('SIGKILL'); await exiting;
  assert.equal(JSON.parse(await readFile(`${file}.lock`, 'utf8')).pid, child.pid);
  const store = new Store(file);
  try {
    const service = new DemoService(store, analyzer); const d = service.read().data;
    assert.equal(d.analysis.status, 'failed'); assert.equal(d.analysis.errorCode, 'AI_INTERRUPTED');
    const request = { schemaVersion: '2.0', sessionId: d.sessionId, taskId: d.task.taskId, datasetVersion: d.datasetVersion,
      submissionId: d.submission.submissionId, contentFingerprint: d.submission.contentFingerprint };
    const previous = await service.analyze(request, 'crash-analysis-key');
    assert.equal(previous.status, 503); assert.equal(previous.body.error.code, 'AI_INTERRUPTED');
    assert.equal((await service.analyze(request, 'crash-new-key')).status, 200);
    assert.equal(service.read().data.submission.summary, 'Crash recovery sample.');
  } finally { store.close(); }
});

test('malformed or invalid owner locks are preserved for inspection, not auto-deleted', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-invalid-lock-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'demo.sqlite');
  for (const contents of ['not-json', JSON.stringify({ pid: 0 }), JSON.stringify({ pid: -2 })]) {
    await writeFile(`${file}.lock`, contents, { mode: 0o600 });
    assert.throws(() => new Store(file));
    assert.equal(await readFile(`${file}.lock`, 'utf8'), contents);
  }
});

test('closing a store preserves an unexpectedly replaced ownership nonce', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-lock-owner-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'demo.sqlite'); const store = new Store(file);
  const replacement = JSON.stringify({ pid: process.pid, nonce: 'different-owner' });
  await writeFile(`${file}.lock`, replacement, { mode: 0o600 });
  store.close();
  assert.equal(await readFile(`${file}.lock`, 'utf8'), replacement);
});

test('CLI target validation keeps admin tokens off non-loopback, credential-bearing and redirected URLs', () => {
  for (const BASE_URL of ['https://example.invalid', 'http://127.0.0.1.evil.invalid:8787', 'http://user:password@localhost:8787',
    'http://127.0.0.1:8787/path', 'http://127.0.0.1:8787/?token=secret', 'http://127.0.0.1:8787/#secret']) {
    assert.throws(() => baseUrl({ BASE_URL }));
  }
  assert.equal(baseUrl({ BASE_URL: 'http://127.0.0.1:8787' }), 'http://127.0.0.1:8787');
});

test('CLI argument/config failures are redacted before any HTTP request is made', () => {
  const secret = 'SECURITY_CLI_ADMIN_TOKEN_SENTINEL_LONG';
  const reset = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/reset.mjs', import.meta.url))], {
    encoding: 'utf8', env: { ...process.env, DEMO_ADMIN_TOKEN: secret, BASE_URL: `http://example.invalid/?token=${secret}` },
  });
  assert.equal(reset.status, 1);
  assert.match(reset.stderr, /INVALID_BASE_URL/);
  assert.equal(`${reset.stdout}${reset.stderr}`.includes(secret), false);
  const demo = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/demo.mjs', import.meta.url)), '--secret', secret], { encoding: 'utf8' });
  assert.equal(demo.status, 1);
  assert.match(demo.stderr, /INVALID_ARGUMENTS/);
  assert.equal(`${demo.stdout}${demo.stderr}`.includes(secret), false);
});

test('existing reclaim lock is preserved and stops stale-owner cleanup conservatively', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-reclaim-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'demo.sqlite');
  const dead = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' });
  assert.equal(dead.status, 0);
  const prior = JSON.stringify({ pid: dead.pid, nonce: 'dead-owner' });
  await writeFile(`${file}.lock`, prior, { mode: 0o600 });
  await writeFile(`${file}.lock.reclaim`, 'inspect-reclaim-owner', { mode: 0o600 });
  assert.throws(() => new Store(file));
  assert.equal(await readFile(`${file}.lock`, 'utf8'), prior);
  assert.equal(await readFile(`${file}.lock.reclaim`, 'utf8'), 'inspect-reclaim-owner');
});

test('concurrent stale-owner restarts elect exactly one database owner', { timeout: 15000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-concurrent-lock-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'demo.sqlite');
  const dead = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' });
  assert.equal(dead.status, 0);
  const code = `
    import { Store } from ${JSON.stringify(new URL('../dist/store.js', import.meta.url).href)};
    let store;
    process.once('message', () => {
      try { store = new Store(${JSON.stringify(file)}); process.send({ won: true }); }
      catch { process.send({ won: false }); }
      process.once('message', () => { store?.close(); process.exit(0); });
    });
    process.send({ ready: true });
  `;
  for (let round = 0; round < 3; round += 1) {
    await writeFile(`${file}.lock`, JSON.stringify({ pid: dead.pid, nonce: `dead-${round}` }), { mode: 0o600 });
    const children = Array.from({ length: 5 }, () => spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }));
    t.after(() => children.forEach(child => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }));
    await Promise.all(children.map(child => once(child, 'message')));
    const results = children.map(child => once(child, 'message'));
    children.forEach(child => child.send('go'));
    const owners = (await Promise.all(results)).filter(([result]) => result.won);
    assert.equal(owners.length, 1, `round ${round}: expected exactly one database owner`);
    const exits = children.map(child => once(child, 'exit'));
    children.forEach(child => child.send('close'));
    await Promise.all(exits);
  }
});
