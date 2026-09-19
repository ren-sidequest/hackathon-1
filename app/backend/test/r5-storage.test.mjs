import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { RevisionStore, ReceiptOwnershipError } from '../dist/r5/store.js';
import { migrateV2Database, MigrationError } from '../dist/r5/migration.js';
import { Store } from '../dist/store.js';
import { DemoService } from '../dist/service.js';
import { createAnalyzer } from '../dist/analysis.js';
import { RevisionService, freshState, convertLegacyState } from '../dist/r5/service.js';
import { createTargetAnalyzer } from '../dist/r5/analysis.js';
import { validateState } from '../dist/r5/state-schema.js';

function temporary(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'evidencebridge-r5-storage-')));
  t.after(() => rmSync(dir, { recursive: true, force: true })); return dir;
}
function paths(dir) { return { source: join(dir, 'source-v2.sqlite'), destination: join(dir, 'destination-v3.sqlite'), backup: join(dir, 'backup-v2.sqlite') }; }
function readDb(path, fn) { const db = new DatabaseSync(path, { readOnly: true }); try { return fn(db); } finally { db.close(); } }
function version(path) { return readDb(path, db => db.prepare('PRAGMA user_version').get().user_version); }
const savedState = () => ({ schemaVersion: '4.0', sessionId: 'session', candidates: {
  alex: { taskId: 'task-alex', versions: [{ submissionId: 'a-v1', contentFingerprint: 'sha256:a', review: { decision: 'needs_more_evidence' } }] },
  maya: { taskId: 'task-maya', analysis: { attemptId: 'maya-attempt', status: 'running' } },
  jordan: { taskId: 'task-jordan', shortlist: [{ action: 'retain', reason: 'Material reviewed' }] },
  sam: { taskId: 'task-sam', assessments: [{ revision: 1, mark: 'NE' }] },
} });
function makeV2(path) {
  const store = new Store(path);
  const submissions = [1, 2].map(number => ({ schemaVersion: '2.0', sessionId: 'legacy-session', candidateId: 'alex-chen',
    taskId: 'legacy-task', submissionId: `legacy-v${number}`, submissionVersion: number, contentFingerprint: `legacy-fingerprint-${number}`,
    previousSubmissionId: number === 2 ? 'legacy-v1' : null, previousContentFingerprint: number === 2 ? 'legacy-fingerprint-1' : null,
    summary: `Unchanged original V${number}: café 🔎`, sources: [{ sourceId: `v${number}-source`, text: 'Quoted original text' }],
  }));
  const state = { schemaVersion: '2.0', sessionId: 'legacy-session', datasetVersion: 'legacy-dataset', revision: 7,
    task: { taskId: 'legacy-task', status: 'reviewed', instructions: 'Original instructions', sentAt: '2026-09-19T00:00:00Z' },
    versions: submissions.map((sub, index) => ({ submissionId: sub.submissionId,
      analysis: { status: 'succeeded', result: { observations: [{ quote: 'Quoted original text', sourceId: `v${index + 1}-source` }] } },
      review: { decision: index ? 'confirm' : 'needs_more_evidence', comment: `Original review ${index + 1}` },
    })),
  };
  store.transaction(() => {
    store.setState(state); submissions.forEach(sub => store.insertSubmission(sub));
    store.saveIdempotency(state.sessionId, '/api/demo/review', 'original-key', 'original-hash', { status: 200, body: { data: { state } } });
  }); store.close();
  // Whitespace is part of the archive contract, not merely the parsed object.
  const db = new DatabaseSync(path);
  const stateJson = ` \n${JSON.stringify(state, null, 2)}\n `;
  db.prepare('UPDATE demo_state SET state_json=? WHERE id=1').run(stateJson); db.close();
  return { state, stateJson, submissions };
}
test('format4 aggregate and candidate-owned receipts survive close/restart without aliasing', t => {
  const dir = temporary(t); const path = join(dir, 'state.sqlite'); let store = new RevisionStore(path);
  assert.equal(store.getState(), null); assert.equal(store.health(), true);
  const state = savedState();
  store.transaction(() => { store.setState(state); store.saveReceipt('session', 'alex', '/submit', 'key', 'hash', { status: 201, body: { candidateId: 'alex' } }); });
  store.getState().candidates.alex.taskId = 'not-persisted';
  assert.deepEqual(store.getState(), state); store.close(); store.close(); assert.equal(store.health(), false);
  assert.equal(version(path), 4); store = new RevisionStore(path); t.after(() => store.close());
  assert.deepEqual(store.getState(), state); assert.deepEqual(store.getReceipt('session', 'alex', '/submit', 'key'), { hash: 'hash', status: 201, body: { candidateId: 'alex' } });
});

