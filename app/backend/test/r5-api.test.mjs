import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRevision5App } from '../dist/r5/app.js';
import { createTargetAnalyzer } from '../dist/r5/analysis.js';
import { AnalysisError } from '../dist/analysis.js';

// Independent product assertions. TEST-STUB/manual rules only: zero external model calls.
const HOST = '127.0.0.1:8787';
const ADMIN = 'R5-TEST-STUB-admin-token-synthetic';
const PEOPLE = ['alex-chen', 'maya-patel', 'leo-zhang', 'sam-taylor'];
const TEMPLATES = [
  { targetRequirementId: 'sql', templateId: 'harbourcart-sql-v1', criterionIds: ['S1', 'S2', 'S3'] },
  { targetRequirementId: 'data-analysis', templateId: 'harbourcart-data-analysis-v1', criterionIds: ['D1', 'D2', 'D3'] },
  { targetRequirementId: 'business-problem-solving', templateId: 'harbourcart-bps-v1', criterionIds: ['B1', 'B2', 'B3', 'B4'] },
];
const CRITERIA = ['S1', 'S2', 'S3', 'D1', 'D2', 'D3', 'B1', 'B2', 'B3', 'B4'];
const MORE = 'TEST-STUB public review: identify a matched comparison and show what different results would mean; retain uncertainty.';
async function fixture(t, options = {}) {
  const app = await createRevision5App({ databasePath: ':memory:', adminToken: ADMIN, analysisMode: 'manual_simulation', ...options });
  await app.ready(); t.after(() => app.close()); return app;
}
function ok(response, status = 200) {
  assert.equal(response.statusCode, status, response.body);
  const body = response.json(); assert.equal(typeof body.meta.replayed, 'boolean'); return body.data;
}
function error(response, statuses = [400, 409], code) {
  assert.ok(statuses.includes(response.statusCode), response.body);
  const payload = response.json(); assert.equal(typeof payload.error?.code, 'string');
  assert.equal(typeof payload.error.requestId, 'string'); assert.equal(typeof payload.error.retryable, 'boolean');
  assert.equal(Object.hasOwn(payload, 'data'), false); if (code) assert.equal(payload.error.code, code); return payload;
}
async function read(app, person = PEOPLE[0]) {
  return ok(await app.inject({ method: 'GET', url: `/api/demo?candidateId=${person}`, headers: { host: HOST } }));
}
async function comparison(app) {
  return ok(await app.inject({ method: 'GET', url: '/api/demo/comparison', headers: { host: HOST } }));
}
function post(app, path, payload, key = randomUUID(), headers = {}) {
  return app.inject({ method: 'POST', url: `/api/demo${path}`, headers: {
    host: HOST, 'content-type': 'application/json', 'idempotency-key': key, ...headers,
  }, payload });
}
function base(d) { return { schemaVersion: '3.0', sessionId: d.sessionId, candidateId: d.candidate.id, jobId: d.job.id, datasetVersion: d.datasetVersion }; }
function binding(d) { return { ...base(d), taskId: d.task.taskId, targetRequirementId: d.task.targetRequirementId }; }
function sendBody(d, template = TEMPLATES[2]) {
  return { ...binding(d), targetRequirementId: template.targetRequirementId, templateId: template.templateId,
    instructions: 'TEST-STUB fixed-template task instructions: show your original work, limitations and checks.',
    gapReason: 'TEST-STUB: application material leaves a specific verification gap.' };
}
async function send(app, person = PEOPLE[0], template = TEMPLATES[2]) { return ok(await post(app, '/task/send', sendBody(await read(app, person), template))); }
function sample(d, version = 1, overrides = {}) {
  return { ...binding(d), submissionVersion: version,
    previousSubmissionId: version === 2 ? d.submission.submissionId : null,
    previousContentFingerprint: version === 2 ? d.submission.contentFingerprint : null,
    summary: `TEST-STUB ${d.candidate.id} V${version}: 🔎 中文\nSame sourceId summary; distinct person and version. Paid Search conversion fell from 3.2% to 1.8%. A cause remains unknown.`,
    findings: [], processEvidence: [], ...overrides };
}
async function first(app, person = PEOPLE[0], template = TEMPLATES[2], overrides = {}) {
  const d = await send(app, person, template); return ok(await post(app, '/submission', sample(d, 1, overrides)), 201);
}
function analysisBody(d) { return { ...binding(d), submissionId: d.submission.submissionId, contentFingerprint: d.submission.contentFingerprint }; }
function reviewBody(d, decision = 'confirm') { return { ...analysisBody(d), decision, comment: MORE }; }
async function unchanged(app, person, action, statuses = [400, 409]) {
  const before = await read(app, person); error(await action(), statuses); assert.deepEqual(await read(app, person), before);
}

