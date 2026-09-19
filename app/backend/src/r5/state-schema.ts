import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { canonicalJson, fingerprint } from '../fingerprint.js';
import { buildSourceIndex, PROMPT_VERSION, validateAnalysis } from '../analysis.js';
import { createSeed, DATASET_VERSION } from '../seed.js';
import { AnalysisStateSchema as LegacyAnalysisStateSchema, ReviewRecordSchema as LegacyReviewRecordSchema } from '../schema.js';
import { CANDIDATE_IDS, FIXTURE_VERSION, JOB, TASK_TEMPLATES, getApplication, validateAssessmentItems, type EvidenceSnapshot } from './fixtures.js';
import { CRITERIA, RUBRIC_VERSION } from './rubric.js';
import { calculateScores } from './scoring.js';
import { validateTargetAnalysis } from './analysis.js';
import { CandidateSchema, StageSchema, FingerprintSchema } from './schema.js';
import { ApplicationSchema, TaskSchema, VersionSchema, AssessmentRecordSchema, ShortlistEventSchema } from './response-schema.js';
import type { State, PersonState, SavedSubmission, AssessmentRecord, Version } from './service.js';
import type { OldMigrationPayload } from './migration.js';
import type { Stage } from './schema.js';

const exact = { additionalProperties: false };
const id = Type.String({ minLength: 1, maxLength: 100, pattern: '^[A-Za-z0-9_.:-]+$' });
const text = (maxLength: number) => Type.String({ minLength: 1, maxLength, pattern: '\\S' });
const nullable = <T extends import('@sinclair/typebox').TSchema>(schema: T) => Type.Union([schema, Type.Null()]);
const StoredVersionSchema = Type.Object({ ...VersionSchema.properties, evidenceSnapshotId: id,
  submission: Type.Intersect([VersionSchema.properties.submission, Type.Object({ submissionId: id, contentFingerprint: FingerprintSchema })]),
  review: nullable(Type.Intersect([VersionSchema.properties.review, Type.Object({ reviewId: id })])),
}, exact);
const PersonSchema = Type.Object({ candidateId: CandidateSchema, application: ApplicationSchema,
  task: Type.Object({ ...TaskSchema.properties, taskId: id, templateId: nullable(id), title: text(300),
    instructions: Type.String({ maxLength: 4000 }), gapReason: Type.String({ maxLength: 2000 }) }, exact),
  versions: Type.Array(StoredVersionSchema, { maxItems: 2 }),
  assessments: Type.Array(Type.Object({ ...AssessmentRecordSchema.properties, assessmentId: id, operatorLabel: text(120) }, exact), { minItems: 1 }),
  shortlist: Type.Array(Type.Object({ ...ShortlistEventSchema.properties, reason: text(2000), operatorLabel: text(120) }, exact)),
}, exact);
export const StateSchema = Type.Object({ schemaVersion: Type.Literal('3.0'), sessionId: id, datasetVersion: Type.Literal(DATASET_VERSION),
  fixtureVersion: Type.Literal(FIXTURE_VERSION), rubricVersion: Type.Literal(RUBRIC_VERSION), revision: Type.Integer({ minimum: 0 }),
  people: Type.Object(Object.fromEntries(CANDIDATE_IDS.map(candidate => [candidate, PersonSchema])), exact) }, exact);
const OldStateSchema = Type.Object({ schemaVersion: Type.Literal('2.0'), sessionId: id, datasetVersion: Type.Literal(DATASET_VERSION),
  revision: Type.Integer({ minimum: 0 }), task: Type.Object({ taskId: id,
    status: Type.Union(['draft', 'sent', 'submitted', 'awaiting_revision', 'reviewed'].map(status => Type.Literal(status))),
    instructions: Type.String({ minLength: 1, maxLength: 4000 }), sentAt: nullable(Type.String({ minLength: 1 })),
  }, exact), versions: Type.Array(Type.Object({ submissionId: id, analysis: LegacyAnalysisStateSchema,
    review: nullable(LegacyReviewRecordSchema) }, exact), { maxItems: 2 }) }, exact);

