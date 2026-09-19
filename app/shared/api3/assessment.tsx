import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dialog } from '../api-ui';
import { GlideSelect } from '../glide-select';
import type { EvidenceFocus } from './coverage-cell';
import type { TaskIntent } from './guidance';
import type { AssessmentItem, Demo, SourceRef, Stage } from '../api3-types';
import { baseBinding, stageContext } from './client';
import type { Api3Controller } from './controller';
import { annotationLabel, assessmentProblem, percent, requirementNames, resolveSourceRef, stageNames, type DraftItem, type Source, type SourceContext } from './hr-model';

export function Rubric({ data, close, initialCriterion }: { data: Demo; close: () => void; initialCriterion?: string }) {
  const selected = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!initialCriterion) return;
    const frame = requestAnimationFrame(() => {
      const detail = selected.current, dialog = detail?.closest('dialog');
      detail?.querySelector('summary')?.focus({ preventScroll: true });
      if (detail && dialog) dialog.scrollTop += detail.getBoundingClientRect().top - dialog.getBoundingClientRect().top - 24;
    });
    return () => cancelAnimationFrame(frame);
  }, [initialCriterion]);
  return <Dialog title="Ten public assessment standards" close={close}><div className="r5-rubric">
    <p>{data.rubric.label}</p><p>{data.rubric.scope}</p>
    <div className="r5-formula"><strong>Criterion contribution = Mark ÷ 4 × 10</strong><p>{data.rubric.requirements.map(r => `${r.title} ${r.maxScore} points`).join(' · ')}</p><p>Complete skill % = skill contribution ÷ skill maximum × 100. One NE means no overall percentage. Assessed points are never scaled up.</p></div>
    {data.rubric.marks.map(m => <p key={m.mark}><strong>{m.mark}:</strong> {m.meaning}</p>)}<p>Not assessed means no judgment yet, and is distinct from NE and 0.</p>
    <p className="eb-muted">{data.rubric.version} · {data.rubric.provenance} · {data.rubric.calibrationStatus}. SQL is static review, not an execution check.</p>
    {data.rubric.criteria.map(c => <details key={c.id} ref={c.id === initialCriterion ? selected : undefined} open={c.id === initialCriterion}><summary><span>{c.id} · {c.title}</span><small>{c.maxScore} points</small></summary><p>{c.observableSupport}</p>{(['4', '2', '0'] as const).map(m => <p key={m}><strong>{m}/4:</strong> {c.anchors[m]}</p>)}</details>)}
  </div></Dialog>;
}

function InlineSource({ name, candidateId, context, source, quote, reveal }: { name: string; candidateId: string; context: SourceContext; source: Source | null; quote?: SourceRef; reveal?:number }) {
  const mark = useRef<HTMLElement>(null);
  const valid = source && (!quote || resolveSourceRef(candidateId, context, quote));
  useEffect(() => { const item=mark.current, pane=item?.closest('.guide-source-scroll'); if(!quote||!item||!pane)return; pane.scrollTop+=item.getBoundingClientRect().top-pane.getBoundingClientRect().top-(pane.clientHeight-item.offsetHeight)/2; if(reveal!==undefined)item.scrollIntoView({block:'center'}); }, [quote,reveal]);
  return <section className="eb-panel r5-inline-source" aria-label="Original source text" tabIndex={-1}><h2>{name} · original source</h2>{valid && source ? <><strong>{source.sourceId}</strong><small>{source.location} · {context.evidenceSnapshotId}</small><pre>{quote ? <>{source.text.slice(0, quote.start)}<mark ref={mark}>{source.text.slice(quote.start, quote.end)}</mark>{source.text.slice(quote.end)}</> : source.text}</pre><small>Synthetic case · quoted text is not proof of execution or independent authorship</small></> : <p role="alert">This quotation does not match the selected candidate and material snapshot.</p>}</section>;
}