for (const person of PEOPLE) for (const template of TEMPLATES) {
  test(`R5 ${person} / ${template.targetRequirementId}: thin V1 → More → independent V2, fixed target and no V3`, async t => {
    const app = await fixture(t); const initial = await read(app, person);
    assert.equal(initial.schemaVersion, '3.0'); assert.equal(initial.candidate.id, person);
    assert.equal(initial.workflow.canSubmit, false); assert.deepEqual(initial.versions, []);
    const sent = await send(app, person, template);
    assert.equal(sent.task.targetRequirementId, template.targetRequirementId);
    assert.equal(sent.workflow.canSubmit, true);
    await unchanged(app, person, () => post(app, '/task/send', sendBody(sent, template)));
    const one = ok(await post(app, '/submission', sample(sent)), 201);
    assert.equal(one.submission.candidateId, person); assert.equal(one.workflow.canSubmit, false);
    assert.equal(one.analysis.status, 'not_started'); assert.equal(one.review, null);
    await unchanged(app, person, () => post(app, '/submission', sample(one, 2)));
    const waiting = ok(await post(app, '/review', reviewBody(one, 'needs_more_evidence')));
    assert.equal(waiting.task.status, 'awaiting_revision'); assert.equal(waiting.workflow.canResubmit, true);
    assert.equal(waiting.review.comment, MORE); assert.equal(waiting.workflow.nextSubmissionVersion, 2);
    const frozenV1 = structuredClone(waiting.versions[0]);
    const input = sample(waiting, 2); const key = randomUUID();
    const two = ok(await post(app, '/submission', input, key), 201);
    assert.deepEqual(two.versions[0], frozenV1); assert.equal(two.versions.length, 2);
    assert.equal(two.submission.previousSubmissionId, one.submission.submissionId);
    assert.equal(two.submission.previousContentFingerprint, one.submission.contentFingerprint);
    assert.notEqual(two.submission.submissionId, one.submission.submissionId);
    assert.notEqual(two.submission.contentFingerprint, one.submission.contentFingerprint);
    assert.equal(two.analysis.status, 'not_started'); assert.equal(two.review, null);
    const replay = await post(app, '/submission', input, key); ok(replay, 201);
    assert.equal(replay.json().meta.replayed, true); assert.deepEqual(await read(app, person), two);
    for (const action of [
      () => post(app, '/analysis', analysisBody(one)),
      () => post(app, '/review', reviewBody(one)),
      () => post(app, '/review', reviewBody(two, 'needs_more_evidence')),
      () => post(app, '/submission', sample(two, 2, { submissionVersion: 3 })),
    ]) await unchanged(app, person, action);
    const decision = PEOPLE.indexOf(person) % 2 ? 'evidence_still_insufficient' : 'confirm';
    const done = ok(await post(app, '/review', reviewBody(two, decision)));
    assert.equal(done.workflow.isTerminal, true); assert.equal(done.workflow.canSubmit, false);
    assert.equal(done.workflow.remainingSubmissions, 0); assert.deepEqual(done.versions[0], frozenV1);
    assert.equal(done.report.requirements.find(r => r.requirementId === template.targetRequirementId).status, decision === 'confirm' ? 'verified' : 'uncertain');
    for (const r of initial.report.requirements.filter(r => r.requirementId !== template.targetRequirementId)) {
      assert.deepEqual(done.report.requirements.find(item => item.requirementId === r.requirementId), r);
    }
    await unchanged(app, person, () => post(app, '/review', reviewBody(done)));
    for (const other of PEOPLE.filter(id => id !== person)) assert.deepEqual((await read(app, other)).versions, []);
  });
}
for (const person of PEOPLE) for (const decision of ['confirm', 'evidence_still_insufficient']) {
  test(`R5 ${person}: V1 ${decision} remains terminal with one unused capacity slot`, async t => {
    const app = await fixture(t); const one = await first(app, person, TEMPLATES[PEOPLE.indexOf(person) % 3]);
    const done = ok(await post(app, '/review', reviewBody(one, decision)));
    assert.equal(done.workflow.isTerminal, true); assert.equal(done.workflow.remainingSubmissions, 1);
    assert.equal(done.workflow.canSubmit, false); assert.equal(done.workflow.canResubmit, false);
    await unchanged(app, person, () => post(app, '/submission', sample(done, 2)));
    await unchanged(app, person, () => post(app, '/review', reviewBody(done, 'needs_more_evidence')));
  });
}

test('R5 explicit candidate selection and strict public ownership DTOs', async t => {
  const app = await fixture(t);
  for (const url of ['/api/demo', '/api/demo?candidateId=unknown', '/api/demo?candidateId=alex-chen&extra=value']) {
    error(await app.inject({ method: 'GET', url, headers: { host: HOST } }), [400]);
  }
  const d = await read(app); const body = sendBody(d);
  for (const field of ['schemaVersion', 'sessionId', 'candidateId', 'jobId', 'datasetVersion', 'taskId', 'targetRequirementId', 'templateId']) {
    const missing = { ...body }; delete missing[field]; await unchanged(app, PEOPLE[0], () => post(app, '/task/send', missing), [400]);
  }
  for (const patch of [{ sessionId: 'stale-session' }, { taskId: 'another-task' }, { jobId: 'another-job' },
    { datasetVersion: 'stale-dataset' }, { targetRequirementId: 'sql' }, { candidateId: PEOPLE[1] }]) {
    const both = await Promise.all(PEOPLE.slice(0, 2).map(id => read(app, id)));
    error(await post(app, '/task/send', { ...body, ...patch }));
    assert.deepEqual(await Promise.all(PEOPLE.slice(0, 2).map(id => read(app, id))), both);
  }
});

