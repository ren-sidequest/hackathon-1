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
    submissionVersion: data.workflow.nextSubmissionVersion,
    previousSubmissionId: data.workflow.nextSubmissionVersion === 2 ? data.submission.submissionId : null,
    previousContentFingerprint: data.workflow.nextSubmissionVersion === 2 ? data.submission.contentFingerprint : null,
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
  for (const version of data.versions ?? [data]) {
    const { submission, analysis, review } = version;
    if (review) {
      assert.equal(review.submissionId, submission.submissionId);
      assert.equal(review.contentFingerprint, submission.contentFingerprint);
    }
    if (!analysis.result) continue;
    assert.equal(analysis.result.submissionId, submission.submissionId);
    assert.equal(analysis.result.contentFingerprint, submission.contentFingerprint);
    for (const observation of analysis.result.observations) {
      for (const citation of observation.citations) {
        const source = submission.sources.find(item => item.sourceId === citation.sourceId);
        assert.ok(source, 'Citation source exists in its own version snapshot');
        assert.equal(source.location, citation.location);
        assert.equal(source.text.slice(citation.start, citation.end), citation.quote);
      }
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
  base = baseUrl({ BASE_URL: base });
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

/** An explicit synthetic API test; resubmission is never simulated by a reset. */
export async function runDemo({ base = baseUrl(), decision = 'confirm', resubmit = false } = {}) {
  if (!decisions.includes(decision) || (resubmit && decision === 'needs_more_evidence')) {
    throw Object.assign(new Error('V2 accepts only a terminal decision.'), { code: 'INVALID_DECISION' });
  }
  const api = httpClient(base);
  assert.equal((await api('/healthz')).status, 'ok');
  const initial = (await api('/api/demo')).data;
  if (initial.schemaVersion !== '2.0') throw Object.assign(new Error('Use a contract 2.0 service; the existing case is untouched.'), { code: 'UNSUPPORTED_CONTRACT' });
  if (initial.task.status !== 'draft' || initial.submission || initial.review || initial.versions.length) {
    throw Object.assign(new Error('Existing case retained; choose an intentional reset or a new database.'), { code: 'CASE_NOT_FRESH' });
  }
  const sent = (await api('/api/demo/task/send', { ...binding(initial), instructions: initial.task.instructions })).data;
  const analysisErrors = [];
  const submitAndAnalyze = async data => {
    assert.equal(data.workflow.canSubmit, true);
    const request = submissionRequest(data);
    if (request.submissionVersion === 2) request.summary += ` V2 addresses this specific shared review request: ${data.review.comment}`;
    const submitted = (await api('/api/demo/submission', request)).data;
    const firstRead = (await api('/api/demo')).data;
    assert.deepEqual(firstRead.submission, submitted.submission);
    for (const key of ['summary', 'findings', 'processEvidence']) assert.deepEqual(firstRead.submission[key], request[key]);
    try { verifyCitations((await api('/api/demo/analysis', analysisRequest(firstRead))).data); }
    catch (error) {
      if (!/^AI_[A-Z_]+$/.test(error.code ?? '')) throw error;
      analysisErrors.push({ submissionVersion: request.submissionVersion, code: error.code });
    }
    const beforeReview = (await api('/api/demo')).data;
    assert.deepEqual(beforeReview.submission, submitted.submission);
    if (analysisErrors.some(error => error.submissionVersion === request.submissionVersion)) assert.equal(beforeReview.analysis.status, 'failed');
    return beforeReview;
  };
  const v1 = await submitAndAnalyze(sent);
  let reviewed = (await api('/api/demo/review', reviewRequest(v1, resubmit ? 'needs_more_evidence' : decision))).data;
  if (resubmit) {
    assert.equal(reviewed.task.status, 'awaiting_revision');
    assert.equal(reviewed.workflow.canResubmit, true);
    const frozenV1 = structuredClone(reviewed.versions[0]);
    const v2 = await submitAndAnalyze(reviewed);
    assert.equal(v2.sessionId, initial.sessionId);
    assert.equal(v2.task.taskId, initial.task.taskId);
    assert.equal(v2.submission.submissionVersion, 2);
    assert.notEqual(v2.submission.submissionId, frozenV1.submission.submissionId);
    assert.equal(v2.submission.previousSubmissionId, frozenV1.submission.submissionId);
    assert.equal(v2.submission.previousContentFingerprint, frozenV1.submission.contentFingerprint);
    assert.deepEqual(v2.versions[0], frozenV1);
    reviewed = (await api('/api/demo/review', reviewRequest(v2, decision))).data;
  }
  const readA = (await api('/api/demo')).data;
  const readB = (await api('/api/demo')).data;
  assert.deepEqual(readA.submission, reviewed.submission);
  assert.deepEqual(readA.review, reviewed.review);
  assert.deepEqual(readA.report, readB.report);
  assert.deepEqual(readA.versions, readB.versions);
  assert.equal(readA.task.status, decision === 'needs_more_evidence' ? 'awaiting_revision' : 'reviewed');
  assert.equal(readA.workflow.isTerminal, decision !== 'needs_more_evidence');
  verifyCitations(readA);
  for (const requirement of readA.report.requirements) {
    const original = initial.report.requirements.find(item => item.requirementId === requirement.requirementId);
    assert.equal(requirement.status, requirement.requirementId === initial.task.requirementId && decision === 'confirm' ? 'verified' : original.status);
  }
  return { status: 'passed', scope: 'synthetic HTTP test client, not dual-UI integration or a real human review',
    decision, resubmit, currentSubmissionVersion: readA.currentSubmissionVersion, taskStatus: readA.task.status,
    analysisStatus: readA.analysis.status, analysisMode: readA.analysis.result?.mode ?? null,
    analysisError: analysisErrors.at(-1)?.code ?? null, analysisErrors,
    submissionId: readA.submission.submissionId, contentFingerprint: readA.submission.contentFingerprint,
    versionsPreserved: readA.versions.length, resetPerformed: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    let resubmit = false; let decision = 'confirm'; let decisionSet = false;
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--resubmit' && !resubmit) resubmit = true;
      else if (args[index] === '--decision' && !decisionSet && args[index + 1]) { decision = args[++index]; decisionSet = true; }
      else throw Object.assign(new Error('Unexpected demo argument.'), { code: 'INVALID_ARGUMENTS' });
    }
    console.log(JSON.stringify(await runDemo({ decision, resubmit }), null, 2));
  } catch (error) {
    const code = /^[A-Z_]{1,80}$/.test(error.code ?? '') ? error.code : 'CLIENT_CHECK_FAILED';
    console.error(`Demo client stopped: ${code}. Existing state was not reset. Check /api/demo and the README.`);
    process.exitCode = 1;
  }
}
