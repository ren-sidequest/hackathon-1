import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../dist/app.js';
import { createAnalyzer } from '../dist/analysis.js';
import { fingerprint } from '../dist/fingerprint.js';
import { Value } from '@sinclair/typebox/value';
import { EnvelopeSchema } from '../dist/response-schema.js';

// These fixtures validate engineering/provenance, not real model effectiveness or hiring validity.
const HOST = '127.0.0.1:8787'; const ADMIN = 'two-version-test-admin-token-only';
const MORE = 'Please cite a channel comparison, distinguish observation from causation, and identify which additional cohort would test your explanation.';
let sequence = 0;
async function fixture(t, options = {}) {
  const app = await createApp({ databasePath: ':memory:', adminToken: ADMIN, analysisMode: 'manual_simulation', ...options });
  await app.ready(); t.after(() => app.close()); return app;
}
async function read(app) {
  const response = await app.inject({ method: 'GET', url: '/api/demo', headers: { host: HOST } });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(Value.Check(EnvelopeSchema, response.json()), true, 'public version history matches response schema');
  return response.json().data;
}
const binding = d => ({ schemaVersion: '2.0', sessionId: d.sessionId, taskId: d.task.taskId, datasetVersion: d.datasetVersion });
const analyzedBinding = d => ({ ...binding(d), submissionId: d.submission.submissionId, contentFingerprint: d.submission.contentFingerprint });
const reviewBody = (d, decision, comment = MORE) => ({ ...analyzedBinding(d), requirementId: d.task.requirementId, decision, comment });
const v1Body = (d, overrides = {}) => ({ ...binding(d), candidateId: d.candidate.id, submissionVersion: 1,
  previousSubmissionId: null, previousContentFingerprint: null,
  summary: 'V1-THIN-UNIQUE: I believe better marketing would improve the outcome.', findings: [], processEvidence: [], ...overrides });
const v2Body = (d, overrides = {}) => ({ ...v1Body(d), submissionVersion: 2,
  previousSubmissionId: d.submission.submissionId, previousContentFingerprint: d.submission.contentFingerprint,
  summary: 'V2-EVIDENCE-UNIQUE: Paid Search warrants investigation; the observed decline is not proof of causation.',
  findings: [
    { id: 'same-id-across-versions', section: 'Key Findings', title: 'Compare rates using the supplied counts',
      detail: 'V2-DETAIL-UNIQUE: Paid Search had 9600 orders / 300000 sessions before and 7668 / 426000 now, or 3.2% versus 1.8%.', source: 'website_traffic.csv', confidence: 'High' },
    { id: 'v2-hypothesis', section: 'Hypotheses', title: 'A causal explanation remains open',
      detail: 'Campaign mix may contribute, but the aggregates do not establish that the campaign caused the decline.', source: 'business_context.md', confidence: 'Low' },
    { id: 'v2-evidence', section: 'Additional Evidence Needed', title: 'Request comparable cohorts',
      detail: 'Request a campaign by device cohort before and after the changes to distinguish traffic mix from page experience.', source: 'landing_pages.csv', confidence: 'Medium' },
    { id: 'v2-next', section: 'Recommended Next Steps', title: 'Prioritise a bounded validation',
      detail: 'Validate funnel drop-off and compare matched cohorts before increasing advertising spend.', source: 'business_context.md', confidence: 'Medium' },
  ], processEvidence: [{ id: 'v2-event', at: '2026-09-19T05:00:00.000Z', title: 'Synthetic client responded to the review comment' }], ...overrides });