test('R5 global operation key never returns a different candidate receipt; same request replays once', async t => {
  const app = await fixture(t); const a = await read(app, PEOPLE[0]); const b = await read(app, PEOPLE[1]);
  const key = randomUUID(); const request = sendBody(a); const result = await post(app, '/task/send', request, key); ok(result);
  const replay = await post(app, '/task/send', request, key); ok(replay); assert.equal(replay.json().meta.replayed, true);
  assert.deepEqual(replay.json().data, result.json().data);
  await unchanged(app, PEOPLE[1], () => post(app, '/task/send', sendBody(b, TEMPLATES[0]), key), [409]);
  await unchanged(app, PEOPLE[0], () => post(app, '/task/send', { ...request, gapReason: 'Changed request content.' }, key), [409]);
  ok(await post(app, '/reset', { schemaVersion:'3.0', sessionId:a.sessionId }, randomUUID(), { 'x-demo-admin-token': ADMIN }));
  await unchanged(app, PEOPLE[0], () => post(app, '/task/send', request, key), [409]);
});

test('R5 private fields, request limits and public review comment constraints preserve all state', async t => {
  const logs = []; const app = await fixture(t, { log: e => logs.push(e) }); const d = await send(app);
  const secret = 'TEST-STUB-PRIVATE-NOTES-92741'; const valid = sample(d);
  const finding = { id: 'same-id', section: 'Key Findings', title: 'Finding', detail: 'Detail', source: 'website_traffic.csv', confidence: 'Low' };
  const event = { id: 'same-event', at: '2026-09-19T00:00:00.000Z', title: 'Synthetic click' };
  for (const payload of [
    { ...valid, notes: secret }, { ...valid, findings: [{ ...finding, notes: secret }] },
    { ...valid, processEvidence: [{ ...event, notes: secret }] },
    { ...valid, findings: Array.from({ length: 41 }, (_, i) => ({ ...finding, id: `finding-${i}` })) },
    { ...valid, processEvidence: Array.from({ length: 101 }, (_, i) => ({ ...event, id: `event-${i}` })) },
  ]) await unchanged(app, PEOPLE[0], () => post(app, '/submission', payload), [400]);
  await unchanged(app, PEOPLE[0], () => post(app, '/submission', { ...valid, summary: 'x'.repeat(129 * 1024) }), [413]);
  const one = ok(await post(app, '/submission', valid), 201);
  for (const comment of ['', '   ', 'x'.repeat(2001)]) await unchanged(app, PEOPLE[0], () => post(app, '/review', { ...reviewBody(one), comment }), [400]);
  assert.equal(JSON.stringify(logs).includes(secret), false); assert.equal(JSON.stringify(await read(app)).includes(secret), false);
  assert.ok(logs.every(e => Object.keys(e).every(key => ['requestId', 'method', 'route', 'status', 'code'].includes(key))));
});

test('R5 local Origin/Host enforcement, administrator reset and old-session invalidation', async t => {
  const app = await fixture(t); const before = await read(app);
  for (const headers of [{ host: 'other.invalid:8787' }, { host: HOST, origin: 'null' },
    { host: HOST, origin: 'http://127.0.0.1:5173.attacker.invalid' }, { host: HOST, 'sec-fetch-site': 'cross-site' }]) {
    error(await app.inject({ method: 'GET', url: '/api/demo?candidateId=alex-chen', headers }), [403]);
  }
  const reset = { schemaVersion: '3.0', sessionId: before.sessionId };
  for (const headers of [{}, { 'x-demo-admin-token': 'wrong-token' }]) await unchanged(app, PEOPLE[0], () => post(app, '/reset', reset, randomUUID(), headers), [403]);
  const rows = await Promise.all(PEOPLE.map(person => first(app, person)));
  const prior = rows[0]; ok(await post(app, '/reset', reset, randomUUID(), { 'x-demo-admin-token': ADMIN }));
  for (const person of PEOPLE) {
    const clean = await read(app, person); assert.notEqual(clean.sessionId, before.sessionId); assert.deepEqual(clean.versions, []);
    assert.equal(clean.analysis.status, 'not_started'); assert.equal(clean.review, null);
  }
  await unchanged(app, PEOPLE[0], () => post(app, '/review', reviewBody(prior)), [409]);
});

