import { CRITERIA, REQUIREMENT_IDS, type CriterionId, type Mark, type RequirementId } from './rubric.js';

export interface ScoreItem { criterionId: CriterionId; mark: Mark }
export interface ScoreOptions { targetRequirementId?: RequirementId; allowPartial?: boolean }
export interface CriterionScore {
  criterionId: CriterionId; requirementId: RequirementId; mark: Mark | null;
  status: 'assessed' | 'needs_evidence' | 'pending'; contribution: number | null;
}
export interface SkillScore {
  requirementId: RequirementId; criterionIds: CriterionId[]; maxScore: number;
  assessmentComplete: boolean; complete: boolean; evaluatedCount: number; neCount: number; pendingCount: number;
  accruedScore: number; score: number | null; percentage: number | null;
}
export interface Scores {
  status: 'complete' | 'needs_evidence' | 'pending'; assessmentComplete: boolean; complete: boolean;
  coveragePercent: number | null; accruedScore: number; overallScore: number | null; overallPercentage: number | null;
  criteria: CriterionScore[]; skills: SkillScore[];
}
export function isMark(value: unknown): value is Mark {
  return value === 'NE' || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4);
}

/** Pure arithmetic: no candidate attributes, tags, model output, threshold or ranking. */
export function calculateScores(items: readonly ScoreItem[], options: ScoreOptions = {}): Scores {
  if (!Array.isArray(items)) throw new RangeError('Assessment items must be an array.');
  if (options.targetRequirementId !== undefined && !REQUIREMENT_IDS.includes(options.targetRequirementId)) {
    throw new RangeError('Unknown target requirement.');
  }
  const expected = CRITERIA.filter(c => options.targetRequirementId === undefined || c.requirementId === options.targetRequirementId);
  const input = new Map<CriterionId, Mark>();
  for (const item of items) {
    if (!item || !expected.some(c => c.id === item.criterionId)) throw new RangeError('Unknown or non-target criterion.');
    if (input.has(item.criterionId)) throw new RangeError('Duplicate criterion.');
    if (!isMark(item.mark)) throw new RangeError('Mark must be an integer from 0 to 4 or NE.');
    input.set(item.criterionId, item.mark);
  }
  if (!options.allowPartial && input.size !== expected.length) throw new RangeError('Assessment must contain the complete criterion group.');
  const criteria: CriterionScore[] = CRITERIA.map(c => {
    const mark = input.get(c.id) ?? null;
    return { criterionId: c.id, requirementId: c.requirementId, mark,
      status: mark === null ? 'pending' : mark === 'NE' ? 'needs_evidence' : 'assessed',
      contribution: typeof mark === 'number' ? mark / 4 * c.maxScore : null };
  });
  const skills: SkillScore[] = REQUIREMENT_IDS.map(requirementId => {
    const group = criteria.filter(c => c.requirementId === requirementId);
    const pendingCount = group.filter(c => c.mark === null).length;
    const neCount = group.filter(c => c.mark === 'NE').length;
    const evaluatedCount = group.length - neCount - pendingCount;
    const accruedScore = group.reduce((sum, c) => sum + (c.contribution ?? 0), 0);
    const complete = evaluatedCount === group.length;
    const maxScore = group.length * 10;
    return { requirementId, criterionIds: group.map(c => c.criterionId), maxScore,
      assessmentComplete: pendingCount === 0, complete, evaluatedCount, neCount, pendingCount,
      accruedScore, score: complete ? accruedScore : null, percentage: complete ? accruedScore / maxScore * 100 : null };
  });
  const assessmentComplete = criteria.every(c => c.mark !== null);
  const complete = criteria.every(c => typeof c.mark === 'number');
  const accruedScore = skills.reduce((sum, s) => sum + s.accruedScore, 0);
  return {
    status: !assessmentComplete ? 'pending' : complete ? 'complete' : 'needs_evidence', assessmentComplete, complete,
    coveragePercent: assessmentComplete ? criteria.filter(c => typeof c.mark === 'number').length / CRITERIA.length * 100 : null,
    accruedScore, overallScore: complete ? accruedScore : null, overallPercentage: complete ? accruedScore : null,
    criteria, skills,
  };
}
