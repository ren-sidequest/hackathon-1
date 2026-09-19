import { Type, FormatRegistry, type Static } from '@sinclair/typebox';

FormatRegistry.Set('date-time', value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
const enums = <T extends string>(values: T[]) => Type.Union(values.map(value => Type.Literal(value)));
const exact = { additionalProperties: false } as const;
const id = Type.String({ minLength: 1, maxLength: 80, pattern: '^[A-Za-z0-9_-]+$' });
const nonblank = (maxLength: number) => Type.String({ minLength: 1, maxLength, pattern: '\\S' });
export const binding = {
  schemaVersion: Type.Literal('1.0'), sessionId: id,
  taskId: id, datasetVersion: id,
};
export const FindingSchema = Type.Object({
  id, section: enums(['Key Findings', 'Hypotheses', 'Additional Evidence Needed', 'Recommended Next Steps']),
  title: nonblank(300), detail: Type.String({ maxLength: 4000 }),
  source: Type.String({ maxLength: 80 }), confidence: enums(['High', 'Medium', 'Low']),
}, exact);
export const EventSchema = Type.Object({
  id, at: Type.String({ format: 'date-time' }), title: nonblank(200),
  detail: Type.Optional(Type.String({ maxLength: 1000 })),
}, exact);
export const WorkSchema = Type.Object({
  summary: nonblank(8000), findings: Type.Array(FindingSchema, { maxItems: 40 }),
  processEvidence: Type.Array(EventSchema, { maxItems: 100 }),
}, exact);
export const SendSchema = Type.Object({ ...binding, instructions: nonblank(4000) }, exact);
export const SubmitSchema = Type.Object({ ...binding, candidateId: id, ...WorkSchema.properties }, exact);
export const AnalyzeSchema = Type.Object({
  ...binding, submissionId: id, contentFingerprint: Type.String({ pattern: '^[a-f0-9]{64}$' }),
}, exact);
export const ReviewSchema = Type.Object({
  ...AnalyzeSchema.properties, requirementId: id,
  decision: enums(['confirm', 'needs_more_evidence', 'evidence_still_insufficient']),
  comment: nonblank(2000),
}, exact);
export const ResetSchema = Type.Object({ schemaVersion: Type.Literal('1.0'), sessionId: id }, exact);
export const SourceSchema = Type.Object({
  sourceId: Type.String(), location: Type.String(), text: Type.String(),
  kind: Type.Union([Type.Literal('work_sample'), Type.Literal('client_reported_event')]),
}, exact);
export const CitationSchema = Type.Object({
  sourceId: Type.String(), location: Type.String(), quote: Type.String(),
  start: Type.Integer({ minimum: 0 }), end: Type.Integer({ minimum: 1 }),
}, exact);
export const ObservationSchema = Type.Object({
  dimension: enums(['Problem Framing', 'Evidence Navigation', 'Hypothesis Formation', 'Evidence Seeking', 'Decision Making']),
  status: Type.Union([Type.Literal('observed'), Type.Literal('not_observed')]),
  statement: Type.String(), citations: Type.Array(CitationSchema), scope: Type.String(), uncertainty: Type.String(),
}, exact);
export const AnalysisResultSchema = Type.Object({
  mode: enums(['live', 'manual_simulation', 'replay']),
  model: Type.Union([Type.String(), Type.Null()]), promptVersion: Type.String(),
  submissionId: id, contentFingerprint: Type.String(), observations: Type.Array(ObservationSchema),
  provenance: Type.Object({
    provider: Type.Union([Type.Literal('openai'), Type.Literal('manual_rules')]),
    generatedAt: Type.String(), responseId: Type.Union([Type.String(), Type.Null()]),
    processEvidence: Type.Literal('client_reported'),
  }, exact),
}, exact);
export const SubmissionSchema = Type.Object({
  ...SubmitSchema.properties, submissionId: id, submittedAt: Type.String(), contentFingerprint: Type.String(),
  processEvidenceProvenance: Type.Literal('client_reported'), sources: Type.Array(SourceSchema),
}, exact);
export const ReviewRecordSchema = Type.Object({ ...ReviewSchema.properties, reviewId: id, reviewedAt: Type.String() }, exact);
export const AnalysisStateSchema = Type.Object({
  status: enums(['not_started', 'running', 'succeeded', 'failed']),
  attemptId: Type.Union([id, Type.Null()]), submissionId: Type.Union([id, Type.Null()]),
  contentFingerprint: Type.Union([Type.String(), Type.Null()]),
  startedAt: Type.Union([Type.String(), Type.Null()]), finishedAt: Type.Union([Type.String(), Type.Null()]),
  errorCode: Type.Union([Type.String(), Type.Null()]),
  result: Type.Union([AnalysisResultSchema, Type.Null()]),
}, exact);
export const ErrorSchema = Type.Object({ error: Type.Object({
  code: Type.String(), message: Type.String(), requestId: Type.String(), retryable: Type.Boolean(),
}, exact) }, exact);
export const WriteHeaders = Type.Object({
  'idempotency-key': Type.String({ minLength: 8, maxLength: 100, pattern: '^[A-Za-z0-9_-]+$' }),
}, { additionalProperties: true });
export type SendRequest = Static<typeof SendSchema>;
export type SubmitRequest = Static<typeof SubmitSchema>;
export type AnalyzeRequest = Static<typeof AnalyzeSchema>;
export type ReviewRequest = Static<typeof ReviewSchema>;
export type ResetRequest = Static<typeof ResetSchema>;
export type Submission = Static<typeof SubmissionSchema>;
export type ReviewRecord = Static<typeof ReviewRecordSchema>;
export type AnalysisState = Static<typeof AnalysisStateSchema>;
