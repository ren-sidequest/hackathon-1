import { Type, type Static } from '@sinclair/typebox';
import { WorkSchema, ErrorSchema, WriteHeaders } from '../schema.js';
export { ErrorSchema, WriteHeaders };
const exact = {
  additionalProperties: false
};
export const SCHEMA_VERSION = '3.0' as const;
const id = Type.String({
  minLength: 1, maxLength: 100, pattern: '^[A-Za-z0-9_.:-]+$'
});
const text = (maxLength = 2000) => Type.String({
  minLength: 1, maxLength, pattern: '\\S'
});
const nullable = <T extends import('@sinclair/typebox').TSchema>(s: T) => Type.Union([
  s, Type.Null()
]);
const enumOf = <T extends string>(items: T[]) => Type.Union(items.map(x => Type.Literal(x)));
export const CandidateSchema = enumOf([
  'alex-chen', 'maya-patel', 'leo-zhang', 'sam-taylor'
]);
export const RequirementSchema = enumOf([
  'sql', 'data-analysis', 'business-problem-solving'
]);
export const StageSchema = enumOf([
  'application_review', 'task_v1', 'task_v2'
]);
export const FingerprintSchema = Type.String({
  pattern: '^[a-f0-9]{64}$'
});
export const CriterionSchema = enumOf([
  'S1', 'S2', 'S3', 'D1', 'D2', 'D3', 'B1', 'B2', 'B3', 'B4'
]);
export const SourceRefSchema = Type.Object({
  candidateId: CandidateSchema, evidenceSnapshotId: id,
  fingerprint: FingerprintSchema, sourceId: id, location: text(300), start: Type.Integer({
    minimum: 0
  }),
  end: Type.Integer({
    minimum: 1
  }), quote: text(2000)
}, exact);
export const AssessmentItemSchema = Type.Object({
  criterionId: CriterionSchema,
  mark: Type.Union([
    Type.Integer({
      minimum: 0, maximum: 4
    }), Type.Literal('NE')
  ]),
  rationale: text(), support: text(), gaps: text(), uncertainty: text(), nextStep: text(),
  checkedSourceIds: Type.Array(id, {
    minItems: 1, maxItems: 100, uniqueItems: true
  }),
  sourceRefs: Type.Array(SourceRefSchema, {
    maxItems: 10
  })
}, exact);
export const Base = {
  schemaVersion: Type.Literal(SCHEMA_VERSION), sessionId: id, candidateId: CandidateSchema,
  jobId: Type.Literal('junior-data-analyst'), datasetVersion: id
};
export const TaskBinding = {
  ...Base, taskId: id, targetRequirementId: RequirementSchema
};
export const SubmissionBinding = {
  ...TaskBinding, submissionId: id, contentFingerprint: FingerprintSchema
};
export const SendSchema = Type.Object({
  ...TaskBinding, templateId: id, instructions: text(4000), gapReason: text()
}, exact);
export const SubmitSchema = Type.Object({
  ...TaskBinding, submissionVersion: Type.Union([
    Type.Literal(1), Type.Literal(2)
  ]),
  previousSubmissionId: nullable(id), previousContentFingerprint: nullable(FingerprintSchema), ...WorkSchema.properties
}, exact);
export const AnalyzeSchema = Type.Object(SubmissionBinding, exact);
export const ReviewSchema = Type.Object({
  ...SubmissionBinding,
  decision: enumOf([
    'confirm', 'needs_more_evidence', 'evidence_still_insufficient'
  ]), comment: text()
}, exact);
export const ReuseSchema = Type.Object({
  assessmentRevision: Type.Integer({
    minimum: 1
  }),
  evidenceSnapshotId: id, fingerprint: FingerprintSchema
}, exact);
export const AssessmentSchema = Type.Object({
  ...Base, stage: StageSchema, evidenceSnapshotId: id,
  fingerprint: FingerprintSchema, submissionId: nullable(id), contentFingerprint: nullable(FingerprintSchema),
  rubricVersion: id, expectedAssessmentRevision: Type.Integer({
    minimum: 0
  }),
  items: Type.Array(AssessmentItemSchema, {
    minItems: 3, maxItems: 10
  }),
  reuseApplication: nullable(ReuseSchema), operatorLabel: text(120)
}, exact);
export const ShortlistSchema = Type.Object({
  ...Base, action: enumOf([
    'retain', 'remove', 'reconfirm'
  ]), reason: text(),
  stage: StageSchema, evidenceSnapshotId: id, fingerprint: FingerprintSchema,
  assessmentRevision: nullable(Type.Integer({
    minimum: 1
  })), rubricVersion: id,
  expectedShortlistRevision: Type.Integer({
    minimum: 0
  }), operatorLabel: text(120)
}, exact);
export const ResetSchema = Type.Object({
  schemaVersion: Type.Literal(SCHEMA_VERSION), sessionId: id
}, exact);
export const QuerySchema = Type.Object({
  candidateId: CandidateSchema
}, exact);
export type SendRequest = Static<typeof SendSchema>;
export type SubmitRequest = Static<typeof SubmitSchema>;
export type AnalyzeRequest = Static<typeof AnalyzeSchema>;
export type ReviewRequest = Static<typeof ReviewSchema>;
export type AssessmentRequest = Static<typeof AssessmentSchema>;
export type ShortlistRequest = Static<typeof ShortlistSchema>;
export type ResetRequest = Static<typeof ResetSchema>;
export type Stage = Static<typeof StageSchema>;
export type PersonId = Static<typeof CandidateSchema>;