export function AssessmentPanel({ data, controller, initialStage = 'application_review', onEditingChange, onTask, openTask, evidenceFocus }: { data: Demo; controller: Api3Controller; initialStage?: Stage; onEditingChange?: (editing: boolean) => void; onTask?:(intent:TaskIntent)=>void; openTask?:()=>void; evidenceFocus?:EvidenceFocus }) {
  const [stage, setStage] = useState<Stage>(initialStage), [expanded, setExpanded] = useState<string | null>('B3');
  const [revision, setRevision] = useState<number | null>(null), [edit, setEdit] = useState(false);
  const [citation, setCitation] = useState<{ sourceId: string; quote?: SourceRef; reused?: boolean; reveal?:number } | null>(null);
  const reviewGrid=useRef<HTMLDivElement>(null);
  const focusedRequest=useRef<number | null>(null);
  useEffect(()=>{
    if(!evidenceFocus)return;
    setStage('application_review');setRevision(null);setExpanded(evidenceFocus.criterion);
    const ref=data.assessment.application_review?.items.find(item=>item.criterionId===evidenceFocus.criterion)?.sourceRefs[0];
    setCitation(ref?{sourceId:ref.sourceId,quote:ref}:null);
  },[evidenceFocus]);
  useLayoutEffect(()=>{
    // Focus only after React commits the requested standard, once per navigation.
    if(!evidenceFocus || focusedRequest.current===evidenceFocus.request || expanded!==evidenceFocus.criterion || stage!=='application_review')return;
    const button=reviewGrid.current?.querySelector<HTMLButtonElement>('.r5-criterion-toggle[aria-expanded=true]');
    if(!button)return;
    focusedRequest.current=evidenceFocus.request;
    reviewGrid.current?.scrollIntoView({block:'start'});
    button.focus({preventScroll:true});
  },[evidenceFocus,expanded,stage]);
  const context = stageContext(data, stage);
  if (!context) return <section className="eb-panel"><p>This material stage is not available.</p></section>;
  const latest = context.assessment;
  const history = data.assessment.history.filter(r => r.stage === stage);
  const record = revision === null ? latest : history.find(r => r.assessmentRevision === revision) ?? null;
  const historical = revision !== null && revision !== latest?.assessmentRevision;
  const currentWork = stage === 'application_review' || stage === `task_v${data.currentSubmissionVersion}`;
  const activeCriteria = data.rubric.criteria;
  const activeId = activeCriteria.some(c => c.id === expanded) ? expanded : activeCriteria[0]?.id;
  const quotedContext = citation?.reused ? stageContext(data, 'application_review')! : context;
  const source = quotedContext.sources.find(s => s.sourceId === citation?.sourceId) ?? quotedContext.sources[0] ?? null;
  const setStageView = (next: Stage) => { setStage(next); setRevision(null); setCitation(null); setExpanded(null); };
  return <>
    <section className="eb-panel r5-assessment-header" aria-label="Assessment context"><div className="eb-heading"><h2>Evidence before a number</h2><button className="eb-action primary" disabled={controller.busy || !!controller.pending || historical || !currentWork} onClick={() => { setEdit(true); onEditingChange?.(true); }}>Edit human assessment</button></div>
      <label className="eb-field">Material stage<GlideSelect ariaLabel="Assessment stage" value={stage} onChange={value=>setStageView(value as Stage)} options={[{value:'application_review',label:'Application materials · comparison baseline'},...data.versions.map(v=>({value:`task_v${v.submission.submissionVersion}`,label:`Task V${v.submission.submissionVersion} · ${data.task.targetRequirementId && requirementNames[data.task.targetRequirementId]}`}))]}/></label>
      <div className="r5-meta"><span>{stageNames[stage]}</span><span>{record ? `${annotationLabel(record.annotationMode)} · revision ${record.assessmentRevision}` : 'Not assessed'}</span><span>{data.rubricVersion}</span></div>
      {stage !== 'application_review' && <p className="eb-feedback">Target: {data.task.targetRequirementId && requirementNames[data.task.targetRequirementId]}. This task is separate from the application comparison. {record?.reuseApplication ? `Non-target criteria explicitly reuse application assessment revision ${record.reuseApplication.assessmentRevision}.` : 'Non-target criteria have no inherited score; application reuse is an explicit choice when saving.'}</p>}
      {(!currentWork || historical) && <p className="eb-feedback">Historical assessment and work are read only. Select the current stage and latest revision to create a new assessment.</p>}
      {record && <div className="r5-three r5-api-assessment-summary"><div><strong>{record.score.overallPercentage != null ? percent(record.score.overallPercentage) : record.score.status === 'needs_evidence' ? 'Needs evidence' : 'Not assessed'}</strong><p>{record.score.status === 'pending' ? 'Not fully assessed' : record.score.status === 'needs_evidence' ? 'NE present · no overall percentage' : 'Job evidence match'}</p></div><div><strong>{percent(record.score.coveragePercent)}</strong><p>Evidence coverage · not a hiring prediction</p></div><div><strong>{record.score.accruedScore.toFixed(1)}/100</strong><p>Accumulated contributions · not scaled up</p></div></div>}
      <details><summary>Assessment history & source binding</summary><label className="eb-field">Assessment revision<select aria-label="Assessment revision" value={revision ?? 'latest'} onChange={e => { setRevision(e.target.value === 'latest' ? null : Number(e.target.value)); setCitation(null); }}><option value="latest">Latest · {latest ? `revision ${latest.assessmentRevision}` : 'not assessed'}</option>{history.map(r => <option key={r.assessmentId} value={r.assessmentRevision}>Revision {r.assessmentRevision} · {annotationLabel(r.annotationMode)} · {r.operatorLabel}</option>)}</select></label><small>{data.candidate.id} · {context.evidenceSnapshotId} · {context.fingerprint}</small>{record && <p>{record.operatorLabel} · {new Date(record.createdAt).toLocaleString()} · {record.assessmentId}</p>}<p>The original application baseline stays immutable; each human save appends a revision.</p><p>{data.application.baseline.provenance.actualAnnotation} · {data.application.baseline.provenance.actualReview}</p><p>Human calibration: {data.application.baseline.provenance.humanCalibration}</p></details>
    </section>
    <div ref={reviewGrid} className="r5-assessment-grid guide-review-grid">
      <nav className="r5-evidence-rail" aria-label="Evidence criteria"><div className="r5-evidence-nav-heading"><h2>Assessment criteria</h2><small>Select a standard · inspect its evidence · choose the next step</small></div><div className="r5-evidence-options">{activeCriteria.map(c=>{
        const direct=record?.items.find(e=>e.criterionId===c.id), reused=!direct?record?.reusedItems.find(e=>e.criterionId===c.id):undefined, entry=direct??reused;
        const selected=activeId===c.id;
        return <button className="r5-criterion-toggle" key={c.id} aria-label={`${c.id} · ${c.title}`} title={`${c.id} · ${c.title}`} aria-expanded={selected} onClick={()=>{setExpanded(c.id);const ref=entry?.sourceRefs[0];setCitation(ref?{sourceId:ref.sourceId,quote:ref,reused:!!reused}:null);}}><span className="r5-criterion-id">{c.id}</span><span><strong>{c.title}</strong><small className={`r5-mark ${!entry || entry.mark === 'NE' ? 'is-unknown' : ''}`}>{!entry?'Not assessed':entry.mark==='NE'?'NE':`${entry.mark}/4`}</small></span></button>;
      })}</div></nav>
      <aside className="r5-original-pane"><section className="eb-panel"><label className="eb-field">Original material<GlideSelect ariaLabel="Review source" value={source?.sourceId??''} onChange={value=>setCitation({sourceId:value,reused:citation?.reused})} options={quotedContext.sources.map(s=>({value:s.sourceId,label:`${s.sourceId} · ${s.location}`}))}/></label></section><div className="guide-source-scroll" tabIndex={0} role="region" aria-label="Scrollable original material"><InlineSource name={data.candidate.name} candidateId={data.candidate.id} context={quotedContext} source={source} quote={citation?.quote} reveal={citation?.reveal}/></div><details className="guide-background"><summary>Reading this evidence</summary><p>Assess individual standards, review the submitted evidence and retain a candidate as separate human decisions. A quote does not prove execution.</p></details></aside>
      <section aria-label="Assessment criteria">{activeCriteria.filter(c=>c.id===activeId).map(c=>{
        const direct=record?.items.find(e=>e.criterionId===c.id), reused=!direct?record?.reusedItems.find(e=>e.criterionId===c.id):undefined, entry=direct??reused;
        const contribution=record?.score.criteria.find(e=>e.criterionId===c.id)?.contribution;
        return <React.Fragment key={c.id}><header className="r5-judgment-heading"><small>REVIEW THIS EVIDENCE · {c.id}</small><h2>{c.title}</h2></header><div className="guide-judgment-scroll" tabIndex={0} role="region" aria-label="Scrollable evidence judgment"><article className="eb-panel r5-criterion"><div className="r5-criterion-body">
          <p><strong>Judgment:</strong> {entry?.rationale??'No saved judgment yet. Read the source before assessing.'}</p>
          {reused && <p className="r5-notice">Application source · explicitly reused revision {record?.reuseApplication?.assessmentRevision}; not evidence from this task.</p>}
          {entry?.sourceRefs.map((ref,index)=><button className="eb-citation" key={index} onClick={()=>setCitation({sourceId:ref.sourceId,quote:ref,reused:!!reused,reveal:performance.now()})}>{ref.quote}<small>{ref.sourceId} · Locate exact source ←</small></button>)}
          {!entry?.sourceRefs.length && <p>No cited passage. Check the original material and scope.</p>}
          <div className="guide-gap"><small>WHAT REMAINS UNCLEAR</small><p>{entry?.gaps||'No specific gap recorded. Inspect the material before requesting more work.'}</p></div>
          <details><summary>Assessment basis, scope & calculation</summary><p><strong>Company requirement:</strong> {data.rubric.requirements.find(r=>r.id===c.requirementId)?.statement}</p><p><strong>What this role needs:</strong> {c.observableSupport}</p><p><strong>Anchor:</strong> {!entry?'Not assessed':entry.mark==='NE'?'Insufficient material, not a zero.':entry.mark===4||entry.mark===2||entry.mark===0?c.anchors[String(entry.mark) as '4'|'2'|'0']:data.rubric.marks.find(m=>m.mark===entry.mark)?.meaning}</p><p><strong>Support:</strong> {entry?.support??'Not assessed'}</p><p><strong>Uncertainty:</strong> {entry?.uncertainty??'Awaiting human assessment.'}</p><div className="r5-formula">{entry&&typeof entry.mark==='number'?`${entry.mark} ÷ 4 × 10 = ${contribution?.toFixed(1)??'—'}/10 contribution`:entry?.mark==='NE'?'NE · no numerical contribution inferred':'No contribution before assessment'}</div><small>Checked sources: {entry?.checkedSourceIds.join(' · ')||'None selected'}</small></details>
        </div></article></div><footer className="guide-next"><strong>Next step</strong><p>{entry?.nextStep||'Review the original material against this standard.'}</p>{onTask && data.workflow.canSend ? <button className="eb-action primary" onClick={()=>onTask({target:c.requirementId,criterion:c.id,reason:[entry?.gaps,entry?.nextStep].filter(Boolean).join(' ')})}>Prepare task from {c.id}</button> : openTask ? <button className="eb-action primary" onClick={openTask}>View task & review</button> : <button className="eb-action primary" disabled={controller.busy||!!controller.pending||historical||!currentWork} onClick={()=>{setEdit(true);onEditingChange?.(true);}}>Assess this work</button>}</footer></React.Fragment>;
      })}</section>
    </div>
    {edit && <AssessmentEditor data={data} stage={stage} controller={controller} close={() => { setEdit(false); onEditingChange?.(false); }}/>}
  </>;
}