async function post(app, path, payload, key = `version-request-${++sequence}`, headers = {}) {
  return app.inject({ method: 'POST', url: `/api/demo${path}`, headers: { host: HOST, 'content-type': 'application/json', 'idempotency-key': key, ...headers }, payload });
}
function ok(response) {
  assert.ok(response.statusCode >= 200 && response.statusCode < 300, response.body);
  assert.equal(Value.Check(EnvelopeSchema, response.json()), true); return response.json().data;
}
function error(response, codes, statuses = [409]) {
  assert.ok(statuses.includes(response.statusCode), response.body);
  assert.ok([codes].flat().includes(response.json().error.code), response.body);
}
async function send(app) { const d = await read(app); return ok(await post(app, '/task/send', { ...binding(d), instructions: d.task.instructions })); }
async function first(app, overrides = {}) { const d = await send(app); return ok(await post(app, '/submission', v1Body(d, overrides))); }
async function requestMore(app, overrides = {}) {
  const d = await first(app, overrides);
  return ok(await post(app, '/review', reviewBody(d, 'needs_more_evidence')));
}
function unchangedOtherRequirements(d) { assert.deepEqual(d.report.requirements.slice(0, 2).map(r => r.status), ['supported', 'supported']); }
function verifyCitations(version) {
  for (const observation of version.analysis.result?.observations ?? []) {
    for (const ref of observation.citations) {
      const source = version.submission.sources.find(s => s.sourceId === ref.sourceId);
      assert.ok(source); assert.equal(source.location, ref.location);
      assert.equal(source.text.slice(ref.start, ref.end), ref.quote);
    }
  }
  if (version.analysis.result) {
    assert.equal(version.analysis.result.submissionId, version.submission.submissionId);
    assert.equal(version.analysis.result.contentFingerprint, version.submission.contentFingerprint);
  }
}

test('2.0 workflow separates capacity, permission, current version and terminal status', async t => {
  const app = await fixture(t); let d = await read(app);
  assert.equal(d.schemaVersion, '2.0'); assert.equal(d.currentSubmissionVersion, null); assert.deepEqual(d.versions, []);
  assert.deepEqual(d.workflow, { maxSubmissions: 2, submissionsUsed: 0, remainingSubmissions: 2,
    canSubmit: false, canResubmit: false, nextSubmissionVersion: null, allowedReviewDecisions: [], isTerminal: false });
  d = await send(app);
  assert.equal(d.workflow.canSubmit, true); assert.equal(d.workflow.nextSubmissionVersion, 1);
  d = ok(await post(app, '/submission', v1Body(d)));
  assert.equal(d.currentSubmissionVersion, 1); assert.equal(d.workflow.submissionsUsed, 1);
  assert.equal(d.workflow.remainingSubmissions, 1); assert.equal(d.workflow.canSubmit, false);
  assert.deepEqual(d.workflow.allowedReviewDecisions, ['confirm', 'needs_more_evidence', 'evidence_still_insufficient']);
  d = ok(await post(app, '/review', reviewBody(d, 'needs_more_evidence')));
  assert.equal(d.task.status, 'awaiting_revision'); assert.equal(d.review.comment, MORE);
  assert.equal(d.workflow.canSubmit, true); assert.equal(d.workflow.canResubmit, true);
  assert.equal(d.workflow.nextSubmissionVersion, 2); assert.equal(d.workflow.isTerminal, false);
  assert.deepEqual(d.workflow.allowedReviewDecisions, []);
  d = ok(await post(app, '/submission', v2Body(d)));
  assert.equal(d.currentSubmissionVersion, 2); assert.equal(d.workflow.remainingSubmissions, 0);
  assert.equal(d.workflow.canSubmit, false); assert.equal(d.workflow.canResubmit, false);
  assert.deepEqual(d.workflow.allowedReviewDecisions, ['confirm', 'evidence_still_insufficient']);
  assert.equal(d.workflow.isTerminal, false);
});

for (const decision of ['confirm', 'evidence_still_insufficient']) {
  test(`V1 ${decision} is final despite one unused physical slot`, async t => {
    const app = await fixture(t); const one = await first(app);
    const done = ok(await post(app, '/review', reviewBody(one, decision)));
    assert.equal(done.workflow.remainingSubmissions, 1); assert.equal(done.workflow.isTerminal, true);
    assert.equal(done.workflow.canSubmit, false); assert.equal(done.workflow.canResubmit, false);
    assert.equal(done.workflow.nextSubmissionVersion, null); assert.deepEqual(done.workflow.allowedReviewDecisions, []);
    error(await post(app, '/submission', v2Body(done)), 'RESUBMISSION_NOT_ALLOWED');
    assert.deepEqual(await read(app), done);
    assert.equal(done.report.requirements[2].status, decision === 'confirm' ? 'verified' : 'uncertain');
    unchangedOtherRequirements(done);
  });
}