function snapshot(d, stage = 'application_review') {
  if (stage === 'application_review') return d.application;
  const version = d.versions.find(v => `task_v${v.submission.submissionVersion}` === stage);
  assert.ok(version); return { candidateId: d.candidate.id, evidenceSnapshotId: version.evidenceSnapshotId,
    fingerprint: version.submission.contentFingerprint, sources: version.submission.sources };
}
function refFor(s, source = s.sources[0], quote = source.text.slice(0, Math.min(100, source.text.length))) {
  const start = source.text.indexOf(quote); assert.ok(start >= 0);
  return { candidateId: s.candidateId, evidenceSnapshotId: s.evidenceSnapshotId, fingerprint: s.fingerprint,
    sourceId: source.sourceId, location: source.location, start, end: start + quote.length, quote };
}
function itemFor(s, criterionId, mark = 2, ref = refFor(s)) {
  return { criterionId, mark, rationale: 'TEST-STUB engineering annotation: inspect literal evidence; not a human-calibration result.',
    support: mark === 'NE' ? 'No adequate support located in the inspected scope.' : 'Literal material is present for this synthetic validation.',
    gaps: 'Verification and independent completion remain open.', uncertainty: 'Synthetic test annotations do not measure actual person ability.',
    nextStep: 'Ask the reviewer to inspect the attached source and criterion.', checkedSourceIds: [ref.sourceId], sourceRefs: mark === 'NE' ? [] : [ref] };
}
function assessmentBody(d, stage = 'application_review', marks, reuseApplication = null) {
  const s = snapshot(d, stage); const ids = stage === 'application_review' ? CRITERIA : TEMPLATES.find(x => x.targetRequirementId === d.task.targetRequirementId).criterionIds;
  return { ...base(d), stage, evidenceSnapshotId: s.evidenceSnapshotId, fingerprint: s.fingerprint,
    submissionId: stage === 'application_review' ? null : d.submission.submissionId,
    contentFingerprint: stage === 'application_review' ? null : d.submission.contentFingerprint,
    rubricVersion: d.rubricVersion, expectedAssessmentRevision: d.assessment[stage]?.assessmentRevision ?? 0,
    items: ids.map((id, i) => itemFor(s, id, marks?.[i] ?? 2)), reuseApplication, operatorLabel: 'TEST-STUB, automated engineering validation' };
}
function shortlistBody(d, action = 'retain', stage = 'application_review') {
  const s = snapshot(d, stage); return { ...base(d), action, reason: `TEST-STUB human-controlled ${action}: bounded material support, pending real verification.`,
    stage, evidenceSnapshotId: s.evidenceSnapshotId, fingerprint: s.fingerprint,
    assessmentRevision: d.assessment[stage]?.assessmentRevision ?? null, rubricVersion: d.rubricVersion,
    expectedShortlistRevision: d.shortlist.revision, operatorLabel: 'TEST-STUB synthetic reviewer' };
}
function verifyItems(s, items) {
  for (const item of items) {
    assert.ok(item.rationale && item.support && item.gaps && item.uncertainty && item.nextStep);
    assert.ok(item.checkedSourceIds.length); for (const id of item.checkedSourceIds) assert.ok(s.sources.some(x => x.sourceId === id));
    for (const ref of item.sourceRefs) {
      assert.equal(ref.candidateId, s.candidateId); assert.equal(ref.evidenceSnapshotId, s.evidenceSnapshotId); assert.equal(ref.fingerprint, s.fingerprint);
      const source = s.sources.find(x => x.sourceId === ref.sourceId); assert.ok(source); assert.equal(ref.location, source.location);
      assert.equal(source.text.slice(ref.start, ref.end), ref.quote);
    }
    if (item.mark !== 'NE') assert.ok(item.sourceRefs.length);
  }
}

test('R5 company/rubric/application fixtures expose four owned immutable evidence sets and genuine source links', async t => {
  const app = await fixture(t); const c = await comparison(app);
  assert.equal(c.stage, 'application_review'); assert.equal(c.candidates.length, 4);
  assert.deepEqual(c.candidates.map(row => row.candidate.id).sort(), [...PEOPLE].sort());
  assert.equal(c.company.name, 'HarbourCart Pty Ltd'); assert.equal(c.company.approximateHeadcount, 25);
  assert.equal(c.rubric.criteria.length, 10); assert.deepEqual(c.rubric.requirements.map(r => r.maxScore), [30, 30, 40]);
  assert.equal(c.rubric.calibrationStatus, 'human_calibration_pending');
  const fingerprints = new Set();
  for (const person of PEOPLE) {
    const d = await read(app, person); assert.equal(d.application.candidateId, person);
    assert.equal(d.application.provenance, 'synthetic'); fingerprints.add(d.application.fingerprint);
    assert.equal(d.application.baseline.label, '合成案例·预置人工评估');
    assert.equal(d.application.baseline.provenance.humanCalibration, 'pending');
    verifyItems(d.application, d.application.baseline.items);
    assert.equal(d.assessment.application_review.assessmentRevision, 1); assert.equal(d.assessment.task_v1, null);
    assert.equal(d.assessment.task_v2, null); assert.equal(d.shortlist.status, 'not_retained');
    for (const criterion of d.rubric.criteria) for (const mark of [0, 2, 4]) assert.ok(criterion.anchors[mark]);
  }
  assert.equal(fingerprints.size, 4);
});

const VECTORS = [
  { name: 'A', marks: [3,3,3,3,3,3,2,2,'NE','NE'], skills: ['75.0','75.0',null], coverage: 80, accrued: 55, total: null },
  { name: 'B', marks: [2,2,'NE',3,3,3,3,3,3,3], skills: [null,'75.0','75.0'], coverage: 90, accrued: 62.5, total: null },
  { name: 'C', marks: [3,3,3,4,3,3,3,3,3,4], skills: ['75.0','83.3','81.3'], coverage: 100, accrued: 80, total: 80 },
  { name: 'D', marks: [4,4,3,3,3,2,2,1,1,1], skills: ['91.7','66.7','31.3'], coverage: 100, accrued: 60, total: 60 },
];
for (const vector of VECTORS) test(`R5 independent arithmetic oracle ${vector.name}: complete groups, NE and unrounded sums`, async t => {
  const app = await fixture(t); const d = await read(app); const baseline = structuredClone(d.application.baseline);
  // All four numerical vectors use one test-only review context; they are not the four preset people.
  const updated = ok(await post(app, '/assessment', assessmentBody(d, 'application_review', vector.marks)), 201);
  const a = updated.assessment.application_review; const score = a.score;
  assert.equal(a.assessmentRevision, 2); assert.equal(score.accruedScore, vector.accrued);
  assert.equal(score.coveragePercent, vector.coverage); assert.equal(score.overallScore, vector.total);
  assert.equal(score.overallPercentage, vector.total);
  assert.deepEqual(score.skills.map(s => s.percentage === null ? null : s.percentage.toFixed(1)), vector.skills);
  assert.deepEqual(score.criteria.map(c => c.contribution), vector.marks.map(mark => mark === 'NE' ? null : mark / 4 * 10));
  assert.equal(score.status, vector.total === null ? 'needs_evidence' : 'complete');
  assert.deepEqual(updated.application.baseline, baseline); assert.equal(updated.assessment.history.length, 2);
  assert.deepEqual(updated.assessment.history[0], d.assessment.history[0]);
});

