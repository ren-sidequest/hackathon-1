import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const decisions = ['confirm', 'needs_more_evidence', 'evidence_still_insufficient'];
export const binding = data => ({ schemaVersion: data.schemaVersion, sessionId: data.sessionId, taskId: data.task.taskId, datasetVersion: data.datasetVersion });
export const analysisRequest = data => ({ ...binding(data), submissionId: data.submission.submissionId, contentFingerprint: data.submission.contentFingerprint });
export function submissionRequest(data, unique = `EB-CROSS-CLIENT-UNIQUE-${randomUUID()}`) {
  const metrics = data.dataset.metrics;
  const search = data.dataset.channels.find(channel => channel.channel === 'Paid Search');
  assert.ok(search, 'Paid Search fixture is required');
  return {
    ...binding(data), candidateId: data.candidate.id,
    summary: `${unique}. Traffic changed by ${metrics.change.trafficPct.toFixed(2)}%, while conversion moved from ${metrics.previous.conversionPct.toFixed(1)}% to ${metrics.current.conversionPct.toFixed(1)}%. Orders fell from ${metrics.previous.orders} to ${metrics.current.orders}. These observations do not establish causation.`,
    findings: [
      { id: 'client-finding-1', section: 'Key Findings', title: 'Compare the Paid Search signal', detail: `Paid Search conversion moved from ${search.previous.toFixed(2)}% to ${search.conversion.toFixed(2)}%; its current traffic share is ${search.trafficSharePct.toFixed(2)}%.`, source: 'website_traffic.csv', confidence: 'High' },
      { id: 'client-finding-2', section: 'Hypotheses', title: 'Traffic quality is a hypothesis', detail: 'New acquisition and page changes are possible explanations, not proven causes. The supplied aggregates do not identify a causal effect.', source: 'business_context.md', confidence: 'Medium' },
      { id: 'client-finding-3', section: 'Additional Evidence Needed', title: 'Request a comparable breakdown', detail: 'Request comparable pre/post campaign, device and landing-page cohorts plus funnel events; separate traffic composition from experience changes.', source: 'landing_pages.csv', confidence: 'High' },
      { id: 'client-finding-4', section: 'Recommended Next Steps', title: 'Validate before changing spend', detail: 'Prioritise a funnel and cohort check, then run a bounded comparison before changing incremental advertising spend.', source: 'business_context.md', confidence: 'Medium' },
    ],
    processEvidence: [{ id: 'client-event-1', at: new Date().toISOString(), title: 'Synthetic test client assembled the public work sample', detail: 'Script-generated fixture event; not an observed candidate action.' }],
  };
}
export function reviewRequest(data, decision = 'confirm') {
  assert.ok(decisions.includes(decision), 'Unknown test review decision');
  return { ...analysisRequest(data), requirementId: data.task.requirementId, decision,
    comment: decision === 'confirm'
      ? 'Synthetic API test decision: confirm this bounded work-sample evidence only; causal explanations and real-world performance remain uncertain.'
      : 'Synthetic API test decision: current evidence remains uncertain; request a comparable cohort and causal validation before drawing stronger conclusions.' };
}
export function verifyCitations(data) {
  for (const observation of data.analysis.result?.observations ?? []) {
    for (const citation of observation.citations) {
      const source = data.submission.sources.find(item => item.sourceId === citation.sourceId);
      assert.ok(source, 'Citation source exists in current snapshot');
      assert.equal(source.location, citation.location);
      assert.equal(source.text.slice(citation.start, citation.end), citation.quote);
    }
  }
}
export function baseUrl(env = process.env) {
  const url = new URL(env.BASE_URL ?? `http://127.0.0.1:${env.PORT ?? '8787'}`);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw Object.assign(new Error('Use a loopback HTTP BASE_URL without credentials or a path.'), { code: 'INVALID_BASE_URL' });
  }
  return url.origin;
}
export function httpClient(base) {
  return async (path, body, extraHeaders = {}) => {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(75_000),
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), ...extraHeaders },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const code = /^[A-Z_]{1,80}$/.test(payload.error?.code ?? '') ? payload.error.code : 'HTTP_ERROR';
      throw Object.assign(new Error(`API returned ${response.status} / ${code}.`), { code, status: response.status });
    }
    return payload;
  };
}

