import { DIMENSIONS } from '../analysis.js';
import { fingerprint as hash } from '../fingerprint.js';
import { createSeed, DATASET_VERSION } from './task-seed.js';
import { CRITERIA, RUBRIC_VERSION, REQUIREMENT_IDS, type CriterionId, type Mark, type RequirementId } from './rubric.js';
import { calculateScores, isMark, type Scores } from './scoring.js';
import { applicationContent, ANNOTATION_DRAFTS, JD_ALIGNMENT_DRAFTS, JD, type SourceProvenance, type JDAlignmentStatus } from './content.js';
export { JD_VERSION } from './content.js';
export const FIXTURE_VERSION = 'harbour-retail-applications-v1' as const;
export const CANDIDATE_IDS = ['amy-chen', 'ann-li', 'david-liu', 'jamie-parker'] as const;
export type CandidateId = typeof CANDIDATE_IDS[number];
export interface Candidate { id: CandidateId; name: string; background: string }
export const CANDIDATES: readonly Candidate[] = [
  { id: 'amy-chen', name: 'Amy Chen', background: 'User-supplied fictional CV: data analytics degree and e-commerce reporting; newly authored channel SQL and analysis companions.' },
  { id: 'ann-li', name: 'Ann Li', background: 'User-supplied fictional CV: statistics/data science and an analytics internship; newly authored churn extraction and method companions.' },
  { id: 'david-liu', name: 'David Liu', background: 'User-supplied fictional CV: computer science and software development; newly authored task-list query and database note, not a completed analytics project.' },
  { id: 'jamie-parker', name: 'Jamie Parker', background: 'User-supplied fictional CV: marketing and basic spreadsheet reporting; newly authored social tracker and cafe campaign brief, without invented SQL experience.' },
];
export const COMPANY = {
  id: 'harbour-retail', name: 'Harbour Retail', provenance: 'user_supplied_demo_jd', location: 'Sydney, NSW',
  businessDescription: 'A growing Sydney-based e-commerce startup using data to improve customer acquisition, digital shopping experiences and commercial performance.',
  profileScope: 'JD facts only. Headcount, recruiter structure and named decision-makers are not supplied. Product, campaign and investment details in the company task are synthetic demonstration assumptions, not JD facts.',
} as const;
export const JOB = {
  id: 'junior-data-analyst', title: 'Junior Data Analyst', company: COMPANY.name,
  location: 'Sydney, NSW', employmentType: 'Full-time', experienceLevel: 'Entry Level / Junior', team: 'Data & Analytics',
  collaboratingTeams: ['Data', 'Marketing', 'Commercial'], supportedByExperiencedAnalysts: true,
  requirements: createSeed().job.requirements,
  successStages: ['Check definitions and provide reproducible routine reporting.', 'Compare relevant groups and explain uncertainty and missing evidence.', 'Support an appropriate evidence-led next step with experienced analysts.'],
  jd: JD,
} as const;
export interface EvidenceSource {
  sourceId: string; location: string; text: string; kind: 'application' | 'work_sample' | 'client_reported_event';
  provenance?: SourceProvenance;
}
export interface EvidenceSnapshot {
  candidateId: string; evidenceSnapshotId: string; fingerprint: string; sources: readonly EvidenceSource[];
}
export interface SourceRef {
  candidateId: string; evidenceSnapshotId: string; fingerprint: string;
  sourceId: string; location: string; start: number; end: number; quote: string;
}
export interface AssessmentItem {
  criterionId: CriterionId; mark: Mark; rationale: string; support: string; gaps: string;
  uncertainty: string; nextStep: string; checkedSourceIds: string[]; sourceRefs: SourceRef[];
}
export interface PresetReport {
  requirementId: RequirementId; status: 'supported' | 'uncertain'; displayStatus: 'Supported' | 'Uncertain';
  mode: 'preset'; summary: string; uncertainty: string; sourceRefs: SourceRef[];
}
export interface ApplicationBaseline {
  candidateId: CandidateId; jobId: 'junior-data-analyst'; evidenceSnapshotId: string; fingerprint: string;
  fixtureVersion: typeof FIXTURE_VERSION; rubricVersion: typeof RUBRIC_VERSION;
  stage: 'application_review'; assessmentRevision: 1; annotationMode: 'ai_authored';
  label: 'AI-authored demo assessment · Human calibration pending'; status: 'reviewed'; assessmentComplete: true;
  provenance: { sampleType: 'synthetic'; standardDesign: 'team_designed'; actualAnnotation: 'ai_agent_authored_fixture';
    actualReview: 'ai_agent_review'; humanCalibration: 'pending'; externalExpertValidation: false; note: string };
  items: AssessmentItem[]; score: Scores;
}
export interface JDAlignment {
  jdRequirementId: string; statuses: JDAlignmentStatus[]; summary: string; remainingUnknowns: string; sourceRefs: SourceRef[];
}
export interface ApplicationSnapshot extends EvidenceSnapshot {
  id: string; candidateId: CandidateId; jobId: 'junior-data-analyst'; fixtureVersion: typeof FIXTURE_VERSION;
  provenance: 'synthetic'; materialVersion: 1; scope: string; sources: EvidenceSource[];
  baseline: ApplicationBaseline; initialReport: PresetReport[]; jdAlignment: JDAlignment[];
}
export interface TaskTemplate {
  templateId: string; title: string; targetRequirementId: RequirementId; instructions: string;
  timeboxMinutes: 20; timeboxEnforced: false; datasetVersion: typeof DATASET_VERSION;
  resourceIds: string[]; observationDimensions: string[]; mode: 'preset';
}
const sharedResources = createSeed().dataset.resources.map(r => r.id);
export const TASK_TEMPLATES: Readonly<Record<RequirementId, TaskTemplate>> = {
  sql: { templateId: 'harbour-retail-sql-v1', title: 'Conversion Data Query Review', targetRequirementId: 'sql',
    instructions: 'First consider an existing query or explanation that addresses the selected gap. For this short task, use harbour-retail-2026-09-v1 to write a readable query fragment for the two-period conversion comparison. Explain the input grain, time windows, aggregation and any join. Describe practical checks and expected results for relevant duplicates, missing values and zero denominators. Submit text through the work-sample form; this is static review, not SQL execution or a general file upload. Shared resources overlap and are not independent populations.',
    timeboxMinutes: 20, timeboxEnforced: false, datasetVersion: DATASET_VERSION, resourceIds: [...sharedResources], observationDimensions: ['S1', 'S2', 'S3'], mode: 'preset' },
  'data-analysis': { templateId: 'harbour-retail-data-analysis-v1', title: 'Conversion Metrics and Comparison', targetRequirementId: 'data-analysis',
    instructions: 'First consider an existing calculation or explanation that addresses the selected gap. Use harbour-retail-2026-09-v1 to define and calculate session, order and conversion changes across two four-week periods. Show numerators, denominators, units and a relevant group comparison with reproducible working. State overlapping populations and missing information. Submit calculation text and limitations, not an executable notebook. Do not invent page-speed measurements, weekly trends or historical device data.',
    timeboxMinutes: 20, timeboxEnforced: false, datasetVersion: DATASET_VERSION, resourceIds: [...sharedResources], observationDimensions: ['D1', 'D2', 'D3'], mode: 'preset' },
  'business-problem-solving': { templateId: 'harbour-retail-bps-v1', title: 'Conversion Drop Investigation', targetRequirementId: 'business-problem-solving',
    instructions: 'First consider an existing explanation that addresses the selected gap. Investigate the conversion decline using harbour-retail-2026-09-v1. Distinguish observations from hypotheses, request evidence that could distinguish explanations, and recommend a practical next step with a way to check its result. Treat the 20-minute timebox as guidance, not a deadline. Work at a junior analyst level and identify decisions requiring an experienced colleague. Submit findings, hypotheses, missing evidence and next steps; incomplete work may still be reviewed.',
    timeboxMinutes: 20, timeboxEnforced: false, datasetVersion: DATASET_VERSION, resourceIds: [...sharedResources], observationDimensions: [...DIMENSIONS], mode: 'preset' },
};
/** Literal source validation; it does not certify that an interpretation is correct. */
export function validateSourceRef(snapshot: EvidenceSnapshot, ref: SourceRef): boolean {
  if (!ref || ref.candidateId !== snapshot.candidateId || ref.evidenceSnapshotId !== snapshot.evidenceSnapshotId
      || ref.fingerprint !== snapshot.fingerprint || typeof ref.quote !== 'string' || ref.quote.trim().length === 0
      || !Number.isSafeInteger(ref.start) || !Number.isSafeInteger(ref.end) || ref.start < 0 || ref.end <= ref.start) return false;
  const matches = snapshot.sources.filter(s => s.sourceId === ref.sourceId && s.location === ref.location);
  if (matches.length !== 1) return false;
  const source = matches[0]!;
  // UTF-16 code-unit offsets are deliberate, but boundaries must not split a surrogate pair.
  const splitsPair = (offset: number) => offset > 0 && offset < source.text.length
    && source.text.charCodeAt(offset - 1) >= 0xD800 && source.text.charCodeAt(offset - 1) <= 0xDBFF
    && source.text.charCodeAt(offset) >= 0xDC00 && source.text.charCodeAt(offset) <= 0xDFFF;
  return ref.end <= source.text.length && !splitsPair(ref.start) && !splitsPair(ref.end)
    && source.text.slice(ref.start, ref.end) === ref.quote;
}

