import { randomUUID } from 'node:crypto';
import { Value } from '@sinclair/typebox/value';
import { Type } from '@sinclair/typebox';
import { createSeed, DATASET_VERSION } from './seed.js';
import { buildSourceIndex, validateAnalysis, type AnalysisResult, type SubmissionForAnalysis } from './analysis.js';
import { ApiError, invariant } from './errors.js';
import { canonicalJson, fingerprint } from './fingerprint.js';
import { AnalysisStateSchema, SubmissionSchema, ReviewRecordSchema, type AnalyzeRequest, type AnalysisState, type ResetRequest, type ReviewRequest, type SendRequest, type Submission, type SubmitRequest } from './schema.js';
import { Store, type State, type StoredResponse } from './store.js';

const blankAnalysis = (): AnalysisState => ({ status: 'not_started', attemptId: null, submissionId: null,
  contentFingerprint: null, startedAt: null, finishedAt: null, errorCode: null, result: null });
const StateSchema = Type.Object({
  schemaVersion: Type.Literal('1.0'), sessionId: Type.String(), datasetVersion: Type.String(), revision: Type.Integer(),
  task: Type.Object({ taskId: Type.String(), status: Type.Union(['draft', 'sent', 'submitted', 'reviewed'].map(x => Type.Literal(x))),
    instructions: Type.String(), sentAt: Type.Union([Type.String(), Type.Null()]) }, { additionalProperties: false }),
  submissionId: Type.Union([Type.String(), Type.Null()]), analysis: AnalysisStateSchema,
  review: Type.Union([ReviewRecordSchema, Type.Null()]),
}, { additionalProperties: false });
const content = (s: SubmitRequest): SubmitRequest => ({ schemaVersion: s.schemaVersion, sessionId: s.sessionId,
  taskId: s.taskId, datasetVersion: s.datasetVersion, candidateId: s.candidateId,
  summary: s.summary, findings: s.findings, processEvidence: s.processEvidence });
export type Analyzer = (submission: SubmissionForAnalysis) => Promise<AnalysisResult>;

