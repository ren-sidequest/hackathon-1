import { DIMENSIONS } from '../analysis.js';
import { fingerprint as hash } from '../fingerprint.js';
import { createSeed, DATASET_VERSION } from '../seed.js';
import { CRITERIA, RUBRIC_VERSION, type CriterionId, type Mark, type RequirementId } from './rubric.js';
import { calculateScores, isMark, type Scores } from './scoring.js';

export const FIXTURE_VERSION = 'harbourcart-applications-v1' as const;
export const CANDIDATE_IDS = ['alex-chen', 'maya-patel', 'leo-zhang', 'sam-taylor'] as const;
export type CandidateId = typeof CANDIDATE_IDS[number];
export interface Candidate { id: CandidateId; name: string; background: string }
export const CANDIDATES: readonly Candidate[] = [
  { id: 'alex-chen', name: 'Alex Chen', background: 'Synthetic junior analyst application: monthly SQL and calculation samples, with a newly versioned short business memo.' },
  { id: 'maya-patel', name: 'Maya Patel', background: 'Synthetic operations reporting application: campaign report and calculation appendix; SQL experience is self-reported.' },
  { id: 'leo-zhang', name: 'Leo Zhang', background: 'Synthetic cooperative-store analysis project: query, calculation audit and investigation plan.' },
  { id: 'sam-taylor', name: 'Sam Taylor', background: 'Synthetic fundraising reporting project: query and validation notes alongside a report with causal inference problems.' },
];
export const COMPANY = {
  id: 'harbourcart', name: 'HarbourCart Pty Ltd', provenance: 'synthetic', location: 'Sydney', approximateHeadcount: 25,
  products: ['Accessories', 'Tote bags', 'Stationery'], fulfilment: 'Partly outsourced',
  hiringManager: 'Operations manager', budgetApprover: 'Founder', dedicatedRecruitingTeam: false,
  businessProblem: 'Traffic is increasing while orders fall; investigate reliably before expanding advertising spend.',
  constraints: ['Small team and limited analysis time', 'Incomplete campaign, historical device and checkout data'],
} as const;
export const JOB = {
  id: 'junior-data-analyst', title: 'Junior Data Analyst', company: COMPANY.name, reportsTo: 'Operations manager',
  requirements: createSeed().job.requirements,
  successStages: ['核对指标定义并提供可复核的基础报表。', '调查期间和分组变化，说明缺失证据。', '提出有优先级、可验证的下一步。'],
} as const;

export interface EvidenceSource {
  sourceId: string; location: string; text: string; kind: 'application' | 'work_sample' | 'client_reported_event';
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
  stage: 'application_review'; assessmentRevision: 1; annotationMode: 'preset_human';
  label: '合成案例·预置人工评估'; status: 'reviewed';
  provenance: { sampleType: 'synthetic'; standardDesign: 'team_designed'; actualAnnotation: 'ai_agent_authored_fixture';
    actualReview: 'ai_agent_review'; humanCalibration: 'pending'; externalExpertValidation: false; note: string };
  items: AssessmentItem[]; score: Scores;
}
export interface ApplicationSnapshot extends EvidenceSnapshot {
  id: string; candidateId: CandidateId; jobId: 'junior-data-analyst'; fixtureVersion: typeof FIXTURE_VERSION;
  provenance: 'synthetic'; materialVersion: 1; scope: string; sources: EvidenceSource[];
  baseline: ApplicationBaseline; initialReport: PresetReport[];
}
export interface TaskTemplate {
  templateId: string; title: string; targetRequirementId: RequirementId; instructions: string;
  timeboxMinutes: 20; timeboxEnforced: false; datasetVersion: typeof DATASET_VERSION;
  resourceIds: string[]; observationDimensions: string[]; mode: 'preset';
}
const sharedResources = createSeed().dataset.resources.map(r => r.id);
export const TASK_TEMPLATES: Readonly<Record<RequirementId, TaskTemplate>> = {
  sql: { templateId: 'harbourcart-sql-v1', title: 'Conversion Data Query Review', targetRequirementId: 'sql',
    instructions: 'Use harbourcart-2026-09-v1 to write a readable query fragment for the two-period conversion comparison. Explain the input grain, time windows, aggregation and any join. Describe practical checks and expected check results for relevant duplicates, missing values and zero denominators. Submit query text, explanations and checks; this is static code review, not online SQL execution. Shared resources overlap and must not be added as independent populations.',
    timeboxMinutes: 20, timeboxEnforced: false, datasetVersion: DATASET_VERSION, resourceIds: [...sharedResources], observationDimensions: ['S1', 'S2', 'S3'], mode: 'preset' },
  'data-analysis': { templateId: 'harbourcart-data-analysis-v1', title: 'Conversion Metrics and Comparison', targetRequirementId: 'data-analysis',
    instructions: 'Use harbourcart-2026-09-v1 to define and calculate the main session, order and conversion changes across the two four-week periods. Show numerators, denominators, units and a relevant group comparison, with enough working to reproduce the result. State overlapping resource populations and missing data. Submit calculation text and limitations; no executable notebook is required. Do not invent page-speed measurements or historical device trends.',
    timeboxMinutes: 20, timeboxEnforced: false, datasetVersion: DATASET_VERSION, resourceIds: [...sharedResources], observationDimensions: ['D1', 'D2', 'D3'], mode: 'preset' },
  'business-problem-solving': { templateId: 'harbourcart-bps-v1', title: 'Conversion Drop Investigation', targetRequirementId: 'business-problem-solving',
    instructions: 'Investigate the conversion decline using harbourcart-2026-09-v1. Identify the strongest observations, distinguish them from hypotheses, request evidence that could test competing explanations, and recommend a prioritised action with a way to check its result. Work within HarbourCart’s small-team constraints. Submit findings, hypotheses, missing evidence and next steps using the investigation board; incomplete or weak work may still be submitted for review.',
    timeboxMinutes: 20, timeboxEnforced: false, datasetVersion: DATASET_VERSION, resourceIds: [...sharedResources], observationDimensions: [...DIMENSIONS], mode: 'preset' },
};

