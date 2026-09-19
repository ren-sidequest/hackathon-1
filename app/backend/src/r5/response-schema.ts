import { Type, type TSchema } from '@sinclair/typebox';
import { DemoSchema as LegacyDemoSchema } from '../response-schema.js';
import { SubmissionSchema as LegacySubmissionSchema, ReviewRecordSchema as LegacyReviewSchema, SourceSchema, AnalysisResultSchema as LegacyResultSchema, AnalysisStateSchema as LegacyAnalysisSchema, ObservationSchema, WorkflowSchema } from '../schema.js';
import { CandidateSchema, RequirementSchema, StageSchema, FingerprintSchema, CriterionSchema, SourceRefSchema, AssessmentItemSchema, SubmitSchema, ReviewSchema, ReuseSchema, ShortlistSchema } from './schema.js';
const o = {
  additionalProperties: false
};
const s = () => Type.String();
const n = () => Type.Number();
const b = () => Type.Boolean();
const integer = () => Type.Integer({
  minimum: 0
});
const strings = () => Type.Array(s());
const choices = (values: string[]) => Type.Union(values.map(x => Type.Literal(x)));
export const nullable = (schema: TSchema) => Type.Union([
  schema, Type.Null()
]);
const mark = Type.Union([
  Type.Integer({
    minimum: 0, maximum: 4
  }), Type.Literal('NE')
]);
export const CandidateInfoSchema = Type.Object({
  id: CandidateSchema, name: s(), background: s()
}, o);
export const CompanySchema = Type.Object({
  id: s(), name: s(), provenance: Type.Literal('synthetic'), location: s(), approximateHeadcount: integer(), products: strings(), fulfilment: s(), hiringManager: s(), budgetApprover: s(), dedicatedRecruitingTeam: Type.Literal(false), businessProblem: s(), constraints: strings()
}, o);
export const JobSchema = Type.Object({
  ...LegacyDemoSchema.properties.job.properties, reportsTo: s(), successStages: strings()
}, o);
export const RubricSchema = Type.Object({
  version: s(), jobId: s(), provenance: s(), calibrationStatus: s(), label: s(), scope: s(),
  requirements: Type.Array(Type.Object({
    id: RequirementSchema, title: s(), maxScore: n(), statement: s()
  }, o)),
  marks: Type.Array(Type.Object({
    mark, meaning: s()
  }, o)),
  criteria: Type.Array(Type.Object({
    id: CriterionSchema, requirementId: RequirementSchema, title: s(), observableSupport: s(), maxScore: Type.Literal(10), anchors: Type.Object({
      '4': s(), '2': s(), '0': s()
    }, o)
  }, o)),
  rules: Type.Object({
    maxScore: Type.Literal(100), criterionContribution: s(), displayDecimalPlaces: integer(), neIsZero: Type.Literal(false), autoPassThreshold: Type.Null(), rounding: s()
  }, o)
}, o);
export const ScoreSchema = Type.Object({
  status: choices([
    'complete', 'needs_evidence', 'pending'
  ]), assessmentComplete: b(), complete: b(), coveragePercent: nullable(n()), accruedScore: n(), overallScore: nullable(n()), overallPercentage: nullable(n()),
  criteria: Type.Array(Type.Object({
    criterionId: CriterionSchema, requirementId: RequirementSchema, mark: nullable(mark), status: choices([
      'assessed', 'needs_evidence', 'pending'
    ]), contribution: nullable(n())
  }, o)),
  skills: Type.Array(Type.Object({
    requirementId: RequirementSchema, criterionIds: Type.Array(CriterionSchema), maxScore: n(), assessmentComplete: b(), complete: b(), evaluatedCount: integer(), neCount: integer(), pendingCount: integer(), accruedScore: n(), score: nullable(n()), percentage: nullable(n())
  }, o))
}, o);
export const PresetReportSchema = Type.Object({
  requirementId: RequirementSchema, status: choices([
    'supported', 'uncertain'
  ]), displayStatus: s(), mode: Type.Literal('preset'), summary: s(), uncertainty: s(), sourceRefs: Type.Array(SourceRefSchema)
}, o);
const baseline = Type.Object({
  candidateId: CandidateSchema, jobId: s(), evidenceSnapshotId: s(), fingerprint: FingerprintSchema, fixtureVersion: s(), rubricVersion: s(), stage: Type.Literal('application_review'), assessmentRevision: Type.Literal(1), annotationMode: Type.Literal('preset_human'), label: s(), status: Type.Literal('reviewed'),
  provenance: Type.Object({
    sampleType: Type.Literal('synthetic'), standardDesign: s(), actualAnnotation: s(), actualReview: s(), humanCalibration: Type.Literal('pending'), externalExpertValidation: Type.Literal(false), note: s()
  }, o), items: Type.Array(AssessmentItemSchema), score: ScoreSchema
}, o);
export const ApplicationSchema = Type.Object({
  id: s(), candidateId: CandidateSchema, jobId: s(), evidenceSnapshotId: s(), fingerprint: FingerprintSchema, fixtureVersion: s(), provenance: Type.Literal('synthetic'), materialVersion: Type.Literal(1), scope: s(),
  sources: Type.Array(Type.Object({
    ...SourceSchema.properties, kind: Type.Literal('application')
  }, o)), baseline, initialReport: Type.Array(PresetReportSchema)
}, o);
export const TaskTemplateSchema = Type.Object({
  templateId: s(), title: s(), targetRequirementId: RequirementSchema, instructions: s(), timeboxMinutes: Type.Literal(20), timeboxEnforced: Type.Literal(false), datasetVersion: s(), resourceIds: strings(), observationDimensions: strings(), mode: Type.Literal('preset')
}, o);
export const TaskSchema = Type.Object({
  taskId: s(), status: choices([
    'draft', 'sent', 'submitted', 'awaiting_revision', 'reviewed'
  ]), targetRequirementId: nullable(RequirementSchema), templateId: nullable(s()), title: s(), instructions: s(), gapReason: s(), sentAt: nullable(s()), timeboxMinutes: Type.Literal(20)
}, o);
export const SubmissionSchema = Type.Union([
  LegacySubmissionSchema, Type.Object({
    ...SubmitSchema.properties, submissionId: s(), submittedAt: s(), contentFingerprint: FingerprintSchema, processEvidenceProvenance: Type.Literal('client_reported'), sources: Type.Array(SourceSchema)
  }, o)
]);
export const ReviewRecordSchema = Type.Union([
  LegacyReviewSchema, Type.Object({
    ...ReviewSchema.properties, reviewId: s(), reviewedAt: s()
  }, o)
]);
const resultSchema = Type.Object({
  ...LegacyResultSchema.properties, observations: Type.Array(Type.Object({
    ...ObservationSchema.properties, dimension: choices([
      'S1', 'S2', 'S3', 'D1', 'D2', 'D3', 'Problem Framing', 'Evidence Navigation', 'Hypothesis Formation', 'Evidence Seeking', 'Decision Making'
    ])
  }, o), {
    minItems: 3, maxItems: 5
  })
}, o);
export const AnalysisStateSchema = Type.Object({
  ...LegacyAnalysisSchema.properties, result: nullable(resultSchema)
}, o);
export const VersionSchema = Type.Object({
  submission: SubmissionSchema, evidenceSnapshotId: s(), analysis: AnalysisStateSchema, review: nullable(ReviewRecordSchema)
}, o);
export const AssessmentRecordSchema = Type.Object({
  assessmentId: s(), candidateId: CandidateSchema, jobId: s(), rubricVersion: s(), stage: StageSchema, evidenceSnapshotId: s(), fingerprint: FingerprintSchema, submissionId: nullable(s()), contentFingerprint: nullable(FingerprintSchema), assessmentRevision: Type.Integer({
    minimum: 1
  }), status: Type.Literal('reviewed'), annotationMode: choices([
    'preset_human', 'human'
  ]), operatorLabel: s(), createdAt: s(), items: Type.Array(AssessmentItemSchema), reuseApplication: nullable(ReuseSchema), reusedItems: Type.Array(AssessmentItemSchema), score: ScoreSchema
}, o);
export const ShortlistBasisSchema = Type.Pick(ShortlistSchema, [
  'stage', 'evidenceSnapshotId', 'fingerprint', 'assessmentRevision', 'rubricVersion'
], o);
export const ShortlistEventSchema = Type.Object({
  revision: Type.Integer({
    minimum: 1
  }), action: ShortlistSchema.properties.action, reason: s(), operatorLabel: s(), at: s(), materialRevision: integer(), basis: ShortlistBasisSchema
}, o);
export const ShortlistViewSchema = Type.Object({
  revision: integer(), status: choices([
    'not_retained', 'retained', 'needs_reconfirmation'
  ]), reason: nullable(s()), basis: nullable(ShortlistBasisSchema), history: Type.Array(ShortlistEventSchema)
}, o);
const common = {
  schemaVersion: Type.Literal('3.0'), sessionId: s(), revision: integer(), datasetVersion: s(), fixtureVersion: s(), rubricVersion: s(), company: CompanySchema, job: JobSchema, rubric: RubricSchema
};
export const DemoSchema = Type.Object({
  ...common, candidate: CandidateInfoSchema, application: ApplicationSchema, dataset: LegacyDemoSchema.properties.dataset, task: TaskSchema,
  taskTemplates: Type.Object({
    sql: TaskTemplateSchema, 'data-analysis': TaskTemplateSchema, 'business-problem-solving': TaskTemplateSchema
  }, o), versions: Type.Array(VersionSchema, {
    maxItems: 2
  }), submission: nullable(SubmissionSchema), analysis: AnalysisStateSchema, review: nullable(ReviewRecordSchema), currentSubmissionVersion: Type.Union([
    Type.Literal(1), Type.Literal(2), Type.Null()
  ]),
  workflow: Type.Object({
    ...WorkflowSchema.properties, canSend: b()
  }, o),
  capabilities: Type.Object({
    contract: Type.Literal('3.0'), analysisMode: choices([
      'disabled', 'manual_simulation', 'live'
    ]), analysisAvailable: b(), analysisUnavailableReason: nullable(choices([
      'AI_DISABLED', 'AI_NOT_CONFIGURED'
    ])), upload: Type.Literal(false), authentication: Type.Literal(false), sqlExecution: Type.Literal(false)
  }, o),
  assessment: Type.Object({
    application_review: nullable(AssessmentRecordSchema), task_v1: nullable(AssessmentRecordSchema), task_v2: nullable(AssessmentRecordSchema), history: Type.Array(AssessmentRecordSchema)
  }, o), shortlist: ShortlistViewSchema,
  report: Type.Object({
    isHiringDecision: Type.Literal(false), requirements: Type.Array(Type.Object({
      requirementId: RequirementSchema, title: s(), evidenceSnapshotId: s(), fingerprint: FingerprintSchema, status: choices([
        'supported', 'uncertain', 'verified'
      ]), mode: choices([
        'preset', 'human_reviewed'
      ]), summary: s(), uncertainty: s(), sourceRefs: Type.Array(SourceRefSchema), review: nullable(ReviewRecordSchema), scope: s()
    }, o))
  }, o)
}, o);
export const ComparisonSchema = Type.Object({
  ...common, stage: Type.Literal('application_review'), sortPolicy: s(), limitations: s(), candidates: Type.Array(Type.Object({
    candidate: CandidateInfoSchema, application: ApplicationSchema, assessment: nullable(AssessmentRecordSchema), task: TaskSchema, taskAssessments: Type.Array(AssessmentRecordSchema), shortlist: ShortlistViewSchema
  }, o), {
    minItems: 4, maxItems: 4
  })
}, o);
const envelope = (data: TSchema) => Type.Object({
  data, meta: Type.Object({
    replayed: b()
  }, o)
}, o);
export const EnvelopeSchema = envelope(DemoSchema);
export const ComparisonEnvelopeSchema = envelope(ComparisonSchema);
