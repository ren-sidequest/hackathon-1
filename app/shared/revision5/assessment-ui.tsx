import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from '../api-ui';
import { GlideSelect } from '../glide-select';
import { criteria } from './fixtures';
import { assessmentKey, quoteSource, rubricVersion, skillName, stageName, submissionSource, type AssessmentEntry, type Mark, type Profile, type Quote, type Source, type Stage } from './model';
import { saveAssessmentDraft, type PreviewController } from './preview-store';

export function Rubric({close,initialCriterion}:{close:()=>void;initialCriterion?:string}) {
  const selected=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    if(!initialCriterion)return;
    const frame=requestAnimationFrame(()=>{
      const detail=selected.current, dialog=detail?.closest('dialog');
      detail?.querySelector('summary')?.focus({preventScroll:true});
      if(detail&&dialog)dialog.scrollTop+=detail.getBoundingClientRect().top-dialog.getBoundingClientRect().top-24;
    });
    return ()=>cancelAnimationFrame(frame);
  },[initialCriterion]);
  return <Dialog title="Ten public assessment standards" close={close}><div className="r5-rubric">
    <p>Job evidence match · based on current materials and this role. Not a hiring probability, ability percentile or retention prediction.</p>
    <div className="r5-formula"><strong>Criterion contribution = Mark ÷ 4 × 10</strong><p>SQL 30 points · Data Analysis 30 · Business Problem Solving 40.</p><p>Complete skill % = skill contribution ÷ skill maximum × 100. One NE means no overall percentage. Coverage is shown separately; assessed points are never scaled up.</p></div>
    <p><strong>0</strong>: an observed problem. <strong>NE</strong>: not enough material. <strong>Not assessed</strong>: no judgment yet. Mark 3 mainly meets the standard with a small gap; Mark 1 is a weak relevant attempt.</p>
    <p className="eb-muted">These are frontend rubric fixtures awaiting the backend definition. SQL is static review, not an execution check.</p>
    {criteria.map(c=><details key={c.id} ref={c.id===initialCriterion?selected:undefined} open={c.id===initialCriterion}><summary><span>{c.id} · {c.title}</span><small>10 points</small></summary><p>{c.looksFor}</p>{([4,2,0] as const).map(m=><p key={m}><strong>{m}/4:</strong> {c.anchors[m]}</p>)}</details>)}
  </div></Dialog>;
}
export function SourceDialog({profile,source,quote,close}:{profile:Profile;source:Source|null;quote?:Quote;close:()=>void}) {
  const valid=source&&source.candidateId===profile.id&&(!quote||quoteSource(profile,quote,[source]));
  return <Dialog title={`${profile.name} · original source`} close={close}>{valid&&source?<><p>{source.kind==='application'?'Preset application material':'Public work snapshot'} · {source.name}</p><small>Snapshot: {source.snapshotId}</small><pre>{quote?<>{source.text.slice(0,quote.start)}<mark>{source.text.slice(quote.start,quote.end)}</mark>{source.text.slice(quote.end)}</>:source.text}</pre><p className="eb-muted">Synthetic frontend preview source. A cited passage is not proof of execution or independent authorship.</p></>:<p role="alert">This quotation does not match the selected candidate and snapshot. It cannot be used as reviewed evidence.</p>}</Dialog>;
}
export function AssessmentPanel({profile,controller}:{profile:Profile;controller:PreviewController}) {
  const [stage,setStage]=useState<Stage>('application_review'), [expanded,setExpanded]=useState<string|null>('B3');
  const [edit,setEdit]=useState(false), [citation,setCitation]=useState<{source:Source|null;quote?:Quote;revealRequest?:number}|null>(()=>{const quote=profile.assessment.entries.find(e=>e.criterionId==='B3')?.citation;return quote?{source:quoteSource(profile,quote)}:null;});
  const task=controller.state.tasks[profile.id];
  const work=stage==='application_review'?null:task?.versions.find(v=>v.version===(stage==='task_v1'?1:2));
  const selectedCriteria=stage==='application_review'?criteria:criteria.filter(c=>c.skill===task?.skill);
  const snapshot=work?.snapshotId??profile.snapshotId;
  const sources=work?[submissionSource(work)]:profile.sources;
  const baseline=stage==='application_review'?profile.assessment.entries:selectedCriteria.map(c=>({criterionId:c.id,mark:null,reason:'',scope:'',gap:'',citation:null} satisfies AssessmentEntry));
  const saved=controller.state.assessmentDrafts[assessmentKey(profile.id,stage)];
  const draft=saved?.snapshotId===snapshot?saved:null;
  const activeId=selectedCriteria.some(c=>c.id===expanded)?expanded:selectedCriteria[0]?.id;
  return <>
    <section className="eb-panel r5-assessment-header" aria-label="Assessment context">
      <label className="eb-field">Material stage<GlideSelect ariaLabel="Assessment stage" value={stage} onChange={value=>{setStage(value as Stage);setExpanded(null);setCitation(null);}} options={[{value:'application_review',label:'Application materials · comparison baseline'},...(task?.versions.map(v=>({value:`task_v${v.version}`,label:`Task V${v.version} · ${skillName[task.skill]}`}))??[])]}/></label>
      <button className="eb-action primary r5-edit-assessment" onClick={()=>setEdit(true)}>Edit human assessment draft</button>
      <div className="r5-meta"><span>{stageName[stage]}</span><span>{stage==='application_review'?'Illustrative reviewed fixture · revision 1':'Not assessed · target skill only'}</span><span>{rubricVersion}</span></div>
      {work&&<p className="eb-feedback">V{work.version} has no inherited score. {skillName[task!.skill]} awaits a new assessment. Other skills retain application assessment revision 1 as a separate source; this task is excluded from the application comparison.</p>}
      {draft&&<p className="r5-notice">Local assessment draft saved {new Date(draft.savedAt).toLocaleString()}. Awaiting the future assessment API; comparison and reviewed percentages are unchanged.</p>}
      <details><summary>Reviewed history & source binding</summary><p>Application assessment revision 1 is a read-only illustrative fixture. No server assessment revision has been created.</p><small>{profile.id} · {snapshot} · {rubricVersion}</small></details>
    </section>
    <div className="r5-assessment-grid"><nav className="r5-evidence-rail" aria-label="Evidence criteria"><div className="r5-evidence-nav-heading"><h2>Assessment criteria</h2><small>{selectedCriteria.length} public standards · Select one to inspect its evidence</small></div><div className="r5-evidence-options">{selectedCriteria.map(c=>{const entry=baseline.find(e=>e.criterionId===c.id)!;return <button key={c.id} className="r5-criterion-toggle" title={`${c.id} · ${c.title}`} aria-label={`${c.id} · ${c.title}`} aria-expanded={activeId===c.id} onClick={()=>{setExpanded(c.id);if(entry.citation)setCitation({source:quoteSource(profile,entry.citation,sources),quote:entry.citation});}}><span className="r5-criterion-id">{c.id}</span><span><strong>{c.title}</strong><small>{entry.mark===null?'Not assessed':entry.mark==='NE'?'NE':`${entry.mark}/4`} · {c.skill}</small></span></button>;})}</div></nav><aside className="r5-original-pane"><section className="eb-panel"><label className="eb-field">Original material<GlideSelect ariaLabel="Review source" value={citation?.source?.id??sources[0]?.id??''} onChange={value=>setCitation({source:sources.find(s=>s.id===value)??null})} options={sources.map(s=>({value:s.id,label:s.name}))}/></label></section><InlineSource key={`${profile.id}.${stage}`} profile={profile} source={citation?.source ?? sources[0] ?? null} quote={citation?.quote} revealRequest={citation?.revealRequest}/><details className="eb-panel"><summary>Three separate decisions</summary><p><strong>Assess:</strong> judge individual standards.</p><p><strong>Review evidence:</strong> confirm or request a bounded revision.</p><p><strong>Retain:</strong> choose who to discuss further.</p><p className="eb-muted">None of these automatically performs the other two.</p></details></aside><section aria-label="Assessment criteria">{selectedCriteria.filter(c=>c.id===activeId).map(c=>{
      const entry=baseline.find(e=>e.criterionId===c.id)!;
      return <article className="eb-panel r5-criterion" key={c.id}><header className="r5-judgment-heading"><small>REVIEW THIS EVIDENCE · {c.id}</small><h2>{c.title}</h2></header>
        {activeId===c.id&&<div className="r5-criterion-body"><p><strong>What this role needs:</strong> {c.looksFor}</p><p><strong>Anchor:</strong> {entry.mark===null?'Select a mark only after reviewing the original work.':entry.mark==='NE'?'Insufficient material; not a zero.':entry.mark===3?'Mainly meets the standard, with a small remaining gap.':entry.mark===1?'A relevant attempt with very weak support.':c.anchors[entry.mark]}</p>
          {entry.citation?<button className="eb-citation" onClick={()=>setCitation({source:quoteSource(profile,entry.citation!,sources),quote:entry.citation!,revealRequest:performance.now()})}>{entry.citation.text}<small>Locate exact source ←</small></button>:<p className="eb-muted">{work?'Open the work source to begin a new assessment.':'No cited passage for this criterion.'}</p>}
          <p><strong>Judgment:</strong> {entry.reason||'No reviewed judgment yet.'}</p><p><strong>Scope:</strong> {entry.scope||'Target work sample, awaiting human assessment.'}</p>
          <div className="r5-formula">{typeof entry.mark==='number'?`${entry.mark} ÷ 4 × 10 = ${entry.mark/4*10}/10 contribution`:entry.mark==='NE'?'NE · no contribution inferred':'No contribution before assessment'}</div>
          <p><strong>Unknown & next step:</strong> {entry.gap||'Review the work against the public anchor.'}</p>
        </div>}
      </article>;
    })}</section></div>
    {edit&&<AssessmentEditor key={`${profile.id}.${stage}.${snapshot}`} profile={profile} stage={stage} snapshot={snapshot} sources={sources} initial={draft?.entries??baseline} controller={controller} close={()=>setEdit(false)}/>}
  </>;
}
function InlineSource({profile,source,quote,revealRequest}:{profile:Profile;source:Source|null;quote?:Quote;revealRequest?:number}) {
  const ref=useRef<HTMLElement>(null);
  const valid=source&&source.candidateId===profile.id&&(!quote||quoteSource(profile,quote,[source]));
  useEffect(()=>{
    const mark=ref.current, pane=mark?.closest('pre');
    if(!quote||!mark||!pane)return;
    // Only reveal the quote within its reading pane. scrollIntoView also scrolls the page.
    pane.scrollTop+=mark.getBoundingClientRect().top-pane.getBoundingClientRect().top-(pane.clientHeight-mark.offsetHeight)/2;
    if(revealRequest!==undefined)mark.scrollIntoView({block:'center'}); // Explicit Locate action only.
  },[quote,revealRequest]);
  return <section tabIndex={-1} className="eb-panel r5-inline-source" aria-label="Original source text"><h2>{profile.name} · original source</h2>{valid&&source?<><strong>{source.name}</strong><small>Snapshot: {source.snapshotId}</small><pre>{quote?<>{source.text.slice(0,quote.start)}<mark ref={ref}>{source.text.slice(quote.start,quote.end)}</mark>{source.text.slice(quote.end)}</>:source.text}</pre><small>Synthetic sample · quotation is not proof of execution</small></>:<p role="alert">This quotation does not match the selected candidate and snapshot.</p>}</section>;
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