/* Source materials are authored first. Assessment annotations below only cite these snapshots.
 * Application exercises are not future task submissions or shared reference answers. */
const originalAlex = createSeed().application.sources;
const materialSources: Record<CandidateId, Array<{ sourceId: string; text: string }>> = {
  'alex-chen': [
    ...originalAlex.map(s => ({ sourceId: s.id, text: s.content })),
    { sourceId: 'business_memo.md', text: `# Alex Chen — supplementary application memo
Synthetic application attachment added in harbourcart-applications-v1. This is not a task V1/V2 submission. The earlier monthly project remains a separate application exercise.

Business question: HarbourCart is considering increasing advertising spend while conversion is falling. First clarify which change deserves investigation. The team has limited analysis time; I have not assigned an owner or an action sequence.
The published synthetic scenario brief reports sessions of 1,000,000 then 1,180,000 and orders of 34,000 then 30,680. The conversion decline is an observation, not proof that the new campaigns caused it. A campaign mix change is one hypothesis; other hypotheses are not yet developed here.

🔎 补证想法
我会请求两个期间的 campaign × device 明细，以及各步 checkout 事件。
这份初始说明尚未写出如何根据不同结果判断假设，也没有业务行动与验证指标。` },
  ],
  'maya-patel': [
    { sourceId: 'cv.md', text: `# Maya Patel — synthetic application CV
I prepared weekly operations summaries for a fictional community stationery shop project. My contribution was the comparison worksheet and a concise manager memo. I describe basic SQL familiarity, but have not attached an original query or a SQL validation example. These are self-statements, not verified work history.` },
    { sourceId: 'sql_statement.md', text: `# SQL self-statement
I have used SELECT and spreadsheet exports in practice exercises. No original SQL query, time-filter logic, grain explanation or SQL check output is included in this application. This statement is not evidence that any particular query was executed correctly.` },
    { sourceId: 'analysis.md', text: `# Maya Patel — stationery promotion worksheet and memo
Synthetic independent application exercise, not the HarbourCart task dataset. Two consecutive non-overlapping four-week windows use the same completed-order and session definitions, in AUD.

Previous: 10,000 sessions, 400 completed orders, AUD 12,000 revenue. Current: 12,000 sessions, 420 orders, AUD 12,600 revenue.
Conversion = completed orders / sessions × 100: 400 / 10,000 = 4.0%; 420 / 12,000 = 3.5%, down 0.5 percentage points (12.5% relative). Order growth = (420 - 400) / 400 = 5.0%; average order value = revenue / orders = AUD 30 in both periods.
Paid: 4,000 sessions / 120 orders then 6,000 / 150, so conversion 3.0% to 2.5%. Returning-customer channel: 6,000 / 280 then 6,000 / 270, so 4.6667% to 4.5%. The channel totals reconcile to each period; Paid’s session weight rises from 40% to 50%. Overall rates use total orders / total sessions, not a simple average of channel rates. Worksheet and memo describe the same population.
Reproduction: sum the two channel rows per period, then apply the stated formulas to integer counts; display rounding is last. I have only prepared aggregates, not raw logs or an independent extraction, and historical device detail is missing.

The manager must decide whether to extend the promotion with one analyst-day available. First determine whether the lower overall conversion reflects channel mix, a within-channel issue, or both; orders rose, so declining conversion alone is not evidence of falling revenue.
The Paid decline and growing weight are observations. Campaign mix is a hypothesis, not an established cause. I have not yet compared a measurement-change explanation.
Request campaign × device counts for both windows and compare conversion within aligned cells: stable cell rates with a changing mix would favour the mix hypothesis. Reconcile cell totals first. I have not specified a contrasting result or a minimum usable cell size.
First ask the operations manager for the export and reconcile it, then use the remaining analyst time on the largest changed cells before extending spend. Track conversion and completed orders together. An explicit stopping threshold is not yet specified.` },
  ],
  'leo-zhang': [
    { sourceId: 'cv.md', text: `# Leo Zhang — synthetic application CV
My fictional cooperative-store project includes a read-only query, reconciliation checklist and manager memo. I claim authorship for this application exercise. Independent completion, production performance and work experience have not been verified.` },
    { sourceId: 'query.sql', text: `-- Leo's cooperative-store application exercise, distinct from HarbourCart task data.
-- Inputs are prepared daily aggregates: one row per day and channel; sessions/orders are integer counts.
-- Source import contract: UNIQUE(day, channel), non-null day/channel/counts, non-negative counts.
-- DATE values use the store's fixed local reporting calendar; no timestamp conversion occurs here.
-- Compare consecutive, non-overlapping four-week windows [2026-03-02,2026-03-30) and [2026-03-30,2026-04-27).
WITH labelled AS (
 SELECT CASE WHEN day < DATE '2026-03-30' THEN 'previous' ELSE 'current' END AS period,
        channel, sessions, orders
 FROM daily_channel
 WHERE day >= DATE '2026-03-02' AND day < DATE '2026-04-27'
)
SELECT period, channel, SUM(sessions) AS sessions, SUM(orders) AS orders,
       100.0 * SUM(orders) / NULLIF(SUM(sessions), 0) AS conversion_pct
FROM labelled GROUP BY period, channel;
-- No join is needed; adding the matching order export would duplicate the same population.
-- Before aggregation: SELECT day, channel, COUNT(*) FROM daily_channel GROUP BY day, channel HAVING COUNT(*) <> 1; expect zero rows.
-- Reject null/negative counts; count those rows before calculating and expect zero. Compare sum of each period's channel results to the source totals below.
-- A zero-session group returns NULL conversion, not 0%; flag any orders > sessions for investigation.
-- Expected reconciliation from prepared facts: previous 2000 sessions / 100 orders, current 2400 / 108.
-- Boundary check: 2026-03-30 belongs only to current; 2026-04-27 is excluded.
-- These are proposed checks and expected results. The application contains code text; no execution log is attached.` },
    { sourceId: 'analysis.md', text: `# Leo Zhang — cooperative-store report
Synthetic independent application exercise. Use the same two four-week local-calendar windows as query.sql; all channels are mutually exclusive and complete.
Search: previous 1,200 sessions / 72 completed orders; current 1,680 / 75. Referral: previous 800 / 28; current 720 / 33. Total: 2,000 / 100 then 2,400 / 108.
Conversion = completed orders / sessions × 100: 5.0% then 4.5%, a decline of 0.5 percentage points or 10.0% relative. Sessions rose 20%; orders rose 8%. No revenue or profit data was supplied.
Search conversion changes from 6.0% to 4.4643%; Referral from 3.5% to 4.5833%. Search's session share changes from 60% to 70%. Use integer totals to weight rates; do not average the two percentages. Query and report describe the same population, so do not add their totals.
Reproduce by summing the two channel rows, dividing orders by sessions, then calculating differences from the unrounded rates. Both period totals reconcile. This is descriptive analysis of prepared totals; raw event definitions, campaign × device history and checkout steps still need checking. A within-channel change and a composition change may coexist.

The small cooperative has one operations lead and a half-day analyst budget. Before extending paid promotion, decide which observable change warrants that limited investigation; conversion, order count and profit implications are separate questions.
A Search-rate decline and growing Search share are facts in these prepared counts. Lower-intent campaign mix, a checkout issue and changed measurement are competing hypotheses. Temporal coincidence alone does not establish a cause.
Request campaign × device sessions and completed orders for both aligned windows, plus each checkout step. First reconcile definitions and totals and identify low-count cells. If cell conversion is stable while low-conversion cell weight rises, investigate acquisition composition. If weights are stable but within-cell checkout completion falls, investigate that step; inconsistent event reconciliation instead calls measurement into question. Mixed results may support multiple explanations, not a single proven cause.
First use the half-day to reconcile the requested export with the operations lead, because no intervention is interpretable without consistent counts. Then inspect the largest changed cells before choosing a small measured intervention. Compare completed orders and conversion with the matched baseline and monitor total order volume; the numeric stop/continue threshold remains to be agreed with the manager.` },
  ],
  'sam-taylor': [
    { sourceId: 'cv.md', text: `# Sam Taylor — synthetic application CV
I wrote SQL for a fictional fundraising campaign exercise and delivered the report below. The query and my business recommendation are separate artefacts. SQL execution, independent authorship and production experience have not been verified.` },
    { sourceId: 'query.sql', text: `-- Sam's independent fundraising exercise: one imported row per period and mutually exclusive acquisition channel.
-- period is a controlled label: previous = [2026-05-04,2026-06-01), current = [2026-06-01,2026-06-29).
-- Both are consecutive four-week local-calendar intervals with unchanged donation/session definitions.
-- Import key is (period, channel); the donations export repeats these aggregates, so do not join or add it.
SELECT period, channel, SUM(sessions) AS sessions, SUM(donations) AS donations,
       100.0 * SUM(donations) / NULLIF(SUM(sessions), 0) AS conversion_pct
FROM fundraising_channel WHERE period IN ('previous', 'current') GROUP BY period, channel;
-- SELECT period, channel, COUNT(*) FROM fundraising_channel GROUP BY period, channel HAVING COUNT(*) <> 1;
-- Expect zero rows; block this result review if duplicate keys appear. Require exactly two allowed period labels and two channels per period.
-- Count null/negative sessions or donations; expect zero. Zero denominator is NULL and flagged, not a successful zero-rate result.
-- Reconcile sums to the prepared totals: previous 5000 sessions / 200 donations, current 6500 / 195.
-- Verify 2026-06-01 is assigned only to current and 2026-06-29 excluded at import. No query execution log is supplied.` },
    { sourceId: 'analysis.md', text: `# Sam Taylor — fundraising report
Synthetic independent application project, not HarbourCart’s task dataset. The same two non-overlapping four-week windows and channel definitions as query.sql apply.
Previous: 5,000 sessions and 200 completed donations. Current: 6,500 sessions and 195 completed donations. Conversion = completed donations / sessions × 100, so 4.0% to 3.0%: down 1.0 percentage point, 25% relative. Sessions rose 30%; donation count fell 2.5%.
Paid: 2,000 sessions / 60 donations then 3,500 / 70 (3.0% to 2.0%). Organic: 3,000 / 140 then 3,000 / 125 (4.6667% to 4.1667%). These channel rows reconcile to the totals and are not additional populations. Paid share rises from 40% to 53.8462%; use integer totals rather than averaging rates.
The figures are prepared aggregates. I show the formulas and channel reconciliation, but have not traced event quality or considered the limits of the causal interpretation below.

The organiser is deciding next month's advertising spend, but this report only notes that donations fell; there is no stated budget or investigation-time constraint.
The new advertising campaign is definitely the sole proven cause of the conversion drop. Its launch occurred in the current period, which proves the campaign caused it. No other explanation needs checking.
I will verify this by reading the same two-period summary again: since conversion declined after launch, that repetition will confirm the campaign cause. No different evidence or comparison is needed.
Increase advertising spend immediately to recover donations. No experiment, validation measure or order of checks is proposed, despite the report calling that campaign the sole cause.` },
  ],
};

