import type { Demo } from '../api4-types';

export function nextStep(data: Demo, role: 'hr' | 'candidate', page: string) {
  if (role === 'candidate') {
    if (data.workflow.canSubmit) return { page: page === 'tasks' ? 'workspace' : 'tasks', label: page === 'tasks' ? `Open V${data.workflow.nextSubmissionVersion} workspace` : `Read V${data.workflow.nextSubmissionVersion} task brief`, detail: data.workflow.canResubmit ? 'Read the feedback and address the remaining gap. V1 remains unchanged.' : 'Read the task, explore the resources, then explain your reasoning.' };
    if (data.versions.length) return { page: 'history', label: 'View work & feedback', detail: data.workflow.isTerminal ? 'Review is complete. Your saved versions remain available.' : 'Your work is saved. Wait for HR feedback; refresh to check for updates.' };
    return { page: 'tasks', label: 'Check task status', detail: 'No task is open yet. You can inspect your materials and check for a request.' };
  }
  if (data.versions.length && !data.versions.at(-1)?.review) return { page: 'tasks', label: 'Review submitted work', detail: 'Read the current work and give public feedback. Scores and shortlist choices remain separate.' };
  if (data.shortlist.status === 'needs_reconfirmation') return { page: 'shortlist', label: 'Reconfirm retained decision', detail: 'The evidence basis changed. Review it before confirming the retained decision again.' };
  if (data.workflow.isTerminal) return { page: 'shortlist', label: 'Make a human shortlist decision', detail: 'Evidence review is complete. Retaining is a separate human decision.' };
  if (data.task.status !== 'draft') return { page: 'tasks', label: 'View task status', detail: 'The candidate has the task. Refresh after they submit their work.' };
  return { page: 'evidence', label: 'Inspect application evidence', detail: 'Inspect the source first. Request a task only for a specific gap, or make a shortlist decision.' };
}
export function savedActionDestination(path: string, role: 'hr' | 'candidate', stage?: unknown) {
  if (role === 'candidate') return { page: 'history', label: 'View work & feedback' };
  if (path === '/shortlist') return { page: 'shortlist', label: 'View retained decisions' };
  if (path === '/assessment') return stage === 'task_v1' || stage === 'task_v2' ? { page: 'tasks', label: 'View saved task assessment' } : { page: 'evidence', label: 'View saved assessment' };
  if (path === '/review') return { page: 'tasks', label: 'View review & next steps' };
  return { page: 'tasks', label: 'View task status' };
}
