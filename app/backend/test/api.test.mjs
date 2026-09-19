import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../dist/app.js';
import { createAnalyzer } from '../dist/analysis.js';
import { loadConfig } from '../dist/config.js';
import { fingerprint } from '../dist/fingerprint.js';

const ADMIN = 'test-token-at-least-24-chars';
const HOST = '127.0.0.1:8787';
const UNIQUE = 'EB-CROSS-CLIENT-UNIQUE: first validate the campaign cohorts.';
let sequence = 0;

async function fixture(t, options = {}) {
  const app = await createApp({ databasePath: ':memory:', adminToken: ADMIN, analysisMode: 'manual_simulation', ...options });
  await app.ready();
  t.after(() => app.close());
  return app;
}
async function get(app) {
  const response = await app.inject({ method: 'GET', url: '/api/demo', headers: { host: HOST } });
  assert.equal(response.statusCode, 200, response.body);
  return response.json().data;
}
function bindings(data) {
  return { schemaVersion: '2.0', sessionId: data.sessionId, taskId: data.task.taskId, datasetVersion: data.datasetVersion };
}
function sample(data, overrides = {}) {
  return {
    ...bindings(data), candidateId: data.candidate.id,
    submissionVersion: 1, previousSubmissionId: null, previousContentFingerprint: null,
    summary: `  Traffic grew 18% while conversion fell from 3.4% to 2.6%. ${UNIQUE}  `,
    findings: [
      { id: 'finding-unique', section: 'Key Findings', title: 'Paid Search warrants investigation', detail: 'The overall rate fell by 0.8 percentage points; this alone does not establish a cause.', source: 'website_traffic.csv', confidence: 'High' },
      { id: 'hypothesis-unique', section: 'Hypotheses', title: 'Campaign mix may contribute', detail: 'Compare equivalent cohorts before attributing the change to campaigns.', source: 'campaigns.csv', confidence: 'Medium' },
      { id: 'evidence-unique', section: 'Additional Evidence Needed', title: 'Request comparable cohorts', detail: 'Request campaign × device × landing-page data and a comparison period.', source: 'landing_pages.csv', confidence: 'High' },
      { id: 'decision-unique', section: 'Recommended Next Steps', title: 'Run a bounded validation', detail: 'Check the mobile funnel before expanding spend; use conversion and checkout drop-off to judge the result.', source: 'business_context.md', confidence: 'Medium' },
    ],
    processEvidence: [{ id: 'event-unique', at: '2026-09-19T02:00:00.000Z', title: 'Opened campaigns.csv', detail: 'Client-reported file access, not a verified capability.' }],
    ...overrides,
  };
}
async function post(app, path, payload, { key = `qa-request-${++sequence}`, headers = {} } = {}) {
  return app.inject({ method: 'POST', url: `/api/demo${path}`, headers: { host: HOST, 'content-type': 'application/json', 'idempotency-key': key, ...headers }, payload });
}
function success(response) {
  assert.ok(response.statusCode >= 200 && response.statusCode < 300, `${response.statusCode}: ${response.body}`);
  const envelope = response.json();
  assert.equal(typeof envelope.meta.replayed, 'boolean');
  return envelope.data;
}
function failure(response, expected) {
  assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.statusCode), `${response.statusCode}: ${response.body}`);
  const body = response.json();
  assert.ok(body.error, response.body);
  assert.equal(typeof body.error.code, 'string');
}
async function sent(app) {
  const initial = await get(app);
  success(await post(app, '/task/send', { ...bindings(initial), instructions: initial.task.instructions }));
  return get(app);
}
async function submitted(app, overrides = {}) {
  const data = await sent(app);
  const request = sample(data, overrides);
  success(await post(app, '/submission', request));
  return { data: await get(app), request };
}
function analysisBinding(data) {
  return { ...bindings(data), submissionId: data.submission.submissionId, contentFingerprint: data.submission.contentFingerprint };
}
function reviewRequest(data, decision = 'confirm') {
  return { ...analysisBinding(data), requirementId: data.task.requirementId, decision, comment: 'Reviewed the submitted sources and retained the scope limitations.' };
}
async function reset(app, data, options = {}) {
  return post(app, '/reset', { schemaVersion: '2.0', sessionId: data.sessionId }, { ...options, headers: { 'x-demo-admin-token': ADMIN, ...(options.headers ?? {}) } });
}

