import { randomUUID } from 'node:crypto';
import { Value } from '@sinclair/typebox/value';
import { Type } from '@sinclair/typebox';
import { createSeed, DATASET_VERSION } from './seed.js';
import { buildSourceIndex, validateAnalysis, type AnalysisResult, type SubmissionForAnalysis } from './analysis.js';
import { ApiError, invariant } from './errors.js';
import { canonicalJson, fingerprint } from './fingerprint.js';
import { AnalysisStateSchema, SubmissionSchema, ReviewRecordSchema, SCHEMA_VERSION, type AnalyzeRequest, type AnalysisState, type ResetRequest, type ReviewRequest, type SendRequest, type Submission, type SubmitRequest } from './schema.js';
import { Store, type State, type StoredResponse } from './store.js';

const blankAnalysis = (): AnalysisState => ({ status: 'not_started', attemptId: null, submissionId: null,
  contentFingerprint: null, startedAt: null, finishedAt: null, errorCode: null, result: null });
const StateSchema = Type.Object({
  schemaVersion: Type.Literal(SCHEMA_VERSION), sessionId: Type.String(), datasetVersion: Type.String(), revision: Type.Integer({ minimum: 0 }),
  task: Type.Object({ taskId: Type.String(), status: Type.Union(['draft', 'sent', 'submitted', 'awaiting_revision', 'reviewed'].map(x => Type.Literal(x))),
    instructions: Type.String(), sentAt: Type.Union([Type.String(), Type.Null()]) }, { additionalProperties: false }),
  versions: Type.Array(Type.Object({ submissionId: Type.String(), analysis: AnalysisStateSchema,
    review: Type.Union([ReviewRecordSchema, Type.Null()]),
  }, { additionalProperties: false }), { maxItems: 2 }),
}, { additionalProperties: false });
const content = (s: SubmitRequest): SubmitRequest => ({ schemaVersion: s.schemaVersion, sessionId: s.sessionId,
  taskId: s.taskId, datasetVersion: s.datasetVersion, candidateId: s.candidateId,
  submissionVersion: s.submissionVersion, previousSubmissionId: s.previousSubmissionId,
  previousContentFingerprint: s.previousContentFingerprint,
  summary: s.summary, findings: s.findings, processEvidence: s.processEvidence });
export type Analyzer = (submission: SubmissionForAnalysis) => Promise<AnalysisResult>;