/** Literal source validation; it does not certify that an interpretation is correct. */
export function validateSourceRef(snapshot: EvidenceSnapshot, ref: SourceRef): boolean {
  if (!ref || ref.candidateId !== snapshot.candidateId || ref.evidenceSnapshotId !== snapshot.evidenceSnapshotId
      || ref.fingerprint !== snapshot.fingerprint || typeof ref.quote !== 'string' || ref.quote.trim().length === 0
      || !Number.isSafeInteger(ref.start) || !Number.isSafeInteger(ref.end) || ref.start < 0 || ref.end <= ref.start) return false;
  const matches = snapshot.sources.filter(s => s.sourceId === ref.sourceId && s.location === ref.location);
  if (matches.length !== 1) return false;
  const source = matches[0]!;
  return ref.end <= source.text.length && source.text.slice(ref.start, ref.end) === ref.quote;
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
  const evidenceSnapshotId = `${candidateId}-application-v1`;
  const sources: EvidenceSource[] = materialSources[candidateId].map((source, index) => ({
    ...source, kind: 'application', location: `/sources/${index}/text`,
  }));
  const content = { candidateId, jobId: JOB.id, fixtureVersion: FIXTURE_VERSION, materialVersion: 1 as const, evidenceSnapshotId, sources };
  return { ...content, id: `${candidateId}-demo-application`, fingerprint: hash(content), provenance: 'synthetic' as const,
    scope: 'Immutable synthetic application material. Separate from actual task V1/V2 submissions. Static review only; authorship, execution and production capability remain unverified.' };
}
const materials = Object.fromEntries(CANDIDATE_IDS.map(id => [id, createMaterials(id)])) as Record<CandidateId, ReturnType<typeof createMaterials>>;
function cite(candidateId: CandidateId, sourceId: string, quote: string): SourceRef {
  const snapshot = materials[candidateId];
  const source = snapshot.sources.find(s => s.sourceId === sourceId);
  const start = source?.text.indexOf(quote) ?? -1;
  if (!source || start < 0 || quote.length === 0) throw new RangeError(`Fixture quote not found: ${candidateId}/${sourceId}`);
  return { candidateId, evidenceSnapshotId: snapshot.evidenceSnapshotId, fingerprint: snapshot.fingerprint,
    sourceId, location: source.location, start, end: start + quote.length, quote };
}
function item(candidateId: CandidateId, criterionId: CriterionId, mark: Mark, sourceId: string | null, quote: string | null,
  support: string, gaps: string, nextStep: string, uncertainty?: string): AssessmentItem {
  return { criterionId, mark, support, gaps, rationale: `${support} ${gaps}`, nextStep,
    uncertainty: uncertainty ?? (criterionId.startsWith('S') ? 'Static source review only; execution, independent authorship and production performance are not verified.'
      : criterionId.startsWith('D') ? 'Prepared synthetic counts support a descriptive calculation, not independently verified extraction or production data quality.'
        : 'This application text supports only the stated reasoning; independent completion, practical execution and actual outcomes remain unverified.'),
    checkedSourceIds: materials[candidateId].sources.map(s => s.sourceId),
    sourceRefs: sourceId === null || quote === null ? [] : [cite(candidateId, sourceId, quote)] };
}
const alex = (id: CriterionId, mark: Mark, source: string | null, quote: string | null, support: string, gaps: string, next: string) =>
  item('alex-chen', id, mark, source, quote, support, gaps, next);