// Product workflow is validated with independent requests, not browser localStorage.
test('initial shared state exposes the fixed case, separate statuses and readiness', async t => {
  const app = await fixture(t);
  const health = await app.inject({ method: 'GET', url: '/healthz', headers: { host: HOST } });
  assert.equal(health.statusCode, 200);
  const data = await get(app);
  assert.equal(data.schemaVersion, '2.0');
  assert.equal(data.candidate.name, 'Alex Chen');
  assert.equal(data.task.status, 'draft');
  assert.equal(data.analysis.status, 'not_started');
  assert.equal(data.submission, null);
  assert.equal(data.review, null);
  assert.deepEqual(data.report.requirements.map(item => item.status), ['supported', 'supported', 'uncertain']);
});

test('send → unique immutable submission → analysis → Confirm updates only its requirement', async t => {
  const app = await fixture(t);
  const { data, request } = await submitted(app);
  assert.equal(data.task.status, 'submitted');
  assert.equal(data.submission.summary, request.summary);
  assert.deepEqual(data.submission.findings, request.findings);
  assert.deepEqual(data.submission.processEvidence, request.processEvidence);
  assert.match(data.submission.summary, /EB-CROSS-CLIENT-UNIQUE/);
  const original = structuredClone(data.submission);
  request.summary = 'This client modified its draft after submitting.';
  request.findings[0].detail = 'Mutated local value';
  assert.deepEqual((await get(app)).submission, original);
  success(await post(app, '/analysis', analysisBinding(data)));
  const analyzed = await get(app);
  assert.equal(analyzed.analysis.status, 'succeeded');
  assert.equal(analyzed.analysis.result.mode, 'manual_simulation');
  assert.equal(analyzed.analysis.result.submissionId, data.submission.submissionId);
  assert.equal(analyzed.analysis.result.contentFingerprint, data.submission.contentFingerprint);
  assert.equal(analyzed.analysis.result.observations.length, 5);
  for (const observation of analyzed.analysis.result.observations) {
    assert.ok(observation.scope.trim());
    assert.ok(observation.uncertainty.trim());
    for (const citation of observation.citations) {
      const source = data.submission.sources.find(item => item.sourceId === citation.sourceId);
      assert.ok(source);
      assert.equal(source.location, citation.location);
      assert.equal(source.text.slice(citation.start, citation.end), citation.quote);
    }
  }
  assert.equal(analyzed.review, null);
  assert.deepEqual(analyzed.report.requirements.map(item => item.status), ['supported', 'supported', 'uncertain']);
  success(await post(app, '/review', reviewRequest(analyzed)));
  const reviewed = await get(app);
  assert.equal(reviewed.task.status, 'reviewed');
  assert.equal(reviewed.review.decision, 'confirm');
  assert.deepEqual(reviewed.report.requirements.map(item => item.status), ['supported', 'supported', 'verified']);
  const updatedRequirement = reviewed.report.requirements.find(item => item.requirementId === data.task.requirementId);
  assert.equal(updatedRequirement.displayStatus, 'Verified through targeted task');
  assert.equal(updatedRequirement.displayLabel, updatedRequirement.displayStatus);
  assert.equal(updatedRequirement.mode, 'human_reviewed');
  assert.ok(updatedRequirement.summary.endsWith(reviewed.review.comment));
  assert.match(updatedRequirement.summary, /^Human evidence review: confirm\./);
  assert.notEqual(updatedRequirement.summary, data.report.requirements.find(item => item.requirementId === data.task.requirementId).summary);
  assert.deepEqual(reviewed.report.requirements.slice(0, 2), data.report.requirements.slice(0, 2));
  assert.deepEqual(reviewed.submission, original);
  assert.deepEqual(await get(app), reviewed);
});

