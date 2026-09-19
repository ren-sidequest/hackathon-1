import { describe, expect, it } from 'vitest';
import { changePreviewDraft, initialPreview, previewDraftPrefix, previewStorageKey, readPreview, retainCandidate, sendTask, writePreviewBusiness } from '../../shared/revision5/preview-store';
import { profiles } from '../../shared/revision5/fixtures';
import { draftKey } from '../../shared/revision5/model';
import { emptyDraft } from '../../shared/api';
const storage = () => { const values = new Map<string,string>(); return { values, getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);} }; };
describe('isolated preview draft storage',()=>{
  it('a stale candidate keystroke preserves a newer HR shortlist and revision',()=>{
    const store=storage(), old=sendTask(initialPreview(),profiles[0],'BPS','Instructions','Gap'); old.revision=1;
    writePreviewBusiness(store,old);
    const latest=retainCandidate(old,profiles[3],true,'Discuss evidence');latest.revision=2;writePreviewBusiness(store,latest);
    const result=changePreviewDraft(store,old,profiles[0].id,d=>({...d,summary:'Candidate edit'}));
    expect(result.revision).toBe(2);expect(result.shortlist[profiles[3].id]?.retained).toBe(true);
    const raw=JSON.parse(store.getItem(previewStorageKey)!);expect(raw.revision).toBe(2);expect(raw.shortlist).toEqual(latest.shortlist);expect(raw.workDrafts).toEqual({});
    expect(Object.values(readPreview(store,old).workDrafts)[0].summary).toBe('Candidate edit');
  });
  it('different candidates save separate draft keys without replacing one another',()=>{
    const store=storage();let state=sendTask(initialPreview(),profiles[0],'BPS','Instructions','Gap');state=sendTask(state,profiles[1],'SQL','Instructions','Gap');writePreviewBusiness(store,state);
    changePreviewDraft(store,state,profiles[0].id,d=>({...d,summary:'Alex'}));changePreviewDraft(store,state,profiles[1].id,d=>({...d,summary:'Maya'}));
    expect(Object.values(readPreview(store,state).workDrafts).map(d=>d.summary).sort()).toEqual(['Alex','Maya']);
    expect([...store.values.keys()].filter(k=>k.startsWith(previewDraftPrefix))).toHaveLength(2);
  });
  it('legacy embedded draft migration preserves newer isolated values',()=>{
    const store=storage(), state=sendTask(initialPreview(),profiles[0],'BPS','Instructions','Gap');const key=draftKey(state,profiles[0].id,state.tasks[profiles[0].id]!,1);
    state.workDrafts[key]={...emptyDraft(),summary:'legacy'};store.setItem(previewStorageKey,JSON.stringify(state));
    expect(readPreview(store,state).workDrafts[key].summary).toBe('legacy');writePreviewBusiness(store,state);
    expect(JSON.parse(store.getItem(previewStorageKey)!).workDrafts).toEqual({});expect(readPreview(store,state).workDrafts[key].summary).toBe('legacy');
    changePreviewDraft(store,state,profiles[0].id,d=>({...d,summary:'newer'}));writePreviewBusiness(store,state);expect(readPreview(store,state).workDrafts[key].summary).toBe('newer');
  });
  it('a changed session or terminal task rejects old draft writes',()=>{
    const store=storage(), old=sendTask(initialPreview(),profiles[0],'BPS','Instructions','Gap');writePreviewBusiness(store,old);
    const closed={...old,tasks:{...old.tasks,[profiles[0].id]:{...old.tasks[profiles[0].id]!,status:'closed' as const}}};writePreviewBusiness(store,closed);
    expect(()=>changePreviewDraft(store,old,profiles[0].id,d=>({...d,summary:'stale'}))).toThrow('changed');
    writePreviewBusiness(store,initialPreview());expect(()=>changePreviewDraft(store,old,profiles[0].id,d=>({...d,summary:'stale'}))).toThrow('changed');
    expect([...store.values.keys()].filter(k=>k.startsWith(previewDraftPrefix))).toHaveLength(0);
  });
});