for (const material of [
  { name: 'evidence-backed', decision: 'confirm', overrides: {} },
  { name: 'unsupported-polished', decision: 'evidence_still_insufficient', overrides: { summary: 'V2-THIN-UNIQUE: My strategic innovation guarantees excellent growth.', findings: [], processEvidence: [] } },
  { name: 'correlation-as-cause', decision: 'evidence_still_insufficient', overrides: { summary: 'V2-CAUSAL-UNIQUE: Traffic rose and conversion fell, so advertisements definitely caused the decline. Stop all spend.', findings: [], processEvidence: [] } },
]) {
  test(`paired thin V1 → concrete feedback → ${material.name} V2 preserves independent evidence`, async t => {
    const app = await fixture(t); const initial = await first(app);
    const v1Analysis = ok(await post(app, '/analysis', analyzedBinding(initial)));
    assert.equal(v1Analysis.analysis.result.observations.filter(o => o.status === 'not_observed').length, 4);
    const more = ok(await post(app, '/review', reviewBody(v1Analysis, 'needs_more_evidence')));
    const history = structuredClone(more.versions[0]);
    const draft = v2Body(more, material.overrides); draft.notes = 'PRIVATE-V2-DRAFT-NOT-SHARED';
    assert.deepEqual((await read(app)).versions[0], history, 'editing local draft never changes V1');
    delete draft.notes;
    const two = ok(await post(app, '/submission', draft));
    assert.equal(two.sessionId, more.sessionId); assert.equal(two.task.taskId, more.task.taskId);
    assert.equal(two.datasetVersion, more.datasetVersion); assert.equal(two.versions.length, 2);
    assert.equal(two.submission.submissionVersion, 2);
    assert.equal(two.submission.previousSubmissionId, more.submission.submissionId);
    assert.equal(two.submission.previousContentFingerprint, more.submission.contentFingerprint);
    assert.notEqual(two.submission.submissionId, more.submission.submissionId);
    assert.notEqual(two.submission.contentFingerprint, more.submission.contentFingerprint);
    assert.deepEqual(two.versions[0], history); assert.equal(two.analysis.status, 'not_started');
    assert.equal(two.analysis.result, null); assert.equal(two.review, null);
    assert.equal(two.report.requirements[2].status, 'uncertain');
    const analyzed = ok(await post(app, '/analysis', analyzedBinding(two)));
    assert.equal(analyzed.analysis.result.mode, 'manual_simulation'); assert.equal(analyzed.review, null);
    assert.equal(analyzed.report.requirements[2].status, 'uncertain');
    assert.deepEqual(analyzed.versions[0], history); analyzed.versions.forEach(verifyCitations);
    assert.notEqual(analyzed.versions[0].analysis.result.contentFingerprint, analyzed.versions[1].analysis.result.contentFingerprint);
    const done = ok(await post(app, '/review', reviewBody(analyzed, material.decision, `Independent V2 human fixture decision: ${material.name}; causality and real-world performance remain unknown.`)));
    assert.equal(done.task.status, 'reviewed'); assert.equal(done.workflow.isTerminal, true);
    assert.equal(done.workflow.remainingSubmissions, 0); assert.deepEqual(done.versions[0], history);
    assert.equal(done.versions[1].review.submissionId, two.submission.submissionId);
    assert.equal(done.report.requirements[2].status, material.decision === 'confirm' ? 'verified' : 'uncertain');
    assert.ok(done.report.requirements[2].submissionSourceRefs.every(ref => ref.submissionId === two.submission.submissionId));
    unchangedOtherRequirements(done);
    assert.equal(JSON.stringify(done).includes('PRIVATE-V2-DRAFT-NOT-SHARED'), false);
  });
}