test('R5 assessment validation is atomic, history-preserving and enforces owned exact UTF-16 citations', async t => {
  const app = await fixture(t); const d = await read(app); const valid = assessmentBody(d);
  const other = await read(app, PEOPLE[1]); const otherSource = other.application.sources.find(s => s.sourceId === 'cv.md') ?? other.application.sources[0];
  for (const change of [
    body => { body.items[9].mark = 5; }, body => { body.items[9].mark = -1; }, body => { body.items[9].mark = 1.5; },
    body => { body.items[9].criterionId = body.items[0].criterionId; }, body => { body.items.pop(); },
    body => { body.items[9].sourceRefs[0].quote = 'Fabricated excerpt'; },
    body => { body.items[9].sourceRefs[0].fingerprint = '0'.repeat(64); },
    body => { body.items[9].sourceRefs[0] = refFor(other.application, otherSource); },
    body => { body.items[9].sourceRefs = []; }, body => { body.items[9].checkedSourceIds = ['missing-source']; },
    body => { body.fingerprint = '0'.repeat(64); }, body => { body.rubricVersion = 'stale-rubric'; },
    body => { body.expectedAssessmentRevision = 0; }, body => { body.overallScore = 100; },
  ]) {
    const bad = structuredClone(valid); change(bad); await unchanged(app, PEOPLE[0], () => post(app, '/assessment', bad));
  }
  const one = await first(app); const source = one.submission.sources.find(s => s.sourceId === 'summary');
  const quote = '🔎 中文\nSame sourceId'; const ref = refFor(snapshot(one, 'task_v1'), source, quote);
  const body = assessmentBody(one, 'task_v1'); body.items = body.items.map(item => ({ ...item, sourceRefs: [ref], checkedSourceIds: [source.sourceId] }));
  const accepted = ok(await post(app, '/assessment', body), 201);
  assert.equal(accepted.assessment.task_v1.assessmentRevision, 1); verifyItems(snapshot(accepted, 'task_v1'), accepted.assessment.task_v1.items);
  const broken = assessmentBody(accepted, 'task_v1'); broken.items[0].sourceRefs = [{ ...ref, start: ref.start + 1 }];
  await unchanged(app, PEOPLE[0], () => post(app, '/assessment', broken), [400]);
});

test('R5 same sourceId across people and versions never grants evidence ownership', async t => {
  const app = await fixture(t); const a = await first(app, PEOPLE[0]); const b = await first(app, PEOPLE[1]);
  assert.equal(a.submission.sources[0].sourceId, b.submission.sources[0].sourceId);
  const wrong = assessmentBody(b, 'task_v1'); wrong.items[0].sourceRefs = [refFor(snapshot(a, 'task_v1'))];
  const beforeA = await read(app, PEOPLE[0]); await unchanged(app, PEOPLE[1], () => post(app, '/assessment', wrong), [400]);
  assert.deepEqual(await read(app, PEOPLE[0]), beforeA);
  for (const endpoint of ['analysis', 'review']) {
    const body = endpoint === 'analysis' ? analysisBody(a) : reviewBody(a);
    await unchanged(app, PEOPLE[1], () => post(app, `/${endpoint}`, { ...body, candidateId: PEOPLE[1], taskId: b.task.taskId }), [409]);
  }
  const waiting = ok(await post(app, '/review', reviewBody(a, 'needs_more_evidence')));
  const two = ok(await post(app, '/submission', sample(waiting, 2)), 201);
  const oldRef = assessmentBody(two, 'task_v2'); oldRef.items[0].sourceRefs = [refFor(snapshot(a, 'task_v1'))];
  await unchanged(app, PEOPLE[0], () => post(app, '/assessment', oldRef), [400]);
});

