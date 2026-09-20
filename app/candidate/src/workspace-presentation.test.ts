import {expect,it} from 'vitest';
import {workspacePresentation,type WorkspaceRole} from '../../shared/api4/workspace-presentation';
import type {Comparison,Demo} from '../../shared/api4-types';
const scope={sessionId:'session',fixtureVersion:'fixture',jdVersion:'jd',rubricVersion:'rubric',datasetVersion:'dataset',revision:1};
const old={...scope,candidate:{id:'amy-chen'}} as Demo;
const list={...scope,candidates:[]} as unknown as Comparison;
it.each(['hr','candidate'] as WorkspaceRole[])('%s keeps the last accepted identity-labelled snapshot during reads',role=>{
 const held={role,data:old,comparison:list};
 expect(workspacePresentation(role,false,null,list,held)).toBe(held);
 expect(held.data.candidate.id).toBe('amy-chen');
});
it.each(['hr','candidate'] as WorkspaceRole[])('%s replaces the presentation atomically when the new identity arrives',role=>{
 const next={...old,candidate:{id:'ann-li'}} as Demo;
 expect(workspacePresentation(role,false,next,list,{role,data:old,comparison:list})).toEqual({role,data:next,comparison:list});
});
it('never carries a presentation between roles',()=>{
 expect(workspacePresentation('candidate',false,null,list,{role:'hr',data:old,comparison:list})).toBeNull();
 expect(workspacePresentation('hr',false,null,list,{role:'candidate',data:old,comparison:list})).toBeNull();
});
it.each(['sessionId','fixtureVersion','jdVersion','rubricVersion','datasetVersion'])('drops a hold when %s changes',key=>{
 expect(workspacePresentation('hr',false,null,{...list,[key]:'new'},{role:'hr',data:old,comparison:list})).toBeNull();
});
it('does not show a retired or unknown identity before selection',()=>{
 expect(workspacePresentation('hr',true,old,list,{role:'hr',data:old,comparison:list})).toBeNull();
});
it('has no presentation before a first accepted snapshot or without comparison',()=>{
 expect(workspacePresentation('hr',false,null,list,null)).toBeNull();
 expect(workspacePresentation('candidate',false,null,null,{role:'candidate',data:old,comparison:list})).toBeNull();
});