for (const decision of ['needs_more_evidence', 'evidence_still_insufficient']) {
  test(`${decision} preserves uncertainty and exposes the bounded follow-up state`, async t => {
    const app = await fixture(t);
    const { data } = await submitted(app);
    success(await post(app, '/review', reviewRequest(data, decision)));
    const reviewed = await get(app);
    assert.equal(reviewed.review.decision, decision);
    assert.equal(reviewed.task.status, decision === 'needs_more_evidence' ? 'awaiting_revision' : 'reviewed');
    assert.equal(reviewed.workflow.canResubmit, decision === 'needs_more_evidence');
    assert.equal(reviewed.workflow.isTerminal, decision !== 'needs_more_evidence');
    assert.deepEqual(reviewed.report.requirements.map(item => item.status), ['supported', 'supported', 'uncertain']);
    failure(await post(app, '/submission', sample(reviewed)), 409);
    failure(await post(app, '/review', reviewRequest(reviewed)), 409);
    assert.deepEqual(await get(app), reviewed);
  });
}

test('write order and missing or stale binding failures do not mutate state', async t => {
  const app = await fixture(t);
  const initial = await get(app);
  failure(await post(app, '/submission', sample(initial)), 409);
  const premature = { ...bindings(initial), submissionId: 'missing-submission', contentFingerprint: '0'.repeat(64) };
  failure(await post(app, '/analysis', premature), 409);
  failure(await post(app, '/review', { ...premature, requirementId: initial.task.requirementId, decision: 'confirm', comment: 'Too early' }), 409);
  assert.deepEqual(await get(app), initial);
  const data = await sent(app);
  for (const override of [{ sessionId: 'stale-session' }, { taskId: 'stale-task' }, { datasetVersion: 'stale-dataset' }, { candidateId: 'other-candidate' }]) {
    failure(await post(app, '/submission', sample(data, override)), [400, 409]);
    assert.deepEqual(await get(app), data);
  }
});

test('idempotency replays exact responses while conflicting writes preserve the snapshot', async t => {
  const app = await fixture(t);
  const initial = await get(app);
  const send = { ...bindings(initial), instructions: initial.task.instructions };
  const first = await post(app, '/task/send', send, { key: 'same-send-key' });
  const replay = await post(app, '/task/send', send, { key: 'same-send-key' });
  success(first); success(replay);
  assert.equal(first.json().meta.replayed, false);
  assert.equal(replay.json().meta.replayed, true);
  assert.deepEqual(first.json().data, replay.json().data);
  failure(await post(app, '/task/send', { ...send, instructions: 'Changed task instructions' }, { key: 'same-send-key' }), 409);
  const data = await get(app);
  const payload = sample(data);
  const [one, two] = await Promise.all([post(app, '/submission', payload, { key: 'same-submit-key' }), post(app, '/submission', payload, { key: 'same-submit-key' })]);
  success(one); success(two);
  assert.deepEqual(one.json().data, two.json().data);
  assert.deepEqual([one.json().meta.replayed, two.json().meta.replayed].sort(), [false, true]);
  failure(await post(app, '/submission', payload), 409);
  failure(await post(app, '/submission', { ...payload, summary: 'Changed content' }, { key: 'same-submit-key' }), 409);
  const stored = await get(app);
  const review = reviewRequest(stored);
  const reviewed = await post(app, '/review', review, { key: 'same-review-key' });
  const replayReview = await post(app, '/review', review, { key: 'same-review-key' });
  success(reviewed); success(replayReview);
  assert.equal(replayReview.json().meta.replayed, true);
  assert.deepEqual(reviewed.json().data, replayReview.json().data);
  failure(await post(app, '/review', { ...review, decision: 'evidence_still_insufficient' }, { key: 'same-review-key' }), 409);
});

test('strict public schema rejects private notes at every accepted object depth', async t => {
  const app = await fixture(t);
  const data = await sent(app);
  const privateValue = 'PRIVATE-NOTES-NEVER-SHARE-9457';
  const base = sample(data);
  const candidates = [
    { ...base, notes: privateValue },
    { ...base, findings: [{ ...base.findings[0], notes: privateValue }] },
    { ...base, processEvidence: [{ ...base.processEvidence[0], notes: privateValue }] },
  ];
  for (const payload of candidates) {
    const response = await post(app, '/submission', payload);
    failure(response, 400);
    assert.ok(!response.body.includes(privateValue));
    assert.ok(!JSON.stringify(await get(app)).includes(privateValue));
  }
  assert.deepEqual(await get(app), data);
});

