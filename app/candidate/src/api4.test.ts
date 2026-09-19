import { beforeEach, expect, it, vi } from 'vitest';
import type { Demo, Comparison } from '../../shared/api4-types';
import { Api4Client, baseBinding } from '../../shared/api4/client';
import { draftKey } from '../../shared/api4/candidate-draft';
import { recoveredPublicText } from '../../shared/api4/legacy-drafts';
import { materialUrl } from '../../shared/api4/materials';
import { prioritizedGaps } from '../../shared/api4/gaps';
import { resolveSourceRef, comparisonCounts } from '../../shared/api4/hr-model';

// Deliberately minimal transport fixtures; real API4 DTOs are covered by browser integration.
const demo = { schemaVersion:'4.0', sessionId:'unit-session', revision:1, candidate:{id:'amy-chen'}, job:{id:'junior-data-analyst'}, rubric:{}, dataset:{resources:[]}, versions:[], workflow:{}, assessment:{}, shortlist:{}, task:{taskId:'unit-task'}, fixtureVersion:'fixture-a', jdVersion:'jd-a', rubricVersion:'rubric-a', datasetVersion:'dataset-a' } as unknown as Demo;
const envelope = { data:demo, meta:{replayed:false} };
const response = (body:unknown, status=200) => new Response(JSON.stringify(body),{status});
beforeEach(()=> { const storage = new Map<string,string>();vi.stubGlobal('sessionStorage',{ getItem:(k:string)=>storage.get(k)??null, setItem:(k:string,v:string)=>storage.set(k,v), removeItem:(k:string)=>storage.delete(k) }); });
it('negotiates API4 and rejects API3 without a fallback',async()=>{
  const fetcher=vi.fn().mockResolvedValue(response({...envelope,data:{...demo,schemaVersion:'3.0'}}));
  const client=new Api4Client('/gateway','unit',fetcher);
  await expect(client.read('amy-chen')).rejects.toMatchObject({code:'SCHEMA_MISMATCH'});
  expect(fetcher.mock.calls[0][1].headers['X-EvidenceBridge-Schema-Version']).toBe('4.0');
});
it('never restores a legacy receipt into API4',()=>{
  sessionStorage.setItem('receipt',JSON.stringify({path:'/task/send',key:'unit-key-123',body:{...baseBinding(demo),schemaVersion:'3.0',candidateId:'alex-chen'}}));
  expect(new Api4Client('/gateway','receipt').pending).toBeNull();
});
it('preserves exact body and key through an HTML 401 and explicit retry',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('<html>Login</html>',{status:401})).mockResolvedValueOnce(response(envelope));
  const client=new Api4Client('/gateway','receipt',fetcher);
  await expect(client.write('/task/send',baseBinding(demo))).rejects.toMatchObject({code:'WRITE_AUTH_REQUIRED'});
  const original=structuredClone(client.pending);const reloaded=new Api4Client('/gateway','receipt',fetcher);
  expect(reloaded.pending).toEqual(original);await reloaded.retry();
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
  expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetcher.mock.calls[1][1].headers['Idempotency-Key']);
  expect(reloaded.pending).toBeNull();
});
it('keeps an uncertain receipt, but rejects a different response identity',async()=>{
  const fetcher=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response({...envelope,data:{...demo,candidate:{id:'ann-li'}}}));
  const client=new Api4Client('/gateway','receipt',fetcher);
  await expect(client.write('/review',baseBinding(demo))).rejects.toMatchObject({uncertain:true});
  const key=client.pending?.key;await expect(client.retry()).rejects.toMatchObject({code:'IDENTITY_MISMATCH'});expect(client.pending?.key).toBe(key);
});
it('a definitive conflict clears the receipt for an explicitly revised request',async()=>{
  const client=new Api4Client('/gateway','receipt',vi.fn().mockResolvedValue(response({error:{code:'ASSESSMENT_CONFLICT',message:'Refresh current basis'}},409)));
  await expect(client.write('/assessment',baseBinding(demo))).rejects.toMatchObject({status:409});expect(client.pending).toBeNull();
});
it.each(['sessionId','fixtureVersion','jdVersion','rubricVersion','datasetVersion'] as const)('partitions drafts when %s changes',field=>{
  expect(draftKey({...demo,[field]:'new-version'},1)).not.toBe(draftKey(demo,1));
});
it('also separates people, tasks and V1/V2',()=>{
  expect(new Set([draftKey(demo,1),draftKey(demo,2),draftKey({...demo,candidate:{...demo.candidate,id:'ann-li'}},1),draftKey({...demo,task:{...demo.task,taskId:'other'}},1)]).size).toBe(4);
});
it('recovery exports only public prose and never imports private notes or events',()=>{
  const text=recoveredPublicText(JSON.stringify({summary:'Public summary',findings:[{title:'Finding',detail:'Public reasoning',notes:'SECRET'}],notes:'PRIVATE',events:[{detail:'PRIVATE_EVENT'}]}));
  expect(text).toContain('Public reasoning');expect(text).not.toMatch(/SECRET|PRIVATE/);expect(text).toContain('not rebound');
});
it('PDF links include the gateway prefix and reject arbitrary or traversing URLs',()=>{
  expect(materialUrl('/gateway','/api/demo/materials/amy-chen/cv.pdf')).toBe('/gateway/api/demo/materials/amy-chen/cv.pdf');
  expect(materialUrl('http://127.0.0.1:8894/','/api/demo/materials/jd.pdf')).toBe('http://127.0.0.1:8894/api/demo/materials/jd.pdf');
  for(const path of ['https://untrusted.test/file.pdf','/api/demo/materials/../secret.pdf','/api/demo/materials/jd.pdf?redirect=x'])expect(materialUrl('/gateway',path)).toBeNull();
});
it('uses server priority rather than the first NE and excludes stale suggestions',()=>{
  const row={assessment:{assessmentRevision:2},application:{evidenceSnapshotId:'snapshot',fingerprint:'hash'},gapSuggestions:[
    {criterionId:'D3',mark:'NE',priority:3,stage:'application_review',assessmentRevision:2,evidenceSnapshotId:'snapshot',fingerprint:'hash'},
    {criterionId:'B2',mark:0,priority:1,stage:'application_review',assessmentRevision:2,evidenceSnapshotId:'snapshot',fingerprint:'hash'},
    {criterionId:'B4',priority:0,stage:'application_review',assessmentRevision:1,evidenceSnapshotId:'snapshot',fingerprint:'hash'},
  ]} as unknown as Comparison['candidates'][number];
  expect(prioritizedGaps(row).map(g=>g.criterionId)).toEqual(['B2','D3']);
});
it('keeps reviewed count separate from numerical coverage using server fields',()=>{
  expect(comparisonCounts({applicationsReviewed:4,candidatesWithCompleteCoreEvidence:2,candidates:[]} as unknown as Comparison)).toEqual({reviewed:4,complete:2});
});
it('quotes with identical filenames still bind person, snapshot, hash and UTF-16',()=>{
  const context={evidenceSnapshotId:'snapshot',fingerprint:'hash',sources:[{sourceId:'cv-public.txt',location:'/sources/0/text',text:'A😀quote'}]};
  const ref={candidateId:'amy-chen' as const,evidenceSnapshotId:'snapshot',fingerprint:'hash',sourceId:'cv-public.txt',location:'/sources/0/text',start:1,end:3,quote:'😀'};
  expect(resolveSourceRef('amy-chen',context,ref)).not.toBeNull();expect(resolveSourceRef('ann-li',context,ref)).toBeNull();expect(resolveSourceRef('amy-chen',{...context,fingerprint:'changed'},ref)).toBeNull();
});
