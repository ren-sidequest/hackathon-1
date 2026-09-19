import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { baseUrl, httpClient } from './demo.mjs';

function verifyFresh(data) {
  assert.equal(data.task.status, 'draft');
  assert.equal(data.submission, null);
  assert.equal(data.review, null);
  assert.equal(data.currentSubmissionVersion, null);
  assert.deepEqual(data.versions, []);
  assert.equal(data.workflow.submissionsUsed, 0);
}

export async function runReset({ base = baseUrl(), token = process.env.DEMO_ADMIN_TOKEN ?? '' } = {}) {
  if (token.length < 24 || token.length > 256) throw Object.assign(new Error('Configure the reset token in the local environment.'), { code: 'ADMIN_TOKEN_REQUIRED' });
  const api = httpClient(base);
  const health = await api('/healthz');
  assert.equal(health.status, 'ok');
  // API2 health has no schemaVersion. Verify its GET contract before any write.
  const version = health.schemaVersion ?? '2.0';
  if (!['2.0', '3.0'].includes(version)) throw Object.assign(new Error('Select a supported demo service.'), { code: 'UNSUPPORTED_CONTRACT' });
  const readPath = version === '3.0' ? '/api/demo/comparison' : '/api/demo';
  const current = (await api(readPath)).data;
  if (current.schemaVersion !== version) throw Object.assign(new Error('The service contract differs from its health response.'), { code: 'UNSUPPORTED_CONTRACT' });
  const reset = (await api('/api/demo/reset', { schemaVersion: version, sessionId: current.sessionId }, { 'X-Demo-Admin-Token': token })).data;
  assert.notEqual(reset.sessionId, current.sessionId);
  const reread = (await api(readPath)).data;
  assert.equal(reread.sessionId, reset.sessionId);
  assert.equal(reread.schemaVersion, version);
  if (version === '3.0') {
    const ids = current.candidates.map(row => row.candidate.id);
    assert.equal(ids.length, 4);
    assert.deepEqual(reread.candidates.map(row => row.candidate.id), ids);
    for (const candidateId of ids) {
      const data = (await api(`/api/demo?candidateId=${encodeURIComponent(candidateId)}`)).data;
      assert.equal(data.candidate.id, candidateId);
      assert.equal(data.sessionId, reset.sessionId);
      verifyFresh(data);
      assert.equal(data.shortlist.status, 'not_retained');
      assert.equal(data.shortlist.revision, 0);
      assert.deepEqual(data.shortlist.history, []);
    }
    return { status: 'reset', schemaVersion: version, candidatesReset: ids.length, taskStatus: 'draft', oldReferencesInvalidated: true };
  }
  verifyFresh(reread);
  return { status: 'reset', schemaVersion: version, candidatesReset: 1, taskStatus: reread.task.status, oldReferencesInvalidated: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length > 2) throw Object.assign(new Error('No command-line credentials are accepted.'), { code: 'INVALID_ARGUMENTS' });
    console.log(JSON.stringify(await runReset()));
  } catch (error) {
    const code = /^[A-Z_]{1,80}$/.test(error.code ?? '') ? error.code : 'RESET_CLIENT_FAILED';
    console.error(`Reset client stopped: ${code}. Check the local token, service and README; credentials are not printed.`);
    process.exitCode = 1;
  }
}