test('schema boundaries reject blank, oversized, duplicate and unknown-source material', async t => {
  const app = await fixture(t);
  const data = await sent(app);
  const valid = sample(data);
  const invalid = [
    { summary: ' \n\t ' }, { summary: 'x'.repeat(8001) }, { summary: 17 }, { findings: null },
    { findings: [{ ...valid.findings[0], title: ' ' }] },
    { findings: [{ ...valid.findings[0], id: 'bad/id' }] },
    { findings: [{ ...valid.findings[0], source: 'invented.csv' }] },
    { findings: [{ ...valid.findings[0], confidence: 'Certain' }] },
    { findings: [valid.findings[0], valid.findings[0]] },
    { processEvidence: [{ ...valid.processEvidence[0], at: 'yesterday' }] },
    { processEvidence: [valid.processEvidence[0], valid.processEvidence[0]] },
    { processEvidence: Array.from({ length: 101 }, (_, i) => ({ ...valid.processEvidence[0], id: `event-${i}` })) },
    { ignoredExtra: 'unknown fields should be explicit errors' },
  ];
  for (const override of invalid) {
    failure(await post(app, '/submission', { ...valid, ...override }), 400);
    assert.deepEqual(await get(app), data);
  }
  // A thin sample remains analyzable: absent evidence should not force positive findings.
  success(await post(app, '/submission', sample(data, { summary: 'I would improve everything.', findings: [], processEvidence: [] })));
});

test('HTTP schema and access boundary failures are explicit and side-effect free', async t => {
  const app = await fixture(t);
  const data = await get(app);
  const payload = { ...bindings(data), instructions: data.task.instructions };
  for (const key of ['', 'short', 'bad key here', 'x'.repeat(101)]) {
    failure(await post(app, '/task/send', payload, { key }), 400);
  }
  const noKey = await app.inject({ method: 'POST', url: '/api/demo/task/send', headers: { host: HOST }, payload });
  failure(noKey, 400);
  const badJson = await post(app, '/task/send', '{broken');
  failure(badJson, 400);
  const oversized = await post(app, '/task/send', { ...payload, instructions: 'x'.repeat(512_000) });
  failure(oversized, [400, 413]);
  const hostileOrigin = await post(app, '/task/send', payload, { headers: { origin: 'https://not-the-demo.example' } });
  failure(hostileOrigin, 403);
  const hostileHost = await post(app, '/task/send', payload, { headers: { host: 'not-the-demo.example:8787' } });
  failure(hostileHost, 403);
  assert.deepEqual(await get(app), data);
});

test('review cannot target another requirement or use a stale submission/fingerprint', async t => {
  const app = await fixture(t);
  const { data } = await submitted(app);
  const base = reviewRequest(data);
  for (const changed of [{ requirementId: data.report.requirements[0].requirementId }, { submissionId: 'not-current-submission' }, { contentFingerprint: '0'.repeat(64) }]) {
    failure(await post(app, '/review', { ...base, ...changed }), [400, 409]);
    assert.deepEqual(await get(app), data);
  }
  for (const changed of [{ comment: '  ' }, { decision: 'hire' }, { notes: 'private review notes' }]) {
    failure(await post(app, '/review', { ...base, ...changed }), 400);
  }
});

test('disabled or failed AI preserves public work and allows explicit human review', async t => {
  const app = await fixture(t, { analysisMode: 'disabled' });
  const { data } = await submitted(app);
  const response = await post(app, '/analysis', analysisBinding(data));
  failure(response, [409, 503]);
  const failed = await get(app);
  assert.deepEqual(failed.submission, data.submission);
  assert.notEqual(failed.analysis.status, 'succeeded');
  assert.equal(failed.review, null);
  success(await post(app, '/review', reviewRequest(failed)));
  assert.equal((await get(app)).review.decision, 'confirm');
});

