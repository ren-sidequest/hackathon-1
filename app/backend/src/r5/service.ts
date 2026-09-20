import { randomUUID } from 'node:crypto';
import { fingerprint } from '../fingerprint.js';
import { ApiError, invariant } from '../errors.js';
import { buildSourceIndex, AnalysisError, type AnalysisResult } from '../analysis.js';
import { createSeed, DATASET_VERSION } from './task-seed.js';
import { type Submission as LegacySubmission } from '../schema.js';
import { CANDIDATES, COMPANY, JOB, FIXTURE_VERSION, TASK_TEMPLATES, getApplication, validateAssessmentItems, type EvidenceSnapshot, type AssessmentItem } from './fixtures.js';
import { gapSuggestions } from './gaps.js';
import { RUBRIC, RUBRIC_VERSION, CRITERIA, type RequirementId, type CriterionId } from './rubric.js';
import { calculateScores } from './scoring.js';
import { RevisionStore } from './store.js';
import { SCHEMA_VERSION, type PersonId, type Stage, type SendRequest, type SubmitRequest, type AnalyzeRequest, type ReviewRequest, type AssessmentRequest, type ShortlistRequest, type ResetRequest } from './schema.js';
import { validateTargetAnalysis, type Analyzer, type AnalysisInput } from './analysis.js';
import type { OldMigrationPayload } from './migration.js';
import { validateState } from './state-schema.js';
import type { RestartRequest } from './schema.js';
export type SavedSubmission = LegacySubmission | (SubmitRequest & {
  submissionId: string;
  submittedAt: string;
  contentFingerprint: string;
  processEvidenceProvenance: 'client_reported';
  sources: ReturnType<typeof buildSourceIndex>;
});
export type AnalysisState = {
  status: 'not_started' | 'running' | 'succeeded' | 'failed';
  attemptId: string | null;
  submissionId: string | null;
  contentFingerprint: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  result: AnalysisResult | null;
};
export type Version = {
  submission: SavedSubmission;
  evidenceSnapshotId: string;
  analysis: AnalysisState;
  review: (ReviewRequest & {
    reviewId: string;
    reviewedAt: string;
  }) | LegacySubmissionReview | null;
};
type LegacySubmissionReview = NonNullable<OldMigrationPayload['legacyState']['versions'][number]['review']>;
export type AssessmentRecord = {
  assessmentId: string;
  candidateId: PersonId;
  jobId: string;
  rubricVersion: string;
  stage: Stage;
  evidenceSnapshotId: string;
  fingerprint: string;
  submissionId: string | null;
  contentFingerprint: string | null;
  assessmentRevision: number;
  status: 'reviewed';
  annotationMode: 'ai_authored' | 'human';
  operatorLabel: string;
  createdAt: string;
  items: AssessmentItem[];
  reuseApplication: AssessmentRequest['reuseApplication'];
  reusedItems: AssessmentItem[];
  score: ReturnType<typeof calculateScores>;
};
type ShortlistEvent = {
  revision: number;
  action: ShortlistRequest['action'];
  reason: string;
  operatorLabel: string;
  at: string;
  materialRevision: number;
  basis: Pick<ShortlistRequest, 'stage' | 'evidenceSnapshotId' | 'fingerprint' | 'assessmentRevision' | 'rubricVersion'>;
};
export type PersonState = {
  candidateId: PersonId;
  application: ReturnType<typeof getApplication>;
  task: {
    taskId: string;
    status: 'draft' | 'sent' | 'submitted' | 'awaiting_revision' | 'reviewed';
    targetRequirementId: RequirementId | null;
    templateId: string | null;
    title: string;
    instructions: string;
    gapReason: string;
    sentAt: string | null;
    timeboxMinutes: number;
  };
  versions: Version[];
  assessments: AssessmentRecord[];
  shortlist: ShortlistEvent[];
};
export type State = {
  schemaVersion: '4.0';
  sessionId: string;
  datasetVersion: string;
  fixtureVersion: string;
  rubricVersion: string;
  revision: number;
  people: Record<PersonId, PersonState>;
};
export type Receipt = {
  status: number;
  body: unknown;
};
const ids = CANDIDATES.map(c => c.id) as PersonId[];
const now = () => new Date().toISOString();
const blank = (): AnalysisState => ({
  status: 'not_started', attemptId: null, submissionId: null, contentFingerprint: null, startedAt: null, finishedAt: null, errorCode: null, result: null
});
function initialAssessment(candidateId: PersonId, application: ReturnType<typeof getApplication>): AssessmentRecord {
  return {
    assessmentId: `preset-${candidateId}`, candidateId, jobId: JOB.id, rubricVersion: RUBRIC_VERSION, stage: 'application_review', evidenceSnapshotId: application.evidenceSnapshotId, fingerprint: application.fingerprint, submissionId: null, contentFingerprint: null, assessmentRevision: 1, status: 'reviewed', annotationMode: 'ai_authored', operatorLabel: 'AI-authored demo assessment · Human calibration pending', createdAt: '2026-09-19T00:00:00.000Z', items: structuredClone(application.baseline.items), reuseApplication: null, reusedItems: [], score: calculateScores(application.baseline.items)
  };
}
export function freshState(): State {
  const people = Object.fromEntries(ids.map(candidateId => {
    const application = getApplication(candidateId);
    return [
      candidateId, {
        candidateId, application, task: {
          taskId: randomUUID(), status: 'draft', targetRequirementId: null, templateId: null, title: 'No targeted task requested', instructions: '', gapReason: '', sentAt: null, timeboxMinutes: 20
        }, versions: [], assessments: [
          initialAssessment(candidateId, application)
        ], shortlist: []
      }
    ];
  })) as unknown as State['people'];
  return {
    schemaVersion: SCHEMA_VERSION, sessionId: randomUUID(), datasetVersion: DATASET_VERSION, fixtureVersion: FIXTURE_VERSION, rubricVersion: RUBRIC_VERSION, revision: 0, people
  };
}
function snapshotFor(person: PersonState, stage: Stage, currentOnly = false): EvidenceSnapshot {
  if (stage === 'application_review')
    return person.application;
  const version = person.versions.find(v => `task_v${v.submission.submissionVersion}` === stage);
  invariant(version, 'SUBMISSION_REQUIRED', 'This assessment stage has no formal submission.');
  if (currentOnly)
    invariant(version === person.versions.at(-1), 'STALE_SUBMISSION', 'Only the current task version accepts a new assessment.');
  return {
    candidateId: person.candidateId, evidenceSnapshotId: version.evidenceSnapshotId, fingerprint: version.submission.contentFingerprint, sources: version.submission.sources
  };
}
function latest(person: PersonState, stage: Stage): AssessmentRecord | null {
  return person.assessments.filter(a => a.stage === stage).at(-1) ?? null;
}
function shortlistView(person: PersonState) {
  const entry = person.shortlist.at(-1);
  if (!entry)
    return {
      revision: 0, status: 'not_retained', reason: null, basis: null, history: []
    };
  const basisAssessment = person.assessments.find(a => a.stage === entry.basis.stage && a.assessmentRevision === entry.basis.assessmentRevision);
  const reused = basisAssessment?.reuseApplication;
  const stale = entry.materialRevision !== person.versions.length
    || entry.basis.assessmentRevision !== (latest(person, entry.basis.stage)?.assessmentRevision ?? null)
    || Boolean(reused && reused.assessmentRevision !== latest(person, 'application_review')?.assessmentRevision);
  return {
    revision: entry.revision, status: entry.action === 'remove' ? 'not_retained' : stale ? 'needs_reconfirmation' : 'retained', reason: entry.reason, basis: entry.basis, history: person.shortlist
  };
}
function analysisInput(person: PersonState, sub: SavedSubmission): AnalysisInput {
  return {
    ...sub, candidateId: person.candidateId, jobId: JOB.id, targetRequirementId: person.task.targetRequirementId!
  };
}
const safeFailure = (code: string, requestId: string, status = 503, retryable = ![
  'AI_DISABLED', 'AI_NOT_CONFIGURED', 'AI_REVIEW_CLOSED'
].includes(code)): Receipt => ({
  status, body: {
    error: {
      code, message: 'Analysis did not complete. The saved work remains available for human review.', requestId, retryable
    }
  }
});
export class RevisionService {
  readonly seed = createSeed();
  constructor(private readonly store: RevisionStore, private readonly analyzer: Analyzer, private readonly analysisMode = 'disabled', private readonly analysisUnavailableReason: string | null = analysisMode === 'disabled' ? 'AI_DISABLED' : null) {
    store.transaction(() => {
      let state = store.getState<State>();
      if (!state) {
        state = freshState();
        store.setState(state);
      }
      this.validateStored(state);
      for (const person of Object.values(state.people)) {
        const current = person.versions.at(-1);
        if (current?.analysis.status === 'running') {
          current.analysis.status = 'failed';
          current.analysis.errorCode = 'AI_INTERRUPTED';
          current.analysis.finishedAt = now();
          state.revision++;
          store.settleAnalysisReceipts(state.sessionId, person.candidateId, current.analysis.attemptId!, safeFailure('AI_INTERRUPTED', current.analysis.attemptId!));
        }
      }
      store.setState(state);
    });
  }
  private state() {
    const state = this.store.getState<State>();
    if (!state)
      throw Error('State missing');
    return state;
  }
  private person(state: State, candidateId: string): PersonState {
    invariant(ids.includes(candidateId as PersonId), 'UNKNOWN_CANDIDATE', 'Select a known candidate.');
    return state.people[candidateId as PersonId];
  }
  private bind(state: State, request: {
    schemaVersion: string;
    sessionId: string;
    candidateId: string;
    jobId: string;
    datasetVersion: string;
  }) {
    invariant(request.schemaVersion === SCHEMA_VERSION, 'SCHEMA_MISMATCH', 'Use the API 4.0 contract.');
    invariant(state.sessionId === request.sessionId, 'STALE_SESSION', 'Refresh the current session.');
    invariant(request.jobId === JOB.id, 'JOB_MISMATCH', 'Job does not match.');
    invariant(request.datasetVersion === state.datasetVersion, 'DATASET_MISMATCH', 'Dataset does not match.');
    return this.person(state, request.candidateId);
  }
  private task(person: PersonState, request: {
    taskId: string;
    targetRequirementId: RequirementId;
  }, sending = false) {
    invariant(request.taskId === person.task.taskId, 'TASK_MISMATCH', 'Task does not belong to this candidate.');
    if (!sending)
      invariant(request.targetRequirementId === person.task.targetRequirementId, 'REQUIREMENT_MISMATCH', 'Task target is fixed after sending.');
  }
  private current(person: PersonState, request: AnalyzeRequest) {
    this.task(person, request);
    const v = person.versions.at(-1);
    invariant(v, 'SUBMISSION_REQUIRED', 'Submit formal work first.');
    invariant(v.submission.submissionId === request.submissionId, 'STALE_SUBMISSION', 'Only the current owned submission accepts this action.');
    invariant(v.submission.contentFingerprint === request.contentFingerprint, 'CONTENT_MISMATCH', 'Submission fingerprint differs.');
    return v;
  }
  private projection(state: State, person: PersonState, liveAttempt?: string) {
    const versions = structuredClone(person.versions);
    for (const v of versions)
      if (v.analysis.result?.mode === 'live' && v.analysis.attemptId !== liveAttempt)
        v.analysis.result.mode = 'replay';
    const current = versions.at(-1), review = current?.review ?? null;
    const canResubmit = person.task.status === 'awaiting_revision' && versions.length === 1;
    const canSubmit = person.task.status === 'sent' || canResubmit;
    return {
      schemaVersion: SCHEMA_VERSION, sessionId: state.sessionId, revision: state.revision, datasetVersion: state.datasetVersion, fixtureVersion: state.fixtureVersion, jdVersion: JOB.jd.version, rubricVersion: RUBRIC_VERSION, company: COMPANY, job: JOB, rubric: RUBRIC, candidate: CANDIDATES.find(c => c.id === person.candidateId)!, application: person.application, dataset: this.seed.dataset, task: person.task, taskTemplates: TASK_TEMPLATES, gapSuggestions: gapSuggestions(latest(person, 'application_review')), assessmentComplete: latest(person, 'application_review')?.score.assessmentComplete ?? false, versions, submission: current?.submission ?? null, analysis: current?.analysis ?? blank(), review, currentSubmissionVersion: current?.submission.submissionVersion ?? null,
      workflow: {
        canSend: person.task.status === 'draft', maxSubmissions: 2, submissionsUsed: versions.length, remainingSubmissions: 2 - versions.length, canSubmit, canResubmit, nextSubmissionVersion: canSubmit ? (canResubmit ? 2 : 1) : null, allowedReviewDecisions: !current || review ? [] : versions.length === 1 ? [
          'confirm', 'needs_more_evidence', 'evidence_still_insufficient'
        ] : [
          'confirm', 'evidence_still_insufficient'
        ], isTerminal: person.task.status === 'reviewed'
      },
      capabilities: {
        contract: '4.0', analysisMode: this.analysisMode, analysisAvailable: this.analysisUnavailableReason === null, analysisUnavailableReason: this.analysisUnavailableReason, upload: false, authentication: false, authenticationScope: 'No application role accounts. Public write access may be protected by the deployment gateway.', writeAccess: { enforcement: 'deployment_defined', status: 'unknown', loginPath: '/gateway/write-access' }, analysisModeLabel: this.analysisMode === 'manual_simulation' ? 'Rule-based simulation' : this.analysisMode === 'live' ? 'Live model (availability reported separately)' : 'Analysis disabled', sqlExecution: false
      },
      assessment: {
        application_review: latest(person, 'application_review'), task_v1: latest(person, 'task_v1'), task_v2: latest(person, 'task_v2'), history: person.assessments
      }, shortlist: shortlistView(person),
      report: {
        isHiringDecision: false, requirements: JOB.requirements.map(r => {
          const initial = person.application.initialReport.find(x => x.requirementId === r.id)!;
          const targeted = r.id === person.task.targetRequirementId && review;
          return {
            requirementId: r.id, title: r.title, status: targeted ? (review.decision === 'confirm' ? 'verified' : 'uncertain') : initial.status,
            mode: targeted ? 'human_reviewed' : 'preset', summary: targeted ? review.comment : initial.summary,
            uncertainty: targeted ? 'Human evidence review of this submitted work only; independent authorship, execution and future performance are unverified.' : initial.uncertainty,
            evidenceSnapshotId: targeted ? current!.evidenceSnapshotId : person.application.evidenceSnapshotId,
            fingerprint: targeted ? current!.submission.contentFingerprint : person.application.fingerprint,
            sourceRefs: targeted ? [] : initial.sourceRefs, review: targeted ? review : null,
            scope: 'Bounded synthetic evidence only; scoring and shortlist are separate.'
          };
        })
      }
    };
  }
  read(candidateId: string) {
    const s = this.state();
    return {
      data: this.projection(s, this.person(s, candidateId)), meta: {
        replayed: false
      }
    };
  }
  comparison() {
    const s = this.state();
    return {
      data: {
        schemaVersion: SCHEMA_VERSION, sessionId: s.sessionId, revision: s.revision, datasetVersion: s.datasetVersion, fixtureVersion: s.fixtureVersion, jdVersion: JOB.jd.version, rubricVersion: RUBRIC_VERSION, company: COMPANY, job: JOB, rubric: RUBRIC, stage: 'application_review', applicationsReviewed: ids.filter(id => latest(s.people[id], 'application_review')?.score.assessmentComplete).length, candidatesWithCompleteCoreEvidence: ids.filter(id => latest(s.people[id], 'application_review')?.score.complete).length, sortPolicy: 'Compare only complete skills in the same stage and rubric; equal values are ties; missing evidence is unranked.', limitations: 'Different synthetic projects are not standardized tests. No automated hiring rank.', candidates: ids.map(id => {
          const p = s.people[id];
          return {
            candidate: CANDIDATES.find(c => c.id === id)!, application: p.application, assessment: latest(p, 'application_review'), task: p.task, assessmentComplete: latest(p, 'application_review')?.score.assessmentComplete ?? false, gapSuggestions: gapSuggestions(latest(p, 'application_review')), taskAssessments: p.assessments.filter(a => a.stage !== 'application_review'), shortlist: shortlistView(p)
          };
        })
      }, meta: {
        replayed: false
      }
    };
  }
  private replay(receipt: Receipt): Receipt {
    const body = structuredClone(receipt.body) as {
      meta?: {
        replayed: boolean;
      };
      data?: {
        analysis?: AnalysisState;
        versions?: Version[];
      };
    };
    if (body.meta)
      body.meta.replayed = true;
    if (body.data?.analysis?.result?.mode === 'live')
      body.data.analysis.result.mode = 'replay';
    for (const v of body.data?.versions ?? [])
      if (v.analysis.result?.mode === 'live')
        v.analysis.result.mode = 'replay';
    return {
      status: receipt.status, body
    };
  }
  private existing(s: State, id: PersonId, path: string, key: string, hash: string) {
    const prior = this.store.getReceipt(s.sessionId, id, path, key);
    if (!prior)
      return null;
    invariant(prior.hash === hash, 'IDEMPOTENCY_CONFLICT', 'The key already belongs to a different request.');
    // Receipt metadata is not enough: also reject a damaged body belonging to another owner.
    const body = prior.body as {
      data?: {
        candidate?: {
          id?: string;
        };
        sessionId?: string;
      };
    };
    if (body.data) {
      if (body.data.candidate?.id !== id || body.data.sessionId !== s.sessionId)
        throw new Error('Receipt ownership integrity mismatch');
      const check = (value: unknown): void => {
        if (!value || typeof value !== 'object')
          return;
        for (const [field, item] of Object.entries(value)) {
          if ((field === 'candidateId' && item !== id) || (field === 'sessionId' && item !== s.sessionId) || (field === 'taskId' && item !== s.people[id].task.taskId))
            throw new Error('Receipt nested ownership integrity mismatch');
          check(item);
        }
      };
      check(body.data);
    }
    return this.replay(prior);
  }
  private mutate<T extends {
    schemaVersion: string;
    sessionId: string;
    candidateId: PersonId;
    jobId: string;
    datasetVersion: string;
  }>(path: string, key: string, request: T, action: (s: State, p: PersonState) => number): Receipt {
    return this.store.transaction(() => {
      const s = this.state(), p = this.bind(s, request), hash = fingerprint(request);
      const prior = this.existing(s, p.candidateId, path, key, hash);
      if (prior)
        return prior;
      const status = action(s, p);
      s.revision++;
      this.store.setState(s);
      const response = {
        status, body: {
          data: this.projection(s, p), meta: {
            replayed: false
          }
        }
      };
      this.store.saveReceipt(s.sessionId, p.candidateId, path, key, hash, response);
      return response;
    });
  }
  restart(request: RestartRequest, key: string) {
    return this.mutate('/rehearsal/restart', key, request, (state, person) => {
      invariant(request.taskId === person.task.taskId && request.expectedRevision === state.revision,
        'STALE_REHEARSAL', 'The case changed. Refresh and review the reset again.');
      invariant(!person.versions.some(v => v.analysis.status === 'running'), 'ANALYSIS_RUNNING', 'Wait for the current analysis to finish before resetting.');
      this.store.archiveCandidate(state.sessionId, person.candidateId, person);
      Object.assign(person, freshState().people[person.candidateId]);
      if (request.checkpoint === 'ready_for_v1') {
        const template = TASK_TEMPLATES['business-problem-solving'];
        Object.assign(person.task, {
          status: 'sent', targetRequirementId: template.targetRequirementId, templateId: template.templateId,
          title: template.title, instructions: template.instructions, sentAt: now(),
          gapReason: 'Synthetic rehearsal checkpoint: explain which campaign and device comparisons would distinguish competing explanations (B3).'
        });
      }
      validateState(state);
      return 200;
    });
  }
  send(request: SendRequest, key: string) {
    return this.mutate('/task/send', key, request, (_s, p) => {
      this.task(p, request, true);
      invariant(p.task.status === 'draft', 'TASK_ALREADY_SENT', 'One targeted task is allowed for each candidate.');
      const template = TASK_TEMPLATES[request.targetRequirementId];
      invariant(template.templateId === request.templateId, 'TEMPLATE_MISMATCH', 'Select the fixed template matching the target.');
      Object.assign(p.task, {
        status: 'sent', targetRequirementId: request.targetRequirementId, templateId: template.templateId, title: template.title, instructions: request.instructions, gapReason: request.gapReason, sentAt: now()
      });
      return 200;
    });
  }
  submit(request: SubmitRequest, key: string) {
    return this.mutate('/submission', key, request, (_s, p) => {
      this.task(p, request);
      invariant(p.task.status !== 'draft', 'TASK_NOT_SENT', 'HR must send the task first.');
      invariant(p.versions.length < 2, 'SUBMISSION_LIMIT_REACHED', 'At most two submissions are allowed.');
      invariant(request.submissionVersion === p.versions.length + 1, 'SUBMISSION_VERSION_MISMATCH', 'Use the next permitted version.');
      const old = p.versions.at(-1);
      if (old)
        invariant(p.task.status === 'awaiting_revision' && old.review?.decision === 'needs_more_evidence', 'RESUBMISSION_NOT_ALLOWED', 'Only V1 More permits V2.');
      invariant(request.previousSubmissionId === (old?.submission.submissionId ?? null) && request.previousContentFingerprint === (old?.submission.contentFingerprint ?? null), 'PREVIOUS_SUBMISSION_MISMATCH', 'Previous version binding does not match.');
      for (const list of [
        request.findings, request.processEvidence
      ])
        invariant(new Set(list.map(i => i.id)).size === list.length, 'DUPLICATE_ID', 'IDs must be unique in each public collection.');
      for (const f of request.findings)
        invariant(!f.source || this.seed.dataset.resources.some(r => r.id === f.source), 'UNKNOWN_SOURCE', 'Use an existing task resource.');
      const sub: SavedSubmission = {
        ...structuredClone(request), submissionId: randomUUID(), submittedAt: now(), contentFingerprint: fingerprint(request), processEvidenceProvenance: 'client_reported', sources: []
      };
      sub.sources = buildSourceIndex(sub);
      p.versions.push({
        submission: sub, evidenceSnapshotId: `submission:${sub.submissionId}`, analysis: blank(), review: null
      });
      p.task.status = 'submitted';
      return 201;
    });
  }
  review(request: ReviewRequest, key: string) {
    return this.mutate('/review', key, request, (s, p) => {
      const v = this.current(p, request);
      invariant(!v.review, 'REVIEW_EXISTS', 'Each version has one human evidence decision.');
      invariant(!(p.versions.length === 2 && request.decision === 'needs_more_evidence'), 'REVIEW_LIMIT_REACHED', 'V2 requires a terminal decision.');
      if (v.analysis.status === 'running') {
        v.analysis.status = 'failed';
        v.analysis.errorCode = 'AI_REVIEW_CLOSED';
        v.analysis.finishedAt = now();
        this.store.settleAnalysisReceipts(s.sessionId, p.candidateId, v.analysis.attemptId!, safeFailure('AI_REVIEW_CLOSED', v.analysis.attemptId!, 409));
      }
      v.review = {
        ...structuredClone(request), reviewId: randomUUID(), reviewedAt: now()
      };
      p.task.status = request.decision === 'needs_more_evidence' ? 'awaiting_revision' : 'reviewed';
      return 200;
    });
  }
  assess(request: AssessmentRequest, key: string) {
    return this.mutate('/assessment', key, request, (_s, p) => {
      invariant(request.rubricVersion === RUBRIC_VERSION, 'RUBRIC_MISMATCH', 'Use the current rubric.');
      const snapshot = snapshotFor(p, request.stage, true);
      invariant(snapshot.evidenceSnapshotId === request.evidenceSnapshotId && snapshot.fingerprint === request.fingerprint, 'EVIDENCE_MISMATCH', 'Use the current owned evidence snapshot.');
      const version = request.stage === 'application_review' ? null : p.versions.at(-1)!;
      invariant(request.submissionId === (version?.submission.submissionId ?? null) && request.contentFingerprint === (version?.submission.contentFingerprint ?? null), 'CONTENT_MISMATCH', 'Assessment submission binding does not match.');
      const old = latest(p, request.stage);
      invariant(request.expectedAssessmentRevision === (old?.assessmentRevision ?? 0), 'ASSESSMENT_CONFLICT', 'Refresh the latest assessment before editing.');
      const expected = CRITERIA.filter(c => !version || c.requirementId === p.task.targetRequirementId).map(c => c.id);
      this.validateItems(snapshot, request.items as AssessmentItem[], expected);
      let reusedItems: AssessmentItem[] = [];
      if (request.reuseApplication) {
        invariant(Boolean(version), 'REUSE_NOT_ALLOWED', 'Application assessment does not reuse itself.');
        const application = latest(p, 'application_review')!;
        invariant(request.reuseApplication.assessmentRevision === application.assessmentRevision && request.reuseApplication.evidenceSnapshotId === application.evidenceSnapshotId && request.reuseApplication.fingerprint === application.fingerprint, 'STALE_REUSE', 'Reuse must explicitly reference the matching current application assessment.');
        reusedItems = structuredClone(application.items.filter(i => !expected.includes(i.criterionId)));
      }
      const items = structuredClone(request.items) as AssessmentItem[];
      const record: AssessmentRecord = {
        assessmentId: randomUUID(), candidateId: p.candidateId, jobId: JOB.id, rubricVersion: RUBRIC_VERSION, stage: request.stage, evidenceSnapshotId: snapshot.evidenceSnapshotId, fingerprint: snapshot.fingerprint, submissionId: request.submissionId, contentFingerprint: request.contentFingerprint, assessmentRevision: (old?.assessmentRevision ?? 0) + 1, status: 'reviewed', annotationMode: 'human', operatorLabel: request.operatorLabel, createdAt: now(), items, reuseApplication: structuredClone(request.reuseApplication), reusedItems, score: calculateScores([
          ...items, ...reusedItems
        ], {
          allowPartial: true
        })
      };
      p.assessments.push(record);
      return 201;
    });
  }
  shortlist(request: ShortlistRequest, key: string) {
    return this.mutate('/shortlist', key, request, (_s, p) => {
      invariant(request.rubricVersion === RUBRIC_VERSION, 'RUBRIC_MISMATCH', 'Use the current rubric.');
      const old = p.shortlist.at(-1);
      invariant(request.expectedShortlistRevision === (old?.revision ?? 0), 'SHORTLIST_CONFLICT', 'Refresh shortlist before changing it.');
      if (request.action === 'retain')
        invariant(!old || old.action === 'remove', 'SHORTLIST_ALREADY_RETAINED', 'Use reconfirm to update an existing retained basis.');
      if (request.action === 'reconfirm')
        invariant(Boolean(old && old.action !== 'remove'), 'SHORTLIST_NOT_RETAINED', 'Retain the candidate before reconfirming.');
      if (request.action === 'remove')
        invariant(Boolean(old && old.action !== 'remove'), 'SHORTLIST_NOT_RETAINED', 'Candidate is not retained.');
      const removing = request.action === 'remove';
      const snapshot = snapshotFor(p, request.stage, !removing);
      invariant(request.evidenceSnapshotId === snapshot.evidenceSnapshotId && request.fingerprint === snapshot.fingerprint, 'EVIDENCE_MISMATCH', 'Use an owned snapshot matching the viewed basis.');
      if (removing) {
        // Withdrawing is independent of rehabilitating a stale score. Preserve the viewed historical basis.
        const basisExists = request.assessmentRevision === null
          ? request.stage !== 'application_review'
          : p.assessments.some(a => a.stage === request.stage && a.assessmentRevision === request.assessmentRevision);
        invariant(basisExists, 'ASSESSMENT_CONFLICT', 'The viewed assessment basis does not exist.');
      } else {
        invariant(request.assessmentRevision === (latest(p, request.stage)?.assessmentRevision ?? null), 'ASSESSMENT_CONFLICT', 'The shortlist basis must match the assessment being viewed.');
        const reused = latest(p, request.stage)?.reuseApplication;
        if (reused)
          invariant(reused.assessmentRevision === latest(p, 'application_review')?.assessmentRevision, 'STALE_REUSE', 'Reassess the task against the current application assessment before using its composite basis.');
      }
      p.shortlist.push({
        revision: (old?.revision ?? 0) + 1, action: request.action, reason: request.reason, operatorLabel: request.operatorLabel, at: now(), materialRevision: p.versions.length, basis: {
          stage: request.stage, evidenceSnapshotId: request.evidenceSnapshotId, fingerprint: request.fingerprint, assessmentRevision: request.assessmentRevision, rubricVersion: RUBRIC_VERSION
        }
      });
      return 200;
    });
  }
  private validateItems(snapshot: EvidenceSnapshot, items: AssessmentItem[], expected: readonly CriterionId[]) {
    try {
      validateAssessmentItems(snapshot, items, expected);
    }
    catch {
      throw new ApiError('INVALID_ASSESSMENT', 400, 'Criteria, marks, checked sources or literal owned citations are invalid.');
    }
  }
  async analyze(request: AnalyzeRequest, key: string): Promise<Receipt> {
    const path = '/analysis', hash = fingerprint(request);
    const start = this.store.transaction(() => {
      const s = this.state(), p = this.bind(s, request);
      const prior = this.existing(s, p.candidateId, path, key, hash);
      if (prior)
        return {
          prior
        };
      const v = this.current(p, request);
      invariant(!v.review, 'REVIEW_EXISTS', 'Historical reviewed analysis is closed.');
      if (v.analysis.status === 'succeeded') {
        const response = {
          status: 200, body: {
            data: this.projection(s, p), meta: {
              replayed: false
            }
          }
        };
        this.store.saveReceipt(s.sessionId, p.candidateId, path, key, hash, response);
        return {
          prior: response
        };
      }
      invariant(v.analysis.status !== 'running', 'ANALYSIS_RUNNING', 'Read the current running analysis.');
      const attemptId = randomUUID();
      v.analysis = {
        ...blank(), status: 'running', attemptId, submissionId: v.submission.submissionId, contentFingerprint: v.submission.contentFingerprint, startedAt: now()
      };
      s.revision++;
      this.store.setState(s);
      this.store.saveReceipt(s.sessionId, p.candidateId, path, key, hash, {
        status: 202, body: {
          data: this.projection(s, p), meta: {
            replayed: false
          }
        }
      });
      return {
        attemptId, input: analysisInput(p, v.submission)
      };
    });
    if (start.prior)
      return start.prior;
    let result: AnalysisResult | null = null, failure: string | null = null, failureStatus = 502, failureRetryable = true;
    try {
      result = validateTargetAnalysis(await this.analyzer(start.input!), start.input!);
    }
    catch (error) {
      // Normalize every thrown value, including null/undefined, without leaking provider text.
      const trusted = error instanceof AnalysisError;
      failure = trusted && /^AI_[A-Z_]+$/.test(error.code) ? error.code : 'AI_PROVIDER_ERROR';
      failureStatus = trusted && [
        400, 413, 429, 500, 502, 503, 504
      ].includes(error.statusCode) ? error.statusCode : 502;
      failureRetryable = trusted ? error.retryable : true;
    }
    return this.store.transaction(() => {
      const s = this.state(), p = this.person(s, request.candidateId), v = p.versions.at(-1);
      invariant(s.sessionId === request.sessionId && p.task.taskId === request.taskId && v?.submission.submissionId === request.submissionId && v.submission.contentFingerprint === request.contentFingerprint && v.analysis.attemptId === start.attemptId && v.analysis.status === 'running' && !v.review, 'STALE_ANALYSIS', 'The original analysis is closed or its binding is stale.');
      v.analysis.status = failure ? 'failed' : 'succeeded';
      v.analysis.errorCode = failure;
      v.analysis.finishedAt = now();
      v.analysis.result = result;
      s.revision++;
      this.store.setState(s);
      const response = failure ? safeFailure(failure, start.attemptId!, failureStatus, failureRetryable) : {
        status: 200, body: {
          data: this.projection(s, p, start.attemptId), meta: {
            replayed: false
          }
        }
      };
      this.store.saveReceipt(s.sessionId, p.candidateId, path, key, hash, response);
      return response;
    });
  }
  reset(request: ResetRequest, key: string): Receipt {
    return this.store.transaction(() => {
      const s = this.state(), hash = fingerprint(request);
      const prior = this.store.getReceipt(request.sessionId, '__admin__', '/reset', key);
      if (prior) {
        invariant(prior.hash === hash, 'IDEMPOTENCY_CONFLICT', 'Reset key conflict.');
        return this.replay(prior);
      }
      invariant(s.sessionId === request.sessionId, 'STALE_SESSION', 'Refresh before resetting the current session.');
      const fresh = freshState();
      this.store.setState(fresh);
      this.store.clearReceipts();
      const response = {
        status: 200, body: this.comparison()
      };
      this.store.saveReceipt(s.sessionId, '__admin__', '/reset', key, hash, response);
      return response;
    });
  }
  private validateStored(state: State) {
    validateState(state);
  }
}
export function convertLegacyState(_payload: OldMigrationPayload): never {
  throw new Error('API4 uses a new applicant cohort. Preserve the old database and initialize a separate API4 database; legacy identities are never renamed or inherited.');
}