test('R5 0, NE, not_started and explicit non-target application reuse remain distinct on V1/V2', async t => {
  const app = await fixture(t); const one = await first(app, PEOPLE[1], TEMPLATES[0]);
  assert.equal(one.assessment.task_v1, null);
  const blank = ok(await post(app, '/assessment', assessmentBody(one, 'task_v1', ['NE','NE','NE'])), 201);
  const score = blank.assessment.task_v1.score;
  assert.equal(score.overallPercentage, null); assert.equal(score.coveragePercent, null);
  assert.equal(score.skills[0].assessmentComplete, true); assert.equal(score.skills[0].neCount, 3);
  assert.equal(score.skills[1].pendingCount, 3); assert.equal(score.skills[1].neCount, 0);
  const appAssessment = blank.assessment.application_review;
  const reuse = { assessmentRevision: appAssessment.assessmentRevision, evidenceSnapshotId: appAssessment.evidenceSnapshotId, fingerprint: appAssessment.fingerprint };
  const revised = ok(await post(app, '/assessment', assessmentBody(blank, 'task_v1', [0,0,0], reuse)), 201);
  assert.equal(revised.assessment.task_v1.score.skills[0].percentage, 0); assert.equal(revised.assessment.task_v1.score.skills[0].neCount, 0);
  assert.deepEqual(revised.assessment.task_v1.reuseApplication, reuse);
  assert.deepEqual(revised.assessment.task_v1.reusedItems, appAssessment.items.filter(i => !i.criterionId.startsWith('S')));
  for (const item of revised.assessment.task_v1.reusedItems) verifyItems(revised.application, [item]);
  const appChanged = ok(await post(app, '/assessment', assessmentBody(revised)), 201);
  await unchanged(app, PEOPLE[1], () => post(app, '/assessment', assessmentBody(appChanged, 'task_v1', [2,2,2], reuse)), [409]);
  const waiting = ok(await post(app, '/review', reviewBody(appChanged, 'needs_more_evidence')));
  const two = ok(await post(app, '/submission', sample(waiting, 2)), 201);
  assert.equal(two.assessment.task_v2, null); assert.deepEqual(two.assessment.task_v1, revised.assessment.task_v1);
  const taskOnly = ok(await post(app, '/assessment', assessmentBody(two, 'task_v2', [2,2,2])), 201);
  assert.equal(taskOnly.assessment.task_v2.score.skills[1].pendingCount, 3); assert.deepEqual(taskOnly.assessment.task_v2.reusedItems, []);
  const done = ok(await post(app, '/review', reviewBody(taskOnly)));
  const afterScoreEdit = ok(await post(app, '/assessment', assessmentBody(done, 'task_v2', [3,3,3])), 201);
  assert.deepEqual(afterScoreEdit.review, done.review); assert.equal(afterScoreEdit.workflow.isTerminal, true);
  await unchanged(app, PEOPLE[1], () => post(app, '/review', reviewBody(afterScoreEdit)), [409]);
});

test('R5 four-person shortlist is independent, reversible, versioned and stale on new work or basis assessment', async t => {
  const app = await fixture(t);
  for (const person of PEOPLE) {
    const d = await read(app, person); const retained = ok(await post(app, '/shortlist', shortlistBody(d)));
    assert.equal(retained.shortlist.status, 'retained'); assert.deepEqual(retained.assessment, d.assessment); assert.deepEqual(retained.review, d.review);
    await unchanged(app, person, () => post(app, '/shortlist', shortlistBody(retained)), [409]);
  }
  const c = await comparison(app); assert.equal(c.candidates.filter(p => p.shortlist.status === 'retained').length, 4);
  let d = await read(app, PEOPLE[3]); const oldBasis = structuredClone(d.shortlist.basis); const oldReason = d.shortlist.reason;
  d = ok(await post(app, '/assessment', assessmentBody(d)), 201);
  assert.equal(d.shortlist.status, 'needs_reconfirmation'); assert.deepEqual(d.shortlist.basis, oldBasis); assert.equal(d.shortlist.reason, oldReason);
  d = ok(await post(app, '/shortlist', shortlistBody(d, 'reconfirm'))); assert.equal(d.shortlist.status, 'retained');
  const retainedHistory = structuredClone(d.shortlist.history);
  d = ok(await post(app, '/task/send', sendBody(d))); assert.equal(d.shortlist.status, 'retained');
  d = ok(await post(app, '/submission', sample(d)), 201); assert.equal(d.shortlist.status, 'needs_reconfirmation');
  assert.deepEqual(d.shortlist.history, retainedHistory);
  d = ok(await post(app, '/shortlist', shortlistBody(d, 'reconfirm')));
  d = ok(await post(app, '/assessment', assessmentBody(d, 'task_v1')), 201);
  assert.equal(d.shortlist.status, 'retained', 'unrelated task assessment does not invalidate a still-matching application basis');
  const scoreBefore = structuredClone(d.assessment);
  d = ok(await post(app, '/review', reviewBody(d, 'evidence_still_insufficient'))); assert.equal(d.shortlist.status, 'retained');
  d = ok(await post(app, '/shortlist', shortlistBody(d, 'remove'))); assert.equal(d.shortlist.status, 'not_retained');
  assert.deepEqual(d.assessment, scoreBefore); assert.equal((await comparison(app)).candidates.length, 4);
  await unchanged(app, PEOPLE[3], () => post(app, '/shortlist', shortlistBody(d, 'reconfirm')), [409]);
  d = ok(await post(app, '/shortlist', shortlistBody(d))); assert.equal(d.shortlist.status, 'retained');
  assert.ok(d.shortlist.history.length >= 5);
});