test('reset requires its token, invalidates old bindings, and is itself idempotent', async t => {
  const app = await fixture(t);
  const { data } = await submitted(app);
  failure(await post(app, '/reset', { schemaVersion: '2.0', sessionId: data.sessionId }), [401, 403]);
  failure(await reset(app, data, { headers: { 'x-demo-admin-token': 'incorrect-token' } }), [401, 403]);
  assert.deepEqual(await get(app), data);
  const first = await reset(app, data, { key: 'same-reset-key' });
  const next = success(first);
  assert.notEqual(next.sessionId, data.sessionId);
  assert.notEqual(next.task.taskId, data.task.taskId);
  assert.equal(next.task.status, 'draft');
  assert.equal(next.submission, null);
  assert.deepEqual(next.report.requirements.map(item => item.status), ['supported', 'supported', 'uncertain']);
  failure(await post(app, '/analysis', analysisBinding(data)), 409);
  failure(await post(app, '/review', reviewRequest(data)), 409);
  const second = await reset(app, data, { key: 'same-reset-key' });
  success(second);
  assert.equal(second.json().meta.replayed, true);
  assert.deepEqual(second.json().data, next);
  const { data: renewed } = await submitted(app, { summary: `New round: ${UNIQUE}` });
  assert.notEqual(renewed.submission.submissionId, data.submission.submissionId);
  assert.notEqual(renewed.submission.contentFingerprint, data.submission.contentFingerprint);
  success(await reset(app, data, { key: 'same-reset-key' }));
  assert.deepEqual((await get(app)).submission, renewed.submission, 'retrying an old reset must not erase current work');
});

test('SQLite restores the same snapshot and decision after closing and reopening the service', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'evidencebridge-qa-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = { databasePath: join(directory, 'state.sqlite'), adminToken: ADMIN, analysisMode: 'manual_simulation' };
  const first = await createApp(options);
  await first.ready();
  let expected;
  try {
    const { data } = await submitted(first);
    success(await post(first, '/review', reviewRequest(data, 'evidence_still_insufficient')));
    expected = await get(first);
  } finally { await first.close(); }
  const restored = await createApp(options);
  await restored.ready();
  try { assert.deepEqual(await get(restored), expected); }
  finally { await restored.close(); }
});

for (const corruption of ['unknown-source', 'wrong-quote', 'wrong-fingerprint', 'missing-dimension']) {
  test(`invalid analyzer output (${corruption}) is rejected before entering shared state`, async t => {
    const manual = createAnalyzer({ mode: 'manual_simulation' });
    const analyzer = async submission => {
      const result = await manual(submission);
      if (corruption === 'unknown-source') result.observations[0].citations[0].sourceId = 'nonexistent-source';
      if (corruption === 'wrong-quote') result.observations[0].citations[0].quote = 'invented quotation not in the work';
      if (corruption === 'wrong-fingerprint') result.contentFingerprint = '0'.repeat(64);
      if (corruption === 'missing-dimension') result.observations.pop();
      return result;
    };
    const app = await fixture(t, { analyzer });
    const { data } = await submitted(app);
    failure(await post(app, '/analysis', analysisBinding(data)), [502, 503]);
    const failed = await get(app);
    assert.equal(failed.analysis.status, 'failed');
    assert.equal(failed.analysis.result, null);
    assert.deepEqual(failed.submission, data.submission);
    assert.equal(failed.review, null);
    assert.deepEqual(failed.report.requirements.map(item => item.status), ['supported', 'supported', 'uncertain']);
  });
}

test('unexpected analyzer exceptions do not leak raw messages or private-looking provider data', async t => {
  const marker = 'PROVIDER-PRIVATE-MARKER-secret-value-8931';
  const app = await fixture(t, { analyzer: async () => { throw new Error(marker); } });
  const { data } = await submitted(app);
  const response = await post(app, '/analysis', analysisBinding(data));
  failure(response, [500, 502, 503]);
  assert.ok(!response.body.includes(marker));
  const failed = await get(app);
  assert.ok(!JSON.stringify(failed).includes(marker));
  assert.equal(failed.analysis.status, 'failed');
  assert.deepEqual(failed.submission, data.submission);
});

test('a running analysis cannot overwrite a reset session with its late result', { timeout: 5000 }, async t => {
  let release;
  let announce;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { announce = resolve; });
  const manual = createAnalyzer({ mode: 'manual_simulation' });
  const app = await fixture(t, { analyzer: async submission => { announce(); await gate; return manual(submission); } });
  const { data } = await submitted(app);
  const pending = post(app, '/analysis', analysisBinding(data));
  await entered;
  assert.equal((await get(app)).analysis.status, 'running');
  const next = success(await reset(app, data));
  release();
  failure(await pending, 409);
  assert.deepEqual(await get(app), next);
});

