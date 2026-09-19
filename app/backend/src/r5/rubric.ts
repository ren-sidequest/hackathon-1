/** Fixed synthetic HarbourCart job standard, published before fixture scoring. */
export const RUBRIC_VERSION = 'harbourcart-rubric-v1' as const;
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
  { id: 'S1', requirementId: 'sql', title: '查询粒度、聚合与连接逻辑', maxScore: 10,
    observableSupport: '表和粒度清楚；聚合及连接与问题一致，没有可见的重复计数；无需 JOIN 的问题不因缺少 JOIN 扣分。',
    anchors: { 4: '粒度明确，聚合／连接与所问问题一致，并核对重复风险。', 2: '基本聚合可读，但粒度或连接的计数影响说明不足。', 0: '可见的重复连接使关键计数错误，却将其作为正确结果。' } },
  { id: 'S2', requirementId: 'sql', title: '时间比较与查询可复核性', maxScore: 10,
    observableSupport: '时间窗和比较对象明确，代码与解释足以检查推导；语法复杂度本身不加分。',
    anchors: { 4: '时间窗、分组和比较对象清楚，代码与解释一致，可按过程复核。', 2: '有查询或期间比较，但过滤条件／边界解释不完整。', 0: '把不同期间或不相关分组混作同一比较对象。' } },
  { id: 'S3', requirementId: 'sql', title: '校验与边界说明', maxScore: 10,
    observableSupport: '有可检查的方法或示例，考虑适用的重复、空值、零分母及边界。',
    anchors: { 4: '有可操作的结果检查和适用边界，说明预期检查结果。', 2: '提到空值／重复等检查，但方法或预期结果不充分。', 0: '明知校验不通过仍宣称结果正确，或校验逻辑明显无效。' } },
  { id: 'D1', requirementId: 'data-analysis', title: '指标、分母、单位和计算', maxScore: 10,
    observableSupport: '分子、分母、时间窗和单位一致，数值可复算，区分百分比与百分点。',
    anchors: { 4: '指标定义、分母、单位、期间和计算都清楚且一致。', 2: '主要计算可用，但某项定义或单位解释不足。', 0: '使用错误分母形成核心结论，且没有识别／修正。' } },
  { id: 'D2', requirementId: 'data-analysis', title: '有意义的期间／分组比较', maxScore: 10,
    observableSupport: '合理比较期间或分组，不只复述总量，不把重叠资源当新增总体。',
    anchors: { 4: '总量和相关分组比较合理，注意权重及重叠总体。', 2: '能看到一个有用变化，但缺少相应分组或基准。', 0: '把重叠资源相加，或直接平均比例后作关键结论。' } },
  { id: 'D3', requirementId: 'data-analysis', title: '可复核过程与限制', maxScore: 10,
    observableSupport: '交代计算过程、数据缺口和适用范围，不凭图表形式推断正确性。',
    anchors: { 4: '给出可重复的计算依据，明确缺失数据与适用范围。', 2: '有过程或限制说明，但另一部分较弱。', 0: '使用材料中不存在的数据并当成已观测事实。' } },
  { id: 'B1', requirementId: 'business-problem-solving', title: '业务问题界定', maxScore: 10,
    observableSupport: '连接实际业务决策、需要回答的问题和小团队资源约束。',
    anchors: { 4: '明确业务决策、需要回答的问题和现实约束。', 2: '能描述下降现象，但与业务决策连接不充分。', 0: '明确回答了无关问题，并将其当成当前决策依据。' } },
  { id: 'B2', requirementId: 'business-problem-solving', title: '观察与因果区分', maxScore: 10,
    observableSupport: '分开事实、假设和已验证原因，避免无依据的确定性断言。',
    anchors: { 4: '事实／假设分开，考虑合理替代解释及推断边界。', 2: '有假设意识，但个别陈述仍把关联说成原因。', 0: '无对应证据，却明确断言唯一原因已经证实。' } },
  { id: 'B3', requirementId: 'business-problem-solving', title: '有区分力的补证计划', maxScore: 10,
    observableSupport: '请求能区分假设的数据，并解释不同结果将意味着什么。',
    anchors: { 4: '具体数据、比较方法及不同结果如何区分假设都清楚。', 2: '给出具体数据请求，但未解释怎样判别假设。', 0: '所提方法逻辑循环或与待判断假设无关，却声称可验证。' } },
  { id: 'B4', requirementId: 'business-problem-solving', title: '行动优先级与验证', maxScore: 10,
    observableSupport: '建议有优先级、理由和验证指标，符合小团队约束。',
    anchors: { 4: '优先级、理由、可执行步骤与验证指标匹配公司约束。', 2: '有相关行动，但顺序、验证指标或停止条件不足。', 0: '行动与自己确认的关键证据明显矛盾且无解释。' } },
];
export const RUBRIC = {
  version: RUBRIC_VERSION,
  jobId: 'junior-data-analyst',
  provenance: 'synthetic_team_designed',
  calibrationStatus: 'human_calibration_pending',
  label: '岗位证据匹配度 · 基于当前材料与本岗位标准',
  scope: 'Material review, not hiring success, population percentile, personality or retention probability. SQL is statically reviewed, not executed.',
  requirements: [
    { id: 'sql', title: 'SQL', maxScore: 30, statement: '核对取数粒度、期间比较与查询边界。' },
    { id: 'data-analysis', title: 'Data Analysis', maxScore: 30, statement: '用可复算的指标与分组比较解释变化。' },
    { id: 'business-problem-solving', title: 'Business Problem Solving', maxScore: 40, statement: '在增加广告预算前提出有优先级、可验证的调查与行动。' },
  ],
  marks: [
    { mark: 4, meaning: '充分满足可观察要求，相关边界说明充分。' },
    { mark: 3, meaning: '主要满足，理由中指出具体非关键缺口。' },
    { mark: 2, meaning: '部分满足，有影响判断的明显缺口。' },
    { mark: 1, meaning: '有相关内容，但尚未达到 2 分的具体支持。' },
    { mark: 0, meaning: '已观察到具体、明确的问题；须有原文依据。' },
    { mark: 'NE', meaning: '材料不足以判断；记录已检查范围，不转为 0。' },
  ],
  criteria: CRITERIA,
  rules: { maxScore: 100, criterionContribution: 'mark / 4 * 10', displayDecimalPlaces: 1,
    neIsZero: false, autoPassThreshold: null, rounding: 'Calculate with unrounded values; round only for display.' },
} as const;

/** Prevent callers from silently changing the published, versioned rubric. */
function freezeDeep(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  Object.values(value).forEach(freezeDeep);
  Object.freeze(value);
}
freezeDeep(RUBRIC);