test('R5 retaining unassessed task records null basis and new task assessment requires reconfirmation', async t => {
  const app = await fixture(t); let d = await first(app, PEOPLE[2], TEMPLATES[1]);
  assert.equal(d.shortlist.status, 'not_retained');
  const request = shortlistBody(d, 'retain', 'task_v1'); assert.equal(request.assessmentRevision, null);
  d = ok(await post(app, '/shortlist', request)); const history = structuredClone(d.shortlist.history);
  d = ok(await post(app, '/assessment', assessmentBody(d, 'task_v1')), 201);
  assert.equal(d.shortlist.status, 'needs_reconfirmation'); assert.equal(d.shortlist.basis.assessmentRevision, null);
  assert.deepEqual(d.shortlist.history, history);
  await unchanged(app, PEOPLE[2], () => post(app, '/shortlist', { ...shortlistBody(d, 'reconfirm', 'task_v1'), assessmentRevision: null }), [409]);
  const done = ok(await post(app, '/shortlist', shortlistBody(d, 'reconfirm', 'task_v1'))); assert.equal(done.shortlist.status, 'retained');
  const waiting = ok(await post(app, '/review', reviewBody(done, 'needs_more_evidence')));
  const two = ok(await post(app, '/submission', sample(waiting, 2)), 201);
  assert.equal(two.shortlist.status, 'needs_reconfirmation'); assert.deepEqual(two.shortlist.basis, done.shortlist.basis);
  assert.deepEqual(two.shortlist.history, done.shortlist.history); assert.equal(two.assessment.task_v2, null);
  const removed = ok(await post(app, '/shortlist', { ...shortlistBody(two, 'remove', 'task_v1'), ...done.shortlist.basis }));
  assert.equal(removed.shortlist.status, 'not_retained'); assert.equal(removed.shortlist.history.at(-1).basis.stage, 'task_v1');
});

for (const template of TEMPLATES) test(`R5 ${template.targetRequirementId} analysis observes its own dimensions and literal current sources`, async t => {
  const app = await fixture(t); const d = await first(app, PEOPLE[0], template);
  const analyzed = ok(await post(app, '/analysis', analysisBody(d)));
  assert.equal(analyzed.analysis.status, 'succeeded'); assert.equal(analyzed.analysis.result.mode, 'manual_simulation');
  const expected = template.targetRequirementId === 'business-problem-solving'
    ? ['Problem Framing','Evidence Navigation','Hypothesis Formation','Evidence Seeking','Decision Making'] : template.criterionIds;
  assert.deepEqual(analyzed.analysis.result.observations.map(o => o.dimension), expected);
  for (const observation of analyzed.analysis.result.observations) for (const ref of observation.citations) {
    const source = d.submission.sources.find(s => s.sourceId === ref.sourceId); assert.ok(source);
    assert.equal(source.location, ref.location); assert.equal(source.text.slice(ref.start, ref.end), ref.quote);
  }
  assert.equal(analyzed.review, null); assert.equal(analyzed.assessment.task_v1, null); assert.equal(analyzed.shortlist.status, 'not_retained');
});

test('R5 disabled and failing analysis preserve public work and allow independent manual evidence review', async t => {
  for (const options of [{ analysisMode: 'disabled' }, { analyzer: async () => { throw Error('TEST-STUB provider failure with PRIVATE_PROVIDER_PAYLOAD'); } }]) {
    const app = await fixture(t, options); const one = await first(app); const failed = await post(app, '/analysis', analysisBody(one));
    error(failed, [502,503]); assert.equal(failed.body.includes('PRIVATE_PROVIDER_PAYLOAD'), false);
    const after = await read(app); assert.equal(after.analysis.status, 'failed'); assert.equal(after.analysis.result, null);
    assert.deepEqual(after.submission, one.submission); const done = ok(await post(app, '/review', reviewBody(after)));
    assert.equal(done.workflow.isTerminal, true); assert.equal(done.assessment.task_v1, null);
  }
});

for (const closure of ['review', 'reset', 'v2']) test(`R5 delayed analysis after ${closure} never overwrites a different session/version/state`, { timeout: 20000 }, async t => {
  let release; let announce; const entered = new Promise(resolve => { announce = resolve; });
  const manual = createTargetAnalyzer({ mode: 'manual_simulation' });
  t.after(() => release?.());
  const app = await fixture(t, { analyzer: async input => { announce(); await new Promise(resolve => { release = resolve; }); return manual(input); } });
  const d = await first(app); const key = randomUUID(); const pending = post(app, '/analysis', analysisBody(d), key).then(response => response);
  await entered;
  const replay = await post(app, '/analysis', analysisBody(d), key); ok(replay, 202); assert.equal(replay.json().meta.replayed, true);
  if (closure === 'reset') ok(await post(app, '/reset', { schemaVersion:'3.0', sessionId:d.sessionId }, randomUUID(), { 'x-demo-admin-token': ADMIN }));
  else {
    const reviewed = ok(await post(app, '/review', reviewBody(d, closure === 'v2' ? 'needs_more_evidence' : 'confirm')));
    if (closure === 'v2') ok(await post(app, '/submission', sample(reviewed, 2)), 201);
  }
  const before = await read(app); release(); error(await pending, [409]);
  assert.deepEqual(await read(app), before);
  if (closure === 'v2') assert.equal(before.analysis.status, 'not_started');
  for (const person of PEOPLE.slice(1)) assert.deepEqual((await read(app, person)).versions, []);
});