test('submission version and previous-link fields are mandatory, validated and side-effect free', async t => {
  const app = await fixture(t); const sent = await send(app); const valid = v1Body(sent);
  for (const field of ['submissionVersion', 'previousSubmissionId', 'previousContentFingerprint']) {
    const missing = { ...valid }; delete missing[field]; error(await post(app, '/submission', missing), 'INVALID_REQUEST', [400]);
  }
  for (const patch of [{ schemaVersion: '1.0' }, { submissionVersion: '1' }, { submissionVersion: 0 }, { submissionVersion: 3 }]) {
    error(await post(app, '/submission', { ...valid, ...patch }), ['INVALID_REQUEST', 'SUBMISSION_VERSION_MISMATCH'], [400, 409]);
  }
  error(await post(app, '/submission', { ...valid, previousSubmissionId: 'unexpected', previousContentFingerprint: 'a'.repeat(64) }), 'PREVIOUS_SUBMISSION_MISMATCH');
  error(await post(app, '/submission', { ...valid, submissionVersion: 2 }), 'SUBMISSION_VERSION_MISMATCH');
  assert.deepEqual(await read(app), sent);
  const one = ok(await post(app, '/submission', valid));
  error(await post(app, '/submission', v2Body(one)), 'RESUBMISSION_NOT_ALLOWED');
  const more = ok(await post(app, '/review', reviewBody(one, 'needs_more_evidence')));
  for (const patch of [{ previousSubmissionId: 'stale-v1' }, { previousContentFingerprint: 'a'.repeat(64) }, { previousSubmissionId: null, previousContentFingerprint: null }]) {
    error(await post(app, '/submission', v2Body(more, patch)), 'PREVIOUS_SUBMISSION_MISMATCH');
    assert.deepEqual(await read(app), more);
  }
});

test('V2 rejects another evidence request and all V3 attempts without changing either version', async t => {
  const app = await fixture(t); const more = await requestMore(app);
  const two = ok(await post(app, '/submission', v2Body(more)));
  error(await post(app, '/review', reviewBody(two, 'needs_more_evidence')), 'REVIEW_LIMIT_REACHED');
  error(await post(app, '/submission', v2Body(more)), 'SUBMISSION_LIMIT_REACHED');
  error(await post(app, '/submission', { ...v2Body(two), submissionVersion: 3 }), ['INVALID_REQUEST', 'SUBMISSION_LIMIT_REACHED'], [400, 409]);
  assert.deepEqual(await read(app), two);
  const done = ok(await post(app, '/review', reviewBody(two, 'evidence_still_insufficient')));
  error(await post(app, '/submission', v2Body(two)), 'SUBMISSION_LIMIT_REACHED');
  assert.deepEqual(await read(app), done);
});

test('concurrent identical and competing V2 requests create exactly one immutable second version', async t => {
  for (const identical of [true, false]) {
    const app = await fixture(t); const more = await requestMore(app); const payload = v2Body(more);
    const [a, b] = await Promise.all([
      post(app, '/submission', payload, 'v2-concurrent-one'),
      post(app, '/submission', identical ? payload : { ...payload, summary: 'Competing V2 content' }, identical ? 'v2-concurrent-one' : 'v2-concurrent-two'),
    ]);
    const codes = [a.statusCode, b.statusCode].sort(); assert.deepEqual(codes, identical ? [201, 201] : [201, 409]);
    if (identical) assert.deepEqual([a.json().meta.replayed, b.json().meta.replayed].sort(), [false, true]);
    assert.equal((await read(app)).versions.length, 2);
    assert.equal((await read(app)).workflow.submissionsUsed, 2);
  }
});