const maya = (id: CriterionId, mark: Mark, source: string | null, quote: string | null, support: string, gaps: string, next: string) =>
  item('maya-patel', id, mark, source, quote, support, gaps, next);
const leo = (id: CriterionId, mark: Mark, source: string | null, quote: string | null, support: string, gaps: string, next: string) =>
  item('leo-zhang', id, mark, source, quote, support, gaps, next);
const sam = (id: CriterionId, mark: Mark, source: string | null, quote: string | null, support: string, gaps: string, next: string) =>
  item('sam-taylor', id, mark, source, quote, support, gaps, next);

/* These marks were applied to the above materials, not copied from arithmetic vectors A–D. */
const annotations: Record<CandidateId, AssessmentItem[]> = {
  'alex-chen': [
    alex('S1', 3, 'customer_churn_analysis.sql', "SELECT customer_id, DATE_TRUNC('month', order_date) AS month,\n         COUNT(*) AS orders, SUM(total) AS revenue\n  FROM orders GROUP BY customer_id, DATE_TRUNC('month', order_date)",
      'The customer-month aggregation and absence of an unnecessary join are inspectable.', 'The order-row uniqueness assumption is not documented.', 'Explain input keys and what one orders row represents.'),
    alex('S2', 2, 'customer_churn_analysis.sql', 'LAG(revenue) OVER (PARTITION BY customer_id ORDER BY month) AS previous_month_revenue',
      'The partition and month ordering show an intended customer-period comparison.', 'No time filter or calendar-gap policy establishes whether the preceding observed row is the preceding calendar month.', 'Clarify the intended time range and missing-month comparison.'),
    alex('S3', 'NE', null, null,
      'The SQL, calculation table, CV and supplementary memo were checked.', 'No practical SQL check or expected boundary result is supplied; checks are unobserved, not known incorrect.', 'Request one reproducible check with its expected result.'),
    alex('D1', 4, 'sales_analysis_project.md', '| Month | Orders | Revenue AUD | Average order value AUD | Revenue change |\n| --- | ---: | ---: | ---: | ---: |\n| April | 400 | 12000 | 30 | — |\n| May | 450 | 13500 | 30 | 12.50% |\n| June | 500 | 15000 | 30 | 11.11% |\n\nAverage order value = revenue / orders. Revenue change = (current revenue - previous revenue) / previous revenue. Percentages shown to two decimals.',
      'Monthly denominators, AUD units and formulas reproduce AOV 30 and the stated revenue changes.', 'No material gap in the displayed descriptive calculation; this contains no conversion-rate comparison.', 'Retain the arithmetic scope and request raw inputs only if needed.'),
    alex('D2', 2, 'sales_analysis_project.md', '| May | 450 | 13500 | 30 | 12.50% |\n| June | 500 | 15000 | 30 | 11.11% |',
      'The consecutive monthly revenue comparisons identify a useful change.', 'No relevant channel or product comparison accompanies the aggregate trend.', 'Ask which grouping would help interpret the overall change.'),
    alex('D3', 3, 'sales_analysis_project.md', 'These calculations show descriptive comparison; they do not establish why revenue changed.',
      'The table, formulas and descriptive limitation provide a reviewable path.', 'The source does not explain raw input provenance or extraction checks.', 'Clarify how the prepared totals would be reconciled to source records.'),
    alex('B1', 3, 'business_memo.md', 'Business question: HarbourCart is considering increasing advertising spend while conversion is falling. First clarify which change deserves investigation. The team has limited analysis time; I have not assigned an owner or an action sequence.',
      'The memo ties investigation to the advertising decision and limited analysis time.', 'The immediate operational owner and time allocation remain unspecified.', 'Clarify the first decision the operations manager needs to make.'),
    alex('B2', 3, 'business_memo.md', 'The conversion decline is an observation, not proof that the new campaigns caused it. A campaign mix change is one hypothesis; other hypotheses are not yet developed here.',
      'Observed conversion and a campaign hypothesis are explicitly distinguished.', 'A reasonable competing explanation has not yet been developed.', 'Ask for another explanation and its evidence boundary.'),
    alex('B3', 2, 'business_memo.md', '🔎 补证想法\n我会请求两个期间的 campaign × device 明细，以及各步 checkout 事件。',
      '两个期间的 campaign × device 和 checkout 数据请求具体。', '未说明怎样比较，也未解释不同结果如何支持或削弱假设。', '你将怎样解释不同结果，哪些结果会改变你的判断？'),
    alex('B4', 'NE', null, null,
      'All four application files were checked, including the new short memo.', 'No business intervention, priority sequence or validation measure is supplied; absence is not evidence of a wrong action.', 'Request a minimal prioritised action with a way to check its result.'),
  ],
  'maya-patel': [
    maya('S1', 'NE', null, null, 'CV, SQL self-statement and the analysis report were checked.', 'No original SQL or inspectable grain/aggregation logic exists in this material scope.', 'Request a query fragment and explain its input grain.'),
    maya('S2', 'NE', null, null, 'The report describes periods but no query has been supplied.', 'A report time definition does not show SQL filters or comparison logic.', 'Request time predicates and comparison explanation in the SQL task.'),
    maya('S3', 'NE', null, null, 'All three sources were checked for SQL validation evidence.', 'No SQL test method or expected check result is attached.', 'Request an applicable duplicate, boundary or zero-denominator check.'),
    maya('D1', 4, 'analysis.md', 'Conversion = completed orders / sessions × 100: 400 / 10,000 = 4.0%; 420 / 12,000 = 3.5%, down 0.5 percentage points (12.5% relative). Order growth = (420 - 400) / 400 = 5.0%; average order value = revenue / orders = AUD 30 in both periods.',
      'Definitions and integer counts reproduce rate, percentage-point, relative-change and AUD calculations.', 'No material arithmetic or unit gap is apparent in this prepared worksheet.', 'Keep the calculation evidence while separately assessing SQL.'),
    maya('D2', 4, 'analysis.md', 'Paid: 4,000 sessions / 120 orders then 6,000 / 150, so conversion 3.0% to 2.5%. Returning-customer channel: 6,000 / 280 then 6,000 / 270, so 4.6667% to 4.5%. The channel totals reconcile to each period; Paid’s session weight rises from 40% to 50%. Overall rates use total orders / total sessions, not a simple average of channel rates. Worksheet and memo describe the same population.',
      'Aligned periods, channel changes, weights and overlapping-population cautions are supported.', 'No material gap in the stated descriptive comparison.', 'Preserve the group comparison and clarify extraction quality separately.'),
    maya('D3', 3, 'analysis.md', 'Reproduction: sum the two channel rows per period, then apply the stated formulas to integer counts; display rounding is last. I have only prepared aggregates, not raw logs or an independent extraction, and historical device detail is missing.',
      'Reproduction steps and the limits of prepared aggregates are explicit.', 'The original export and its reconciliation procedure are absent.', 'Ask how the worksheet would be reconciled to an original export.'),
    maya('B1', 4, 'analysis.md', 'The manager must decide whether to extend the promotion with one analyst-day available. First determine whether the lower overall conversion reflects channel mix, a within-channel issue, or both; orders rose, so declining conversion alone is not evidence of falling revenue.',
      'The decision, limited analyst time and investigation question are connected.', 'No material gap in the stated problem frame.', 'Confirm that the manager agrees with this decision scope.'),
    maya('B2', 3, 'analysis.md', 'The Paid decline and growing weight are observations. Campaign mix is a hypothesis, not an established cause. I have not yet compared a measurement-change explanation.',
      'The report separates the observation and causal hypothesis.', 'A measurement-change alternative is named but not developed.', 'Clarify how a measurement change could be checked.'),
    maya('B3', 3, 'analysis.md', 'Request campaign × device counts for both windows and compare conversion within aligned cells: stable cell rates with a changing mix would favour the mix hypothesis. Reconcile cell totals first. I have not specified a contrasting result or a minimum usable cell size.',
      'The request, aligned-cell comparison and one hypothesis-discriminating result are given.', 'Contrasting outcomes and low-cell-count handling remain underspecified.', 'Ask what a different comparison outcome would mean.'),
    maya('B4', 3, 'analysis.md', 'First ask the operations manager for the export and reconcile it, then use the remaining analyst time on the largest changed cells before extending spend. Track conversion and completed orders together. An explicit stopping threshold is not yet specified.',
      'The plan prioritises reconciliation, assigns an owner and names evaluation metrics within one analyst-day.', 'An explicit stop/continue criterion is missing.', 'Agree a stopping criterion with the manager before any intervention.'),
  ],
  'leo-zhang': [
    leo('S1', 4, 'query.sql', "SELECT period, channel, SUM(sessions) AS sessions, SUM(orders) AS orders,\n       100.0 * SUM(orders) / NULLIF(SUM(sessions), 0) AS conversion_pct\nFROM labelled GROUP BY period, channel;\n-- No join is needed; adding the matching order export would duplicate the same population.\n-- Before aggregation: SELECT day, channel, COUNT(*) FROM daily_channel GROUP BY day, channel HAVING COUNT(*) <> 1; expect zero rows.",
      'Period/channel grain, additive counts and the duplicate-risk check are inspectable.', 'No material grain or aggregation defect is visible in the static sample.', 'Keep this as code evidence and verify execution separately if required.'),
    leo('S2', 4, 'query.sql', "-- Compare consecutive, non-overlapping four-week windows [2026-03-02,2026-03-30) and [2026-03-30,2026-04-27).\nWITH labelled AS (\n SELECT CASE WHEN day < DATE '2026-03-30' THEN 'previous' ELSE 'current' END AS period,\n        channel, sessions, orders\n FROM daily_channel\n WHERE day >= DATE '2026-03-02' AND day < DATE '2026-04-27'\n)",
      'Both half-open windows and the period assignment agree with the explanation.', 'No material time-comparison gap is visible in this DATE-based example.', 'Confirm the stated local reporting calendar when using real data.'),
    leo('S3', 4, 'query.sql', '-- Reject null/negative counts; count those rows before calculating and expect zero. Compare sum of each period\'s channel results to the source totals below.\n-- A zero-session group returns NULL conversion, not 0%; flag any orders > sessions for investigation.\n-- Expected reconciliation from prepared facts: previous 2000 sessions / 100 orders, current 2400 / 108.\n-- Boundary check: 2026-03-30 belongs only to current; 2026-04-27 is excluded.',
      'Checks name the method, expected totals, zero/null handling and boundary cases.', 'No material gap in the proposed static validation procedure; execution remains unobserved.', 'Run and capture these checks separately before operational use.'),
    leo('D1', 4, 'analysis.md', 'Conversion = completed orders / sessions × 100: 5.0% then 4.5%, a decline of 0.5 percentage points or 10.0% relative. Sessions rose 20%; orders rose 8%. No revenue or profit data was supplied.',
      'Counts, denominators and period definitions reproduce the stated changes with correct units.', 'No material arithmetic gap is visible; revenue is correctly left unknown.', 'Retain the descriptive calculations without inferring profitability.'),
    leo('D2', 4, 'analysis.md', "Search conversion changes from 6.0% to 4.4643%; Referral from 3.5% to 4.5833%. Search's session share changes from 60% to 70%. Use integer totals to weight rates; do not average the two percentages. Query and report describe the same population, so do not add their totals.",
      'The report compares relevant groups, periods and weights and identifies overlap.', 'No material gap in this descriptive comparison.', 'Check finer groups only if needed for the business question.'),
    leo('D3', 4, 'analysis.md', 'Reproduce by summing the two channel rows, dividing orders by sessions, then calculating differences from the unrounded rates. Both period totals reconcile. This is descriptive analysis of prepared totals; raw event definitions, campaign × device history and checkout steps still need checking. A within-channel change and a composition change may coexist.',
      'Reproduction, unrounded inputs, missing data and inference limits are explicit.', 'No material gap in the supplied reproducibility and limitation account.', 'Verify raw definitions before applying conclusions operationally.'),
    leo('B1', 4, 'analysis.md', 'The small cooperative has one operations lead and a half-day analyst budget. Before extending paid promotion, decide which observable change warrants that limited investigation; conversion, order count and profit implications are separate questions.',
      'The decision, question and realistic resource limit are specific.', 'No material gap in the stated business frame.', 'Agree the investigation budget with the decision owner.'),
    leo('B2', 4, 'analysis.md', 'A Search-rate decline and growing Search share are facts in these prepared counts. Lower-intent campaign mix, a checkout issue and changed measurement are competing hypotheses. Temporal coincidence alone does not establish a cause.',
      'Facts, competing hypotheses and a clear causal limitation are separated.', 'No material causal overclaim is visible in this passage.', 'Retain each hypothesis until discriminating evidence is available.'),
    leo('B3', 4, 'analysis.md', 'Request campaign × device sessions and completed orders for both aligned windows, plus each checkout step. First reconcile definitions and totals and identify low-count cells. If cell conversion is stable while low-conversion cell weight rises, investigate acquisition composition. If weights are stable but within-cell checkout completion falls, investigate that step; inconsistent event reconciliation instead calls measurement into question. Mixed results may support multiple explanations, not a single proven cause.',
      'Concrete evidence, aligned comparisons and contrasting results distinguish hypotheses with stated limits.', 'No material gap in the proposed discriminating plan.', 'Ask for execution evidence if this reasoning will inform an actual decision.'),
    leo('B4', 3, 'analysis.md', 'First use the half-day to reconcile the requested export with the operations lead, because no intervention is interpretable without consistent counts. Then inspect the largest changed cells before choosing a small measured intervention. Compare completed orders and conversion with the matched baseline and monitor total order volume; the numeric stop/continue threshold remains to be agreed with the manager.',
      'The sequence, justification, owner and monitoring measures fit the half-day constraint.', 'A numeric stop/continue threshold is not yet agreed.', 'Set the decision threshold with the manager before intervening.'),
  ],
  'sam-taylor': [
    sam('S1', 4, 'query.sql', "-- Import key is (period, channel); the donations export repeats these aggregates, so do not join or add it.\nSELECT period, channel, SUM(sessions) AS sessions, SUM(donations) AS donations,\n       100.0 * SUM(donations) / NULLIF(SUM(sessions), 0) AS conversion_pct\nFROM fundraising_channel WHERE period IN ('previous', 'current') GROUP BY period, channel;\n-- SELECT period, channel, COUNT(*) FROM fundraising_channel GROUP BY period, channel HAVING COUNT(*) <> 1;",
      'The import key, aggregation and duplicate-risk check are explicit.', 'No material grain or counting defect is visible in this static query.', 'Verify the import-key assumption against real source records if used.'),
    sam('S2', 3, 'query.sql', "-- period is a controlled label: previous = [2026-05-04,2026-06-01), current = [2026-06-01,2026-06-29).\n-- Both are consecutive four-week local-calendar intervals with unchanged donation/session definitions.",
      'Controlled labels map to aligned non-overlapping periods and the query filters both labels.', 'The import code assigning the period labels is not attached.', 'Ask to inspect the importer time-boundary mapping.'),
    sam('S3', 4, 'query.sql', '-- Expect zero rows; block this result review if duplicate keys appear. Require exactly two allowed period labels and two channels per period.\n-- Count null/negative sessions or donations; expect zero. Zero denominator is NULL and flagged, not a successful zero-rate result.\n-- Reconcile sums to the prepared totals: previous 5000 sessions / 200 donations, current 6500 / 195.\n-- Verify 2026-06-01 is assigned only to current and 2026-06-29 excluded at import. No query execution log is supplied.',
      'The checks state expected results, response to failures, null/zero handling, reconciliation and date edges.', 'No material gap in the proposed checks, while actual execution is unobserved.', 'Capture the checks and their outputs separately if operational use is considered.'),
    sam('D1', 4, 'analysis.md', 'Previous: 5,000 sessions and 200 completed donations. Current: 6,500 sessions and 195 completed donations. Conversion = completed donations / sessions × 100, so 4.0% to 3.0%: down 1.0 percentage point, 25% relative. Sessions rose 30%; donation count fell 2.5%.',
      'Denominators, units and prepared integer counts support the rate and change calculations.', 'No material numerical error is visible in these formulas.', 'Retain the correct calculations while reviewing causal claims separately.'),
    sam('D2', 4, 'analysis.md', 'Paid: 2,000 sessions / 60 donations then 3,500 / 70 (3.0% to 2.0%). Organic: 3,000 / 140 then 3,000 / 125 (4.6667% to 4.1667%). These channel rows reconcile to the totals and are not additional populations. Paid share rises from 40% to 53.8462%; use integer totals rather than averaging rates.',
      'Group changes, weight changes and overlap are documented with reconciled counts.', 'No material descriptive-comparison gap is visible here.', 'Do not treat correct comparison as confirmation of the later causal claim.'),
    sam('D3', 2, 'analysis.md', 'The figures are prepared aggregates. I show the formulas and channel reconciliation, but have not traced event quality or considered the limits of the causal interpretation below.',
      'Formulas and reconciliation make the numerical part reviewable.', 'Event quality and limits of the report’s causal interpretation are not examined.', 'State the missing data and the boundary of what these counts establish.'),
    sam('B1', 2, 'analysis.md', "The organiser is deciding next month's advertising spend, but this report only notes that donations fell; there is no stated budget or investigation-time constraint.",
      'The report identifies a related spending decision and falling donation count.', 'The question and realistic resource constraints are not developed.', 'Frame what must be learned before that spending decision.'),
    sam('B2', 0, 'analysis.md', 'The new advertising campaign is definitely the sole proven cause of the conversion drop. Its launch occurred in the current period, which proves the campaign caused it. No other explanation needs checking.',
      'There is an inspectable, explicit causal assertion to assess.', 'Coincidence is presented as proof of a sole cause without discriminating evidence.', 'Separate the observed timing from a hypothesis and consider a competing explanation.'),
    sam('B3', 0, 'analysis.md', 'I will verify this by reading the same two-period summary again: since conversion declined after launch, that repetition will confirm the campaign cause. No different evidence or comparison is needed.',
      'A specific proposed verification method is available for review.', 'The proposed method repeats the original association and is logically circular, rather than distinguishing hypotheses.', 'Request different evidence and explain what result would change the conclusion.'),
    sam('B4', 0, 'analysis.md', 'Increase advertising spend immediately to recover donations. No experiment, validation measure or order of checks is proposed, despite the report calling that campaign the sole cause.',
      'The source proposes an explicit business action.', 'Increasing spend without explanation conflicts with its own asserted harmful-campaign cause and omits validation.', 'Resolve the contradiction and define a measured next step before spending.'),
  ],
};

