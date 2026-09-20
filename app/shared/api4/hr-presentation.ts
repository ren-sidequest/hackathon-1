import type { Demo, Comparison } from '../api4-types';
import { workspacePresentation } from './workspace-presentation';
export type HRPresentation = { data: Demo; comparison: Comparison };
/** Compatibility for the original shortlist-only contract; live pages use the shared presenter. */
export function hrPresentation(role:'hr'|'candidate',page:string,needsSelection:boolean,data:Demo|null,comparison:Comparison|null,held:HRPresentation|null):HRPresentation|null {
  if(role!=='hr'||(!data&&page!=='shortlist'))return null;
  const next=workspacePresentation(role,needsSelection,data,comparison,held?{role:'hr',...held}:null);
  return next?(data&&comparison?{data,comparison}:held):null;
}
