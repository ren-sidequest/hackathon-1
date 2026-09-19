import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApp } from '../dist/app.js';
import { binding, submissionRequest, analysisRequest, reviewRequest, verifyCitations } from './demo.mjs';

const output = new URL('../../../docs/backend/', import.meta.url);
const exampleDir = new URL('examples/', output);
const app = await createApp({ analysisMode: 'manual_simulation' });
const write = async (name, value, directory = exampleDir) => writeFile(new URL(name, directory), `${JSON.stringify(value, null, 2)}\n`);
const manifest = { generatedAt: new Date().toISOString(), kind: 'generated-synthetic-manual-fixture',
  modelCalls: 0, scope: 'In-memory API contract examples; IDs and timestamps are one generated run, never production constants.',
  requests: [] };
try {
  await app.ready();
  await mkdir(exampleDir, { recursive: true });
  await write('openapi.json', app.swagger(), output);
  const request = async (name, path, body) => {
    const headers = { host: '127.0.0.1:8787', ...(body === undefined ? {} : { 'content-type': 'application/json', 'idempotency-key': `example-${name}-v1` }) };
    const response = await app.inject({ method: body === undefined ? 'GET' : 'POST', url: path, headers, ...(body === undefined ? {} : { payload: body }) });
    assert.ok(response.statusCode >= 200 && response.statusCode < 300, `Example ${name} returned ${response.statusCode}`);
    if (body !== undefined) await write(`${name}.request.json`, body);
    await write(`${name}.response.json`, response.json());
    manifest.requests.push({ name, method: body === undefined ? 'GET' : 'POST', path, status: response.statusCode,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `example-${name}-v1` }, requestFile: `${name}.request.json` }), responseFile: `${name}.response.json` });
    return response.json();
  };
  await request('health', '/healthz');
  const initial = (await request('initial', '/api/demo')).data;
  const sent = (await request('send', '/api/demo/task/send', { ...binding(initial), instructions: initial.task.instructions })).data;
  const submitted = (await request('submission', '/api/demo/submission', submissionRequest(sent, 'EB-CROSS-CLIENT-UNIQUE-GENERATED-EXAMPLE'))).data;
  const analyzed = (await request('analysis', '/api/demo/analysis', analysisRequest(submitted))).data;
  verifyCitations(analyzed);
  await request('review', '/api/demo/review', reviewRequest(analyzed));
  await request('reviewed', '/api/demo');
  await write('reset.request.json', { schemaVersion: initial.schemaVersion, sessionId: initial.sessionId });
  manifest.requests.push({ name: 'reset', method: 'POST', path: '/api/demo/reset', executed: false,
    note: 'Explicit reset is documented separately; set a real local admin token, use the latest GET session, and generate a fresh key.',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'replace-with-random-uuid', 'X-Demo-Admin-Token': '<LOCAL_ADMIN_TOKEN>' }, requestFile: 'reset.request.json' });
  await write('manifest.json', manifest);
  console.log(`Generated OpenAPI and synthetic examples in ${fileURLToPath(output)}. No model or remote service was called.`);
} finally { await app.close(); }