for (const material of [
  { name: 'evidence-backed', summary: 'Traffic +18%; conversion 3.4% to 2.6%. The overall decline does not by itself establish causality.', findings: null },
  { name: 'unsupported-polished', summary: 'My innovative strategy will optimize all conversion and deliver excellent business outcomes.', findings: [] },
  { name: 'correlation-as-cause', summary: 'Traffic rose while conversion fell, therefore advertising definitely caused the decline; stop all spending immediately.', findings: [] },
]) {
  test(`AI material ${material.name}: manual simulation stays labeled and never auto-confirms`, async t => {
    const app = await fixture(t);
    const overrides = { summary: material.summary, processEvidence: [] };
    if (material.findings !== null) overrides.findings = material.findings;
    const { data } = await submitted(app, overrides);
    success(await post(app, '/analysis', analysisBinding(data)));
    const result = await get(app);
    assert.equal(result.analysis.result.mode, 'manual_simulation');
    assert.equal(result.analysis.result.provenance.provider, 'manual_rules');
    assert.equal(result.analysis.result.model, null);
    assert.equal(result.review, null);
    assert.deepEqual(result.report.requirements.map(item => item.status), ['supported', 'supported', 'uncertain']);
    if (material.findings?.length === 0) {
      assert.equal(result.analysis.result.observations.filter(item => item.status === 'not_observed').length, 4);
    }
    for (const observation of result.analysis.result.observations) {
      assert.match(observation.scope, /manual/i);
      assert.ok(observation.uncertainty.trim());
    }
  });
}

test('analysis retries expose pending status then replay one completed result without a second invocation', { timeout: 5000 }, async t => {
  let release;
  let announce;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { announce = resolve; });
  const manual = createAnalyzer({ mode: 'manual_simulation' });
  const app = await fixture(t, { analyzer: async submission => { calls += 1; announce(); await gate; return manual(submission); } });
  const { data } = await submitted(app);
  const payload = analysisBinding(data);
  const pending = post(app, '/analysis', payload, { key: 'pending-analysis-key' });
  await entered;
  const again = await post(app, '/analysis', payload, { key: 'pending-analysis-key' });
  assert.equal(again.statusCode, 202);
  assert.equal(again.json().meta.replayed, true);
  assert.equal(again.json().data.analysis.status, 'running');
  failure(await post(app, '/analysis', payload, { key: 'different-analysis-key' }), 409);
  release();
  const completed = await pending;
  success(completed);
  const replay = await post(app, '/analysis', payload, { key: 'pending-analysis-key' });
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.json().meta.replayed, true);
  assert.deepEqual(replay.json().data, completed.json().data);
  assert.equal(calls, 1);
});

test('allowed frontend CORS preflight works without weakening disallowed-origin or header checks', async t => {
  const origin = 'http://localhost:5186';
  const app = await fixture(t, { allowedOrigins: [origin] });
  const response = await app.inject({ method: 'OPTIONS', url: '/api/demo/submission', headers: {
    host: HOST, origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,idempotency-key',
  } });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-origin'], origin);
  assert.match(response.headers['access-control-allow-headers'], /Idempotency-Key/i);
  const allowed = await app.inject({ method: 'GET', url: '/api/demo', headers: { host: HOST, origin } });
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.headers['access-control-allow-origin'], origin);
  assert.equal(allowed.headers['cache-control'], 'no-store');
  const denied = await app.inject({ method: 'OPTIONS', url: '/api/demo/submission', headers: {
    host: HOST, origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization',
  } });
  failure(denied, 403);
  const nullOrigin = await app.inject({ method: 'GET', url: '/api/demo', headers: { host: HOST, origin: 'null' } });
  failure(nullOrigin, 403);
});