export class DemoService {
  private readonly seed = createSeed();
  constructor(private readonly store: Store, private readonly analyzer: Analyzer) {
    this.store.transaction(() => {
      const saved = store.getState();
      if (!saved) { store.setState(this.fresh()); return; }
      if (!Value.Check(StateSchema, saved) || saved.datasetVersion !== DATASET_VERSION)
        throw new Error('Incompatible demo database; preserve it and select a new DATABASE_PATH');
      if (saved.submissionId) {
        const sub = store.getSubmission(saved.submissionId);
        if (!Value.Check(SubmissionSchema, sub) || sub.sessionId !== saved.sessionId || sub.taskId !== saved.task.taskId
          || sub.datasetVersion !== DATASET_VERSION || sub.candidateId !== this.seed.candidate.id
          || sub.contentFingerprint !== fingerprint(content(sub)) || canonicalJson(sub.sources) !== canonicalJson(buildSourceIndex(sub)))
          throw new Error('Stored submission integrity check failed');
        if (saved.analysis.status !== 'not_started' && (saved.analysis.submissionId !== sub.submissionId || saved.analysis.contentFingerprint !== sub.contentFingerprint))
          throw new Error('Stored analysis binding is invalid');
        if (saved.analysis.result) validateAnalysis(saved.analysis.result, sub);
        if (saved.review && (saved.review.sessionId !== saved.sessionId || saved.review.taskId !== saved.task.taskId
          || saved.review.datasetVersion !== DATASET_VERSION || saved.review.submissionId !== sub.submissionId
          || saved.review.contentFingerprint !== sub.contentFingerprint || saved.review.requirementId !== this.seed.task.requirementId))
          throw new Error('Stored review binding is invalid');
      }
      if ((saved.task.status === 'reviewed') !== Boolean(saved.review)
        || (['submitted', 'reviewed'].includes(saved.task.status)) !== Boolean(saved.submissionId)
        || (saved.task.status === 'draft') !== (saved.task.sentAt === null)
        || (!saved.submissionId && saved.analysis.status !== 'not_started')
        || (saved.analysis.status === 'succeeded') !== Boolean(saved.analysis.result))
        throw new Error('Stored workflow state is inconsistent');
      if (saved.analysis.status === 'running') {
        saved.analysis.status = 'failed'; saved.analysis.errorCode = 'AI_INTERRUPTED';
        saved.analysis.finishedAt = new Date().toISOString(); saved.revision += 1; store.setState(saved);
        store.interruptPending(saved.sessionId, saved.analysis.attemptId ?? 'interrupted');
      }
    });
  }
  private fresh(): State {
    return { schemaVersion: '1.0', sessionId: randomUUID(), datasetVersion: DATASET_VERSION, revision: 0,
      task: { taskId: randomUUID(), status: 'draft', instructions: this.seed.task.instructions, sentAt: null },
      submissionId: null, analysis: blankAnalysis(), review: null };
  }
  private state(): State { const state = this.store.getState(); if (!state) throw new Error('State missing'); return state; }
  private bind(state: State, request: ResetRequest & Partial<AnalyzeRequest>): void {
    invariant(request.sessionId === state.sessionId, 'STALE_SESSION', 'Demo was reset. Reload the current case.');
    if ('taskId' in request) invariant(request.taskId === state.task.taskId, 'STALE_TASK', 'Task reference is stale.');
    if ('datasetVersion' in request) invariant(request.datasetVersion === state.datasetVersion, 'DATASET_MISMATCH', 'Dataset version does not match.');
  }
  private submitted(state: State, request: AnalyzeRequest): Submission {
    invariant(state.submissionId, 'SUBMISSION_REQUIRED', 'Submit a work sample before this action.');
    invariant(request.submissionId === state.submissionId, 'STALE_SUBMISSION', 'Submission reference is stale.');
    const sub = this.store.getSubmission(state.submissionId);
    invariant(sub.contentFingerprint === request.contentFingerprint, 'CONTENT_MISMATCH', 'Submission fingerprint does not match.');
    return sub;
  }
  private projection(state: State, liveAttempt?: string) {
    const submission = state.submissionId ? this.store.getSubmission(state.submissionId) : null;
    const analysis = structuredClone(state.analysis);
    if (analysis.result?.mode === 'live' && analysis.attemptId !== liveAttempt) analysis.result.mode = 'replay';
    const requirements = this.seed.application.initialReport.map(initial => {
      const target = initial.requirementId === this.seed.task.requirementId;
      const confirmed = target && state.review?.decision === 'confirm';
      const status = confirmed ? 'verified' : initial.status;
      return { ...initial, title: this.seed.job.requirements.find(r => r.id === initial.requirementId)!.title,
        status, displayStatus: confirmed ? 'Verified through targeted task' : initial.displayStatus,
        displayLabel: confirmed ? 'Verified through targeted task' : initial.displayStatus,
        mode: target && state.review ? 'human_reviewed' : initial.mode,
        summary: target && state.review ? `Human evidence review: ${state.review.decision}. ${state.review.comment}` : initial.summary,
        review: target ? state.review : null,
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
      task: { ...this.seed.task, ...state.task }, submission, analysis, review: state.review,
      report: { mode: state.review ? 'human_reviewed' : 'preset_with_current_workflow',
        isHiringDecision: false, requirements, review: state.review },
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
    const data = body['data'] as { analysis?: AnalysisState } | undefined;
    if (data?.analysis?.result?.mode === 'live') data.analysis.result.mode = 'replay';
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
      invariant(!state.submissionId, 'SUBMISSION_EXISTS', 'This task already has an immutable submission.');
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
      state.submissionId = snapshot.submissionId; state.task.status = 'submitted'; state.analysis = blankAnalysis(); return 201;
    });
  }
  review(request: ReviewRequest, key: string): StoredResponse {
    return this.mutate('/api/demo/review', key, request, state => {
      this.submitted(state, request);
      invariant(!state.review, 'REVIEW_EXISTS', 'This submission already has a final review.');
      invariant(request.requirementId === this.seed.task.requirementId, 'REQUIREMENT_MISMATCH', 'Only the target requirement can be reviewed.');
      state.review = { ...request, reviewId: randomUUID(), reviewedAt: new Date().toISOString() };
      state.task.status = 'reviewed'; return 200;
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
      if (state.analysis.status === 'succeeded') {
        const result = this.response(state); this.store.saveIdempotency(state.sessionId, path, key, hash, result); return { prior: result };
      }
      invariant(!state.review, 'REVIEW_EXISTS', 'Analysis is closed after the final review.');
      invariant(state.analysis.status !== 'running', 'ANALYSIS_RUNNING', 'Analysis is already running. Read the current state.');
      const attemptId = randomUUID();
      state.analysis = { ...blankAnalysis(), status: 'running', attemptId, submissionId: sub.submissionId,
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
      invariant(state.sessionId === request.sessionId && state.submissionId === sub.submissionId && state.analysis.attemptId === attemptId,
        'STALE_ANALYSIS', 'Analysis belongs to a previous demo. Reload the current case.');
      state.analysis.status = failure ? 'failed' : 'succeeded'; state.analysis.errorCode = failure;
      state.analysis.result = result; state.analysis.finishedAt = new Date().toISOString(); state.revision += 1;
      this.store.setState(state);
      const response = failure ? { status: failure === 'AI_DISABLED' || failure === 'AI_NOT_CONFIGURED' ? 503 : 502,
        body: { error: { code: failure, message: 'Analysis did not complete. The saved work sample remains available for human review.', requestId: attemptId, retryable: true } } }
        : this.response(state, 200, attemptId);
      this.store.saveIdempotency(state.sessionId, path, key, hash, response); return response;
    });
  }
}
