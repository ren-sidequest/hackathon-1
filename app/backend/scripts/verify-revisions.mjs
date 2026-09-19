import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { binding, submissionRequest, analysisRequest, reviewRequest, verifyCitations } from './demo.mjs';

// This verifier launches only its own loopback service and synthetic databases. It never calls a model.
const cwd = fileURLToPath(new URL('../', import.meta.url));
const workspace = fileURLToPath(new URL('../../../../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output-dir')) throw new Error('Usage: node scripts/verify-revisions.mjs [--output-dir PATH]');
const output = resolve(args[1] ?? join(workspace, '.artifacts', 'revisions-qa-20260919'));
await mkdir(output, { recursive: true, mode: 0o700 });
const run = await mkdtemp(join(output, 'run-'));
const databases = join(run, 'databases'); await mkdir(databases, { mode: 0o700 });
const token = randomBytes(32).toString('hex');
const childLogs = [];
const execute = promisify(execFile);
const report = { schemaVersion: '2.0', startedAt: new Date().toISOString(), scope: 'Executable HTTP and independent-process tests on synthetic fixtures; not UI integration or a model-quality experiment.', modelCalls: 0, node: process.version, checks: [], errorsObserved: [], commands: ['node dist/server.js', 'node scripts/demo.mjs', 'node scripts/demo.mjs --resubmit', 'node scripts/reset.mjs'], temporaryServicesStopped: false, temporaryDatabasesRemoved: false };
let active;
function pass(name) { report.checks.push({ name, status: 'passed' }); console.log(`PASS ${report.checks.length}: ${name}`); }
async function freePort() {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
async function start(file, mode = 'manual_simulation') {
  const port = await freePort();
  const child = spawn(process.execPath, ['dist/server.js'], { cwd, env: { ...process.env, PORT: String(port), DATABASE_PATH: file,
    DEMO_ADMIN_TOKEN: token, ANALYSIS_MODE: mode, OPENAI_API_KEY: '', OPENAI_MODEL: '', AI_TIMEOUT_MS: '20000',
    ALLOWED_ORIGINS: 'http://127.0.0.1:5173,http://127.0.0.1:4173,http://127.0.0.1:5186' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const service = { file, mode, child, base: `http://127.0.0.1:${port}`, async stop() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill('SIGTERM');
    });
  } };
  try {
    await new Promise((resolve, reject) => {
      let stdout = '';
      const timer = setTimeout(() => reject(new Error('Synthetic server startup timed out.')), 10000);
      child.stdout.on('data', chunk => { const text = String(chunk); childLogs.push(text); stdout += text; if (stdout.includes('"event":"ready"')) { clearTimeout(timer); resolve(); } });
      child.stderr.on('data', chunk => childLogs.push(String(chunk)));
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Synthetic server exited with code ${code}.`)); });
    });
    return service;
  } catch (error) { await service.stop(); throw error; }
}
async function http(path, body, status = 200, headers = {}) {
  const response = await fetch(`${active.base}${path}`, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(75000),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json();
  assert.equal(response.status, status, `${path}: ${payload.error?.code ?? response.status}`); return payload;
}
const read = async () => (await http('/api/demo')).data;
async function negative(name, path, body, status = 409) {
  const before = await read(); const failure = await http(path, body, status);
  assert.ok(failure.error?.code); assert.deepEqual(await read(), before);
  report.errorsObserved.push({ name, status, code: failure.error.code }); pass(`${name}: explicit error, no state mutation`);
}
async function restart(expected, name) {
  const { file, mode } = active; await active.stop(); active = await start(file, mode);
  assert.deepEqual(await read(), expected); pass(`${name}: identical state after independent server process restart`);
}
async function cli(script, cliArgs = [], expected = 0, env = {}) {
  try {
    const result = await execute(process.execPath, [`scripts/${script}.mjs`, ...cliArgs], { cwd, env: { ...process.env, BASE_URL: active.base, DEMO_ADMIN_TOKEN: token, ...env }, timeout: 90000 });
    childLogs.push(result.stdout, result.stderr); assert.equal(expected, 0); return result.stdout.trim();
  } catch (error) {
    childLogs.push(error.stdout ?? '', error.stderr ?? ''); assert.equal(error.code, expected); return error.stderr;
  }
}
async function snapshot(name, data) { verifyCitations(data); await writeFile(join(run, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 }); }
async function prepareV1(label) {
  const initial = await read(); assert.equal(initial.schemaVersion, '2.0'); assert.equal(initial.currentSubmissionVersion, null);
  const sent = (await http('/api/demo/task/send', { ...binding(initial), instructions: initial.task.instructions })).data;
  const input = submissionRequest(sent, `${label}-UNIQUE-V1`);
  const submitted = (await http('/api/demo/submission', input, 201)).data;
  assert.equal(submitted.submission.submissionVersion, 1); assert.equal(submitted.submission.previousSubmissionId, null);
  assert.equal(submitted.submission.previousContentFingerprint, null); assert.equal(submitted.submission.summary, input.summary);
  const analyzed = (await http('/api/demo/analysis', analysisRequest(submitted))).data; verifyCitations(analyzed);
  return analyzed;
}
async function verifyRevisionPath(finalDecision) {
  const label = `REVISION-${finalDecision.toUpperCase()}`;
  active = await start(join(databases, `${finalDecision}.sqlite`));
  const v1 = await prepareV1(label);
  const premature = { ...submissionRequest(v1, `${label}-PREMATURE`), submissionVersion: 2,
    previousSubmissionId: v1.submission.submissionId, previousContentFingerprint: v1.submission.contentFingerprint };
  await negative(`${label}: V2 before explicit V1 request`, '/api/demo/submission', premature);
  const more = { ...reviewRequest(v1, 'needs_more_evidence'), comment: `${label}-V1-COMMENT: clarify evidence limits and identify a specific matched comparison; do not treat correlation as causation.` };
  const waiting = (await http('/api/demo/review', more)).data;
  assert.equal(waiting.task.status, 'awaiting_revision'); assert.equal(waiting.workflow.canResubmit, true);
  assert.equal(waiting.workflow.isTerminal, false); assert.equal(waiting.workflow.nextSubmissionVersion, 2);
  assert.equal(waiting.report.requirements.find(r => r.requirementId === waiting.task.requirementId).status, 'uncertain');
  await snapshot(`${finalDecision}-awaiting-revision`, waiting); pass(`${label}: V1 more opens one same-task revision and retains comment/quotes`);
  await restart(waiting, `${label}: awaiting revision`);
  const frozenV1 = structuredClone(waiting.versions[0]);
  const input2 = submissionRequest(waiting, `${label}-UNIQUE-V2`);
  input2.summary += ' Revision clarification: the device split is current-only and does not establish why conversion changed; matched historical cohorts are still needed.';
  await negative(`${label}: invalid previous submission link`, '/api/demo/submission', { ...input2, previousSubmissionId: 'unknown-previous-submission' });
  await negative(`${label}: invalid previous fingerprint`, '/api/demo/submission', { ...input2, previousContentFingerprint: '0'.repeat(64) });
  const key = randomUUID();
  const v2 = (await http('/api/demo/submission', input2, 201, { 'Idempotency-Key': key })).data;
  assert.equal(v2.sessionId, v1.sessionId); assert.equal(v2.task.taskId, v1.task.taskId); assert.equal(v2.currentSubmissionVersion, 2);
  assert.notEqual(v2.submission.submissionId, v1.submission.submissionId); assert.equal(v2.submission.summary, input2.summary);
  assert.equal(v2.submission.previousSubmissionId, v1.submission.submissionId); assert.equal(v2.submission.previousContentFingerprint, v1.submission.contentFingerprint);
  assert.deepEqual(v2.versions[0], frozenV1); assert.equal(v2.analysis.status, 'not_started'); assert.equal(v2.review, null);
  const replay = await http('/api/demo/submission', input2, 201, { 'Idempotency-Key': key });
  assert.equal(replay.meta.replayed, true); assert.deepEqual((await read()).versions, v2.versions);
  await snapshot(`${finalDecision}-v2-pending`, v2); pass(`${label}: V2 is a new linked snapshot, no inherited result, duplicate replays once`);
  await restart(v2, `${label}: V2 pending review`);
  await negative(`${label}: historical analysis request`, '/api/demo/analysis', analysisRequest(v1));
  await negative(`${label}: historical review request`, '/api/demo/review', reviewRequest(v1));
  const analyzed = (await http('/api/demo/analysis', analysisRequest(v2))).data;
  verifyCitations(analyzed); assert.deepEqual(analyzed.versions[0], frozenV1);
  await negative(`${label}: V2 requests another revision`, '/api/demo/review', reviewRequest(analyzed, 'needs_more_evidence'));
  const finalReview = { ...reviewRequest(analyzed, finalDecision), comment: `${label}-V2-FINAL-COMMENT: ${finalDecision}; this is bounded sample evidence, with causal and performance uncertainty retained.` };
  const final = (await http('/api/demo/review', finalReview)).data;
  assert.deepEqual(final.versions[0], frozenV1); assert.equal(final.versions[1].review.comment, finalReview.comment);
  assert.equal(final.workflow.isTerminal, true); assert.equal(final.workflow.remainingSubmissions, 0); assert.equal(final.workflow.canSubmit, false);
  assert.equal(final.report.requirements.find(r => r.requirementId === final.task.requirementId).status, finalDecision === 'confirm' ? 'verified' : 'uncertain');
  await snapshot(`${finalDecision}-final-history`, final); pass(`${label}: terminal report and both versions retain their own quotes/comments`);
  await restart(final, `${label}: terminal history`);
  await negative(`${label}: V3 number`, '/api/demo/submission', { ...input2, submissionVersion: 3, previousSubmissionId: final.submission.submissionId, previousContentFingerprint: final.submission.contentFingerprint }, 400);
  await negative(`${label}: extra submission within numeric schema`, '/api/demo/submission', input2);
  assert.match(await cli('demo', [], 1), /CASE_NOT_FRESH/); assert.deepEqual(await read(), final); pass(`${label}: existing-case demo protection`);
  assert.match(await cli('reset', [], 1, { DEMO_ADMIN_TOKEN: 'wrong-fixture-token-'.repeat(3) }), /ADMIN_TOKEN_REQUIRED/); assert.deepEqual(await read(), final); pass(`${label}: wrong reset credential preserves both versions`);
  await cli('reset'); const reset = await read();
  assert.notEqual(reset.sessionId, final.sessionId); assert.equal(reset.currentSubmissionVersion, null); assert.deepEqual(reset.versions, []);
  assert.equal(reset.analysis.status, 'not_started'); assert.equal(reset.review, null); pass(`${label}: explicit reset starts a new session with no inherited history`);
  await negative(`${label}: stale old-session review after reset`, '/api/demo/review', finalReview);
  await active.stop(); active = undefined;
}
try {
  await verifyRevisionPath('confirm');
  await verifyRevisionPath('evidence_still_insufficient');
  for (const [name, args, mode, version, taskStatus] of [
    ['direct V1 confirm', [], 'manual_simulation', 1, 'reviewed'],
    ['V1 request only', ['--decision', 'needs_more_evidence'], 'manual_simulation', 1, 'awaiting_revision'],
    ['explicit V1/V2 confirm', ['--resubmit'], 'manual_simulation', 2, 'reviewed'],
    ['explicit V1/V2 insufficient', ['--resubmit', '--decision', 'evidence_still_insufficient'], 'manual_simulation', 2, 'reviewed'],
    ['disabled AI preserves two-version work', ['--resubmit'], 'disabled', 2, 'reviewed'],
  ]) {
    active = await start(join(databases, `${randomUUID()}.sqlite`), mode);
    const result = JSON.parse(await cli('demo', args));
    assert.equal(result.currentSubmissionVersion, version); assert.equal(result.taskStatus, taskStatus);
    assert.equal(result.versionsPreserved, version); assert.equal(result.resetPerformed, false);
    if (mode === 'disabled') assert.equal(result.analysisErrors.length, 2);
    pass(`actual demo CLI: ${name}`); await active.stop(); active = undefined;
  }
  assert.ok(childLogs.every(text => !text.includes(token) && !text.includes('wrong-fixture-token-'.repeat(3))));
  pass('all captured child-server and CLI output excludes reset credentials');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = { name: error.name, message: error.message }; process.exitCode = 1;
  console.error(`Revision verification failed: ${error.name}: ${error.message}`);
} finally {
  await active?.stop(); report.temporaryServicesStopped = true;
  await rm(databases, { recursive: true, force: true }); report.temporaryDatabasesRemoved = true;
  report.finishedAt = new Date().toISOString(); report.passedChecks = report.checks.length;
  assert.ok(childLogs.every(text => !text.includes(token)), 'No secret enters saved logs');
  await writeFile(join(run, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await writeFile(join(run, 'server-cli.log'), childLogs.join(''), { mode: 0o600 });
  console.log(JSON.stringify({ status: report.status, passedChecks: report.passedChecks, report: join(run, 'report.json'), modelCalls: 0, temporaryServicesStopped: true, temporaryDatabasesRemoved: true }));
}