const qualitative: Record<CandidateId, Array<{ requirementId: RequirementId; status: 'supported' | 'uncertain'; summary: string; uncertainty: string }>> = {
  'alex-chen': [
    { requirementId: 'sql', status: 'supported', summary: 'Customer-month aggregation and a window comparison are visible in the original SQL sample.', uncertainty: 'Static source evidence only; date gaps, validation, execution and production performance remain open.' },
    { requirementId: 'data-analysis', status: 'supported', summary: 'Monthly prepared totals and formulas support inspectable descriptive calculations.', uncertainty: 'Extraction and group-level diagnosis remain unobserved.' },
    { requirementId: 'business-problem-solving', status: 'uncertain', summary: 'The added application memo gives a concrete data request but not a discriminating plan or verified action.', uncertainty: 'The missing reasoning should be clarified; this is not a statement about underlying capability.' },
  ],
  'maya-patel': [
    { requirementId: 'sql', status: 'uncertain', summary: 'SQL familiarity is self-reported without an original query or checks.', uncertainty: 'The material scope supports no evaluation of SQL performance; request a focused sample.' },
    { requirementId: 'data-analysis', status: 'supported', summary: 'The worksheet supplies reproducible formulas, aligned groups and population-overlap cautions.', uncertainty: 'Prepared numbers do not establish independent extraction quality.' },
    { requirementId: 'business-problem-solving', status: 'supported', summary: 'The memo connects a spending decision to a constrained investigation and monitoring plan.', uncertainty: 'Contrasting outcomes and stopping criteria need clarification; practical delivery remains unverified.' },
  ],
  'leo-zhang': [
    { requirementId: 'sql', status: 'supported', summary: 'Grain, dates, aggregation and practical check expectations are inspectable.', uncertainty: 'This is static code review, not an execution or authorship certification.' },
    { requirementId: 'data-analysis', status: 'supported', summary: 'Integer counts, weighted comparisons and limitations form a reproducible descriptive analysis.', uncertainty: 'Raw event quality and independent work remain unverified.' },
    { requirementId: 'business-problem-solving', status: 'supported', summary: 'The report includes a constrained decision frame and a plan that distinguishes hypotheses.', uncertainty: 'Decision thresholds, execution and actual outcomes remain open; the report is not a hiring recommendation.' },
  ],
  'sam-taylor': [
    { requirementId: 'sql', status: 'supported', summary: 'The query and expected checks provide inspectable technical evidence.', uncertainty: 'Import code and actual query execution are not supplied.' },
    { requirementId: 'data-analysis', status: 'supported', summary: 'The descriptive calculation and weighted comparisons are reproducible.', uncertainty: 'This support is restricted to arithmetic; the same report contains unsupported causal conclusions.' },
    { requirementId: 'business-problem-solving', status: 'uncertain', summary: 'The report asserts a sole cause, uses circular verification and proposes an internally inconsistent action.', uncertainty: 'These are source-backed reasoning problems, not an automatic rejection or judgement of personal worth.' },
  ],
};