test('historical same-key receipts replay but old-version new operations and old sessions are rejected', async t => {
  const app = await fixture(t); const sent = await send(app); const body = v1Body(sent);
  const oneResponse = await post(app, '/submission', body, 'history-v1-submit'); const one = ok(oneResponse);
  const analysisBody = analyzedBinding(one); const analyzedResponse = await post(app, '/analysis', analysisBody, 'history-v1-analysis'); ok(analyzedResponse);
  const review = reviewBody(one, 'needs_more_evidence'); const moreResponse = await post(app, '/review', review, 'history-v1-review'); const more = ok(moreResponse);
  const two = ok(await post(app, '/submission', v2Body(more)));
  for (const [path, payload, key, original] of [['/submission', body, 'history-v1-submit', oneResponse], ['/analysis', analysisBody, 'history-v1-analysis', analyzedResponse], ['/review', review, 'history-v1-review', moreResponse]]) {
    const replay = await post(app, path, payload, key); ok(replay);
    assert.equal(replay.json().meta.replayed, true); assert.deepEqual(replay.json().data, original.json().data);
    assert.deepEqual(await read(app), two);
  }
  error(await post(app, '/analysis', analysisBody), 'STALE_SUBMISSION');
  error(await post(app, '/review', review), 'STALE_SUBMISSION');
  error(await post(app, '/review', { ...review, comment: 'Changed historical review' }, 'history-v1-review'), 'IDEMPOTENCY_CONFLICT');
  const reset = ok(await post(app, '/reset', { schemaVersion: '2.0', sessionId: two.sessionId }, 'versions-reset', { 'x-demo-admin-token': ADMIN }));
  assert.deepEqual(reset.versions, []); assert.equal(reset.currentSubmissionVersion, null);
  for (const [path, payload, key] of [['/submission', body, 'history-v1-submit'], ['/analysis', analysisBody, 'history-v1-analysis'], ['/review', review, 'history-v1-review']]) {
    error(await post(app, path, payload, key), 'STALE_SESSION');
  }
  assert.deepEqual(await read(app), reset);
});

for (const lateFailure of [false, true]) {
  test(`review closes running V1 analysis before V2; late ${lateFailure ? 'failure' : 'success'} never writes either version`, { timeout: 5000 }, async t => {
    let release; let announce;
    const gate = new Promise(resolve => { release = resolve; }); const entered = new Promise(resolve => { announce = resolve; });
    const manual = createAnalyzer({ mode: 'manual_simulation' });
    const app = await fixture(t, { analyzer: async submission => {
      if (submission.submissionVersion === 1) { announce(); await gate; if (lateFailure) throw new Error('LATE-PRIVATE-PROVIDER-ERROR'); }
      return manual(submission);
    } });
    const one = await first(app);
    const pending = post(app, '/analysis', analyzedBinding(one), 'review-close-pending'); await entered;
    const more = ok(await post(app, '/review', reviewBody(one, 'needs_more_evidence')));
    assert.equal(more.analysis.status, 'failed'); assert.equal(more.analysis.errorCode, 'AI_REVIEW_CLOSED');
    error(await post(app, '/analysis', analyzedBinding(one), 'review-close-pending'), 'AI_REVIEW_CLOSED');
    const frozen = structuredClone(more.versions[0]);
    const two = ok(await post(app, '/submission', v2Body(more)));
    const current = ok(await post(app, '/analysis', analyzedBinding(two)));
    release(); error(await pending, 'STALE_ANALYSIS');
    const after = await read(app); assert.deepEqual(after, current); assert.deepEqual(after.versions[0], frozen);
    assert.equal(after.analysis.status, 'succeeded'); assert.equal(after.analysis.result.submissionId, two.submission.submissionId);
    assert.equal(JSON.stringify(after).includes('LATE-PRIVATE-PROVIDER-ERROR'), false);
  });
}

test('V2 private notes at every object depth are rejected without contaminating history or model inputs', async t => {
  const captured = []; const manual = createAnalyzer({ mode: 'manual_simulation' });
  const app = await fixture(t, { analyzer: async s => { captured.push(structuredClone(s)); return manual(s); } });
  const more = await requestMore(app); const body = v2Body(more); const secret = 'PRIVATE-V2-FIELD-SENTINEL';
  for (const bad of [{ ...body, notes: secret }, { ...body, findings: [{ ...body.findings[0], notes: secret }] },
    { ...body, processEvidence: [{ ...body.processEvidence[0], notes: secret }] }]) {
    const response = await post(app, '/submission', bad); error(response, 'INVALID_REQUEST', [400]);
    assert.equal(response.body.includes(secret), false); assert.deepEqual(await read(app), more);
  }
  const two = ok(await post(app, '/submission', body)); ok(await post(app, '/analysis', analyzedBinding(two)));
  assert.equal(JSON.stringify(await read(app)).includes(secret), false); assert.equal(JSON.stringify(captured).includes(secret), false);
});

