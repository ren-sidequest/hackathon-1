import { describe, expect, it } from 'vitest';
import initial from '../../../docs/backend/examples/initial.response.json';
import { ApiClient, ApiError, emptyDraft, publicWork, submissionPayload, submissionIssues, draftKey, resolveCitation } from '../../shared/api';
import type { Demo, Version } from '../../shared/api-types';
const data = initial.data as Demo;
const sent = { ...data, workflow: { ...data.workflow, canSubmit:true, nextSubmissionVersion:1 as const } };
describe('API 2.0 frontend boundary', () => {
  it('whitelists nested public work and excludes private notes', () => {
    const draft = { ...emptyDraft(), summary:'Public statement', notes:'PRIVATE', findings:[{ id:'f1',section:'Key Findings' as const,title:'Finding',detail:'Evidence',source:'',confidence:'Low' as const,notes:'NESTED_PRIVATE' }], events:[{id:'e1',at:new Date().toISOString(),title:'Viewed source',notes:'EVENT_PRIVATE'}] };
    const payload = submissionPayload(sent,draft);
    expect(JSON.stringify(payload)).not.toContain('PRIVATE');
    expect(payload.previousSubmissionId).toBeNull();
    expect(payload.schemaVersion).toBe('2.0');
    expect(publicWork(draft)).not.toHaveProperty('notes');
  });
  it('requires actual permission, not unused submission capacity', () => {
    expect(() => submissionPayload(data,emptyDraft())).toThrow();
    expect(() => submissionPayload({...sent,workflow:{...sent.workflow,canSubmit:false,remainingSubmissions:1}},emptyDraft())).toThrow();
  });
  it('accepts weak work but rejects oversize UTF-8 payloads', () => {
    expect(submissionIssues(sent,{...emptyDraft(),summary:'A weak but real answer.'})).toEqual([]);
    const findings = Array.from({length:30},(_,i)=>({id:`f${i}`,section:'Key Findings' as const,title:'Test',detail:'字'.repeat(2000),source:'',confidence:'Low' as const}));
    expect(submissionIssues(sent,{...emptyDraft(),summary:'Summary',findings})).toContain('The public work exceeds 128 KiB. Shorten the summary or cards before submitting.');
  });
  it('isolates drafts by session, task and intended version', () => {
    expect(draftKey(data,1)).not.toBe(draftKey(data,2));
    expect(draftKey(data,1)).not.toBe(draftKey({...data,sessionId:'new'},1));
  });
  it('validates UTF-16 quotations against their selected version, not current view', () => {
    const text='😀中文 evidence';const c={sourceId:'summary',location:'/summary',quote:'中文',start:2,end:4};
    const version={submission:{submissionId:'v1',contentFingerprint:'hash',sources:[{sourceId:'summary',location:'/summary',text}]},analysis:{submissionId:'v1',contentFingerprint:'hash',result:{submissionId:'v1',contentFingerprint:'hash'}}} as Version;
    expect(resolveCitation(version,c)?.text).toBe(text);
    expect(resolveCitation(version,{...c,start:1})).toBeNull();
    expect(resolveCitation({...version,analysis:{...version.analysis,submissionId:'v2'}},c)).toBeNull();
  });
  it('retries uncertain requests with the exact original body and key', async () => {
    const calls: RequestInit[]=[];
    const fetcher=async (_url:unknown,init?:RequestInit)=>{ calls.push(init!); if(calls.length===1)throw new Error('network lost'); return new Response(JSON.stringify(initial),{status:200}); };
    const client=new ApiClient('http://test','unit-test',fetcher as typeof fetch);
    await expect(client.write('/task/send',{schemaVersion:'2.0',instructions:'Original'})).rejects.toBeInstanceOf(ApiError);
    await client.retry();
    expect(calls[0].body).toBe(calls[1].body);
    expect(calls[0].headers).toEqual(calls[1].headers);
    expect(client.pending).toBeNull();
  });
});
