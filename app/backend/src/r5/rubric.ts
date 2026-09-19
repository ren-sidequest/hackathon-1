/** Junior-role anchors frozen before reviewing the new R6 application materials. */
export const RUBRIC_VERSION = 'harbour-retail-junior-analyst-rubric-v1' as const;
export const REQUIREMENT_IDS = ['sql', 'data-analysis', 'business-problem-solving'] as const;
export type RequirementId = typeof REQUIREMENT_IDS[number];
export const CRITERION_IDS = ['S1', 'S2', 'S3', 'D1', 'D2', 'D3', 'B1', 'B2', 'B3', 'B4'] as const;
export type CriterionId = typeof CRITERION_IDS[number];
export type Mark = 0 | 1 | 2 | 3 | 4 | 'NE';
export interface Criterion {
  id: CriterionId; requirementId: RequirementId; title: string; observableSupport: string;
  maxScore: 10; anchors: { 4: string; 2: string; 0: string };
}
export const CRITERIA: readonly Criterion[] = [
  { id: 'S1', requirementId: 'sql', title: 'Query grain, aggregation and joins', maxScore: 10,
    observableSupport: 'Input grain is clear and aggregation or joins answer the stated question without visible double counting. A join is not required when the question does not need one.',
    anchors: { 4: 'Clear grain and appropriate aggregation or joins, with duplicate-counting risk checked.', 2: 'Readable basic aggregation, but the grain or counting effect of a join is insufficiently explained.', 0: 'A visibly duplicating join produces incorrect key counts that are presented as correct.' } },
  { id: 'S2', requirementId: 'sql', title: 'Time or group comparison and query traceability', maxScore: 10,
    observableSupport: 'The reporting windows and comparison groups are explicit and consistent with the query. Complexity earns no extra credit.',
    anchors: { 4: 'Windows, groups and comparison objects are clear; code and explanation support a reproducible comparison.', 2: 'A query or period comparison is present, but filters or boundary explanations are incomplete.', 0: 'Different periods or unrelated groups are incorrectly treated as the same comparison.' } },
  { id: 'S3', requirementId: 'sql', title: 'Validation and relevant edge cases', maxScore: 10,
    observableSupport: 'Inspect proposed checks or examples for relevant duplicates, missing values, zero denominators and boundaries. Static review does not establish execution.',
    anchors: { 4: 'Actionable checks cover relevant boundaries and state expected results.', 2: 'Checks such as missing values or duplicates are mentioned, but methods or expected results are incomplete.', 0: 'The source claims correctness despite a known failed check, or uses a clearly invalid validation method.' } },
  { id: 'D1', requirementId: 'data-analysis', title: 'Metrics, denominators, units and calculations', maxScore: 10,
    observableSupport: 'Numerators, denominators, windows and units agree; calculations are reproducible and percentages are distinguished from percentage points where relevant.',
    anchors: { 4: 'Metric definitions, denominators, units, periods and calculations are clear and consistent.', 2: 'The main calculation is usable but a relevant definition or unit is insufficiently explained.', 0: 'A wrong denominator drives the main conclusion and is neither identified nor corrected.' } },
  { id: 'D2', requirementId: 'data-analysis', title: 'Meaningful period or group comparisons', maxScore: 10,
    observableSupport: 'Compare appropriate periods or groups beyond repeating totals; consider weights and overlapping populations when applicable.',
    anchors: { 4: 'Totals and relevant groups are compared appropriately, considering weights and overlapping populations.', 2: 'One useful change is visible, but a relevant breakdown or baseline is missing.', 0: 'Overlapping populations are added or rates are directly averaged to produce a key conclusion.' } },
  { id: 'D3', requirementId: 'data-analysis', title: 'Reproducibility, sources and limitations', maxScore: 10,
    observableSupport: 'Show the calculation process, missing information and scope. Presentation quality alone does not establish analytical correctness.',
    anchors: { 4: 'Reproducible working is supplied and missing data and scope are explicit.', 2: 'A process or limitation is described, but the other aspect is weak.', 0: 'Information absent from the materials is used as an observed fact.' } },
  { id: 'B1', requirementId: 'business-problem-solving', title: 'Business question and decision framing', maxScore: 10,
    observableSupport: 'Connect the question to a practical business decision and realistic constraints at a junior analyst level; senior strategic ownership is not required.',
    anchors: { 4: 'The business decision, question to answer and realistic constraints are clear.', 2: 'A relevant change is described but its connection to a business decision is incomplete.', 0: 'An explicitly unrelated question is answered and used as the basis of the current decision.' } },
  { id: 'B2', requirementId: 'business-problem-solving', title: 'Observations, hypotheses and causal claims', maxScore: 10,
    observableSupport: 'Separate observed facts, hypotheses and demonstrated causes, with appropriate inference limits.',
    anchors: { 4: 'Facts and hypotheses are separate; plausible alternatives and inference limits are considered.', 2: 'Hypothesis awareness is visible, but some statements still imply causation from association.', 0: 'A sole proven cause is explicitly asserted without corresponding evidence.' } },
  { id: 'B3', requirementId: 'business-problem-solving', title: 'Evidence requests that distinguish explanations', maxScore: 10,
    observableSupport: 'Request relevant data and explain what different results would imply for competing explanations.',
    anchors: { 4: 'Specific data, a comparison method and the contrasting implications are clear.', 2: 'Specific additional data is requested, but how it distinguishes explanations is not explained.', 0: 'A circular or irrelevant method is explicitly presented as verifying the proposed explanation.' } },
  { id: 'B4', requirementId: 'business-problem-solving', title: 'Practical next steps and validation', maxScore: 10,
    observableSupport: 'Propose an appropriate order, reason and way to check a practical next step; ask a senior colleague where decisions exceed the junior role.',
    anchors: { 4: 'Priority, rationale, feasible steps and validation measures fit the stated constraints.', 2: 'A relevant action exists but its sequence, validation measure or stopping condition is incomplete.', 0: 'The proposed action contradicts the source\'s own key evidence without explanation.' } },
];
export const RUBRIC = {
  version: RUBRIC_VERSION, jobId: 'junior-data-analyst', provenance: 'synthetic_team_designed',
  calibrationStatus: 'human_calibration_pending', label: 'Core analytical evidence match',
  scope: 'SQL, Data Analysis and Business Problem Solving evidence for this junior role. Not all JD requirements, hiring success, personality, population rank or retention probability. SQL is statically reviewed, not executed. The 30/30/40 weights are a prior team demo policy, not JD-specified weights.',
  requirements: [
    { id: 'sql', title: 'SQL', maxScore: 30, statement: 'Review basic extraction, grain, comparisons and appropriate checks.' },
    { id: 'data-analysis', title: 'Data Analysis', maxScore: 30, statement: 'Explain metrics and meaningful comparisons with reproducible working.' },
    { id: 'business-problem-solving', title: 'Business Problem Solving', maxScore: 40, statement: 'Frame a relevant decision, distinguish evidence from hypotheses and propose a sensible next step.' },
  ],
  marks: [
    { mark: 4, meaning: 'Fully supports the observable requirement with relevant explanations and boundaries.' },
    { mark: 3, meaning: 'Mostly supports the requirement; the rationale identifies a specific non-critical gap.' },
    { mark: 2, meaning: 'Partially supports the requirement, with a material gap affecting interpretation.' },
    { mark: 1, meaning: 'A relevant attempt is visible but specific support is weaker than the mark-2 anchor.' },
    { mark: 0, meaning: 'A clear, observed problem is supported by the source text; not a substitute for missing evidence.' },
    { mark: 'NE', meaning: 'Not enough evidence to judge. Record the checked scope; never convert this to zero.' },
  ],
  criteria: CRITERIA,
  rules: { maxScore: 100, criterionContribution: 'mark / 4 * 10', displayDecimalPlaces: 1,
    neIsZero: false, autoPassThreshold: null, rounding: 'Calculate with unrounded values; round only for display.' },
} as const;
function freezeDeep(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  Object.values(value).forEach(freezeDeep); Object.freeze(value);
}
freezeDeep(RUBRIC);