export function validateAssessmentItems(snapshot: EvidenceSnapshot, items: readonly AssessmentItem[], expectedCriterionIds?: readonly CriterionId[]): void {
  if (!Array.isArray(items) || items.length === 0 || items.length > CRITERIA.length) throw new RangeError('Invalid assessment item count.');
  const sourceIds = new Set(snapshot.sources.map(s => s.sourceId));
  if (sourceIds.size !== snapshot.sources.length) throw new RangeError('Duplicate source ID in evidence snapshot.');
  const seen = new Set<CriterionId>();
  const nonblank = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  for (const item of items) {
    if (!item || !CRITERIA.some(c => c.id === item.criterionId) || seen.has(item.criterionId) || !isMark(item.mark)) {
      throw new RangeError('Invalid or duplicate criterion or mark.');
    }
    seen.add(item.criterionId);
    if (![item.rationale, item.support, item.gaps, item.uncertainty, item.nextStep].every(nonblank)) {
      throw new RangeError('Assessment explanations must be nonblank.');
    }
    if (!Array.isArray(item.checkedSourceIds) || item.checkedSourceIds.length === 0
        || new Set(item.checkedSourceIds).size !== item.checkedSourceIds.length
        || item.checkedSourceIds.some((id: string) => !sourceIds.has(id))) throw new RangeError('Invalid checked-source scope.');
    if (!Array.isArray(item.sourceRefs) || (item.mark !== 'NE' && item.sourceRefs.length === 0)
        || item.sourceRefs.some((ref: SourceRef) => !validateSourceRef(snapshot, ref) || !item.checkedSourceIds.includes(ref.sourceId))) {
      throw new RangeError('Assessment source binding or UTF-16 citation is invalid.');
    }
  }
  if (expectedCriterionIds !== undefined && (new Set(expectedCriterionIds).size !== expectedCriterionIds.length
      || seen.size !== expectedCriterionIds.length || expectedCriterionIds.some(id => !seen.has(id)))) {
    throw new RangeError('Assessment must contain the expected criterion group.');
  }
}