test('receipt ownership/hash conflicts roll back the entire aggregate without returning another candidate', t => {
  const dir = temporary(t); const store = new RevisionStore(join(dir, 'state.sqlite')); t.after(() => store.close());
  const state = savedState(); store.setState(state);
  store.saveReceipt('session', 'alex', '/submit', 'same-key', 'hash', { status: 201, body: { secret: 'alex-only' } });
  assert.throws(() => store.getReceipt('session', 'maya', '/submit', 'same-key'), error => error instanceof ReceiptOwnershipError
    && error.status === 409 && error.code === 'IDEMPOTENCY_OWNER_MISMATCH' && !error.message.includes('alex-only'));
  assert.throws(() => store.transaction(() => {
    store.setState({ mutated: true }); store.saveReceipt('session', 'maya', '/submit', 'same-key', 'hash', { status: 201, body: {} });
  }), ReceiptOwnershipError);
  assert.deepEqual(store.getState(), state);
  assert.throws(() => store.saveReceipt('session', 'alex', '/submit', 'same-key', 'different', { status: 200, body: {} }), { code: 'IDEMPOTENCY_CONFLICT' });
  assert.equal(store.getReceipt('session', 'alex', '/submit', 'same-key').body.secret, 'alex-only');
  assert.equal(store.getReceipt('other-session', 'maya', '/submit', 'same-key'), null);
  assert.throws(() => store.transaction(() => { store.clearReceipts(); throw new Error('fail'); }), /fail/);
  assert.ok(store.getReceipt('session', 'alex', '/submit', 'same-key')); store.clearReceipts();
  assert.equal(store.getReceipt('session', 'alex', '/submit', 'same-key'), null); assert.deepEqual(store.getState(), state);
});

test('pending analysis settlement is bound to session, candidate, attempt and status202', () => {
  const store = new RevisionStore(':memory:');
  try {
    for (const [session, candidate, attempt, status, key] of [['s', 'a', 'attempt', 202, 'one'], ['s', 'b', 'attempt', 202, 'two'],
      ['s', 'a', 'other', 202, 'three'], ['t', 'a', 'attempt', 202, 'four'], ['s', 'a', 'attempt', 200, 'five']])
      store.saveReceipt(session, candidate, '/analysis', key, key, { status, body: { data: { analysis: { attemptId: attempt } } } });
    store.settleAnalysisReceipts('s', 'a', 'attempt', { status: 503, body: { error: { code: 'AI_INTERRUPTED' } } });
    assert.equal(store.getReceipt('s', 'a', '/analysis', 'one').status, 503);
    assert.equal(store.getReceipt('s', 'b', '/analysis', 'two').status, 202);
    assert.equal(store.getReceipt('s', 'a', '/analysis', 'three').status, 202);
    assert.equal(store.getReceipt('t', 'a', '/analysis', 'four').status, 202);
    assert.equal(store.getReceipt('s', 'a', '/analysis', 'five').status, 200);
  } finally { store.close(); }
});

test('synchronous transaction guard prevents accidental async commit and supports subsequent rollback', () => {
  const store = new RevisionStore(':memory:');
  try {
    assert.throws(() => store.transaction(async () => store.setState({ bad: true })), /synchronous/);
    assert.equal(store.getState(), null);
    assert.throws(() => store.transaction(() => { store.setState({ bad: true }); return Promise.resolve(); }), /synchronous/);
    assert.equal(store.getState(), null);
    assert.throws(() => store.transaction(() => store.transaction(() => undefined)), /Nested/);
    store.transaction(() => store.setState({ good: true })); assert.deepEqual(store.getState(), { good: true });
  } finally { store.close(); }
});

