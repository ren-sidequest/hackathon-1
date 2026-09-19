import React, { useState } from 'react';
import { Dialog } from '../api-ui';
import { criteria } from './fixtures';
import { assessmentKey, quoteSource, rubricVersion, skillName, stageName, submissionSource, type AssessmentEntry, type Mark, type Profile, type Quote, type Source, type Stage } from './model';
import { saveAssessmentDraft, type PreviewController } from './preview-store';

export function Rubric({close}:{close:()=>void}) {
  return <Dialog title="Ten public assessment standards" close={close}><div className="r5-rubric">
    <p>Job evidence match · based on current materials and this role. Not a hiring probability, ability percentile or retention prediction.</p>
    <div className="r5-formula"><strong>Criterion contribution = Mark ÷ 4 × 10</strong><p>SQL 30 points · Data Analysis 30 · Business Problem Solving 40.</p><p>Complete skill % = skill contribution ÷ skill maximum × 100. One NE means no overall percentage. Coverage is shown separately; assessed points are never scaled up.</p></div>
    <p><strong>0</strong>: an observed problem. <strong>NE</strong>: not enough material. <strong>Not assessed</strong>: no judgment yet. Mark 3 mainly meets the standard with a small gap; Mark 1 is a weak relevant attempt.</p>
    <p className="eb-muted">These are frontend rubric fixtures awaiting the backend definition. SQL is static review, not an execution check.</p>
    {criteria.map(c=><details key={c.id}><summary><span>{c.id} · {c.title}</span><small>10 points</small></summary><p>{c.looksFor}</p>{([4,2,0] as const).map(m=><p key={m}><strong>{m}/4:</strong> {c.anchors[m]}</p>)}</details>)}
  </div></Dialog>;
}
export function SourceDialog({profile,source,quote,close}:{profile:Profile;source:Source|null;quote?:Quote;close:()=>void}) {
  const valid=source&&source.candidateId===profile.id&&(!quote||quoteSource(profile,quote,[source]));
  return <Dialog title={`${profile.name} · original source`} close={close}>{valid&&source?<><p>{source.kind==='application'?'Preset application material':'Public work snapshot'} · {source.name}</p><small>Snapshot: {source.snapshotId}</small><pre>{quote?<>{source.text.slice(0,quote.start)}<mark>{source.text.slice(quote.start,quote.end)}</mark>{source.text.slice(quote.end)}</>:source.text}</pre><p className="eb-muted">Synthetic frontend preview source. A cited passage is not proof of execution or independent authorship.</p></>:<p role="alert">This quotation does not match the selected candidate and snapshot. It cannot be used as reviewed evidence.</p>}</Dialog>;
}
export function AssessmentPanel({profile,controller}:{profile:Profile;controller:PreviewController}) {
  const [stage,setStage]=useState<Stage>('application_review'), [expanded,setExpanded]=useState<string|null>('B3');
  const [edit,setEdit]=useState(false), [citation,setCitation]=useState<{source:Source|null;quote?:Quote}|null>(null);
  const task=controller.state.tasks[profile.id];
  const work=stage==='application_review'?null:task?.versions.find(v=>v.version===(stage==='task_v1'?1:2));
  const selectedCriteria=stage==='application_review'?criteria:criteria.filter(c=>c.skill===task?.skill);
  const snapshot=work?.snapshotId??profile.snapshotId;
  const sources=work?[submissionSource(work)]:profile.sources;
  const baseline=stage==='application_review'?profile.assessment.entries:selectedCriteria.map(c=>({criterionId:c.id,mark:null,reason:'',scope:'',gap:'',citation:null} satisfies AssessmentEntry));
  const saved=controller.state.assessmentDrafts[assessmentKey(profile.id,stage)];
  const draft=saved?.snapshotId===snapshot?saved:null;
  return <>
    <section className="eb-panel"><div className="eb-heading"><div><h2>Evidence before a number</h2><p>Company requirement → original passage → anchored judgment → remaining uncertainty.</p></div><button className="eb-action primary" onClick={()=>setEdit(true)}>Edit human assessment draft</button></div>
      <label className="eb-field">Material stage<select aria-label="Assessment stage" value={stage} onChange={e=>{setStage(e.target.value as Stage);setExpanded(null);}}><option value="application_review">Application materials · comparison baseline</option>{task?.versions.map(v=><option key={v.id} value={`task_v${v.version}`}>Task V{v.version} · {skillName[task.skill]}</option>)}</select></label>
      <div className="r5-meta"><span>{stageName[stage]}</span><span>{stage==='application_review'?'Illustrative reviewed fixture · revision 1':'Not assessed · target skill only'}</span><span>{rubricVersion}</span></div>
      {work&&<p className="eb-feedback">V{work.version} has no inherited score. {skillName[task!.skill]} awaits a new assessment. Other skills retain application assessment revision 1 as a separate source; this task is excluded from the application comparison.</p>}
      {draft&&<p className="r5-notice">Local assessment draft saved {new Date(draft.savedAt).toLocaleString()}. Awaiting the future assessment API; comparison and reviewed percentages are unchanged.</p>}
      <details><summary>Reviewed history & source binding</summary><p>Application assessment revision 1 is a read-only illustrative fixture. No server assessment revision has been created.</p><small>{profile.id} · {snapshot} · {rubricVersion}</small></details>
    </section>
    <div className="r5-assessment-grid"><section>{selectedCriteria.map(c=>{
      const entry=baseline.find(e=>e.criterionId===c.id)!;
      return <article className="eb-panel r5-criterion" key={c.id}><button className="r5-criterion-toggle" aria-expanded={expanded===c.id} onClick={()=>setExpanded(expanded===c.id?null:c.id)}><span className="r5-criterion-id">{c.id}</span><span><strong>{c.title}</strong><small>{skillName[c.skill]} · 10 points maximum</small></span><span className={`r5-mark ${entry.mark==='NE'||entry.mark===null?'is-unknown':''}`}>{entry.mark===null?'Not assessed':entry.mark==='NE'?'NE':`${entry.mark}/4`}</span></button>
        {expanded===c.id&&<div className="r5-criterion-body"><p><strong>What this role needs:</strong> {c.looksFor}</p><p><strong>Anchor:</strong> {entry.mark===null?'Select a mark only after reviewing the original work.':entry.mark==='NE'?'Insufficient material; not a zero.':entry.mark===3?'Mainly meets the standard, with a small remaining gap.':entry.mark===1?'A relevant attempt with very weak support.':c.anchors[entry.mark]}</p>
          {entry.citation?<button className="eb-citation" onClick={()=>setCitation({source:quoteSource(profile,entry.citation!,sources),quote:entry.citation!})}>{entry.citation.text}<small>Open exact source ↗</small></button>:<p className="eb-muted">{work?'Open the work source to begin a new assessment.':'No cited passage for this criterion.'}</p>}
          <p><strong>Judgment:</strong> {entry.reason||'No reviewed judgment yet.'}</p><p><strong>Scope:</strong> {entry.scope||'Target work sample, awaiting human assessment.'}</p>
          <div className="r5-formula">{typeof entry.mark==='number'?`${entry.mark} ÷ 4 × 10 = ${entry.mark/4*10}/10 contribution`:entry.mark==='NE'?'NE · no contribution inferred':'No contribution before assessment'}</div>
          <p><strong>Unknown & next step:</strong> {entry.gap||'Review the work against the public anchor.'}</p>
        </div>}
      </article>;
    })}</section><aside><section className="eb-panel"><h2>Original materials</h2><p>Candidate-authored sample text is separate from the task resources.</p>{sources.map(s=><button className="r5-source-card" key={s.id} onClick={()=>setCitation({source:s})}><strong>{s.name}</strong><small>{s.kind==='application'?'Application sample':'Formal mock work snapshot'} ↗</small></button>)}</section><section className="eb-panel"><h3>Three separate decisions</h3><p><strong>Assess:</strong> judge individual standards.</p><p><strong>Review evidence:</strong> confirm or request a bounded revision.</p><p><strong>Retain:</strong> choose who to discuss further.</p><p className="eb-muted">None of these automatically performs the other two.</p></section></aside></div>
    {citation&&<SourceDialog profile={profile} {...citation} close={()=>setCitation(null)}/>}
    {edit&&<AssessmentEditor key={`${profile.id}.${stage}.${snapshot}`} profile={profile} stage={stage} snapshot={snapshot} sources={sources} initial={draft?.entries??baseline} controller={controller} close={()=>setEdit(false)}/>}
  </>;
}
function AssessmentEditor({profile,stage,snapshot,sources,initial,controller,close}:{profile:Profile;stage:Stage;snapshot:string;sources:Source[];initial:AssessmentEntry[];controller:PreviewController;close:()=>void}) {
  const [entries,setEntries]=useState(()=>structuredClone(initial)), [selected,setSelected]=useState(initial[0].criterionId), [error,setError]=useState('');
  const entry=entries.find(e=>e.criterionId===selected)!, criterion=criteria.find(c=>c.id===selected)!;
  const [sourceId,setSourceId]=useState(entry.citation?.sourceId??sources[0]?.id??'');
  const [quote,setQuote]=useState(entry.citation?.text??'');
  const patch=(update:Partial<AssessmentEntry>)=>setEntries(all=>all.map(e=>e.criterionId===selected?{...e,...update}:e));
  const changeQuote=(text:string,id=sourceId)=>{setQuote(text);const source=sources.find(s=>s.id===id),start=source?.text.indexOf(text)??-1;patch({citation:source&&text&&start>=0?{candidateId:profile.id,snapshotId:snapshot,sourceId:id,start,end:start+text.length,text}:null});};
  const save=async()=>{
    const invalid=entries.find(e=>e.mark!==null&&(!e.reason.trim()||(e.mark==='NE'?(!e.scope.trim()||!e.gap.trim()):(!e.citation||!quoteSource(profile,e.citation,sources)))));
    if(invalid){setError(`${invalid.criterionId}: add a reason and a valid source quote; NE needs the checked scope and missing-evidence explanation.`);return;}
    if(!entries.some(e=>e.mark!==null)){setError('Assess at least one criterion before saving a local draft.');return;}
    if(await controller.run(s=>saveAssessmentDraft(s,{candidateId:profile.id,stage,snapshotId:snapshot,rubricVersion,entries,savedAt:new Date().toISOString()}),`${profile.name}: assessment draft saved locally. No reviewed score was recalculated.`))close();
  };
  return <Dialog title={`${profile.name} · human assessment draft`} close={close}><p>{stageName[stage]} · Local draft only. A future backend save will create a reviewed revision and calculate scores.</p><label className="eb-field">Criterion<select aria-label="Edit criterion" value={selected} onChange={e=>{const next=entries.find(x=>x.criterionId===e.target.value)!;setSelected(next.criterionId);setSourceId(next.citation?.sourceId??sources[0]?.id??'');setQuote(next.citation?.text??'');setError('');}}>{entries.map(e=><option key={e.criterionId} value={e.criterionId}>{e.criterionId} · {criteria.find(c=>c.id===e.criterionId)!.title}</option>)}</select></label>
    <p>{criterion.looksFor}</p><label className="eb-field">Human mark<select aria-label="Human mark" value={entry.mark??''} onChange={e=>patch({mark:e.target.value===''?null:e.target.value==='NE'?'NE':Number(e.target.value) as Mark})}><option value="">Not assessed</option>{[4,3,2,1,0].map(m=><option key={m} value={m}>{m}/4</option>)}<option value="NE">NE · insufficient material</option></select></label>
    <label className="eb-field">Judgment reason<textarea aria-label="Judgment reason" maxLength={2000} value={entry.reason} onChange={e=>patch({reason:e.target.value})}/></label>
    <label className="eb-field">Checked scope<textarea aria-label="Checked scope" maxLength={2000} value={entry.scope} onChange={e=>patch({scope:e.target.value})}/></label>
    <label className="eb-field">Missing evidence / next step<textarea aria-label="Missing evidence / next step" maxLength={2000} value={entry.gap} onChange={e=>patch({gap:e.target.value})}/></label>
    <label className="eb-field">Candidate source<select aria-label="Candidate source" value={sourceId} onChange={e=>{setSourceId(e.target.value);changeQuote('',e.target.value);}}>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><details><summary>Read source text</summary><pre>{sources.find(s=>s.id===sourceId)?.text}</pre></details>
    <label className="eb-field">Exact source quotation<textarea aria-label="Exact source quotation" value={quote} onChange={e=>changeQuote(e.target.value)}/></label>
    {quote&&!entry.citation&&<p role="alert">The quote must occur exactly in this candidate’s selected source.</p>}
    {error&&<p role="alert" className="eb-feedback">{error}</p>}{controller.error&&<p role="alert">{controller.error}</p>}
    <div className="eb-actions"><button className="eb-action primary" disabled={controller.busy} onClick={()=>void save()}>{controller.busy?'Saving locally…':'Save local assessment draft'}</button><button className="eb-action" onClick={close}>Cancel</button></div>
  </Dialog>;
}