function createMaterials(candidateId: CandidateId) {
  const evidenceSnapshotId = `${candidateId}-application-r6-v1`;
  const sources: EvidenceSource[] = applicationContent(candidateId).map((source, index) => ({
    ...source, kind: source.provenance.origin === 'user_supplied_fictional_cv' ? 'application' : 'work_sample', location: `/sources/${index}/text`,
  }));
  const content = { candidateId, jobId: JOB.id, fixtureVersion: FIXTURE_VERSION, materialVersion: 1 as const, evidenceSnapshotId, sources };
  return { ...content, id: `${candidateId}-demo-application`, fingerprint: hash(content), provenance: 'synthetic' as const,
    scope: 'Immutable new application materials: user-confirmed fictional CV plus clearly labelled synthetic companions. Original fictional PDF downloads are unredacted; default display text omits contact headers. Past projects are separate from company task data and formal V1/V2 submissions. Static review does not verify authorship, execution, employment or future performance.' };
}
const materials = Object.fromEntries(CANDIDATE_IDS.map(id => [id, createMaterials(id)])) as Record<CandidateId, ReturnType<typeof createMaterials>>;
function cite(candidateId: CandidateId, sourceId: string, quote: string): SourceRef {
  const snapshot = materials[candidateId];
  const source = snapshot.sources.find(s => s.sourceId === sourceId);
  const start = source?.text.indexOf(quote) ?? -1;
  if (!source || start < 0 || quote.length === 0 || source.text.indexOf(quote, start + 1) !== -1) throw new RangeError(`Fixture quote is absent or ambiguous: ${candidateId}/${sourceId}`);
  const ref = { candidateId, evidenceSnapshotId: snapshot.evidenceSnapshotId, fingerprint: snapshot.fingerprint,
    sourceId, location: source.location, start, end: start + quote.length, quote };
  if (!validateSourceRef(snapshot, ref)) throw new Error('Invalid bound fixture citation.');
  return ref;
}
const annotations: Record<CandidateId, AssessmentItem[]> = Object.fromEntries(CANDIDATE_IDS.map(candidateId => [candidateId,
  ANNOTATION_DRAFTS[candidateId]!.map(({ citations, ...annotation }) => ({ ...annotation,
    checkedSourceIds: materials[candidateId].sources.map(s => s.sourceId),
    sourceRefs: citations.map(ref => cite(candidateId, ref.sourceId, ref.quote)),
  })),
])) as Record<CandidateId, AssessmentItem[]>;
const summaries: Record<CandidateId, Array<{ status: 'supported' | 'uncertain'; summary: string; uncertainty: string }>> = {
  'amy-chen': [
    { status: 'supported', summary: 'Static channel-period SQL makes grain, aligned windows and practical checks inspectable.', uncertainty: 'Execution and original export definitions remain unverified.' },
    { status: 'supported', summary: 'The prepared channel worksheet reproduces metric changes and weighted comparisons.', uncertainty: 'These are synthetic prepared counts, not independent extraction evidence.' },
    { status: 'uncertain', summary: 'The operations note identifies a plausible hypothesis and a specific request, but not the contrasting implications or decision-linked validation.', uncertainty: 'A focused explanation could clarify the reasoning; this is not a judgement of underlying capability.' },
  ],
  'ann-li': [
    { status: 'uncertain', summary: 'A customer-snapshot extract and proposed checks are visible; feature-window and comparison logic are incomplete.', uncertainty: 'The CV claims broader SQL work than the attached extract demonstrates.' },
    { status: 'supported', summary: 'Cohort arithmetic and a clearly bounded model-evaluation procedure are inspectable.', uncertainty: 'No measured capstone model comparison, execution or business outcome is supplied. This limited support does not imply every DA criterion is fully met.' },
    { status: 'uncertain', summary: 'Association limits and follow-up considerations are clear, but a decision-specific investigation and validation plan are not.', uncertainty: 'Model complexity and the separate internship AUC are not job-match percentages.' },
  ],
  'david-liu': [
    { status: 'uncertain', summary: 'A soundly described application join and functional checks are visible; analytical comparisons are not supplied.', uncertainty: 'The missing comparison is NE rather than a failed query or an inference of inability.' },
    { status: 'uncertain', summary: 'No analytical calculation or business period/group comparison is present in the checked software sample.', uncertainty: 'Software documentation is not relabelled as data-analysis evidence.' },
    { status: 'uncertain', summary: 'The supplied software scope contains no business investigation or evidence-led recommendation to assess.', uncertainty: 'Missing work evidence is not a personal deficiency or automatic rejection.' },
  ],
  'jamie-parker': [
    { status: 'uncertain', summary: 'The CV and two marketing companions supply no SQL material.', uncertainty: 'Basic spreadsheet reporting does not establish SQL skill; no SQL error was observed.' },
    { status: 'supported', summary: 'Simple social-action and follower calculations are reproducible and their reporting limits are stated.', uncertainty: 'No workbook, original platform export or detailed post-level comparison is attached.' },
    { status: 'uncertain', summary: 'A bounded campaign plan and follow-up checks are present, but discriminating evidence and success criteria need clarification.', uncertainty: 'The planning brief does not claim launch, causation or a sales gain.' },
  ],
};
const applications: Record<CandidateId, ApplicationSnapshot> = Object.fromEntries(CANDIDATE_IDS.map(candidateId => {
  const snapshot = materials[candidateId]; const items = annotations[candidateId];
  validateAssessmentItems(snapshot, items, CRITERIA.map(c => c.id));
  const baseline: ApplicationBaseline = {
    candidateId, jobId: JOB.id, evidenceSnapshotId: snapshot.evidenceSnapshotId, fingerprint: snapshot.fingerprint,
    fixtureVersion: FIXTURE_VERSION, rubricVersion: RUBRIC_VERSION, stage: 'application_review', assessmentRevision: 1,
    annotationMode: 'ai_authored', label: 'AI-authored demo assessment · Human calibration pending', status: 'reviewed', assessmentComplete: true,
    provenance: { sampleType: 'synthetic', standardDesign: 'team_designed', actualAnnotation: 'ai_agent_authored_fixture',
      actualReview: 'ai_agent_review', humanCalibration: 'pending', externalExpertValidation: false,
      note: 'AI-authored annotations and AI-agent source/range/arithmetic review of user-confirmed fictional CVs and new synthetic companions. This is internal agent review, not independent human approval. Human calibration and external validation remain pending; the core rubric is not an all-JD match rate.' },
    items, score: calculateScores(items),
  };
  const initialReport: PresetReport[] = REQUIREMENT_IDS.map((requirementId, index) => ({
    ...summaries[candidateId][index]!, requirementId,
    displayStatus: summaries[candidateId][index]!.status === 'supported' ? 'Supported' : 'Uncertain', mode: 'preset',
    sourceRefs: items.filter(i => CRITERIA.find(c => c.id === i.criterionId)?.requirementId === requirementId)
      .flatMap(i => i.sourceRefs).filter((ref, i, refs) => refs.findIndex(r => r.sourceId === ref.sourceId && r.start === ref.start && r.end === ref.end) === i),
  }));
  const jdAlignment: JDAlignment[] = JD_ALIGNMENT_DRAFTS[candidateId]!.map(({ citations, ...entry }) => ({ ...entry,
    sourceRefs: citations.map(ref => cite(candidateId, ref.sourceId, ref.quote)),
  }));
  if (jdAlignment.length !== JD.requirements.length || new Set(jdAlignment.map(row => row.jdRequirementId)).size !== JD.requirements.length
    || jdAlignment.some(row => !JD.requirements.some(req => req.id === row.jdRequirementId))) throw new Error('Incomplete JD alignment.');
  return [candidateId, { ...snapshot, baseline, initialReport, jdAlignment }];
})) as Record<CandidateId, ApplicationSnapshot>;
export function getApplication(candidateId: string): ApplicationSnapshot {
  if (!CANDIDATE_IDS.includes(candidateId as CandidateId)) throw new RangeError('Unknown candidate ID.');
  return structuredClone(applications[candidateId as CandidateId]);
}
export const B3_EXPLANATION = {
  label: 'AI-authored demo assessment · Human calibration pending', companyRequirement: 'Identify when additional data is required before reaching a business conclusion.',
  criterion: CRITERIA.find(c => c.id === 'B3')!, ...annotations['amy-chen'].find(i => i.criterionId === 'B3')!,
  contribution: 5, maxContribution: 10, markMaximum: 4, rubricVersion: RUBRIC_VERSION, fixtureVersion: FIXTURE_VERSION,
};
function freezeDeep(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  Object.values(value).forEach(freezeDeep); Object.freeze(value);
}
[CANDIDATES, COMPANY, JOB, TASK_TEMPLATES, applications, B3_EXPLANATION].forEach(freezeDeep);
