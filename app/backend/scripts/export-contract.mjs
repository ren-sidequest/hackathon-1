import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApp } from '../dist/app.js';
import { binding, submissionRequest, analysisRequest, reviewRequest, verifyCitations } from './demo.mjs';

const output = new URL('../../../docs/backend/', import.meta.url);
const exampleDir = new URL('examples/', output);
const apps = [];
const files = new Map();
const manifest = { schemaVersion: '2.0', generatedAt: new Date().toISOString(), kind: 'generated-synthetic-manual-fixture',
  modelCalls: 0, scope: 'Two independent in-memory scenarios: direct V1 completion and same-session V1/V2 revision. IDs, timestamps and fingerprints belong to this generated run, never application constants.',
  requests: [] };
async function scenario(label) {
  const app = await createApp({ analysisMode: 'manual_simulation' }); apps.push(app); await app.ready();
  const request = async (name, path, body, expectedStatus) => {
    const headers = { host: '127.0.0.1:8787', ...(body === undefined ? {} : { 'content-type': 'application/json', 'idempotency-key': `example-${name}-v2` }) };
    const response = await app.inject({ method: body === undefined ? 'GET' : 'POST', url: path, headers, ...(body === undefined ? {} : { payload: body }) });
    const payload = response.json();
    if (expectedStatus !== undefined) assert.equal(response.statusCode, expectedStatus, `${name}: ${payload.error?.code}`);
    else assert.ok(response.statusCode >= 200 && response.statusCode < 300, `${name}: ${response.statusCode} / ${payload.error?.code}`);
    if (body !== undefined) files.set(`${name}.request.json`, body);
    files.set(`${name}.response.json`, payload);
    manifest.requests.push({ scenario: label, name, method: body === undefined ? 'GET' : 'POST', path, status: response.statusCode,
      ...(payload.error ? { errorCode: payload.error.code } : {}),
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `example-${name}-v2` }, requestFile: `${name}.request.json` }), responseFile: `${name}.response.json` });
    return payload;
  };
  return { app, request };
}
try {
  const direct = await scenario('direct-v1');
  await direct.request('health', '/healthz');
  const initial = (await direct.request('initial', '/api/demo')).data;
  assert.equal(initial.schemaVersion, '2.0', 'Build the 2.0 service before regenerating examples.');
  const sent = (await direct.request('send', '/api/demo/task/send', { ...binding(initial), instructions: initial.task.instructions })).data;
  const submitted = (await direct.request('submission', '/api/demo/submission', submissionRequest(sent, 'EB-EXAMPLE-DIRECT-V1'))).data;
  const analyzed = (await direct.request('analysis', '/api/demo/analysis', analysisRequest(submitted))).data;
  verifyCitations(analyzed);
  await direct.request('review', '/api/demo/review', reviewRequest(analyzed));
  await direct.request('reviewed', '/api/demo');

  const revision = await scenario('same-session-v1-v2');
  const start = (await revision.request('revision-initial', '/api/demo')).data;
  const revisionSent = (await revision.request('revision-send', '/api/demo/task/send', { ...binding(start), instructions: start.task.instructions })).data;
  const v1 = (await revision.request('revision-v1-submission', '/api/demo/submission', submissionRequest(revisionSent, 'EB-EXAMPLE-REVISION-V1'))).data;
  const v1Analyzed = (await revision.request('revision-v1-analysis', '/api/demo/analysis', analysisRequest(v1))).data;
  const more = reviewRequest(v1Analyzed, 'needs_more_evidence');
  more.comment = 'V1 shared review: distinguish what the device aggregates show from what remains untested, then explain a bounded next validation step. The current evidence remains uncertain.';
  await revision.request('revision-v1-more', '/api/demo/review', more);
  const waiting = (await revision.request('awaiting-revision', '/api/demo')).data;
  const frozenV1 = structuredClone(waiting.versions[0]);
  const v2Request = submissionRequest(waiting, 'EB-EXAMPLE-REVISION-V2');
  v2Request.summary += ' V2 clarification: the supplied current device split lacks historical matched cohorts. It identifies a question to test, not a causal explanation.';
  await revision.request('error-bad-link', '/api/demo/submission', { ...v2Request, previousSubmissionId: 'missing-previous-submission' }, 409);
  const v2 = (await revision.request('revision-v2-submission', '/api/demo/submission', v2Request)).data;
  assert.equal(v2.sessionId, start.sessionId); assert.equal(v2.task.taskId, start.task.taskId);
  assert.deepEqual(v2.versions[0], frozenV1);
  await revision.request('error-old-id', '/api/demo/analysis', analysisRequest(v1), 409);
  const v2Analyzed = (await revision.request('revision-v2-analysis', '/api/demo/analysis', analysisRequest(v2))).data;
  verifyCitations(v2Analyzed);
  await revision.request('error-v2-more', '/api/demo/review', reviewRequest(v2Analyzed, 'needs_more_evidence'), 409);
  const v2Review = reviewRequest(v2Analyzed);
  v2Review.comment = 'V2 synthetic review: confirm only the clarified, bounded work-sample evidence. Causation, independent authorship and future performance remain unverified.';
  await revision.request('revision-v2-review', '/api/demo/review', v2Review);
  const final = (await revision.request('revision-history', '/api/demo')).data;
  assert.deepEqual(final.versions[0], frozenV1); assert.equal(final.versions.length, 2); verifyCitations(final);
  await revision.request('error-v3', '/api/demo/submission', { ...v2Request, submissionVersion: 3, previousSubmissionId: final.submission.submissionId, previousContentFingerprint: final.submission.contentFingerprint }, 400);
  await revision.request('error-submission-limit', '/api/demo/submission', { ...v2Request, previousSubmissionId: final.submission.submissionId, previousContentFingerprint: final.submission.contentFingerprint }, 409);

  files.set('reset.request.json', { schemaVersion: final.schemaVersion, sessionId: final.sessionId });
  manifest.requests.push({ scenario: 'same-session-v1-v2', name: 'reset', method: 'POST', path: '/api/demo/reset', executed: false,
    note: 'Explicit reset is a new demo session, never a substitute for resubmission. Set a local admin token, read the latest session and use a fresh key.',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'replace-with-random-uuid', 'X-Demo-Admin-Token': '<LOCAL_ADMIN_TOKEN>' }, requestFile: 'reset.request.json' });
  await mkdir(exampleDir, { recursive: true });
  await writeFile(new URL('openapi.json', output), `${JSON.stringify(direct.app.swagger(), null, 2)}\n`);
  files.set('manifest.json', manifest);
  for (const [name, value] of files) await writeFile(new URL(name, exampleDir), `${JSON.stringify(value, null, 2)}\n`);
  console.log(`Generated contract 2.0 and ${files.size} synthetic example files in ${fileURLToPath(output)}. No model or remote service was called.`);
} finally { await Promise.all(apps.map(app => app.close())); }
