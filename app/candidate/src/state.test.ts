import { describe, expect, it } from 'vitest';
import { initialState, reducer, restore, submissionIssues, type Action, type State } from './state';
import { channels, resources, csv } from './data';
const at = '2026-09-19T01:00:00.000Z';
const action = (type: 'APPLY'|'START'|'SAVE'|'SUBMIT'|'LOAD_FINDINGS'): Action => ({type,at,id:type});
function working(): State {
  return reducer(reducer(reducer(initialState,{type:'LOAD_APPLICATION'}),action('APPLY')),action('START'));
}
function complete(): State { return reducer(working(),action('LOAD_FINDINGS')); }
describe('candidate evidence workflow',()=>{
  it('requires a resume and a received task before beginning work',()=>{
    expect(reducer(initialState,action('APPLY'))).toBe(initialState);
    expect(reducer(initialState,action('START'))).toBe(initialState);
    expect(working().stage).toBe('working');
  });
  it('rejects an incomplete investigation and identifies all five requirements',()=>{
    expect(submissionIssues(working())).toHaveLength(5);
    expect(reducer(working(),action('SUBMIT')).stage).toBe('working');
  });
  it('submits one immutable work sample and prevents duplicate submission',()=>{
    const submitted=reducer(complete(),action('SUBMIT'));
    expect(submitted.stage).toBe('submitted');expect(submitted.submittedAt).toBe(at);
    expect(reducer(submitted,action('SUBMIT'))).toBe(submitted);
    expect(reducer(submitted,{type:'SUMMARY',value:'overwrite'})).toBe(submitted);
    expect(reducer(submitted,{type:'DELETE',findingId:'demo-1',at,id:'delete'})).toBe(submitted);
    expect(reducer(submitted,{type:'UPSERT',finding:{...submitted.findings[0],title:'overwrite'},at,id:'edit'})).toBe(submitted);
  });
  it('upserts and deletes cards without duplicating IDs; whitespace cannot create evidence',()=>{
    const s=complete(), finding={...s.findings[0],title:'Revised observation'};
    const updated=reducer(s,{type:'UPSERT',finding,at,id:'edit'});
    expect(updated.findings).toHaveLength(s.findings.length);expect(updated.findings[0].title).toBe(finding.title);
    expect(reducer(s,{type:'UPSERT',finding:{...finding,title:'  '},at,id:'blank'})).toBe(s);
    expect(reducer(updated,{type:'DELETE',findingId:finding.id,at,id:'remove'}).findings).toHaveLength(s.findings.length-1);
  });
  it('keeps insufficient evidence separate from confirmation',()=>{
    const submitted=reducer(complete(),action('SUBMIT'));
    const rejected=reducer(submitted,{type:'REVIEW',review:'insufficient',at,id:'review'});
    expect(rejected.stage).toBe('reviewed');expect(rejected.review).toBe('insufficient');
    expect(reducer(submitted,{type:'REVIEW',review:'confirmed',at,id:'review'}).review).toBe('confirmed');
  });
  it('reopens a requested draft, preserves evidence and permits resubmission',()=>{
    const submitted=reducer(complete(),action('SUBMIT'));
    const more=reducer(submitted,{type:'REVIEW',review:'more',at,id:'review'});
    expect(more.stage).toBe('working');expect(more.findings).toEqual(submitted.findings);
    const second=reducer(more,{type:'SUBMIT',at:'2026-09-19T02:00:00.000Z',id:'second'});
    expect(second.stage).toBe('submitted');expect(second.review).toBeNull();
  });
  it('cannot apply a review before submission or after review completion',()=>{
    expect(reducer(working(),{type:'REVIEW',review:'confirmed',at,id:'review'}).stage).toBe('working');
  });
  it('explicitly labels seeded example content instead of fabricating individual actions',()=>{
    const s=complete();expect(s.events.at(-1)?.title).toBe('Loaded example investigation');
    expect(s.events.some(e=>e.title.startsWith('Viewed '))).toBe(false);
  });
  it('reset removes all materials, notes and previously submitted work',()=>{
    const s=reducer(complete(),{type:'NOTES',value:'private'});
    expect(reducer(s,{type:'RESET'})).toEqual(initialState);
  });
});
describe('local demo persistence and data',()=>{
  it('restores a valid draft without losing evidence',()=>expect(restore(JSON.stringify(complete()))).toEqual(complete()));
  it.each(['{broken', '{}', 'null', JSON.stringify({...initialState,version:2}), JSON.stringify({...initialState,findings:[null]}),JSON.stringify({...initialState,events:[{id:'x',at:'broken',title:'x'}]})])('recovers malformed browser storage: %s', raw=>expect(restore(raw)).toEqual(initialState));
  it('uses consistent channel totals for the KPI snapshot',()=>{
    expect(channels.reduce((n,c)=>n+c.traffic,0)).toBe(1200000);
    expect(channels.reduce((n,c)=>n+c.orders,0)).toBe(31200);
    for(const c of channels)expect(100*c.orders/c.traffic).toBeCloseTo(c.conversion,3);
  });
  it('escapes quotes and delimiters in downloaded CSV',()=>expect(csv({...resources[0],columns:['name'],rows:[['a,"b"']]})).toBe('"name"\r\n"a,""b"""'));
});
