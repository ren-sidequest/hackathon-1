import { CRITERIA } from './rubric.js';
import type { AssessmentRecord } from './service.js';

/** Suggestions are derived from the current assessment, never a person's name or list position. */
export function gapSuggestions(assessment: AssessmentRecord | null) {
  if (!assessment) return [];
  return assessment.items.filter(item => item.mark !== 4).map(item => {
    const criterion = CRITERIA.find(c => c.id === item.criterionId)!;
    const severity = item.mark === 0 ? 'observed_problem' : item.mark === 'NE' ? 'missing_evidence'
      : item.mark <= 2 ? 'material_gap' : 'minor_gap';
    const priority = severity === 'observed_problem' ? 1 : severity === 'missing_evidence' || severity === 'material_gap' ? 2 : 3;
    const priorityReason = severity === 'observed_problem'
      ? 'A source-backed problem affects a core junior-role requirement. Clarify it before relying on the result.'
      : severity === 'missing_evidence'
        ? 'This core junior-role requirement has been checked but remains unobserved. Request relevant existing material before assigning a task.'
        : severity === 'material_gap'
          ? 'The available work partially supports a core requirement but leaves a material reasoning or validation gap.'
          : 'The main requirement is supported; a limited clarification may be sufficient rather than another task.';
    return {
      gapId: `${assessment.stage}:${item.criterionId}`, stage: assessment.stage,
      assessmentRevision: assessment.assessmentRevision, evidenceSnapshotId: assessment.evidenceSnapshotId,
      fingerprint: assessment.fingerprint, criterionId: item.criterionId, targetRequirementId: criterion.requirementId,
      mark: item.mark, severity, priority, priorityReason,
      summary: item.gaps, rationale: item.rationale, uncertainty: item.uncertainty, nextStep: item.nextStep,
      checkedSourceIds: item.checkedSourceIds, sourceRefs: item.sourceRefs,
      requiresHumanConfirmation: true, suggestedFirstAction: 'Request the relevant existing explanation or work sample; HR explicitly selects any bounded task.'
    };
  }).sort((a, b) => a.priority - b.priority || a.criterionId.localeCompare(b.criterionId));
}
