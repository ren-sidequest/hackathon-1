import { describe, it, expect } from 'vitest';
import { emptyDraft, publicWork, sections } from '../../shared/api4/candidate-draft';
import { fillDemoDraft, nextExample } from '../../shared/api4/rehearsal';

describe('authored demo examples', () => {
  it('fills all four sections and required summary; preserves work, notes and repeated fill', () => {
    const d=fillDemoDraft({...emptyDraft(),started:true,notes:'private'});
    expect(d.summary).toContain('Synthetic rehearsal');expect(d.findings).toHaveLength(4);
    expect(sections.every(s=>d.findings.some(f=>f.section===s))).toBe(true);
    const edited={...d,summary:'My own summary',findings:d.findings.map(f=>({...f,title:'Edited '+f.title}))};
    expect(fillDemoDraft(edited)).toEqual(edited);expect(edited.notes).toBe('private');expect(publicWork(edited)).not.toHaveProperty('notes');
  });
  for(const section of sections) it(`${section}: saved examples are distinct even after title edits; exhausted bank never duplicates`,()=>{
    const findings=[] as NonNullable<ReturnType<typeof nextExample>>[];
    for(let i=0;i<4;i++){const f=nextExample(section,findings)!;expect(f).toBeTruthy();expect(findings.some(old=>old.detail===f.detail)).toBe(false);findings.push({...f,title:'Edited'});}
    expect(nextExample(section,findings)).toBeNull();expect(new Set(findings.map(f=>f.id)).size).toBe(4);
  });
  it('never exceeds the 40 card limit',()=>{
    const f=nextExample('Key Findings',[])!;const d={...emptyDraft(),findings:Array.from({length:40},(_,i)=>({...f,id:String(i)}))};
    expect(fillDemoDraft(d).findings).toHaveLength(40);
  });
});
