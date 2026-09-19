import { Type } from '@sinclair/typebox';
import { AnalysisStateSchema, ReviewRecordSchema, SubmissionSchema } from './schema.js';
const o = { additionalProperties: false } as const;
const s = () => Type.String(); const n = () => Type.Number();
const nullable = <T extends ReturnType<typeof Type.Object>>(schema: T) => Type.Union([schema, Type.Null()]);
const record = Type.Object({ id: s(), period: s(), channel: s(), sessions: n(), orders: n(), adSpendCents: n(), revenueCents: n() }, o);
const metrics = Type.Object({ sessions: n(), orders: n(), adSpendCents: n(), revenueCents: n(), conversionPct: n() }, o);
const initial = Type.Object({ requirementId: s(), status: s(), displayStatus: s(), mode: s(), summary: s(), uncertainty: s(),
  sourceRefs: Type.Array(Type.Object({ sourceId: s(), locator: s(), quote: s() }, o)) }, o);
export const DemoSchema = Type.Object({
  schemaVersion: Type.Literal('1.0'), sessionId: s(), datasetVersion: s(), revision: Type.Integer(),
  candidate: Type.Object({ id: s(), name: s() }, o),
  job: Type.Object({ id: s(), title: s(), company: s(), requirements: Type.Array(Type.Object({ id: s(), title: s(), statement: s() }, o)) }, o),
  application: Type.Object({ id: s(), mode: s(), sources: Type.Array(Type.Object({ id: s(), name: s(), kind: s(), provenance: s(), content: s() }, o)), initialReport: Type.Array(initial) }, o),
  dataset: Type.Object({ version: s(), provenance: s(), records: Type.Array(record),
    metrics: Type.Object({ previous: metrics, current: metrics, change: Type.Object({ trafficPct: n(), ordersPct: n(), adSpendPct: n(), conversionPercentagePoints: n() }, o) }, o),
    channels: Type.Array(Type.Object({ id: s(), channel: s(), traffic: n(), growth: n(), orders: n(), conversion: n(), previous: n(), revenue: n(), trafficSharePct: n(), before: record, current: record }, o)),
    trafficTrend: Type.Array(Type.Object({ period: s(), label: s(), sessions: n(), traffic: n(), orders: n(), conversion: n() }, o)),
    resources: Type.Array(Type.Object({ id: s(), name: s(), datasetVersion: s(), provenance: s(), mimeType: s(), description: s(),
      columns: Type.Array(s()), rows: Type.Array(Type.Array(s())), content: s(), sizeBytes: Type.Integer(), text: Type.Optional(s()) }, o)),
  }, o),
  task: Type.Object({ id: s(), taskId: s(), requirementId: s(), title: s(), instructions: s(), timeboxMinutes: n(), timeboxEnforced: Type.Boolean(), mode: s(), resourceIds: Type.Array(s()),
    status: Type.Union([Type.Literal('draft'), Type.Literal('sent'), Type.Literal('submitted'), Type.Literal('reviewed')]), sentAt: Type.Union([s(), Type.Null()]) }, o),
  submission: nullable(SubmissionSchema), analysis: AnalysisStateSchema, review: nullable(ReviewRecordSchema),
  report: Type.Object({ mode: s(), isHiringDecision: Type.Literal(false), review: nullable(ReviewRecordSchema),
    requirements: Type.Array(Type.Object({ ...initial.properties, title: s(), displayLabel: s(), review: nullable(ReviewRecordSchema),
      submissionSourceRefs: Type.Array(Type.Object({ submissionId: s(), contentFingerprint: s(), sourceId: s(), location: s() }, o)) }, o)),
  }, o),
}, o);
export const EnvelopeSchema = Type.Object({ data: DemoSchema, meta: Type.Object({ replayed: Type.Boolean() }, o) }, o);