for (const stage of ['awaiting_revision', 'v2_submitted', 'v2_reviewed']) {
  test(`file SQLite restores ${stage} with both references and exact historical evidence`, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'evidencebridge-v2-restart-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const options = { databasePath: join(directory, 'two.sqlite'), adminToken: ADMIN, analysisMode: 'manual_simulation' };
    const app = await createApp(options); await app.ready(); let expected;
    try {
      const one = await first(app); ok(await post(app, '/analysis', analyzedBinding(one)));
      expected = ok(await post(app, '/review', reviewBody(one, 'needs_more_evidence')));
      if (stage !== 'awaiting_revision') expected = ok(await post(app, '/submission', v2Body(expected)));
      if (stage === 'v2_reviewed') { expected = ok(await post(app, '/analysis', analyzedBinding(expected))); expected = ok(await post(app, '/review', reviewBody(expected, 'confirm'))); }
    } finally { await app.close(); }
    const reopened = await createApp(options); await reopened.ready();
    try { assert.deepEqual(await read(reopened), expected); (await read(reopened)).versions.forEach(verifyCitations); }
    finally { await reopened.close(); }
  });
}

for (const userVersion of [0, 1]) {
  test(`legacy user_version ${userVersion} database is refused and its bytes retained`, async t => {
    const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-legacy-'));
    t.after(() => rm(dir, { recursive: true, force: true })); const path = join(dir, 'legacy.sqlite');
    const db = new DatabaseSync(path);
    db.exec(`PRAGMA user_version=${userVersion}; CREATE TABLE demo_state(id INTEGER PRIMARY KEY,state_json TEXT NOT NULL)`);
    const old = JSON.stringify({ schemaVersion: '1.0', privateMarker: 'LEGACY-RETAINED-RECORD' });
    db.prepare('INSERT INTO demo_state VALUES(1,?)').run(old); db.close();
    const before = await readFile(path);
    await assert.rejects(createApp({ databasePath: path }), /incompatible|legacy|version/i);
    assert.deepEqual(await readFile(path), before);
    const retained = new DatabaseSync(path); try {
      assert.equal(retained.prepare('PRAGMA user_version').get().user_version, userVersion);
      assert.equal(retained.prepare('SELECT state_json FROM demo_state').get().state_json, old);
    } finally { retained.close(); }
  });
}

test('new database user_version is 2 and default configuration names the v2 database', async t => {
  const { loadConfig } = await import('../dist/config.js'); assert.match(loadConfig({}).databasePath, /evidencebridge-v2\.sqlite$/);
  const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-db-version-'));
  t.after(() => rm(dir, { recursive: true, force: true })); const path = join(dir, 'fresh.sqlite');
  const app = await createApp({ databasePath: path }); await app.close();
  const db = new DatabaseSync(path); try { assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2); } finally { db.close(); }
});