function requireIntegrity(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Stored revision5 integrity: ${message}; preserve database`);
}
function equal(left: unknown, right: unknown): boolean { return canonicalJson(left) === canonicalJson(right); }
function time(value: string): number {
  const parsed = Date.parse(value);
  requireIntegrity(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(parsed) && new Date(parsed).toISOString() === value, 'invalid timestamp'); return parsed;
}
function content(submission: SavedSubmission) {
  const common = { schemaVersion: submission.schemaVersion, sessionId: submission.sessionId, taskId: submission.taskId,
    datasetVersion: submission.datasetVersion, candidateId: submission.candidateId, submissionVersion: submission.submissionVersion,
    previousSubmissionId: submission.previousSubmissionId, previousContentFingerprint: submission.previousContentFingerprint,
    summary: submission.summary, findings: submission.findings, processEvidence: submission.processEvidence };
  return submission.schemaVersion === '3.0' ? { ...common, jobId: submission.jobId, targetRequirementId: submission.targetRequirementId } : common;
}
function snapshot(person: PersonState, stage: Stage): EvidenceSnapshot {
  if (stage === 'application_review') return person.application;
  const version = person.versions.find(item => `task_v${item.submission.submissionVersion}` === stage);
  requireIntegrity(version, 'assessment/shortlist stage has no submission');
  return { candidateId: person.candidateId, evidenceSnapshotId: version.evidenceSnapshotId,
    fingerprint: version.submission.contentFingerprint, sources: version.submission.sources };
}
function baseline(person: PersonState): AssessmentRecord {
  const application = getApplication(person.candidateId);
  return { assessmentId: `preset-${person.candidateId}`, candidateId: person.candidateId, jobId: JOB.id, rubricVersion: RUBRIC_VERSION,
    stage: 'application_review', evidenceSnapshotId: application.evidenceSnapshotId, fingerprint: application.fingerprint,
    submissionId: null, contentFingerprint: null, assessmentRevision: 1, status: 'reviewed', annotationMode: 'preset_human',
    operatorLabel: 'Synthetic preset; AI-authored fixture, human calibration pending', createdAt: '2026-09-19T00:00:00.000Z',
    items: structuredClone(application.baseline.items), reuseApplication: null, reusedItems: [], score: calculateScores(application.baseline.items) };
}
function validateAnalysisState(person: PersonState, version: Version): void {
  const analysis = version.analysis; const submission = version.submission;
  if (analysis.status === 'not_started') {
    requireIntegrity(equal(analysis, { status: 'not_started', attemptId: null, submissionId: null, contentFingerprint: null,
      startedAt: null, finishedAt: null, errorCode: null, result: null }), 'unstarted analysis is not blank'); return;
  }
  requireIntegrity(analysis.submissionId === submission.submissionId && analysis.contentFingerprint === submission.contentFingerprint
    && analysis.attemptId && analysis.startedAt, 'analysis owner binding');
  requireIntegrity(time(analysis.startedAt) >= time(submission.submittedAt), 'analysis predates submission');
  if (analysis.status === 'running') requireIntegrity(analysis.finishedAt === null && analysis.result === null && analysis.errorCode === null, 'running analysis fields');
  else {
    requireIntegrity(analysis.finishedAt && time(analysis.finishedAt) >= time(analysis.startedAt), 'analysis completion timestamp');
    if (analysis.status === 'succeeded') requireIntegrity(analysis.result !== null && analysis.errorCode === null, 'successful analysis fields');
    else requireIntegrity(analysis.result === null && analysis.errorCode && /^AI_[A-Z_]+$/.test(analysis.errorCode), 'failed analysis fields');
  }
  if (analysis.result) {
    if (submission.schemaVersion === '2.0' && analysis.result.promptVersion === PROMPT_VERSION) validateAnalysis(analysis.result, submission);
    else validateTargetAnalysis(analysis.result, { ...submission, candidateId: person.candidateId, jobId: JOB.id, targetRequirementId: person.task.targetRequirementId! });
  }
}

/** Pure validation, shared by startup and migration before any new destination is published. */
export function validateState(input: unknown): asserts input is State {
  requireIntegrity(Value.Check(StateSchema, input), 'strict aggregate shape'); const state = input as State;
  const taskIds = new Set<string>(), submissionIds = new Set<string>(), assessmentIds = new Set<string>(), reviewIds = new Set<string>(), attemptIds = new Set<string>();
  const resources = createSeed().dataset.resources.map(resource => resource.id);
  for (const candidateId of CANDIDATE_IDS) {
    const person = state.people[candidateId]; const task = person.task;
    requireIntegrity(person.candidateId === candidateId && person.application.candidateId === candidateId, 'candidate ownership');
    requireIntegrity(equal(person.application, getApplication(candidateId)), 'immutable application fixture');
    requireIntegrity(!taskIds.has(task.taskId), 'duplicate task ID'); taskIds.add(task.taskId);
    requireIntegrity(task.timeboxMinutes === 20, 'task timebox');
    if (task.status === 'draft') requireIntegrity(task.targetRequirementId === null && task.templateId === null && task.sentAt === null && !person.versions.length, 'draft task binding');
    else {
      requireIntegrity(task.targetRequirementId !== null && task.sentAt !== null, 'sent task binding');
      const template = TASK_TEMPLATES[task.targetRequirementId];
      requireIntegrity(template && task.templateId === template.templateId && task.title === template.title, 'fixed task template binding'); time(task.sentAt);
      requireIntegrity(task.instructions.trim() && task.gapReason.trim(), 'sent task explanation');
    }
    let previous: Version | undefined;
    for (const [index, version] of person.versions.entries()) {
      const sub = version.submission;
      requireIntegrity(sub.candidateId === candidateId && sub.sessionId === state.sessionId && sub.taskId === task.taskId
        && sub.datasetVersion === DATASET_VERSION && sub.submissionVersion === index + 1
        && sub.previousSubmissionId === (previous?.submission.submissionId ?? null)
        && sub.previousContentFingerprint === (previous?.submission.contentFingerprint ?? null), 'submission ownership/version chain');
      requireIntegrity(!submissionIds.has(sub.submissionId), 'duplicate submission ID'); submissionIds.add(sub.submissionId);
      requireIntegrity(version.evidenceSnapshotId === `submission:${sub.submissionId}` && sub.contentFingerprint === fingerprint(content(sub))
        && equal(sub.sources, buildSourceIndex(sub)), 'submission content fingerprint/source index');
      requireIntegrity(task.sentAt && time(sub.submittedAt) >= time(task.sentAt), 'submission predates sent task');
      if (sub.schemaVersion === '2.0') requireIntegrity(candidateId === 'alex-chen' && task.targetRequirementId === 'business-problem-solving'
        && (!previous || previous.submission.schemaVersion === '2.0'), 'legacy submission scope');
      else requireIntegrity(sub.jobId === JOB.id && sub.targetRequirementId === task.targetRequirementId, 'submission job/target binding');
      for (const finding of sub.findings) requireIntegrity(!finding.source || resources.includes(finding.source), 'unknown task resource');
      if (previous) requireIntegrity(previous.review?.decision === 'needs_more_evidence'
        && time(sub.submittedAt) >= time(previous.review.reviewedAt), 'V2 requires preceding V1 More');
      validateAnalysisState(person, version);
      if (version.analysis.attemptId) { requireIntegrity(!attemptIds.has(version.analysis.attemptId), 'duplicate analysis attempt ID'); attemptIds.add(version.analysis.attemptId); }
      const review = version.review;
      if (review) {
        requireIntegrity(review.sessionId === state.sessionId && review.taskId === task.taskId && review.datasetVersion === DATASET_VERSION
          && review.submissionId === sub.submissionId && review.contentFingerprint === sub.contentFingerprint
          && (index === 0 || review.decision !== 'needs_more_evidence') && version.analysis.status !== 'running', 'review owner/version binding');
        if (review.schemaVersion === '2.0') requireIntegrity(sub.schemaVersion === '2.0' && review.requirementId === task.targetRequirementId, 'legacy review requirement binding');
        else requireIntegrity(review.candidateId === candidateId && review.jobId === JOB.id && review.targetRequirementId === task.targetRequirementId, 'review candidate/job/target binding');
        requireIntegrity(time(review.reviewedAt) >= time(sub.submittedAt), 'review predates submission');
        if (version.analysis.finishedAt) requireIntegrity(time(version.analysis.finishedAt) <= time(review.reviewedAt), 'analysis completed after terminal review');
        requireIntegrity(!reviewIds.has(review.reviewId), 'duplicate review ID'); reviewIds.add(review.reviewId);
      }
      previous = version;
    }
    const expected = previous ? previous.review ? previous.review.decision === 'needs_more_evidence' ? 'awaiting_revision' : 'reviewed' : 'submitted' : task.sentAt ? 'sent' : 'draft';
    requireIntegrity(task.status === expected, 'task status disagrees with history');
    requireIntegrity(equal(person.assessments[0], baseline(person)), 'immutable baseline assessment missing or changed');
    const counts = new Map<Stage, number>(); const seenApplications = new Map<number, AssessmentRecord>(); let lastAssessmentTime = -Infinity;
    for (const [index, record] of person.assessments.entries()) {
      requireIntegrity(Value.Check(StageSchema, record.stage), 'unknown assessment stage');
      const evidence = snapshot(person, record.stage);
      const version = record.stage === 'application_review' ? null : person.versions.find(item => `task_v${item.submission.submissionVersion}` === record.stage)!;
      const expectedIds = CRITERIA.filter(criterion => !version || criterion.requirementId === task.targetRequirementId).map(criterion => criterion.id);
      validateAssessmentItems(evidence, record.items, expectedIds);
      const revision = (counts.get(record.stage) ?? 0) + 1;
      requireIntegrity(record.assessmentRevision === revision && record.candidateId === candidateId && record.jobId === JOB.id
        && record.rubricVersion === RUBRIC_VERSION && record.evidenceSnapshotId === evidence.evidenceSnapshotId && record.fingerprint === evidence.fingerprint
        && record.submissionId === (version?.submission.submissionId ?? null) && record.contentFingerprint === (version?.submission.contentFingerprint ?? null), 'assessment owner/stage/revision binding');
      requireIntegrity(index === 0 || record.annotationMode === 'human', 'only initial baseline is preset');
      requireIntegrity(!assessmentIds.has(record.assessmentId), 'duplicate assessment ID'); assessmentIds.add(record.assessmentId);
      const created = time(record.createdAt); requireIntegrity(created >= lastAssessmentTime, 'assessment history chronology'); lastAssessmentTime = created;
      if (version) {
        requireIntegrity(created >= time(version.submission.submittedAt), 'assessment predates submission');
        const next = person.versions[version.submission.submissionVersion];
        requireIntegrity(!next || created <= time(next.submission.submittedAt), 'historical submission assessed after V2');
      }
      if (record.reuseApplication) {
        const original = seenApplications.get(record.reuseApplication.assessmentRevision);
        requireIntegrity(version && original && record.reuseApplication.assessmentRevision === counts.get('application_review')
          && original.evidenceSnapshotId === record.reuseApplication.evidenceSnapshotId && original.fingerprint === record.reuseApplication.fingerprint
          && equal(record.reusedItems, original.items.filter(item => !expectedIds.includes(item.criterionId))), 'explicit prior application reuse');
      } else requireIntegrity(record.reusedItems.length === 0, 'unexpected reused assessment items');
      requireIntegrity(equal(record.score, calculateScores([...record.items, ...record.reusedItems], { allowPartial: true })), 'deterministic assessment score');
      counts.set(record.stage, revision); if (record.stage === 'application_review') seenApplications.set(revision, record);
    }
    let previousEvent: PersonState['shortlist'][number] | undefined;
    for (const [index, event] of person.shortlist.entries()) {
      const evidence = snapshot(person, event.basis.stage); const at = time(event.at);
      requireIntegrity(event.revision === index + 1 && event.basis.evidenceSnapshotId === evidence.evidenceSnapshotId
        && event.basis.fingerprint === evidence.fingerprint && event.basis.rubricVersion === RUBRIC_VERSION
        && Number.isInteger(event.materialRevision) && event.materialRevision >= 0 && event.materialRevision <= person.versions.length, 'shortlist history binding');
      requireIntegrity(event.action === 'retain' ? !previousEvent || previousEvent.action === 'remove' : previousEvent && previousEvent.action !== 'remove', 'shortlist action transition');
      requireIntegrity(!previousEvent || at >= time(previousEvent.at) && event.materialRevision >= previousEvent.materialRevision, 'shortlist chronology');
      const stageVersion = event.basis.stage === 'application_review' ? 0 : event.basis.stage === 'task_v1' ? 1 : 2;
      requireIntegrity(event.materialRevision >= stageVersion, 'shortlist references future material');
      for (const version of person.versions.slice(0, event.materialRevision)) requireIntegrity(time(version.submission.submittedAt) <= at, 'shortlist predates material');
      const next = person.versions[event.materialRevision]; requireIntegrity(!next || at <= time(next.submission.submittedAt), 'shortlist material count mismatch');
      if (event.basis.assessmentRevision !== null) {
        const assessment = person.assessments.find(record => record.stage === event.basis.stage && record.assessmentRevision === event.basis.assessmentRevision);
        requireIntegrity(assessment && time(assessment.createdAt) <= at, 'shortlist references missing/future assessment');
      } else requireIntegrity(event.basis.stage !== 'application_review', 'application shortlist is missing baseline assessment');
      previousEvent = event;
    }
  }
}

export function validateLegacyPayload(payload: OldMigrationPayload): void {
  requireIntegrity(Value.Check(OldStateSchema, payload.legacyState), 'strict legacy workflow shape');
  const old = payload.legacyState;
  requireIntegrity(payload.submissions.length === old.versions.length, 'legacy submission count');
  for (const [index, version] of old.versions.entries()) requireIntegrity(payload.submissions[index]?.submissionId === version.submissionId, 'legacy submission ordering');
  // A converted state is validated separately; these are the original-only invariants that wrapping would hide.
  requireIntegrity((old.task.status === 'draft') === (old.task.sentAt === null), 'legacy sentAt/status binding');
  for (const version of old.versions) if (version.analysis.result) {
    const submission = payload.submissions.find(item => item.submissionId === version.submissionId);
    requireIntegrity(submission, 'legacy analysis submission missing'); validateAnalysis(version.analysis.result, submission);
  }
}
