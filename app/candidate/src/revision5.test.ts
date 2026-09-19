import { describe, expect, it } from 'vitest';
import { emptyDraft } from '../../shared/api';
import { criteria, profiles } from '../../shared/revision5/fixtures';
import { assessmentKey, currentBasis, draftKey, formatPercent, needsReconfirmation, nextVersion, quoteSource, sortedProfiles } from '../../shared/revision5/model';
import { initialPreview, retainCandidate, reviewWork, saveAssessmentDraft, sendTask, submitWork, validState } from '../../shared/revision5/preview-store';

describe('Revision 5 frontend view models (mock, not backend acceptance)',()=>{
  it('rejects malformed local drafts and assessment entries before mounting their editors',()=>{
    const state=initialPreview();
    expect(validState(state)).toBe(true);
    expect(validState({...state,workDrafts:{bad:{summary:null}}})).toBe(false);
    expect(validState({...state,assessmentDrafts:{bad:{candidateId:profiles[0].id,entries:[]}}})).toBe(false);
    expect(validState({...state,shortlist:{[profiles[0].id]:{retained:true}}})).toBe(false);
  });
  it('keeps four distinct profiles and every fixture quotation bound to exact UTF-16 source text',()=>{
    expect(new Set(profiles.map(p=>p.id)).size).toBe(4);
    for(const profile of profiles){
      expect(profile.assessment.entries).toHaveLength(10);
      expect(profile.sources.every(s=>s.candidateId===profile.id)).toBe(true);
      for(const entry of profile.assessment.entries)if(entry.citation){
        expect(quoteSource(profile,entry.citation)).not.toBeNull();
        expect(quoteSource(profiles.find(p=>p.id!==profile.id)!,entry.citation)).toBeNull();
        expect(quoteSource(profile,{...entry.citation,snapshotId:'another-snapshot'})).toBeNull();
      }
    }
    const b3=profiles[0].assessment.entries.find(e=>e.criterionId==='B3')!;
    expect(b3.mark).toBe(2);expect(b3.citation?.text).toContain('😀');
    expect(quoteSource(profiles[0],{...b3.citation!,start:b3.citation!.start+1})).toBeNull();
  });
  it('formats missing, zero and fractional results distinctly and never ranks missing evidence as zero',()=>{
    expect(formatPercent(null)).toBe('Needs evidence');expect(formatPercent(0)).toBe('0.0%');expect(formatPercent(81.25)).toBe('81.3%');
    expect(sortedProfiles(profiles,'overall').map(p=>p.name)).toEqual(['Leo Nguyen','Sam Rivera','Alex Chen','Maya Patel']);
    expect(sortedProfiles(profiles,'SQL').map(p=>p.name)).toEqual(['Sam Rivera','Alex Chen','Leo Nguyen','Maya Patel']);
    expect(sortedProfiles(profiles,'default')).toEqual(profiles);
  });
  it('keeps reviewed fixture results unchanged when a local assessment draft is saved',()=>{
    const p=profiles[0],state=initialPreview(),entries=structuredClone(p.assessment.entries);entries[0].mark=0;
    const after=saveAssessmentDraft(state,{candidateId:p.id,stage:'application_review',snapshotId:p.snapshotId,rubricVersion:p.assessment.rubricVersion,entries,savedAt:'2026-09-19T00:00:00Z'});
    expect(after.assessmentDrafts[assessmentKey(p.id,'application_review')].entries[0].mark).toBe(0);
    expect(p.assessment.results.skills.SQL).toBe(75);expect(state.assessmentDrafts).toEqual({});
  });
  for(const p of profiles)it(`${p.name}: one task, one authorised revision, immutable history and independent shortlist`,()=>{
    let state=sendTask(initialPreview(),p,p.suggestedSkill,'Reviewable instructions','Specific gap');
    expect(()=>sendTask(state,p,'SQL','Other','Other')).toThrow();
    expect(nextVersion(state.tasks[p.id])).toBe(1);
    const other=profiles.find(x=>x.id!==p.id)!;expect(state.tasks[other.id]).toBeNull();
    const draft={...emptyDraft(),summary:'Unique first answer',notes:'PRIVATE DO NOT SHARE'};
    const task=state.tasks[p.id]!;
    expect(draftKey(state,p.id,task,1)).not.toBe(draftKey(state,other.id,task,1));
    expect(draftKey(state,p.id,task,1)).not.toBe(draftKey(state,p.id,task,2));
    state=submitWork(state,p,draft);expect(JSON.stringify(state.tasks[p.id])).not.toContain('PRIVATE');
    expect(nextVersion(state.tasks[p.id])).toBeNull();
    const v1=state.tasks[p.id]!.versions[0];
    state=reviewWork(state,p,v1.id,'needs_more_evidence','Explain the discriminator.');
    const before=JSON.stringify(state.tasks[p.id]!.versions[0]);
    expect(nextVersion(state.tasks[p.id])).toBe(2);
    state=submitWork(state,p,{...draft,summary:'Unique revised answer'});
    expect(JSON.stringify(state.tasks[p.id]!.versions[0])).toBe(before);
    const v2=state.tasks[p.id]!.versions[1];expect(v2.review).toBeNull();expect(v2.id).not.toBe(v1.id);
    expect(()=>reviewWork(state,p,v1.id,'confirm','Old version')).toThrow();
    expect(()=>reviewWork(state,p,v2.id,'needs_more_evidence','Third')).toThrow();
    state=reviewWork(state,p,v2.id,'confirm','Bounded evidence confirmed.');
    expect(nextVersion(state.tasks[p.id])).toBeNull();expect(state.shortlist[p.id]).toBeNull();
    expect(()=>submitWork(state,p,draft)).toThrow();
  });
  it('supports retaining all four and marks the old basis stale after new public work',()=>{
    let state=initialPreview();
    for(const p of profiles)state=retainCandidate(state,p,true,'A specific reason.');
    expect(Object.values(state.shortlist).filter(s=>s?.retained)).toHaveLength(4);
    const p=profiles[3],original=state.shortlist[p.id]!;
    state=sendTask(state,p,'SQL','SQL checks','Specific check');state=submitWork(state,p,{...emptyDraft(),summary:'A new source snapshot.'});
    expect(needsReconfirmation(state.shortlist[p.id],currentBasis(p,state.tasks[p.id]))).toBe(true);
    expect(state.shortlist[p.id]).toEqual(original);
    state=retainCandidate(state,p,true,'Reviewed the new source.');
    expect(needsReconfirmation(state.shortlist[p.id],currentBasis(p,state.tasks[p.id]))).toBe(false);
    state=retainCandidate(state,p,false,'Need to discuss the other evidence first.');
    expect(state.tasks[p.id]!.versions).toHaveLength(1);expect(profiles).toHaveLength(4);
  });
  it('accepts a weak answer but blocks empty, oversize and unknown-resource public work',()=>{
    const p=profiles[0],state=sendTask(initialPreview(),p,'BPS','Task','Gap');
    expect(()=>submitWork(state,p,emptyDraft())).toThrow();
    expect(()=>submitWork(state,p,{...emptyDraft(),summary:'A weak answer'})).not.toThrow();
    const findings=Array.from({length:40},(_,i)=>({id:`f${i}`,section:'Key Findings' as const,title:'Evidence',detail:'字'.repeat(3000),source:'',confidence:'Low' as const}));
    expect(()=>submitWork(state,p,{...emptyDraft(),summary:'Summary',findings})).toThrow(/128 KiB/);
    expect(()=>submitWork(state,p,{...emptyDraft(),summary:'Summary',findings:[{...findings[0],detail:'Short',source:'unknown.csv'}]})).toThrow(/source/);
    expect(criteria.filter(c=>c.skill==='SQL')).toHaveLength(3);
  });
});