for (const [name, sql] of [
  ['v2', 'CREATE TABLE old_state(value); PRAGMA user_version=2;'],
  ['future', 'CREATE TABLE future_state(value); PRAGMA user_version=9;'],
  ['unversioned data', 'CREATE TABLE old_state(value);'],
  ['view-only database', 'CREATE VIEW legacy AS SELECT 1;'],
  ['incomplete v4', 'CREATE TABLE revision_state(id,state_json); PRAGMA user_version=4;'],
  ['missing v4 columns', 'CREATE TABLE revision_state(id,state_json); CREATE TABLE revision_receipts(session_id); PRAGMA user_version=4;'],
]) test(`startup preserves ${name} file byte-for-byte and releases its lock`, t => {
  const dir = temporary(t); const path = join(dir, 'old.sqlite'); const db = new DatabaseSync(path); db.exec(sql); db.close();
  const before = readFileSync(path); assert.throws(() => new RevisionStore(path), /Incompatible|incomplete/);
  assert.deepEqual(readFileSync(path), before); assert.equal(existsSync(`${path}.lock`), false);
  assert.equal(existsSync(`${path}-wal`), false);
});

test('single-process lock rejects live aliases, reopens after close, and recovers a dead owner', t => {
  const dir = temporary(t); const path = join(dir, 'store.sqlite'); const alias = join(dir, 'alias.sqlite');
  let store = new RevisionStore(path); symlinkSync(path, alias);
  assert.throws(() => new RevisionStore(path), /live process/); assert.throws(() => new RevisionStore(alias), /live process/);
  store.close();
  const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  assert.equal(child.status, 0); writeFileSync(`${path}.lock`, JSON.stringify({ pid: Number(child.stdout), nonce: 'dead' }));
  store = new RevisionStore(path); store.close(); assert.equal(existsSync(`${path}.lock`), false);
  writeFileSync(`${path}.lock`, '{broken'); assert.throws(() => new RevisionStore(path));
  assert.equal(readFileSync(`${path}.lock`, 'utf8'), '{broken');
});

test('close retains a replacement lock rather than deleting another owner', t => {
  const path = join(temporary(t), 'store.sqlite'); const store = new RevisionStore(path);
  const replacement = JSON.stringify({ pid: process.pid, nonce: 'replacement' }); writeFileSync(`${path}.lock`, replacement);
  store.close(); assert.equal(readFileSync(`${path}.lock`, 'utf8'), replacement);
});

test('revision6 retires identity migration before touching source, destinations, backups or converter callbacks', async t => {
  const dir = temporary(t); const p = paths(dir); const original = makeV2(p.source); const before = readFileSync(p.source);
  let converterCalled = false;
  await assert.rejects(migrateV2Database({ ...p, convert: () => { converterCalled = true; return { state: {} }; } }), error => {
    assert.ok(error instanceof MigrationError); assert.match(error.message, /API4|revision.6|retired|new applicant/); assert.deepEqual(error.diagnosticPaths, []); return true;
  });
  assert.equal(converterCalled, false); assert.deepEqual(readFileSync(p.source), before); assert.deepEqual(readdirSync(dir), ['source-v2.sqlite']);
  const rollback = new Store(p.source); try { assert.deepEqual(rollback.getState(), original.state); } finally { rollback.close(); }
  // Early rejection does not even probe missing source paths or replace pre-existing destinations.
  writeFileSync(p.destination, 'other-owner');
  await assert.rejects(migrateV2Database({ ...p, source: join(dir, 'missing.sqlite'), convert: () => ({ state: {} }) }));
  assert.equal(readFileSync(p.destination, 'utf8'), 'other-owner'); assert.equal(existsSync(p.backup), false);
});

