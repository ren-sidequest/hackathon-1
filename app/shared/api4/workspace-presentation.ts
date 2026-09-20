import type { Demo, Comparison } from '../api4-types';
export type WorkspaceRole = 'hr' | 'candidate';
export type WorkspacePresentation = { role: WorkspaceRole; data: Demo; comparison: Comparison };
const scopeKeys = ['sessionId','fixtureVersion','jdVersion','rubricVersion','datasetVersion'] as const;
/** Display-only hold, never a replacement for the controller's identity-strict data or write checks. */
export function workspacePresentation(role: WorkspaceRole, needsSelection: boolean, data: Demo|null, comparison: Comparison|null, held: WorkspacePresentation|null): WorkspacePresentation|null {
  if(needsSelection) return null;
  if(data&&comparison) return {role,data,comparison};
  if(!held||held.role!==role||!comparison) return null;
  if(scopeKeys.some(key=>held.data[key]!==comparison[key])) return null;
  return held;
}