for (const corruption of ['duplicate-version-id', 'reordered-history', 'historical-terminal-review', 'current-review-stale-id', 'old-result-as-current']) {
  test(`restoring corrupt two-version state (${corruption}) fails without silently rewriting history`, async t => {
    const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-v2-corrupt-'));
    t.after(() => rm(dir, { recursive: true, force: true })); const path = join(dir, 'two.sqlite');
    const options = { databasePath: path, adminToken: ADMIN, analysisMode: 'manual_simulation' };
    const app = await createApp(options); await app.ready();
    try {
      const one = await first(app); ok(await post(app, '/analysis', analyzedBinding(one)));
      const more = ok(await post(app, '/review', reviewBody(one, 'needs_more_evidence')));
      const two = ok(await post(app, '/submission', v2Body(more))); ok(await post(app, '/analysis', analyzedBinding(two)));
      ok(await post(app, '/review', reviewBody(two, 'confirm')));
    } finally { await app.close(); }
    const valid = await createApp(options); await valid.close();
    const db = new DatabaseSync(path); const state = JSON.parse(db.prepare('SELECT state_json FROM demo_state').get().state_json);
    if (corruption === 'duplicate-version-id') state.versions[1].submissionId = state.versions[0].submissionId;
    if (corruption === 'reordered-history') state.versions.reverse();
    if (corruption === 'historical-terminal-review') state.versions[0].review.decision = 'confirm';
    if (corruption === 'current-review-stale-id') state.versions[1].review.submissionId = state.versions[0].submissionId;
    if (corruption === 'old-result-as-current') state.versions[1].analysis.result = state.versions[0].analysis.result;
    const corrupted = JSON.stringify(state); db.prepare('UPDATE demo_state SET state_json=?').run(corrupted); db.close();
    await assert.rejects(createApp(options));
    const after = new DatabaseSync(path); try { assert.equal(after.prepare('SELECT state_json FROM demo_state').get().state_json, corrupted); } finally { after.close(); }
  });
}

test('closing running V2 preserves completed V1 analysis and its historical idempotency receipt', { timeout: 5000 }, async t => {
  let release; let enteredResolve;
  const gate = new Promise(resolve => { release = resolve; }); const entered = new Promise(resolve => { enteredResolve = resolve; });
  const manual = createAnalyzer({ mode: 'manual_simulation' });
  const app = await fixture(t, { analyzer: async sub => { if (sub.submissionVersion === 2) { enteredResolve(); await gate; } return manual(sub); } });
  const one = await first(app); const v1request = analyzedBinding(one);
  const firstResponse = await post(app, '/analysis', v1request, 'v1-complete-receipt'); ok(firstResponse);
  const more = ok(await post(app, '/review', reviewBody(one, 'needs_more_evidence')));
  const oneHistory = structuredClone(more.versions[0]);
  const two = ok(await post(app, '/submission', v2Body(more)));
  const pending = post(app, '/analysis', analyzedBinding(two), 'v2-pending-receipt'); await entered;
  const done = ok(await post(app, '/review', reviewBody(two, 'evidence_still_insufficient')));
  error(await post(app, '/analysis', analyzedBinding(two), 'v2-pending-receipt'), 'AI_REVIEW_CLOSED');
  const replay = await post(app, '/analysis', v1request, 'v1-complete-receipt'); ok(replay);
  assert.equal(replay.json().meta.replayed, true); assert.deepEqual(replay.json().data, firstResponse.json().data);
  assert.deepEqual(done.versions[0], oneHistory); release(); error(await pending, 'STALE_ANALYSIS');
  assert.deepEqual(await read(app), done);
});

test('test-only live V1/V2 results become replay in all current and historical response positions', async t => {
  let calls = 0; const manual = createAnalyzer({ mode: 'manual_simulation' });
  const app = await fixture(t, { analyzer: async input => {
    calls += 1; const output = await manual(input);
    output.mode = 'live'; output.model = 'TEST-STUB-NOT-A-REAL-MODEL';
    output.provenance.provider = 'openai'; output.provenance.responseId = `TEST-STUB-v${input.submissionVersion}`;
    return output;
  } });
  const one = await first(app); const firstRequest = analyzedBinding(one);
  const generatedOne = ok(await post(app, '/analysis', firstRequest, 'live-stub-v1-key'));
  assert.equal(generatedOne.analysis.result.mode, 'live'); assert.equal(generatedOne.versions[0].analysis.result.mode, 'live');
  const more = ok(await post(app, '/review', reviewBody(one, 'needs_more_evidence')));
  const two = ok(await post(app, '/submission', v2Body(more))); const secondRequest = analyzedBinding(two);
  const generatedTwo = ok(await post(app, '/analysis', secondRequest, 'live-stub-v2-key'));
  assert.equal(generatedTwo.analysis.result.mode, 'live');
  assert.deepEqual(generatedTwo.versions.map(v => v.analysis.result.mode), ['replay', 'live']);
  const current = await read(app); assert.equal(current.analysis.result.mode, 'replay');
  assert.deepEqual(current.versions.map(v => v.analysis.result.mode), ['replay', 'replay']);
  for (const [request, key] of [[firstRequest, 'live-stub-v1-key'], [secondRequest, 'live-stub-v2-key']]) {
    const response = await post(app, '/analysis', request, key); const historical = ok(response);
    assert.equal(response.json().meta.replayed, true); assert.equal(historical.analysis.result.mode, 'replay');
    assert.ok(historical.versions.every(v => v.analysis.result.mode === 'replay'));
    assert.ok(historical.versions.every(v => v.analysis.result.model === 'TEST-STUB-NOT-A-REAL-MODEL'));
  }
  assert.equal(calls, 2); assert.deepEqual(await read(app), current);
});

