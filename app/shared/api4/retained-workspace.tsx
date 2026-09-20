import React, { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import fileText from './icons/file-text.svg';
import { Dialog, Heading } from '../api-ui';
import pencil from './icons/pencil.svg';
import check from './icons/check.svg';
import chevron from './icons/chevron-right.svg';
import type { Demo, Comparison, CandidateId, Stage, SourceRef, AssessmentItem } from '../api4-types';
import type { Api4Controller } from './controller';
import { baseBinding, stageContext } from './client';
import { latestStage, stageNames } from './hr-model';
import { PermissionHelp } from './access';
import helpIcon from './icons/circle-help.svg';
import clockIcon from './icons/clock-3.svg';
import arrowIcon from './icons/arrow-right.svg';
import { annotationLabel, resolveSourceRef } from './hr-model';
import { decisionEvidence, decisionIsCurrent, retainedRows, type RetentionFilter } from './retained-model';
import { GapSuggestions } from './gaps';
import type { TaskIntent } from './guidance';

const labels = {not_retained:'Not retained',retained:'Retained',needs_reconfirmation:'Reconfirmation needed'};
type WorkspaceProps = {requestedCandidateId:CandidateId|null;data:Demo;comparison:Comparison;controller:Api4Controller;select:(id:CandidateId,page?:string,criterion?:string)=>void;go:(page:string)=>void;remove:()=>void;filter:RetentionFilter;setFilter:(filter:RetentionFilter)=>void;onTask:(intent:TaskIntent)=>void;inspectStage:(stage:Stage)=>void};
export function RetainedWorkspace({data,comparison,controller,select,go,remove,filter,setFilter,onTask,inspectStage,requestedCandidateId}:WorkspaceProps) {
  const [resetKey,setResetKey]=useState(0);
  const [dirty,setDirty]=useState(false), [leaving,setLeaving]=useState<(() => void)|null>(null);
  const rows=retainedRows(comparison.candidates,filter);
  const selectedId=requestedCandidateId??data.candidate.id;
  const switching=selectedId!==data.candidate.id;
  const switchStatus=useId();
  const visible=rows.some(row=>row.candidate.id===data.candidate.id);
  const navigate=(action:()=>void)=>{if(dirty)setLeaving(()=>action);else action();};
  const firstId=rows[0]?.candidate.id;
  const awaitingFilteredSelection=!visible&&!!firstId&&!dirty&&!switching&&!controller.error;
  const transitioning=switching||awaitingFilteredSelection;
  const targetId=awaitingFilteredSelection?firstId:selectedId;
  const requestedName=comparison.candidates.find(row=>row.candidate.id===targetId)?.candidate.name??targetId;
  useEffect(()=>{if(!visible && firstId && !controller.loading && !controller.error && !dirty && !switching)select(firstId,'shortlist');},[visible,firstId,controller.loading,controller.error,dirty,switching,select]);
  return <section className="rd-workspace">
    <Heading title="Retention & review"/><p className="rd-intro">Every candidate remains available. Retaining is not hiring.</p>
    <div className="rd-layout">
      <section className="eb-panel rd-roster" aria-label="Shortlist candidate navigation">
        <nav className="rd-filters" aria-label="Shortlist filters">{(['retained','needs_reconfirmation','all'] as const).map(value=><button key={value} aria-pressed={filter===value} onClick={()=>navigate(()=>setFilter(value))}><span>{{retained:'Retained',needs_reconfirmation:'Reconfirmation needed',all:'All'}[value]}</span><span>{retainedRows(comparison.candidates,value).length}</span></button>)}</nav>
        <div className="rd-candidates">{rows.map(row=><button className="rd-person" key={row.candidate.id} aria-current={row.candidate.id===selectedId?'true':undefined} onClick={()=>{if(row.candidate.id!==selectedId)navigate(()=>select(row.candidate.id,'shortlist'));}}>
          <span className="mf-avatar" data-local-raw>{row.candidate.name.split(' ').map(n=>n[0]).join('')}</span><span><strong>{row.candidate.name}</strong><small>{labels[row.shortlist.status]}</small></span><BasisIcon src={chevron}/>
        </button>)}</div>
        {!rows.length&&<div className="rd-empty"><h2>{filter==='retained'?'No retained candidates yet':'No candidates need reconfirmation'}</h2><p>Choose from all candidates to inspect evidence and record a decision.</p><button className="eb-action" onClick={()=>navigate(()=>setFilter('all'))}>View all candidates</button></div>}
        <p className="rd-roster-help"><BasisIcon src={helpIcon}/>Choose a name to review evidence and decisions here.</p>
      </section>
      <div className="rd-detail-frame" aria-busy={transitioning}>
      {transitioning&&<p id={switchStatus} role="status" className="rd-switch-status">{controller.error?'Switch not completed:':'Switching to'} {requestedName} · <span>Still showing</span> {data.candidate.name} <span>(read only)</span></p>}
      <div className="rd-detail-content" inert={transitioning} aria-describedby={transitioning?switchStatus:undefined}>
      {(visible||dirty||transitioning)?<RetentionEditor key={`${data.candidate.id}:${resetKey}`} data={data} controller={controller} remove={()=>navigate(remove)} inspectStage={stage=>navigate(()=>inspectStage(stage))} go={page=>navigate(()=>go(page))} inspect={criterion=>navigate(()=>select(data.candidate.id,'evidence',criterion))} onDirty={setDirty} onTask={intent=>navigate(()=>onTask(intent))}/>:<section className="eb-panel rd-empty-detail" aria-live="polite"><BasisIcon src={helpIcon}/><h2>{rows.length?'Loading candidate…':'Choose a candidate to review'}</h2><p>{rows.length?'Loading the selected candidate’s own evidence and saved decision.':'Use All to inspect any candidate without leaving this page.'}</p></section>}
      </div></div>
    </div>
    {leaving&&<Dialog title="Unsaved decision edits" close={()=>setLeaving(null)}><p>Your draft has not been saved. Discard these edits and continue?</p><div className="eb-actions"><button className="eb-action" onClick={()=>setLeaving(null)}>Keep editing</button><button className="eb-action" onClick={()=>{setDirty(false);setResetKey(value=>value+1);const action=leaving;setLeaving(null);action();}}>Discard edits and continue</button></div></Dialog>}
  </section>;
}
function BasisIcon({src=fileText}:{src?:string}) {
  return <span className="mf-icon" aria-hidden="true" style={{'--mf-mask':`url("${src}")`} as CSSProperties}/>;
}
function RetentionEditor({data,controller,remove,go,inspect,onDirty,onTask,inspectStage}:{data:Demo;controller:Api4Controller;remove:()=>void;go:(page:string)=>void;inspect:(criterion?:string)=>void;onDirty:(dirty:boolean)=>void;onTask:(intent:TaskIntent)=>void;inspectStage:(stage:Stage)=>void}) {
  const [view,setView]=useState(()=>structuredClone(data));
  const [dirty,setDirty]=useState(false);
  const [editing,setEditing]=useState(data.shortlist.status!=='retained'),[gapsOpen,setGapsOpen]=useState(false);
  useEffect(()=>onDirty(dirty),[dirty,onDirty]);
  useEffect(()=>{if(data.shortlist.status==='needs_reconfirmation')setEditing(true);},[data.shortlist.status]);
  const [editingBasis,setEditingBasis]=useState(false),[historyOpen,setHistoryOpen]=useState(false);
  const basisId=useId();
  const historyButtonRef=useRef<HTMLButtonElement>(null);
  const [reason,setReason]=useState(view.shortlist.reason??''),[operator,setOperator]=useState('');
  const [stage,setStage]=useState<Stage>(view.shortlist.status==='needs_reconfirmation'?latestStage(view):view.shortlist.basis?.stage??latestStage(view));
  useEffect(()=>{if(dirty)return;setView(structuredClone(data));setReason(data.shortlist.reason??'');setStage(data.shortlist.status==='needs_reconfirmation'?latestStage(data):data.shortlist.basis?.stage??latestStage(data));},[data,dirty]);
  const context=stageContext(view,stage), record=view.shortlist;
  const stale=data.sessionId!==view.sessionId||data.shortlist.revision!==view.shortlist.revision;
  const action=record.status==='not_retained'?'retain':'reconfirm';
  const stages:Stage[]=['application_review',...view.versions.filter(v=>v.submission.submissionVersion===view.currentSubmissionVersion).map(v=>`task_v${v.submission.submissionVersion}` as Stage)];
  const assessmentLabel=(basis:Stage)=>{
    const assessment=stageContext(view,basis)?.assessment;
    return assessment?`Assessment version ${assessment.assessmentRevision}`:'Not assessed';
  };
  const evidence=decisionEvidence(view,stage);
  return <section className="eb-panel rd-dossier" aria-label="Candidate decision dossier">
    <header className="rd-dossier-header"><div className="rd-identity"><span className="mf-avatar" data-local-raw>{view.candidate.name.split(' ').map(n=>n[0]).join('')}</span><h2>{view.candidate.name}</h2><span className="mf-status">{labels[record.status]}</span></div><small>{dirty?'Unsaved decision draft':decisionIsCurrent(view)?'Current basis matches the saved decision':record.status==='needs_reconfirmation'?'Evidence changed · reconfirmation needed':record.status==='not_retained'?'No retention decision saved':'Saved basis is historical'}</small></header>
    <div className="rd-dossier-columns"><EvidenceSummary data={view} stage={stage} inspect={()=>inspectStage(stage)}/><aside className="mf-retention-editor rd-editor" aria-label="Human shortlist decision">
    <section className="mf-decision-basis">
      <div className="mf-basis-heading"><h3>Decision basis</h3>
        <button className="mf-text-button mf-basis-toggle" aria-label={editingBasis?'Finish choosing decision basis':'Change decision basis'} aria-expanded={editingBasis} aria-controls={basisId} onClick={()=>{setEditing(true);setEditingBasis(value=>!value);}}>
          <BasisIcon src={editingBasis?check:pencil}/>{editingBasis?'Done':'Change'}
        </button>
      </div>
      <div id={basisId} className="mf-basis-content">
        {editingBasis?<>
          <fieldset className="mf-basis-choices" aria-label="Shortlist basis stage">
            {stages.map(value=><label className="mf-basis-choice" key={value} data-selected={stage===value}>
              <input type="radio" name={basisId} value={value} checked={stage===value} aria-label={stageNames[value]} onChange={()=>{setStage(value);setDirty(true);}}/>
              <BasisIcon/><span>{stageNames[value]}</span><small>{assessmentLabel(value)}</small>
            </label>)}
          </fieldset>
          <small className="mf-basis-hint">Selection only updates the draft.</small>
        </>:<p className="mf-basis-current"><BasisIcon/><span>{stageNames[stage]} · {assessmentLabel(stage)}</span></p>}
      </div>
      {record.status==='needs_reconfirmation'&&<p className="eb-feedback">Evidence changed. Check the current basis before reconfirming.<br/>{record.basis&&<small>Saved decision basis: {stageNames[record.basis.stage]} · {record.basis.assessmentRevision===null?'Not assessed':`Assessment version ${record.basis.assessmentRevision}`}</small>}</p>}
    </section>
    {editing?<section className="mf-retention-fields">
      <label className="eb-field">Reason for retaining<textarea aria-label="Human shortlist reason" placeholder="Enter a reason for retaining…" maxLength={2000} value={reason} onChange={e=>{setReason(e.target.value);setDirty(true);}}/></label>
      <small className="mf-character-count">{reason.length} / 2000</small>
      <label className="eb-field mf-decision-operator">Decision reviewer<input aria-label="Shortlist operator label" maxLength={120} placeholder="Hiring reviewer" title="Demo audit label, not authenticated identity." value={operator} onChange={e=>{setOperator(e.target.value);setDirty(true);}}/></label>
    </section>
    :<section className="rd-saved-reason"><h3>Reason for retaining</h3><p>{record.reason}</p><small>Add specific evidence to make future review easier.</small></section>}
    <PermissionHelp base={controller.base} error={controller.error}/>
    {(controller.error||stale)&&<p role="alert">{controller.error?.message??'The saved basis changed. Refresh before saving.'} · Your reason is retained.</p>}
    {controller.pending&&<button className="eb-action" disabled={controller.busy} onClick={async()=>{if(await controller.retry())setDirty(false);}}>Retry original action</button>}
    {editing?<button className="eb-action primary mf-wide" disabled={controller.busy||!!controller.pending||stale||!context||!operator.trim()||!reason.trim()} onClick={async()=>{
      if(!context)return;
      if(await controller.write('/shortlist',{...baseBinding(view),action,reason:reason.trim(),stage,evidenceSnapshotId:context.evidenceSnapshotId,fingerprint:context.fingerprint,assessmentRevision:context.assessment?.assessmentRevision??null,rubricVersion:view.rubricVersion,expectedShortlistRevision:view.shortlist.revision,operatorLabel:operator.trim()})){setDirty(false);setEditing(false);setEditingBasis(false);}
    }}>{controller.busy?'Saving…':record.status==='not_retained'?'Retain candidate':record.status==='needs_reconfirmation'?'Reconfirm with current basis':'Save retain reason'}</button>:<button className="eb-action primary mf-wide" onClick={()=>setEditing(true)}>Edit decision</button>}
    {editing&&record.status==='retained'&&!controller.pending&&<button className="mf-text-button rd-cancel" onClick={()=>{setView(structuredClone(data));setReason(data.shortlist.reason??'');setStage(data.shortlist.basis?.stage??latestStage(data));setDirty(false);setEditing(false);setEditingBasis(false);}}>Cancel editing</button>}
    <footer className="mf-decision-records rd-decision-meta"><small title="Demo audit label, not authenticated identity.">Decision reviewer: {record.history.at(-1)?.operatorLabel??'Not recorded'}</small><button ref={historyButtonRef} className="mf-text-button" onClick={()=>setHistoryOpen(true)}>Decision records ({record.history.length})<BasisIcon src={chevron}/></button></footer>
    {record.status!=='not_retained'&&<div className="mf-remove"><button className="eb-action mf-wide" disabled={controller.busy||!!controller.pending} onClick={remove}>Remove from retained</button></div>}
    <section className="rd-next"><h3><BasisIcon src={arrowIcon}/>Next step</h3><p>{evidence.concerns[0]?.nextStep??'Inspect the full evidence before deciding whether further clarification is needed.'}</p><button className="mf-text-button" onClick={()=>setGapsOpen(true)}>Review evidence gaps<BasisIcon src={chevron}/></button><small className="rd-task-state"><BasisIcon src={clockIcon}/>{{draft:'Evidence task not sent',sent:'Awaiting submitted work',submitted:'Submitted work awaits review',awaiting_revision:'Awaiting V2',reviewed:'Task review complete'}[view.task.status]}</small>{view.task.status!=='draft'&&<button className="mf-text-button" onClick={()=>go('tasks')}>Open tasks & review</button>}</section>
    {gapsOpen&&<Dialog title="Review evidence gaps" close={()=>setGapsOpen(false)}><GapSuggestions data={view} onTask={onTask} inspect={inspect}/></Dialog>}
    {historyOpen&&<Dialog title="Decision records" close={()=>{setHistoryOpen(false);requestAnimationFrame(()=>historyButtonRef.current?.focus());}}>
      <div className="mf-decision-history">
        {!record.history.length&&<p>No decisions recorded yet.</p>}
        {record.history.map(e=><article key={e.revision}><h3>{{retain:'Retained',reconfirm:'Reconfirmed',remove:'Removed'}[e.action]} · {e.operatorLabel}</h3><p>{e.reason}</p><small>{stageNames[e.basis.stage]} · {e.basis.assessmentRevision===null?'Not assessed':`Assessment version ${e.basis.assessmentRevision}`} · {new Date(e.at).toLocaleString()}</small></article>)}
        <details><summary>Scoring standard reference</summary><code>{view.rubricVersion}</code></details>
        <small>Demo audit label, not authenticated identity.</small>
      </div>
    </Dialog>}
  </aside></div></section>;
}

function EvidenceSummary({data,stage,inspect}:{data:Demo;stage:Stage;inspect:(criterion?:string)=>void}) {
  const {context,assessment,supports,concerns}=decisionEvidence(data,stage);
  const [quotation,setQuotation]=useState<SourceRef|null>(null);
  const sourceTrigger=useRef<HTMLElement|null>(null);
  const source=quotation&&context?resolveSourceRef(data.candidate.id,context,quotation):null;
  useEffect(()=>setQuotation(null),[stage]);
  const item=(entry:AssessmentItem,concern=false)=><article className="rd-evidence-item" key={entry.criterionId}>
    <BasisIcon/><div><h4><span className="rd-criterion">{entry.criterionId}</span>{data.rubric.criteria.find(c=>c.id===entry.criterionId)?.title??entry.criterionId}{entry.mark==='NE'&&<small>NE · Missing evidence</small>}</h4><p>{concern?entry.gaps:entry.support}</p>
    {entry.sourceRefs.filter(ref=>context&&resolveSourceRef(data.candidate.id,context,ref)).map((ref,i)=><button key={i} className="rd-source" onClick={event=>{sourceTrigger.current=event.currentTarget;setQuotation(ref);}}><span data-local-raw>{ref.sourceId}</span> · View original</button>)}
    {concern&&<details className="rd-uncertainty"><summary>What to verify</summary><p>{entry.nextStep}</p><small>{entry.uncertainty}</small></details>}</div>
  </article>;
  return <section className="rd-evidence" aria-label="Evidence for this decision"><h3>Supporting evidence in the materials</h3><small>Assessment excerpts · Not a complete conclusion</small>{stage!=='application_review'&&<small className="rd-evidence-stage">{stageNames[stage]} · {assessment?`Assessment version ${assessment.assessmentRevision}`:'Not assessed'}</small>}
    {supports.map(entry=>item(entry))}{!supports.length&&<p className="rd-no-excerpts">No source-backed support excerpt for this stage. Inspect the full materials.</p>}
    <section className="rd-concerns"><h3><BasisIcon src={helpIcon}/>Points to verify <small>({concerns.length})</small></h3>{concerns.slice(0,1).map(entry=>item(entry,true))}{concerns.length>1&&<details className="rd-more-concerns"><summary>More points to verify ({concerns.length-1})</summary>{concerns.slice(1).map(entry=>item(entry,true))}</details>}{!concerns.length&&<p>No listed gap for this stage. This does not establish full role suitability.</p>}</section>
    <button className="mf-text-button rd-all-evidence" onClick={()=>inspect()}>View all evidence<BasisIcon src={chevron}/></button>
    <aside className="rd-provenance"><BasisIcon src={helpIcon}/><div><p>Static material review; execution and independent authorship remain unverified.</p><small>{annotationLabel(assessment?.annotationMode)}</small></div></aside>
    {quotation&&<Dialog title="Original evidence" close={()=>{setQuotation(null);requestAnimationFrame(()=>sourceTrigger.current?.focus());}}>{source?<><small>{data.candidate.name} · {stageNames[stage]} · <span data-local-raw>{source.sourceId}</span></small><pre data-local-raw>{source.text.slice(0,quotation.start)}<mark data-local-raw>{source.text.slice(quotation.start,quotation.end)}</mark>{source.text.slice(quotation.end)}</pre></>:<p role="alert">This quotation does not match the selected material snapshot.</p>}</Dialog>}
  </section>;
}