test('R5 TEST-STUB malformed provider citations and foreign submission binding never become saved observations', async t => {
  const manual = createTargetAnalyzer({ mode:'manual_simulation' });
  for (const damage of [
    result => { result.observations.find(o => o.citations.length).citations[0].quote = 'TEST-STUB fabricated provider quote'; },
    result => { result.submissionId = 'different-person-submission'; },
  ]) {
    const app = await fixture(t, { analyzer: async input => { const result = await manual(input); damage(result); return result; } });
    const one = await first(app, PEOPLE[2], TEMPLATES[0]); const failed = await post(app, '/analysis', analysisBody(one));
    error(failed, [502], 'AI_OUTPUT_INVALID'); const after = await read(app, PEOPLE[2]);
    assert.equal(after.analysis.status, 'failed'); assert.equal(after.analysis.result, null); assert.deepEqual(after.submission, one.submission);
    assert.equal(after.assessment.task_v1, null); assert.equal(after.shortlist.status, 'not_retained');
    const reviewed = ok(await post(app, '/review', reviewBody(after))); assert.equal(reviewed.workflow.isTerminal, true);
  }
});

for (const failure of [null, undefined, new Error('TEST-STUB generic')]) test(`R5 thrown ${failure === null ? 'null' : failure === undefined ? 'undefined' : 'generic error'} settles analysis and same-key receipt`, async t => {
  const app = await fixture(t, { analyzer: async () => { throw failure; } }); const one = await first(app);
  const key = randomUUID(); const request = analysisBody(one); const result = await post(app, '/analysis', request, key);
  error(result, [502], 'AI_PROVIDER_ERROR'); const after = await read(app);
  assert.equal(after.analysis.status, 'failed'); assert.equal(after.analysis.result, null);
  const replay = await post(app, '/analysis', request, key); error(replay, [502], 'AI_PROVIDER_ERROR');
  assert.deepEqual(await read(app), after); assert.deepEqual(replay.json(), result.json());
});

test('R5 trusted timeout status/retryability survives service persistence and idempotent replay', async t => {
  const app = await fixture(t, { analyzer: async () => { throw new AnalysisError('AI_TIMEOUT', 504, true); } });
  const one = await first(app); const key = randomUUID(); const request = analysisBody(one);
  const failed = await post(app, '/analysis', request, key); error(failed, [504], 'AI_TIMEOUT'); assert.equal(failed.json().error.retryable, true);
  const replay = await post(app, '/analysis', request, key); error(replay, [504], 'AI_TIMEOUT'); assert.equal(replay.json().error.retryable, true);
  const d = await read(app); assert.equal(d.analysis.status, 'failed'); assert.equal(d.analysis.errorCode, 'AI_TIMEOUT');
  const done = ok(await post(app, '/review', reviewBody(d))); assert.equal(done.workflow.isTerminal, true);
});

test('R5 live mode without model/key advertises unavailable and never silently simulates success', async t => {
  const app = await fixture(t, { analysisMode:'live', apiKey:'', model:'' }); const initial = await read(app);
  assert.equal(initial.capabilities.analysisMode, 'live'); assert.equal(initial.capabilities.analysisAvailable, false);
  assert.equal(initial.capabilities.analysisUnavailableReason, 'AI_NOT_CONFIGURED');
  const one = await first(app); const failed = await post(app, '/analysis', analysisBody(one)); error(failed, [503], 'AI_NOT_CONFIGURED');
  const after = await read(app); assert.equal(after.analysis.status, 'failed'); assert.equal(after.analysis.result, null);
});

test('R5 shortlist task basis tracks explicit reused application dependency without rewriting historical task score', async t => {
  const app = await fixture(t); let d = await first(app, PEOPLE[0], TEMPLATES[0]);
  let application = d.assessment.application_review;
  const reuse = a => ({ assessmentRevision:a.assessmentRevision, evidenceSnapshotId:a.evidenceSnapshotId, fingerprint:a.fingerprint });
  d = ok(await post(app, '/assessment', assessmentBody(d, 'task_v1', [2,2,2], reuse(application))), 201);
  d = ok(await post(app, '/shortlist', shortlistBody(d, 'retain', 'task_v1')));
  const oldTask = structuredClone(d.assessment.task_v1); const oldBasis = structuredClone(d.shortlist.basis);
  d = ok(await post(app, '/assessment', assessmentBody(d)), 201);
  assert.equal(d.shortlist.status, 'needs_reconfirmation'); assert.deepEqual(d.shortlist.basis, oldBasis);
  assert.deepEqual(d.assessment.task_v1, oldTask);
  await unchanged(app, PEOPLE[0], () => post(app, '/shortlist', shortlistBody(d, 'reconfirm', 'task_v1')), [409]);
  application = d.assessment.application_review;
  d = ok(await post(app, '/assessment', assessmentBody(d, 'task_v1', [2,2,2], reuse(application))), 201);
  d = ok(await post(app, '/shortlist', shortlistBody(d, 'reconfirm', 'task_v1')));
  assert.equal(d.shortlist.status, 'retained'); assert.equal(d.shortlist.basis.assessmentRevision, 2);
  assert.deepEqual(d.assessment.history.find(a => a.stage === 'task_v1' && a.assessmentRevision === 1), oldTask);
  d = ok(await post(app, '/assessment', assessmentBody(d)), 201);
  assert.equal(d.shortlist.status, 'needs_reconfirmation');
  d = ok(await post(app, '/shortlist', shortlistBody(d, 'remove', 'task_v1')));
  assert.equal(d.shortlist.status, 'not_retained', 'withdrawal does not require reassessing an outdated composite');
});
