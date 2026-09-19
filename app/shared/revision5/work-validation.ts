import initial from '../../../docs/backend/examples/initial.response.json';
import type { Demo } from '../api-types';
import { publicWork, submissionIssues } from '../api';
import { nextVersion, type Profile, type Task, type WorkDraft } from './model';
const canonical=initial.data as Demo;
const validationCase={...canonical,workflow:{...canonical.workflow,canSubmit:true,nextSubmissionVersion:1 as const}};
export function previewSubmissionIssues(profile:Profile,task:Task,draft:WorkDraft) {
  const issues=submissionIssues(validationCase,draft);
  const bytes=new TextEncoder().encode(JSON.stringify({candidateId:profile.id,taskId:task.id,version:nextVersion(task),...publicWork(draft)})).length;
  if(bytes>128*1024&&!issues.some(i=>i.includes('128 KiB')))issues.push('The public work exceeds 128 KiB. Shorten it before submitting.');
  return issues;
}