test('structured logs exclude request bodies, unknown query values, headers and provider exceptions', async t => {
  const logs = [];
  const privateMarker = 'PRIVATE-LOG-MARKER-61729';
  const app = await fixture(t, { log: entry => logs.push(entry), analyzer: async () => { throw new Error(privateMarker); } });
  const data = await sent(app);
  failure(await post(app, '/submission', { ...sample(data), notes: privateMarker }), 400);
  const unknown = await app.inject({ method: 'GET', url: `/api/demo?private=${privateMarker}`, headers: { host: HOST, 'x-demo-admin-token': privateMarker } });
  assert.equal(unknown.statusCode, 200);
  success(await post(app, '/submission', sample(data)));
  const current = await get(app);
  failure(await post(app, '/analysis', analysisBinding(current)), 502);
  assert.ok(logs.length > 0);
  const serialized = JSON.stringify(logs);
  for (const value of [privateMarker, ADMIN, UNIQUE, 'Traffic grew 18%']) assert.ok(!serialized.includes(value));
  for (const entry of logs) {
    assert.ok(Object.keys(entry).every(key => ['requestId', 'method', 'route', 'status', 'code'].includes(key)));
  }
});

test('missing reset configuration disables reset instead of exposing a public reset action', async t => {
  const app = await fixture(t, { adminToken: '' });
  const initial = await get(app);
  failure(await reset(app, initial), 503);
  assert.deepEqual(await get(app), initial);
});

test('inconsistent saved state fails startup and is preserved for diagnosis rather than reset silently', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'evidencebridge-corrupt-qa-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = { databasePath: join(directory, 'state.sqlite'), adminToken: ADMIN, analysisMode: 'manual_simulation' };
  const app = await createApp(options);
  await app.ready();
  const original = await get(app);
  await app.close();
  const db = new DatabaseSync(options.databasePath);
  const stored = JSON.parse(db.prepare('SELECT state_json FROM demo_state WHERE id=1').get().state_json);
  stored.task.status = 'reviewed';
  db.prepare('UPDATE demo_state SET state_json=? WHERE id=1').run(JSON.stringify(stored));
  db.close();
  await assert.rejects(createApp(options), /inconsistent/i);
  const preserved = new DatabaseSync(options.databasePath);
  try {
    const current = JSON.parse(preserved.prepare('SELECT state_json FROM demo_state WHERE id=1').get().state_json);
    assert.equal(current.sessionId, original.sessionId);
    assert.equal(current.task.status, 'reviewed');
    assert.deepEqual(current.versions, []);
  } finally { preserved.close(); }
});

test('runtime configuration keeps local defaults and rejects invalid ports, modes, origins and credential bounds', () => {
  const defaults = loadConfig({});
  assert.equal(defaults.port, 8787);
  assert.equal(defaults.analysisMode, 'disabled');
  assert.equal(defaults.adminToken, '');
  assert.equal(defaults.apiKey, '');
  assert.equal(defaults.aiTimeoutMs, 20000);
  const explicit = loadConfig({ PORT: '8788', ANALYSIS_MODE: 'manual_simulation', AI_TIMEOUT_MS: '500', DEMO_ADMIN_TOKEN: ADMIN,
    ALLOWED_ORIGINS: 'http://localhost:5186, http://127.0.0.1:5173', OPENAI_MODEL: 'test-only-model', OPENAI_API_KEY: 'test-only-key' });
  assert.equal(explicit.port, 8788);
  assert.deepEqual(explicit.allowedOrigins, ['http://localhost:5186', 'http://127.0.0.1:5173']);
  for (const env of [
    { PORT: '0' }, { PORT: '65536' }, { PORT: '1.5' }, { PORT: 'abc' },
    { AI_TIMEOUT_MS: '99' }, { AI_TIMEOUT_MS: '60001' }, { AI_TIMEOUT_MS: '1.5' },
    { ANALYSIS_MODE: 'pretend-live' }, { DEMO_ADMIN_TOKEN: 'too-short' }, { DEMO_ADMIN_TOKEN: 'x'.repeat(257) },
    { ALLOWED_ORIGINS: '*' }, { ALLOWED_ORIGINS: 'http://outside.example' },
    { ALLOWED_ORIGINS: 'https://localhost:5186' }, { ALLOWED_ORIGINS: 'http://localhost:5186/path' },
    { ALLOWED_ORIGINS: 'http://localhost:5186/' }, { ALLOWED_ORIGINS: '' },
  ]) assert.throws(() => loadConfig(env));
});