function blankItem(criterionId: AssessmentItem['criterionId']): DraftItem { return { criterionId, mark: null, rationale: '', support: '', gaps: '', uncertainty: '', nextStep: '', checkedSourceIds: [], sourceRefs: [] }; }
function AssessmentEditor({ data, stage, controller, close }: { data: Demo; stage: Stage; controller: Api3Controller; close: () => void }) {
  // Freeze the visible basis. A background refresh must not silently rebase this human edit.
  const [snapshot] = useState(() => {
    const context = stageContext(data, stage)!;
    const criteria = data.rubric.criteria.filter(c => stage === 'application_review' || c.requirementId === data.task.targetRequirementId);
    return { context: structuredClone(context), criteria, binding: baseBinding(data), rubricVersion: data.rubricVersion, application: structuredClone(data.assessment.application_review), name: data.candidate.name };
  });
  const [entries, setEntries] = useState<DraftItem[]>(() => snapshot.criteria.map(c => structuredClone(snapshot.context.assessment?.items.find(item => item.criterionId === c.id) ?? blankItem(c.id))));
  const [selected, setSelected] = useState(entries[0].criterionId), [error, setError] = useState('');
  const [operator, setOperator] = useState(''), [reuse, setReuse] = useState(!!snapshot.context.assessment?.reuseApplication);
  const [sourceId, setSourceId] = useState(snapshot.context.sources[0]?.sourceId ?? ''), [quote, setQuote] = useState(''), [start, setStart] = useState(0);
  const currentContext = stageContext(data, stage);
  const basisChanged = !currentContext || data.sessionId !== snapshot.binding.sessionId || currentContext.evidenceSnapshotId !== snapshot.context.evidenceSnapshotId || currentContext.fingerprint !== snapshot.context.fingerprint || (currentContext.assessment?.assessmentRevision ?? 0) !== (snapshot.context.assessment?.assessmentRevision ?? 0) || (stage !== 'application_review' && stage !== `task_v${data.currentSubmissionVersion}`) || (reuse && data.assessment.application_review?.assessmentRevision !== snapshot.application?.assessmentRevision);
  const entry = entries.find(e => e.criterionId === selected)!;
  const criterion = snapshot.criteria.find(c => c.id === selected)!;
  const source = snapshot.context.sources.find(s => s.sourceId === sourceId);
  const quoteMatches = !!source && !!quote.trim() && quote.length <= 2000 && Number.isInteger(start) && start >= 0 && source.text.slice(start, start + quote.length) === quote;
  const patch = (change: Partial<DraftItem>) => setEntries(all => all.map(e => e.criterionId === selected ? { ...e, ...change } : e));
  const addQuote = () => {
    if (!quoteMatches || !source || entry.sourceRefs.length >= 10) return;
    const ref: SourceRef = { candidateId: snapshot.binding.candidateId, evidenceSnapshotId: snapshot.context.evidenceSnapshotId, fingerprint: snapshot.context.fingerprint, sourceId, location: source.location, start, end: start + quote.length, quote };
    patch({ sourceRefs: [...entry.sourceRefs, ref], checkedSourceIds: [...new Set([...entry.checkedSourceIds, sourceId])] }); setQuote(''); setStart(0);
  };
  const save = async () => {
    if (basisChanged) { setError('The saved basis changed. Copy any useful edits, then reopen the current assessment before saving.'); return; }
    const problem = assessmentProblem(snapshot.binding.candidateId, snapshot.context, entries);
    if (problem || !operator.trim()) { setError(problem ?? 'Enter an operator label for this human revision.'); return; }
    const app = snapshot.application;
    const body = { ...snapshot.binding, stage, evidenceSnapshotId: snapshot.context.evidenceSnapshotId, fingerprint: snapshot.context.fingerprint, submissionId: snapshot.context.submissionId, contentFingerprint: snapshot.context.contentFingerprint, rubricVersion: snapshot.rubricVersion, expectedAssessmentRevision: snapshot.context.assessment?.assessmentRevision ?? 0, items: entries as AssessmentItem[], reuseApplication: reuse && app ? { assessmentRevision: app.assessmentRevision, evidenceSnapshotId: app.evidenceSnapshotId, fingerprint: app.fingerprint } : null, operatorLabel: operator.trim() };
    if (await controller.write('/assessment', body)) close();
  };
  return <Dialog title={`${snapshot.name} · human assessment`} close={close}><p>{stageNames[stage]} · Save all {entries.length} criteria together. The server computes the score and appends a revision; the baseline remains unchanged.</p><p className="eb-muted">Unsubmitted edits stay in this open form, not in the shared comparison. Cancel discards these edits.</p>
    <label className="eb-field">Criterion<select aria-label="Edit criterion" value={selected} onChange={e => { setSelected(e.target.value as typeof selected); setQuote(''); setStart(0); setError(''); }}>{entries.map(e => <option key={e.criterionId} value={e.criterionId}>{e.criterionId} · {e.mark === null ? 'Not assessed' : e.mark} · {snapshot.criteria.find(c => c.id === e.criterionId)?.title}</option>)}</select></label>
    <p>{criterion.observableSupport}</p><label className="eb-field">Human mark<select aria-label="Human mark" value={entry.mark ?? ''} onChange={e => patch({ mark: e.target.value === '' ? null : e.target.value === 'NE' ? 'NE' : Number(e.target.value) })}><option value="">Not assessed</option>{[4, 3, 2, 1, 0].map(mark => <option key={mark} value={mark}>{mark}/4</option>)}<option value="NE">NE · insufficient material</option></select></label>
    {([['rationale', 'Judgment reason'], ['support', 'Support / checked scope'], ['gaps', 'Missing evidence / counter-evidence'], ['uncertainty', 'Uncertainty'], ['nextStep', 'Next step']] as const).map(([field, label]) => <label key={field} className="eb-field">{label}<textarea aria-label={label} maxLength={2000} value={entry[field]} onChange={e => patch({ [field]: e.target.value })}/></label>)}
    <fieldset><legend>Checked sources · required also for NE</legend>{snapshot.context.sources.map(s => <label className="eb-field" key={s.sourceId}><span><input type="checkbox" aria-label={`Checked source ${s.sourceId}`} checked={entry.checkedSourceIds.includes(s.sourceId)} onChange={e => patch({ checkedSourceIds: e.target.checked ? [...entry.checkedSourceIds, s.sourceId] : entry.checkedSourceIds.filter(id => id !== s.sourceId) })}/> {s.sourceId} · {s.location}</span></label>)}</fieldset>
    <label className="eb-field">Candidate source<select aria-label="Candidate source" value={sourceId} onChange={e => { setSourceId(e.target.value); setQuote(''); setStart(0); }}>{snapshot.context.sources.map(s => <option key={s.sourceId} value={s.sourceId}>{s.sourceId} · {s.location}</option>)}</select></label><details><summary>Read source text</summary><pre>{source?.text}</pre></details>
    <label className="eb-field">Exact source quotation<textarea aria-label="Exact source quotation" maxLength={2000} value={quote} onChange={e => { setQuote(e.target.value); setStart(Math.max(0, source?.text.indexOf(e.target.value) ?? 0)); }}/></label><label className="eb-field">Quotation start (UTF-16)<input aria-label="Quotation start (UTF-16)" type="number" min={0} step={1} value={start} onChange={e => setStart(Number(e.target.value))}/></label>
    {quote && !quoteMatches && <p role="alert">The quote must match this source exactly at the selected UTF-16 offset.</p>}<button className="eb-action" disabled={!quoteMatches || entry.sourceRefs.length >= 10} onClick={addQuote}>Add source quotation</button>
    {entry.sourceRefs.map((ref, i) => <div className="eb-finding" key={i}><p>{ref.quote}</p><small>{ref.sourceId} · {ref.start}–{ref.end}</small><button className="eb-action" onClick={() => patch({ sourceRefs: entry.sourceRefs.filter((_, index) => index !== i) })}>Remove quotation {i + 1}</button></div>)}
    {stage !== 'application_review' && <label className="eb-field"><span><input type="checkbox" aria-label="Explicitly reuse application assessment" checked={reuse} disabled={!snapshot.application} onChange={e => setReuse(e.target.checked)}/> Explicitly reuse non-target application criteria from revision {snapshot.application?.assessmentRevision ?? 'unavailable'}</span><small>{snapshot.application?.evidenceSnapshotId}. This is application evidence, not a new task achievement. Otherwise non-target criteria remain unassessed.</small></label>}
    <label className="eb-field">Operator label<input aria-label="Assessment operator label" maxLength={120} value={operator} onChange={e => setOperator(e.target.value)}/></label><p className="eb-muted">Demo label for audit history, not authenticated identity.</p>
    {basisChanged && <p role="alert">The saved basis changed while this form was open. Your edits remain here to copy; close and reopen the current assessment to review its new basis.</p>}{error && <p role="alert">{error}</p>}{controller.error && <p role="alert">{controller.error.message} · Your form is retained. For a conflict, review the latest state before opening a new edit.</p>}
    <div className="eb-actions">{controller.pending && <button className="eb-action" disabled={controller.busy} onClick={async () => { if (await controller.retry()) close(); }}>Retry original action</button>}<button className="eb-action primary" disabled={controller.busy || !!controller.pending || basisChanged} onClick={() => void save()}>{controller.busy ? 'Saving…' : 'Save assessment revision'}</button><button className="eb-action" onClick={close}>Cancel</button></div>
  </Dialog>;
}