const applications: Record<CandidateId, ApplicationSnapshot> = Object.fromEntries(CANDIDATE_IDS.map(candidateId => {
  const snapshot = materials[candidateId];
  const items = annotations[candidateId];
  validateAssessmentItems(snapshot, items, CRITERIA.map(c => c.id));
  const baseline: ApplicationBaseline = {
    candidateId, jobId: JOB.id, evidenceSnapshotId: snapshot.evidenceSnapshotId, fingerprint: snapshot.fingerprint,
    fixtureVersion: FIXTURE_VERSION, rubricVersion: RUBRIC_VERSION, stage: 'application_review', assessmentRevision: 1,
    annotationMode: 'preset_human', label: '合成案例·预置人工评估', status: 'reviewed',
    provenance: { sampleType: 'synthetic', standardDesign: 'team_designed', actualAnnotation: 'ai_agent_authored_fixture',
      actualReview: 'ai_agent_review', humanCalibration: 'pending', externalExpertValidation: false,
      note: 'preset_human is the product fixture category, not a claim that a human expert authored or validated these annotations. AI agents implemented and reviewed the synthetic team-designed fixture. Two-person human calibration and external validation remain pending.' },
    items, score: calculateScores(items),
  };
  const initialReport: PresetReport[] = qualitative[candidateId].map(report => ({
    ...report, displayStatus: report.status === 'supported' ? 'Supported' : 'Uncertain', mode: 'preset',
    sourceRefs: items.filter(i => CRITERIA.find(c => c.id === i.criterionId)?.requirementId === report.requirementId)
      .flatMap(i => i.sourceRefs).filter((ref, index, refs) => refs.findIndex(r => r.sourceId === ref.sourceId && r.start === ref.start && r.end === ref.end) === index),
  }));
  // The lack of original SQL is described by Maya's own self-statement, not by another candidate's query.
  if (candidateId === 'maya-patel') initialReport[0]!.sourceRefs = [cite(candidateId, 'sql_statement.md', 'No original SQL query, time-filter logic, grain explanation or SQL check output is included in this application.')];
  return [candidateId, { ...snapshot, baseline, initialReport }];
})) as Record<CandidateId, ApplicationSnapshot>;

export function getApplication(candidateId: string): ApplicationSnapshot {
  if (!CANDIDATE_IDS.includes(candidateId as CandidateId)) throw new RangeError('Unknown candidate ID.');
  return structuredClone(applications[candidateId as CandidateId]);
}

/** Complete demonstrable chain backed by the actual Alex application source, including emoji/newline offsets. */
export const B3_EXPLANATION = {
  label: '合成案例·预置人工评估', companyRequirement: '在进一步增加广告预算前，明确应优先调查什么。',
  criterion: CRITERIA.find(c => c.id === 'B3')!, ...annotations['alex-chen'].find(i => i.criterionId === 'B3')!,
  contribution: 5, maxContribution: 10, markMaximum: 4, rubricVersion: RUBRIC_VERSION, fixtureVersion: FIXTURE_VERSION,
};

function freezeDeep(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  Object.values(value).forEach(freezeDeep);
  Object.freeze(value);
}
[CANDIDATES, COMPANY, JOB, TASK_TEMPLATES, applications, B3_EXPLANATION].forEach(freezeDeep);