test('a format-2 database with missing tables is preserved instead of silently rebuilt', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-v2-incomplete-'));
  t.after(() => rm(dir, { recursive: true, force: true })); const path = join(dir, 'incomplete.sqlite');
  const db = new DatabaseSync(path); db.exec('PRAGMA user_version=2; CREATE TABLE demo_state(id INTEGER PRIMARY KEY,state_json TEXT NOT NULL)'); db.close();
  const before = await readFile(path);
  await assert.rejects(createApp({ databasePath: path }), /incomplete|schema/i);
  assert.deepEqual(await readFile(path), before);
  const inspect = new DatabaseSync(path);
  try { assert.deepEqual(inspect.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name), ['demo_state']); }
  finally { inspect.close(); }
});

test('interrupted V2 restores as retryable failure while preserving the actual failed V1 history', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'evidencebridge-v2-interrupted-'));
  t.after(() => rm(dir, { recursive: true, force: true })); const path = join(dir, 'two.sqlite');
  const options = { databasePath: path, adminToken: ADMIN, analysisMode: 'disabled' };
  const app = await createApp(options); await app.ready(); let two; let history;
  try {
    const one = await first(app); error(await post(app, '/analysis', analyzedBinding(one)), 'AI_DISABLED', [503]);
    const more = ok(await post(app, '/review', reviewBody(one, 'needs_more_evidence')));
    history = structuredClone(more.versions[0]); assert.equal(history.analysis.errorCode, 'AI_DISABLED');
    two = ok(await post(app, '/submission', v2Body(more)));
  } finally { await app.close(); }
  const request = analyzedBinding(two); const db = new DatabaseSync(path);
  const stored = JSON.parse(db.prepare('SELECT state_json FROM demo_state').get().state_json);
  const running = { status: 'running', attemptId: 'v2-interrupted-attempt', submissionId: two.submission.submissionId,
    contentFingerprint: two.submission.contentFingerprint, startedAt: '2026-09-19T06:00:00.000Z', finishedAt: null, errorCode: null, result: null };
  stored.versions[1].analysis = running;
  db.prepare('UPDATE demo_state SET state_json=?').run(JSON.stringify(stored));
  db.prepare('INSERT INTO idempotency VALUES(?,?,?,?,?,?)').run(two.sessionId, '/api/demo/analysis', 'v2-interrupted-key', fingerprint(request), 202,
    JSON.stringify({ data: { ...two, analysis: running, versions: [two.versions[0], { ...two.versions[1], analysis: running }] }, meta: { replayed: false } }));
  db.close();
  const restarted = await createApp({ ...options, analysisMode: 'manual_simulation' }); await restarted.ready();
  try {
    const restored = await read(restarted); assert.deepEqual(restored.versions[0], history);
    assert.equal(restored.analysis.status, 'failed'); assert.equal(restored.analysis.errorCode, 'AI_INTERRUPTED');
    assert.equal(restored.currentSubmissionVersion, 2); assert.equal(restored.review, null);
    error(await post(restarted, '/analysis', request, 'v2-interrupted-key'), 'AI_INTERRUPTED', [503]);
    const retried = ok(await post(restarted, '/analysis', request, 'v2-retry-new-key'));
    assert.deepEqual(retried.versions[0], history); assert.equal(retried.analysis.status, 'succeeded');
    verifyCitations(retried.versions[1]);
  } finally { await restarted.close(); }
});