test('retired migration CLI rejects empty and explicit legacy invocations without opening default or new databases', t => {
  const dir = temporary(t); const p = paths(dir); makeV2(p.source); const before = readFileSync(p.source);
  const script = new URL('../scripts/migrate-v3.mjs', import.meta.url);
  for (const args of [[], ['--source', p.source, '--destination', p.destination, '--backup', p.backup]]) {
    const result = spawnSync(process.execPath, [script.pathname, ...args], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /Usage:|API4|revision.6|retired|new applicant/);
  }
  assert.deepEqual(readFileSync(p.source), before); assert.deepEqual(readdirSync(dir), ['source-v2.sqlite']);
});

function ownedBinding(data) { return { schemaVersion: '4.0', sessionId: data.sessionId, candidateId: data.candidate.id,
  jobId: data.job.id, datasetVersion: data.datasetVersion, taskId: data.task.taskId, targetRequirementId: 'sql' }; }
async function domainFixture() {
  const store = new RevisionStore(':memory:'); const service = new RevisionService(store, createTargetAnalyzer({ mode: 'manual_simulation' }));
  let data = service.read('amy-chen').data; const binding = ownedBinding(data);
  data = service.send({ ...binding, templateId: 'harbour-retail-sql-v1', instructions: 'Explain query grain and check the source counts.', gapReason: 'Request direct SQL evidence.' }, 'send').body.data;
  data = service.submit({ ...binding, submissionVersion: 1, previousSubmissionId: null, previousContentFingerprint: null,
    summary: 'I would count the distinct sessions and compare their completed orders.', findings: [], processEvidence: [] }, 'submit').body.data;
  const current = { ...binding, submissionId: data.submission.submissionId, contentFingerprint: data.submission.contentFingerprint };
  data = (await service.analyze(current, 'analyze')).body.data;
  const snapshotId = data.versions[0].evidenceSnapshotId;
  const items = data.application.baseline.items.filter(item => item.criterionId.startsWith('S')).map(item => ({ ...item, mark: 'NE',
    rationale: 'The current summary has insufficient query detail.', support: 'No independently checkable query is present.',
    gaps: 'Query text and concrete checks are missing.', sourceRefs: [], checkedSourceIds: [data.submission.sources[0].sourceId] }));
  service.assess({ ...binding, stage: 'task_v1', evidenceSnapshotId: snapshotId, fingerprint: current.contentFingerprint,
    submissionId: current.submissionId, contentFingerprint: current.contentFingerprint, rubricVersion: data.rubricVersion,
    expectedAssessmentRevision: 0, items, reuseApplication: null, operatorLabel: 'Synthetic reviewer' }, 'assess');
  service.shortlist({ ...binding, action: 'retain', reason: 'Retain for discussion with the stated evidence limits.', stage: 'task_v1',
    evidenceSnapshotId: snapshotId, fingerprint: current.contentFingerprint, assessmentRevision: 1, rubricVersion: data.rubricVersion,
    expectedShortlistRevision: 0, operatorLabel: 'Synthetic reviewer' }, 'retain');
  service.review({ ...current, decision: 'needs_more_evidence', comment: 'Supply the query, explain the grain, and describe a duplicate check.' }, 'more');
  validateState(store.getState()); return { store, service, binding, current };
}

test('strict aggregate validation accepts actual task/analysis/assessment/shortlist writes and restart', async () => {
  const { store, service, binding, current } = await domainFixture();
  try {
    service.submit({ ...binding, submissionVersion: 2, previousSubmissionId: current.submissionId,
      previousContentFingerprint: current.contentFingerprint, summary: 'V2 query explanation is still intentionally incomplete.', findings: [], processEvidence: [] }, 'v2');
    validateState(store.getState());
    new RevisionService(store, createTargetAnalyzer({ mode: 'manual_simulation' }));
    assert.equal(service.read('amy-chen').data.shortlist.status, 'needs_reconfirmation');
  } finally { store.close(); }
});