export class DemoService {
  private readonly seed = createSeed();
  constructor(private readonly store: Store, private readonly analyzer: Analyzer) {
    this.store.transaction(() => {
      const saved = store.getState();
      if (!saved) {
        if (store.submissionIds().length) throw new Error('Stored submissions have no workflow state; preserve this database');
        store.setState(this.fresh()); return;
      }
      if (!Value.Check(StateSchema, saved) || saved.datasetVersion !== DATASET_VERSION)
        throw new Error('Incompatible demo database; preserve it and select a new DATABASE_PATH');
      if (canonicalJson(store.submissionIds()) !== canonicalJson(saved.versions.map(v => v.submissionId)))
        throw new Error('Stored submission history is inconsistent');
      let previous: Submission | null = null;
      for (const [index, version] of saved.versions.entries()) {
        const sub = store.getSubmission(version.submissionId);
        if (!Value.Check(SubmissionSchema, sub) || sub.sessionId !== saved.sessionId || sub.taskId !== saved.task.taskId
          || sub.datasetVersion !== DATASET_VERSION || sub.candidateId !== this.seed.candidate.id
          || sub.submissionVersion !== index + 1 || sub.previousSubmissionId !== (previous?.submissionId ?? null)
          || sub.previousContentFingerprint !== (previous?.contentFingerprint ?? null)
          || sub.contentFingerprint !== fingerprint(content(sub)) || canonicalJson(sub.sources) !== canonicalJson(buildSourceIndex(sub)))
          throw new Error('Stored submission integrity check failed');
        this.validateStoredAnalysis(version.analysis, sub);
        const review = version.review;
        if (review && (review.sessionId !== saved.sessionId || review.taskId !== saved.task.taskId
          || review.datasetVersion !== DATASET_VERSION || review.submissionId !== sub.submissionId
          || review.contentFingerprint !== sub.contentFingerprint || review.requirementId !== this.seed.task.requirementId
          || (sub.submissionVersion === 2 && review.decision === 'needs_more_evidence')))
          throw new Error('Stored review binding is invalid');
        if ((review && version.analysis.status === 'running')
          || (index === 1 && saved.versions[0]?.review?.decision !== 'needs_more_evidence'))
          throw new Error('Stored version transition is inconsistent');
        previous = sub;
      }
      const current = saved.versions.at(-1);
      const expected = current ? (current.review ? (current.review.decision === 'needs_more_evidence' ? 'awaiting_revision' : 'reviewed') : 'submitted') : null;
      if ((expected ? saved.task.status !== expected : !['draft', 'sent'].includes(saved.task.status))
        || (saved.task.status === 'draft') !== (saved.task.sentAt === null))
        throw new Error('Stored workflow state is inconsistent');
      if (current?.analysis.status === 'running') {
        current.analysis.status = 'failed'; current.analysis.errorCode = 'AI_INTERRUPTED';
        current.analysis.finishedAt = new Date().toISOString(); saved.revision += 1; store.setState(saved);
        store.interruptPending(saved.sessionId, current.analysis.attemptId!);
      }
    });
  }
  private validateStoredAnalysis(analysis: AnalysisState, sub: Submission): void {
    if (analysis.status === 'not_started') {
      if (canonicalJson(analysis) !== canonicalJson(blankAnalysis())) throw new Error('Stored unstarted analysis is inconsistent');
      return;
    }
    if (analysis.submissionId !== sub.submissionId || analysis.contentFingerprint !== sub.contentFingerprint
      || !analysis.attemptId || !analysis.startedAt) throw new Error('Stored analysis binding is invalid');
    if ((analysis.status === 'succeeded') !== Boolean(analysis.result)
      || (analysis.status === 'failed') !== Boolean(analysis.errorCode)
      || (analysis.status === 'running') !== (analysis.finishedAt === null))
      throw new Error('Stored analysis state is inconsistent');
    if (analysis.result) validateAnalysis(analysis.result, sub);
  }
  private fresh(): State {
    return { schemaVersion: SCHEMA_VERSION, sessionId: randomUUID(), datasetVersion: DATASET_VERSION, revision: 0,
      task: { taskId: randomUUID(), status: 'draft', instructions: this.seed.task.instructions, sentAt: null },
      versions: [] };
  }
  private state(): State { const state = this.store.getState(); if (!state) throw new Error('State missing'); return state; }
  private bind(state: State, request: ResetRequest & Partial<AnalyzeRequest>): void {
    invariant(request.sessionId === state.sessionId, 'STALE_SESSION', 'Demo was reset. Reload the current case.');
    if ('taskId' in request) invariant(request.taskId === state.task.taskId, 'STALE_TASK', 'Task reference is stale.');
    if ('datasetVersion' in request) invariant(request.datasetVersion === state.datasetVersion, 'DATASET_MISMATCH', 'Dataset version does not match.');
  }
  private submitted(state: State, request: AnalyzeRequest): Submission {
    const current = state.versions.at(-1);
    invariant(current, 'SUBMISSION_REQUIRED', 'Submit a work sample before this action.');
    invariant(request.submissionId === current.submissionId, 'STALE_SUBMISSION', 'Only the current submission accepts this action. Read history for older versions.');
    const sub = this.store.getSubmission(current.submissionId);
    invariant(sub.contentFingerprint === request.contentFingerprint, 'CONTENT_MISMATCH', 'Submission fingerprint does not match.');
    return sub;
  }
  private projection(state: State, liveAttempt?: string) {
    const versions = state.versions.map(version => {
      const analysis = structuredClone(version.analysis);
      if (analysis.result?.mode === 'live' && analysis.attemptId !== liveAttempt) analysis.result.mode = 'replay';
      return { submission: this.store.getSubmission(version.submissionId), analysis, review: version.review };
    });
    const current = versions.at(-1);
    const submission = current?.submission ?? null;
    const analysis = current?.analysis ?? blankAnalysis();
    const review = current?.review ?? null;
    const canResubmit = state.task.status === 'awaiting_revision' && versions.length === 1;
    const canSubmit = state.task.status === 'sent' || canResubmit;
    const requirements = this.seed.application.initialReport.map(initial => {
      const target = initial.requirementId === this.seed.task.requirementId;
      const confirmed = target && review?.decision === 'confirm';
      const status = confirmed ? 'verified' : initial.status;
      return { ...initial, title: this.seed.job.requirements.find(r => r.id === initial.requirementId)!.title,
        status, displayStatus: confirmed ? 'Verified through targeted task' : initial.displayStatus,
        displayLabel: confirmed ? 'Verified through targeted task' : initial.displayStatus,
        mode: target && review ? 'human_reviewed' : initial.mode,
        summary: target && review ? `Human evidence review: ${review.decision}. ${review.comment}` : initial.summary,
        review: target ? review : null,
        submissionSourceRefs: target && submission ? submission.sources.filter(s => s.kind === 'work_sample').map(s => ({
          submissionId: submission.submissionId, contentFingerprint: submission.contentFingerprint,
          sourceId: s.sourceId, location: s.location,
        })) : [],
        uncertainty: confirmed ? 'Bounded work-sample evidence only. Causal explanations, independent authorship and real-world performance remain unverified.' : initial.uncertainty,
      };
    });
    return {
      schemaVersion: state.schemaVersion, sessionId: state.sessionId, datasetVersion: state.datasetVersion,
      revision: state.revision, candidate: this.seed.candidate, job: this.seed.job,
      application: this.seed.application, dataset: this.seed.dataset,
      task: { ...this.seed.task, ...state.task }, submission, analysis, review,
      currentSubmissionVersion: submission?.submissionVersion ?? null, versions,
      workflow: {
        maxSubmissions: 2 as const, submissionsUsed: versions.length, remainingSubmissions: 2 - versions.length,
        canSubmit, canResubmit, nextSubmissionVersion: canSubmit ? (canResubmit ? 2 as const : 1 as const) : null,
        allowedReviewDecisions: !current || review ? [] : submission?.submissionVersion === 1
          ? ['confirm', 'needs_more_evidence', 'evidence_still_insufficient'] : ['confirm', 'evidence_still_insufficient'],
        isTerminal: state.task.status === 'reviewed',
      },
      report: { mode: review ? 'human_reviewed' : 'preset_with_current_workflow',
        isHiringDecision: false, requirements, review },
    };
  }
  read() { return { data: this.projection(this.state()), meta: { replayed: false } }; }
  private response(state: State, status = 200, liveAttempt?: string): StoredResponse {
    return { status, body: { data: this.projection(state, liveAttempt), meta: { replayed: false } } };
  }
  private existing(session: string, path: string, key: string, hash: string): StoredResponse | null {
    const result = this.store.getIdempotency(session, path, key);
    if (!result) return null;
    invariant(result.hash === hash, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with different content.');
    const body = structuredClone(result.body) as Record<string, unknown>;
    if ('data' in body) body['meta'] = { replayed: true };
    // A saved live result is replay on every subsequent response, including retry receipts.
    const data = body['data'] as { analysis?: AnalysisState; versions?: { analysis: AnalysisState }[] } | undefined;
    if (data?.analysis?.result?.mode === 'live') data.analysis.result.mode = 'replay';
    for (const version of data?.versions ?? []) if (version.analysis.result?.mode === 'live') version.analysis.result.mode = 'replay';
    return { status: result.status, body };
  }
  private mutate<T extends ResetRequest>(path: string, key: string, request: T, action: (state: State) => number): StoredResponse {
    return this.store.transaction(() => {
      const state = this.state(); this.bind(state, request);
      const hash = fingerprint(request); const prior = this.existing(request.sessionId, path, key, hash);
      if (prior) return prior;
      const status = action(state); state.revision += 1; this.store.setState(state);
      const response = this.response(state, status); this.store.saveIdempotency(state.sessionId, path, key, hash, response);
      return response;
    });
  }
  send(request: SendRequest, key: string): StoredResponse {
    return this.mutate('/api/demo/task/send', key, request, state => {
      invariant(state.task.status === 'draft', 'TASK_ALREADY_SENT', 'Task was already sent.');
      state.task.instructions = request.instructions; state.task.sentAt = new Date().toISOString(); state.task.status = 'sent'; return 200;
    });
  }
  submit(request: SubmitRequest, key: string): StoredResponse {
    return this.mutate('/api/demo/submission', key, request, state => {
      invariant(state.task.status !== 'draft', 'TASK_NOT_SENT', 'Send the task before submission.');
      const count = state.versions.length;
      invariant(count < 2, 'SUBMISSION_LIMIT_REACHED', 'This task accepts at most two submissions.');
      invariant(request.submissionVersion === count + 1, 'SUBMISSION_VERSION_MISMATCH', 'Read the current version before submitting.');
      const previous = count ? this.store.getSubmission(state.versions[0]!.submissionId) : null;
      if (count) invariant(state.task.status === 'awaiting_revision' && state.versions[0]!.review?.decision === 'needs_more_evidence',
        'RESUBMISSION_NOT_ALLOWED', 'Only a V1 request for more evidence opens one V2 submission.');
      invariant(request.previousSubmissionId === (previous?.submissionId ?? null)
        && request.previousContentFingerprint === (previous?.contentFingerprint ?? null),
        'PREVIOUS_SUBMISSION_MISMATCH', 'The previous submission ID and fingerprint must match the permitted version.');
      if (request.candidateId !== this.seed.candidate.id) throw new ApiError('CANDIDATE_MISMATCH', 409, 'Candidate reference does not match.');
      for (const list of [request.findings, request.processEvidence]) {
        if (new Set(list.map(item => item.id)).size !== list.length) throw new ApiError('DUPLICATE_ID', 400, 'IDs must be unique within each collection.');
      }
      if (request.findings.some(f => f.source && !this.seed.dataset.resources.some(r => r.id === f.source)))
        throw new ApiError('UNKNOWN_SOURCE', 400, 'A finding references an unknown case resource.');
      const snapshot: Submission = { ...structuredClone(content(request)), submissionId: randomUUID(),
        submittedAt: new Date().toISOString(), contentFingerprint: fingerprint(content(request)),
        processEvidenceProvenance: 'client_reported', sources: [] };
      snapshot.sources = buildSourceIndex(snapshot); this.store.insertSubmission(snapshot);
      state.versions.push({ submissionId: snapshot.submissionId, analysis: blankAnalysis(), review: null });
      state.task.status = 'submitted'; return 201;
    });
  }
  review(request: ReviewRequest, key: string): StoredResponse {
    return this.mutate('/api/demo/review', key, request, state => {
      this.submitted(state, request);
      const current = state.versions.at(-1)!;
      invariant(!current.review, 'REVIEW_EXISTS', 'This submission already has a human review.');
      invariant(request.requirementId === this.seed.task.requirementId, 'REQUIREMENT_MISMATCH', 'Only the target requirement can be reviewed.');
      invariant(!(state.versions.length === 2 && request.decision === 'needs_more_evidence'),
        'REVIEW_LIMIT_REACHED', 'V2 requires a terminal decision: confirm or evidence_still_insufficient.');
      // Freeze this version before opening the next one: a late model result never changes a reviewed history entry.
      if (current.analysis.status === 'running') {
        current.analysis.status = 'failed'; current.analysis.errorCode = 'AI_REVIEW_CLOSED';
        current.analysis.finishedAt = new Date().toISOString();
        this.store.interruptPending(state.sessionId, current.analysis.attemptId!, 'AI_REVIEW_CLOSED', 409);
      }
      current.review = { ...request, reviewId: randomUUID(), reviewedAt: new Date().toISOString() };
      state.task.status = request.decision === 'needs_more_evidence' ? 'awaiting_revision' : 'reviewed'; return 200;
    });
  }
  reset(request: ResetRequest, key: string): StoredResponse {
    return this.store.transaction(() => {
      const hash = fingerprint(request); const prior = this.existing(request.sessionId, '/api/demo/reset', key, hash);
      if (prior) return prior;
      this.bind(this.state(), request); const fresh = this.fresh();
      this.store.clear(); this.store.setState(fresh); const result = this.response(fresh);
      this.store.saveIdempotency(request.sessionId, '/api/demo/reset', key, hash, result); return result;
    });
  }
  async analyze(request: AnalyzeRequest, key: string): Promise<StoredResponse> {
    const path = '/api/demo/analysis'; const hash = fingerprint(request);
    const start = this.store.transaction(() => {
      const state = this.state(); this.bind(state, request);
      const prior = this.existing(state.sessionId, path, key, hash); if (prior) return { prior };
      const sub = this.submitted(state, request);
      const current = state.versions.at(-1)!;
      if (current.analysis.status === 'succeeded') {
        const result = this.response(state); this.store.saveIdempotency(state.sessionId, path, key, hash, result); return { prior: result };
      }
      invariant(!current.review, 'REVIEW_EXISTS', 'Analysis is closed after human review.');
      invariant(current.analysis.status !== 'running', 'ANALYSIS_RUNNING', 'Analysis is already running. Read the current state.');
      const attemptId = randomUUID();
      current.analysis = { ...blankAnalysis(), status: 'running', attemptId, submissionId: sub.submissionId,
        contentFingerprint: sub.contentFingerprint, startedAt: new Date().toISOString() };
      state.revision += 1; this.store.setState(state);
      this.store.saveIdempotency(state.sessionId, path, key, hash, this.response(state, 202));
      return { sub, attemptId };
    });
    if (start.prior) return start.prior;
    const { sub, attemptId } = start;
    if (!sub || !attemptId) throw new Error('Analysis attempt missing');
    let result: AnalysisResult | null = null; let failure: string | null = null;
    try { result = validateAnalysis(await this.analyzer(sub), sub); }
    catch (error) {
      // Never copy provider messages into storage, public responses or logs.
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      failure = typeof code === 'string' && /^AI_[A-Z_]{1,60}$/.test(code) ? code : 'AI_FAILED';
    }
    return this.store.transaction(() => {
      const state = this.state();
      const current = state.versions.at(-1);
      invariant(state.sessionId === request.sessionId && current?.submissionId === sub.submissionId
        && current.analysis.attemptId === attemptId && current.analysis.status === 'running' && !current.review,
        'STALE_ANALYSIS', 'This analysis attempt is closed or belongs to an older version or session. Reload the current case.');
      current.analysis.status = failure ? 'failed' : 'succeeded'; current.analysis.errorCode = failure;
      current.analysis.result = result; current.analysis.finishedAt = new Date().toISOString(); state.revision += 1;
      this.store.setState(state);
      const response = failure ? { status: failure === 'AI_DISABLED' || failure === 'AI_NOT_CONFIGURED' ? 503 : 502,
        body: { error: { code: failure, message: 'Analysis did not complete. The saved work sample remains available for human review.', requestId: attemptId, retryable: true } } }
        : this.response(state, 200, attemptId);
      this.store.saveIdempotency(state.sessionId, path, key, hash, response); return response;
    });
  }
}