test('a second service cannot share a live SQLite owner and closing releases only its own lock', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'evidencebridge-owner-qa-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = { databasePath: join(directory, 'state.sqlite'), adminToken: ADMIN, analysisMode: 'disabled' };
  const first = await createApp(options);
  await first.ready();
  const state = await get(first);
  await assert.rejects(createApp(options), /already open/i);
  assert.deepEqual(await get(first), state);
  await first.close();
  const successor = await createApp(options);
  await successor.ready();
  try { assert.deepEqual(await get(successor), state); }
  finally { await successor.close(); }
});

test('stored running analysis becomes interrupted after restart and its old pending receipt stops returning 202', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'evidencebridge-interrupted-qa-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = { databasePath: join(directory, 'state.sqlite'), adminToken: ADMIN, analysisMode: 'manual_simulation' };
  const first = await createApp(options);
  await first.ready();
  const { data } = await submitted(first);
  await first.close();
  const payload = analysisBinding(data);
  const db = new DatabaseSync(options.databasePath);
  const stored = JSON.parse(db.prepare('SELECT state_json FROM demo_state WHERE id=1').get().state_json);
  // Deterministic interruption fault injection; no live model or candidate data involved.
  stored.versions[0].analysis = { status: 'running', attemptId: 'qa-interrupted-attempt', submissionId: data.submission.submissionId,
    contentFingerprint: data.submission.contentFingerprint, startedAt: '2026-09-19T02:00:00.000Z', finishedAt: null, errorCode: null, result: null };
  db.prepare('UPDATE demo_state SET state_json=? WHERE id=1').run(JSON.stringify(stored));
  db.prepare('INSERT INTO idempotency VALUES(?,?,?,?,?,?)').run(data.sessionId, '/api/demo/analysis', 'interrupted-analysis-key', fingerprint(payload), 202,
    JSON.stringify({ data: { ...data, analysis: stored.versions[0].analysis }, meta: { replayed: false } }));
  db.close();
  const restored = await createApp(options);
  await restored.ready();
  try {
    const recovered = await get(restored);
    assert.equal(recovered.analysis.status, 'failed');
    assert.equal(recovered.analysis.errorCode, 'AI_INTERRUPTED');
    assert.deepEqual(recovered.submission, data.submission);
    const oldReceipt = await post(restored, '/analysis', payload, { key: 'interrupted-analysis-key' });
    failure(oldReceipt, 503);
    assert.equal(oldReceipt.json().error.code, 'AI_INTERRUPTED');
    success(await post(restored, '/analysis', payload, { key: 'new-analysis-after-interruption' }));
    assert.equal((await get(restored)).analysis.status, 'succeeded');
  } finally { await restored.close(); }
});

test('API provenance contract: injected test-only live output becomes replay on GET and retry', async t => {
  const manual = createAnalyzer({ mode: 'manual_simulation' });
  let calls = 0;
  const app = await fixture(t, { analyzer: async submission => {
    calls += 1;
    const output = await manual(submission);
    // This stub tests transport labels only. No actual model request occurs.
    output.mode = 'live'; output.model = 'TEST-STUB-NOT-A-REAL-MODEL';
    output.provenance.provider = 'openai'; output.provenance.responseId = 'TEST-STUB-response-001';
    return output;
  } });
  const { data } = await submitted(app);
  const payload = analysisBinding(data);
  const response = await post(app, '/analysis', payload, { key: 'stub-mode-analysis-key' });
  const justProduced = success(response);
  assert.equal(justProduced.analysis.result.mode, 'live');
  const read = await get(app);
  assert.equal(read.analysis.result.mode, 'replay');
  assert.equal(read.analysis.result.provenance.responseId, 'TEST-STUB-response-001');
  const retry = await post(app, '/analysis', payload, { key: 'stub-mode-analysis-key' });
  const retried = success(retry);
  assert.equal(retried.analysis.result.mode, 'replay');
  assert.equal(retry.json().meta.replayed, true);
  success(await post(app, '/analysis', payload, { key: 'stub-mode-new-key-cached' }));
  assert.equal(calls, 1);
  assert.equal(read.review, null);
});