/** An explicit API test action, never an automatic product review or implicit reset. */
export async function runDemo({ base = baseUrl(), decision = 'confirm' } = {}) {
  if (!decisions.includes(decision)) throw Object.assign(new Error('Use one of the three documented decisions.'), { code: 'INVALID_DECISION' });
  const api = httpClient(base);
  const health = await api('/healthz');
  assert.equal(health.status, 'ok');
  const initial = (await api('/api/demo')).data;
  if (initial.task.status !== 'draft' || initial.submission || initial.review) {
    throw Object.assign(new Error('Existing case retained. Use the separate reset command intentionally or choose a fresh database.'), { code: 'CASE_NOT_FRESH' });
  }
  const sent = (await api('/api/demo/task/send', { ...binding(initial), instructions: initial.task.instructions })).data;
  const request = submissionRequest(sent);
  const submitted = (await api('/api/demo/submission', request)).data;
  const firstRead = (await api('/api/demo')).data;
  assert.deepEqual(firstRead.submission, submitted.submission);
  assert.equal(firstRead.submission.summary, request.summary);
  assert.deepEqual(firstRead.submission.findings, request.findings);
  assert.deepEqual(firstRead.submission.processEvidence, request.processEvidence);
  let analysisError = null;
  try { verifyCitations((await api('/api/demo/analysis', analysisRequest(firstRead))).data); }
  catch (error) {
    if (!/^AI_[A-Z_]+$/.test(error.code ?? '')) throw error;
    analysisError = error.code;
  }
  const beforeReview = (await api('/api/demo')).data;
  assert.deepEqual(beforeReview.submission, submitted.submission);
  if (analysisError) assert.equal(beforeReview.analysis.status, 'failed');
  const reviewed = (await api('/api/demo/review', reviewRequest(beforeReview, decision))).data;
  const readA = (await api('/api/demo')).data;
  const readB = (await api('/api/demo')).data;
  assert.deepEqual(readA.submission, submitted.submission);
  assert.deepEqual(readA.review, reviewed.review);
  assert.deepEqual(readA.report, readB.report);
  assert.deepEqual(readA.review, readB.review);
  assert.equal(readA.task.status, 'reviewed');
  for (const requirement of readA.report.requirements) {
    const original = initial.report.requirements.find(item => item.requirementId === requirement.requirementId);
    const expected = requirement.requirementId === initial.task.requirementId && decision === 'confirm' ? 'verified' : original.status;
    assert.equal(requirement.status, expected);
  }
  return { status: 'passed', scope: 'synthetic HTTP test client, not dual-UI integration or a real human review',
    decision, analysisStatus: readA.analysis.status, analysisMode: readA.analysis.result?.mode ?? null,
    analysisError, submissionId: readA.submission.submissionId, contentFingerprint: readA.submission.contentFingerprint,
    resetPerformed: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  try {
    if (args.length && (args.length !== 2 || args[0] !== '--decision')) throw Object.assign(new Error('Usage: npm run demo -- [--decision confirm|needs_more_evidence|evidence_still_insufficient]'), { code: 'INVALID_ARGUMENTS' });
    console.log(JSON.stringify(await runDemo({ decision: args[1] ?? 'confirm' }), null, 2));
  } catch (error) {
    const code = /^[A-Z_]{1,80}$/.test(error.code ?? '') ? error.code : 'CLIENT_CHECK_FAILED';
    console.error(`Demo client stopped: ${code}. Existing state was not reset. Check /api/demo and the README.`);
    process.exitCode = 1;
  }
}
