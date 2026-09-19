import { expect, it } from 'vitest';
import { candidateSelection, clearRetiredDemoStorage } from '../../shared/api4/current-demo';

it.each(['amy-chen','ann-li','david-liu','jamie-parker'])('keeps current identity %s', id => {
  expect(candidateSelection(`https://example.org/hr/?candidateId=${id}#comparison`)).toEqual({ candidateId: id, needsSelection: false });
});
it.each(['alex-chen','maya-patel','leo-zhang','sam-taylor','unknown'])('requires explicit selection for retired/unknown identity %s', id => {
  expect(candidateSelection(`https://example.org/hr/?candidateId=${id}`)).toEqual({ candidateId: null, needsSelection: true });
});
it('keeps normal no-ID bootstrap and empty links', () => {
  for (const suffix of ['', '?candidateId=']) expect(candidateSelection(`https://example.org/hr/${suffix}`)).toEqual({candidateId:null,needsSelection:false});
});
it('removes only old demo drafts and receipts, preserving current work and preferences', () => {
  const retired=['evidencebridge.api3.draft.old.alex-chen.task.v1','evidencebridge.api3.receipt.hr./gateway','evidencebridge.api3.analysis-receipt.candidate./gateway'];
  const kept=['evidencebridge.api4.draft.session.amy-chen.task.v1','evidencebridge.api4.receipt.hr./gateway','evidencebridge.api4.analysis-receipt.hr./gateway','evidencebridge.theme','unrelated.draft'];
  const values=new Map([...retired,...kept].map(key=>[key,'unchanged']));
  clearRetiredDemoStorage({get length(){return values.size;},key:index=>[...values.keys()][index]??null,removeItem:key=>{values.delete(key);}});
  expect([...values.keys()]).toEqual(kept);expect([...values.values()]).toEqual(kept.map(()=>'unchanged'));
});
it('works even when browser storage is blocked',()=>{
  expect(()=>clearRetiredDemoStorage({get length(): number {throw new Error('blocked');},key:()=>null,removeItem:()=>{}})).not.toThrow();
});
