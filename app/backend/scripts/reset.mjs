import assert from 'node:assert/strict';
import { baseUrl, httpClient } from './demo.mjs';

try {
  if (process.argv.length > 2) throw Object.assign(new Error('No command-line credentials are accepted.'), { code: 'INVALID_ARGUMENTS' });
  const token = process.env.DEMO_ADMIN_TOKEN ?? '';
  if (token.length < 24 || token.length > 256) throw Object.assign(new Error('Configure the reset token in the local environment.'), { code: 'ADMIN_TOKEN_REQUIRED' });
  const api = httpClient(baseUrl());
  const current = (await api('/api/demo')).data;
  if (current.schemaVersion !== '2.0') throw Object.assign(new Error('Use a contract 2.0 service before reset.'), { code: 'UNSUPPORTED_CONTRACT' });
  const reset = (await api('/api/demo/reset', { schemaVersion: current.schemaVersion, sessionId: current.sessionId }, { 'X-Demo-Admin-Token': token })).data;
  assert.notEqual(reset.sessionId, current.sessionId);
  assert.equal(reset.task.status, 'draft');
  assert.equal(reset.submission, null);
  assert.equal(reset.review, null);
  assert.equal(reset.currentSubmissionVersion, null);
  assert.deepEqual(reset.versions, []);
  assert.equal(reset.workflow.submissionsUsed, 0);
  const reread = (await api('/api/demo')).data;
  assert.equal(reread.sessionId, reset.sessionId);
  console.log(JSON.stringify({ status: 'reset', taskStatus: reread.task.status, oldReferencesInvalidated: true }));
} catch (error) {
  const code = /^[A-Z_]{1,80}$/.test(error.code ?? '') ? error.code : 'RESET_CLIENT_FAILED';
  console.error(`Reset client stopped: ${code}. Check the local token, service and README; credentials are not printed.`);
  process.exitCode = 1;
}