test('strict aggregate guards reject malformed shape, private fields, baseline drift and domain binding corruption', async () => {
  const { store } = await domainFixture();
  try {
    const good = store.getState();
    const corruptions = [
      state => { state.extraPrivateNotes = 'private'; },
      state => { state.people['ann-li'].candidateId = 'amy-chen'; },
      state => { state.people['amy-chen'].task.taskId = ''; },
      state => { state.people['amy-chen'].task.templateId = 'harbour-retail-bps-v1'; },
      state => { state.people['amy-chen'].versions[0].submission.notes = 'private'; },
      state => { state.people['amy-chen'].versions[0].submission.submittedAt = 'yesterday'; },
      state => { state.people['amy-chen'].versions[0].analysis.status = 'invented'; },
      state => { state.people['amy-chen'].versions[0].analysis.result.observations[0].citations[0].quote = 'borrowed text'; },
      state => { state.people['amy-chen'].versions[0].review.candidateId = 'ann-li'; },
      state => { state.people['amy-chen'].versions[0].review.jobId = 'other-job'; },
      state => { state.people['amy-chen'].versions[0].review.datasetVersion = 'other-dataset'; },
      state => { state.people['amy-chen'].versions[0].review.targetRequirementId = 'business-problem-solving'; },
      state => { state.people['amy-chen'].assessments = []; },
      state => { state.people['amy-chen'].assessments[0].operatorLabel = 'rewritten preset'; },
      state => { state.people['amy-chen'].assessments[1].submissionId = 'another-submission'; },
      state => { state.people['amy-chen'].assessments[1].contentFingerprint = 'a'.repeat(64); },
      state => { state.people['amy-chen'].assessments[1].score.overallScore = 100; },
      state => { state.people['amy-chen'].assessments[1].reusedItems = state.people['ann-li'].assessments[0].items; },
      state => { state.people['amy-chen'].shortlist[0].action = 'reconfirm'; },
      state => { state.people['amy-chen'].shortlist[0].materialRevision = -1; },
      state => { state.people['amy-chen'].shortlist[0].basis.assessmentRevision = 99; },
      state => { state.people['amy-chen'].shortlist[0].at = '2020-01-01T00:00:00.000Z'; },
    ];
    for (const [index, mutate] of corruptions.entries()) {
      const bad = structuredClone(good); mutate(bad); assert.throws(() => validateState(bad), `corruption ${index} must fail`);
    }
    validateState(good); validateState(freshState());
  } finally { store.close(); }
});

async function actualLegacyDatabase(path) {
  const store = new Store(path); const service = new DemoService(store, createAnalyzer({ mode: 'manual_simulation' }));
  let data = service.read().data;
  const binding = { schemaVersion: '2.0', sessionId: data.sessionId, taskId: data.task.taskId, datasetVersion: data.datasetVersion };
  service.send({ ...binding, instructions: data.task.instructions }, 'send');
  data = service.submit({ ...binding, candidateId: 'alex-chen', submissionVersion: 1, previousSubmissionId: null,
    previousContentFingerprint: null, summary: 'The conversion decline is an observation; its cause still needs investigation.',
    findings: [], processEvidence: [] }, 'submit').body.data;
  await service.analyze({ ...binding, submissionId: data.submission.submissionId, contentFingerprint: data.submission.contentFingerprint }, 'analysis');
  const state = store.getState(); store.close(); return state;
}

test('old real API2 workflow stays usable and byte-identical after rejected R6 identity conversion', async t => {
  const p = paths(temporary(t)); const original = await actualLegacyDatabase(p.source); const before = readFileSync(p.source);
  assert.throws(() => convertLegacyState({ legacyState: original }), /API4|new applicant|never renamed/);
  await assert.rejects(migrateV2Database({ ...p, convert: convertLegacyState }));
  assert.deepEqual(readFileSync(p.source), before); assert.equal(version(p.source), 2);
  assert.equal(existsSync(p.backup), false); assert.equal(existsSync(p.destination), false);
  const store = new Store(p.source);
  try { assert.deepEqual(store.getState(), original); new DemoService(store, createAnalyzer({ mode: 'manual_simulation' })); }
  finally { store.close(); }
});
