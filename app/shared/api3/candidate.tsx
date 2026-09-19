import React, { useEffect, useRef, useState } from 'react';
import type { Demo, Finding } from '../api3-types';
import type { Api3Controller } from './controller';
import { download } from '../api';
import { Dialog, Heading, ResourceList } from '../api-ui';
import { CardEditor } from '../card-editor';
import { DataOverview, WorkflowStrip, VersionComparison } from '../workspace-ui';
import { appendDraftEvent, copyPublicSnapshot, draftKey, emptyDraft, event, readDraft, sections, submissionIssues, submissionPayload, type CandidateDraft } from './candidate-draft';
import { ReviewNote, WorkSnapshot } from './work';

type Props = { data: Demo; controller: Api3Controller; page: string; go: (page: string) => void };
// Reuse the established Candidate page/layout, but only API3 owns formal business state.
export default function CandidateConnected(props: Props) {
  const { data } = props;
  return <CandidateSession key={`${data.sessionId}.${data.candidate.id}.${data.task.taskId}.${data.workflow.nextSubmissionVersion ?? 'read-only'}`} {...props}/>;
}
function CandidateSession({ data, controller, page, go }: Props) {
  const { task, candidate, workflow } = data;
  const version = workflow.canSubmit && !workflow.isTerminal ? workflow.nextSubmissionVersion : null;
  const key = version ? draftKey(data, version) : '';
  const [draft, setDraft] = useState<CandidateDraft>(() => key ? readDraft(key) : emptyDraft());
  const draftRef = useRef(draft), alive = useRef(true);
  const [storageError, setStorageError] = useState(''), [submitError, setSubmitError] = useState('');
  const [source, setSource] = useState<Demo['application']['sources'][number] | null>(null), [confirm, setConfirm] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const latest = data.versions.at(-1), sent = task.status !== 'draft';
  const skill = data.rubric.requirements.find(r => r.id === task.targetRequirementId)?.title ?? 'Targeted evidence';
  const disabled = controller.busy || Boolean(controller.pending);
  const update = (fn: (d: CandidateDraft) => CandidateDraft) => {
    if (!key || !version || disabled) return;
    const next = { ...fn(draftRef.current), savedAt: new Date().toISOString() };
    draftRef.current = next; setDraft(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('Browser storage is full or unavailable. This draft is kept in this open page only; keep the page open until submission succeeds.'); }
  };
  const record = (title: string) => {
    if (draftRef.current.started && version) { const entry = event(title); update(d => appendDraftEvent(d, entry)); }
  };
  const start = (copy = false) => {
    if (!version || !workflow.canSubmit || disabled) return;
    const previous = data.versions.find(v => v.submission.submissionVersion === 1);
    if (copy && version === 2 && previous) update(() => copyPublicSnapshot(previous.submission));
    else { const entry = event(`Started V${version} draft`, 'Started a blank version.'); update(d => ({ ...d, started: true, events: [entry] })); }
    go('workspace');
  };
  const submit = async () => {
    if (!version || disabled) return;
    const submitted = { ...draftRef.current, events: [...draftRef.current.events, event(`Submitted V${version} work sample`)] };
    const issues = submissionIssues(data, submitted);
    if (issues.length) { setSubmitError(issues.join(' ')); return; }
    setSubmitError('');
    if (await controller.write('/submission', submissionPayload(data, submitted))) {
      if (alive.current) { setConfirm(false); go('history'); }
    }
  };
  return <>
    {page !== 'application' && <WorkflowStrip status={workflow.isTerminal ? 'closed' : task.status} started={draft.started} version={latest?.submission.submissionVersion ?? 1}/>}
    {storageError && <p className="eb-feedback" role="alert">{storageError}</p>}
    {page === 'application' && <><Heading eyebrow={`${data.company.name} · ${data.job.title}`} title="Your application materials"/><div className="r5-two"><section className="eb-panel"><h2>{candidate.name}</h2><p>{candidate.background}</p><p>Preset synthetic samples. No file upload, parsing or actual account login has taken place.</p>{data.application.sources.map(s => <button className="r5-source-card" key={s.sourceId} onClick={() => setSource(s)}><strong>{s.sourceId}</strong><small>View this person’s preset material ↗</small></button>)}</section><section className="eb-panel"><h2>Only supplement what is needed</h2><p>{sent ? `A ${skill} task has been requested.` : 'No supplementary task has been requested. Your application can be compared using the available evidence.'}</p><p>Receiving a task is not rejection. Having no task is not an offer.</p><button className="eb-action primary" onClick={() => go('tasks')}>View task status</button></section></div></>}
    {page === 'tasks' && <><Heading title="Your targeted task"/>{!sent ? <section className="eb-panel"><h2>No supplementary task requested</h2><p>Wait for a specific request from the hiring team, then refresh the shared case. A candidate with sufficient material can be compared directly.</p></section> : <><section className="eb-panel"><span className="r5-state">{workflow.isTerminal ? 'closed' : task.status.replaceAll('_', ' ')}</span><h2>{task.title}</h2><p><strong>Target:</strong> {skill}</p><p><strong>Why this task:</strong> {task.gapReason}</p><p className="eb-preserve">{task.instructions}</p><p>{task.timeboxMinutes} minutes suggested · No enforced deadline · Shared synthetic resources</p>{version ? <div className="eb-actions">{draft.started ? <button className="eb-action primary" onClick={() => go('workspace')}>Continue V{version} draft</button> : <><button className="eb-action primary" disabled={disabled} onClick={() => start()}>Start V{version} draft</button>{version === 2 && <button className="eb-action" disabled={disabled} onClick={() => start(true)}>Copy V1 public work into V2</button>}</>}</div> : <p>{workflow.isTerminal ? 'Evidence review is complete. No further submission is available.' : 'Your public snapshot is awaiting human review. V2 is not yet available.'}</p>}</section>{latest && <ReviewNote version={latest}/>}<section className="eb-panel"><h2>Task-provided resources</h2><p>Shared business data, not evidence authored by the candidate.</p><ResourceList resources={data.dataset.resources}/></section></>}</>}
    {page === 'workspace' && <><Heading eyebrow={sent ? `${skill} · V${version ?? latest?.submission.submissionVersion ?? 1}` : undefined} title="Investigation workspace"/>{!sent || !version || !draft.started ? <section className="eb-panel"><p>{workflow.isTerminal ? 'This task is closed. Your previous versions remain available.' : latest ? 'Your formal snapshot is saved on the server. Read its public work and feedback.' : 'Open the task and start an available draft to edit.'}</p><button className="eb-action" onClick={() => go(latest ? 'history' : 'tasks')}>{latest ? 'View submitted work' : 'View task and work'}</button>{latest && <><ReviewNote version={latest}/><WorkSnapshot data={data} version={latest}/></>}</section> : <>
      <section className="eb-panel"><h2>{task.title}</h2><details><summary>Task brief & guidance</summary><p className="eb-preserve">{task.instructions}</p><p>{templateHint(task.targetRequirementId)}</p></details><small>{draft.savedAt ? `Local draft updated ${new Date(draft.savedAt).toLocaleString()}` : 'Local draft'} · {candidate.name} · V{version}</small>{version === 2 && <p>V1 stays unchanged. This draft answers the specific feedback below.</p>}</section>
      {version === 2 && latest && <ReviewNote version={latest}/>}<Investigation data={data} draft={draft} update={update} record={record} disabled={disabled}/>
      <section className="eb-panel"><h2>Public work sample</h2><label className="eb-field">Executive summary<textarea aria-label="Executive summary" maxLength={8000} disabled={disabled} value={draft.summary} onChange={e => update(d => ({ ...d, summary: e.target.value }))}/></label><small>{draft.summary.length}/8,000 characters · {draft.findings.length}/40 cards · {draft.events.length}/100 reported events</small>{draft.events.length >= 99 && <p>Process log is full. Existing events are preserved; one final slot is reserved for submission.</p>}<p>Weak or incomplete work may still be submitted. Private notes are excluded. Only saved public snapshots can be exported.</p><button className="eb-action primary" disabled={disabled} onClick={() => { setSubmitError(''); setConfirm(true); }}>Submit V{version}</button></section>
    </>}</>}
    {page === 'history' && <><Heading title="Work and public feedback"/>{data.versions.length ? <History key={latest!.submission.submissionId} data={data}/> : <section className="eb-panel"><h2>No formal work snapshot yet</h2><p>Your drafts are separate from submitted work.</p><button className="eb-action" onClick={() => go('tasks')}>View task status</button></section>}{version === 2 && <button className="eb-action primary" onClick={() => go('tasks')}>Read feedback and prepare V2</button>}{workflow.isTerminal && <p className="r5-notice">Task closed · no V3. Evidence confirmation is not a hiring decision.</p>}</>}
    {source && <Dialog title={`${candidate.name} · ${source.sourceId}`} close={() => setSource(null)}><p>Preset synthetic application material · {source.location} · {data.application.evidenceSnapshotId}</p><pre>{source.text}</pre><button className="eb-action" onClick={() => download(`${candidate.id}-${source.sourceId}.txt`, source.text)}>Download material</button></Dialog>}
    {confirm && version && <Dialog title={`Submit V${version} for ${candidate.name}?`} close={() => setConfirm(false)}><p>This creates an immutable public snapshot on the shared backend. Private notes stay in your local draft and are excluded from the request and exports.</p>{submissionIssues(data, draft).map(issue => <p className="eb-feedback" key={issue}>{issue}</p>)}{submitError && <p role="alert">{submitError}</p>}{controller.error && <p className="eb-feedback" role="alert">{controller.error.code} — {controller.error.message}</p>}{controller.pending && <p>The original request is awaiting its receipt. Your draft stays here. <button className="eb-action" disabled={controller.busy} onClick={async () => { if (await controller.retry()) { if (alive.current) { setConfirm(false); go('history'); } } }}>Retry original action</button></p>}<button className="eb-action primary" disabled={disabled || submissionIssues(data, draft).length > 0} onClick={() => void submit()}>{controller.busy ? 'Submitting…' : `Confirm V${version} submission`}</button></Dialog>}
  </>;
}
function templateHint(target: Demo['task']['targetRequirementId']) {
  return target === 'sql' ? 'Provide SQL in a card’s reasoning field, explain its grain and time window, and describe checks. This page does not execute SQL.' : target === 'data-analysis' ? 'Show formulas, denominators, period comparisons and limitations in your public cards.' : 'Separate findings from hypotheses, identify missing evidence and propose a testable next action.';
}
function Investigation({ data, draft, update, record, disabled }: { data: Demo; draft: CandidateDraft; update: (fn: (d: CandidateDraft) => CandidateDraft) => void; record: (title: string) => void; disabled: boolean }) {
  const [tab, setTab] = useState(data.task.targetRequirementId === 'sql' ? 'SQL' : data.task.targetRequirementId === 'data-analysis' ? 'Data analysis' : 'Explore'), [editing, setEditing] = useState<Finding | null>(null);
  const { current, previous } = data.dataset.metrics;
  return <div className="eb-workbench r5-workbench"><section className="eb-panel"><h2>Data & resources</h2><small>Task-provided · {data.dataset.version}</small><ResourceList resources={data.dataset.resources} onEvent={record} onCreateFinding={!disabled && draft.findings.length < 40 ? setEditing : undefined}/></section><section className="eb-panel"><div className="eb-tabs" role="tablist" aria-label="Investigation tools">{['Explore', 'SQL', 'Data analysis', 'Private notebook'].map(t => <button className="eb-action" role="tab" key={t} aria-selected={tab === t} onClick={() => { setTab(t); record(`Opened ${t}`); }}>{t}</button>)}</div>
    {tab === 'Explore' && <DataOverview dataset={data.dataset} onEvent={record}/>}
    {tab === 'SQL' && <><h2>SQL · static review</h2><p>Put your query or code snippet in a card’s reasoning field, then explain the grain, time boundaries, joins and checks.</p><pre className="eb-code">{'-- Describe the intended grain first.\n-- Use the resource columns and explicit period bounds.\n-- Explain a validation check and a remaining limitation.'}</pre><p>No query is run here. Do not claim execution passed without execution evidence.</p></>}
    {tab === 'Data analysis' && <><h2>Show the calculation</h2><p>Define the metric, denominator and unit. Make your comparison reviewable, then state the limitation.</p><div className="r5-formula">Conversion = orders ÷ sessions × 100<br/>Current: {current.orders.toLocaleString()} ÷ {current.sessions.toLocaleString()} × 100 = {current.conversionPct}%<br/>Previous: {previous.orders.toLocaleString()} ÷ {previous.sessions.toLocaleString()} × 100 = {previous.conversionPct}%</div><p className="eb-muted">This task-provided worked example is not personal evidence. Explain your own checks and interpretation in the investigation cards.</p></>}
    {tab === 'Private notebook' && <><h2>{data.candidate.name} · private working notes</h2><p>Local draft only; excluded from HR views, public snapshots and exports.</p><label className="eb-field">Private notes<textarea aria-label="Private notes" disabled={disabled} value={draft.notes} onChange={e => update(d => ({ ...d, notes: e.target.value }))}/></label></>}
    </section><section className="eb-panel eb-board"><h2>Investigation board</h2><small>{draft.findings.length}/40 cards · Public when submitted</small>{sections.map(section => <section key={section}><div className="eb-board-heading"><h3>{section}</h3><button className="eb-action" aria-label={`Add ${section}`} disabled={disabled || draft.findings.length >= 40} onClick={() => setEditing({ id: crypto.randomUUID(), section, title: '', detail: '', source: '', confidence: 'Medium' })}>+</button></div>{draft.findings.filter(f => f.section === section).map(f => <article key={f.id} className="eb-finding"><h4>{f.title}</h4><p className="eb-preserve">{f.detail}</p><small>{(data.dataset.resources.find(r => r.id === f.source)?.name ?? f.source) || 'No source'} · Self-confidence {f.confidence}</small><button className="eb-action" aria-label={`Edit ${f.title}`} disabled={disabled} onClick={() => setEditing(f)}>Edit</button></article>)}{!draft.findings.some(f => f.section === section) && <p className="eb-muted">No cards yet · optional</p>}</section>)}</section>
    {editing && <CardEditor key={editing.id} finding={editing} resources={data.dataset.resources} editable={!disabled} close={() => setEditing(null)} save={finding => { const entry = event(`Saved ${finding.section}`, finding.title); update(d => appendDraftEvent({ ...d, findings: d.findings.some(f => f.id === finding.id) ? d.findings.map(f => f.id === finding.id ? finding : f) : d.findings.length < 40 ? [...d.findings, finding] : d.findings }, entry)); setEditing(null); }} remove={() => { const entry = event('Removed investigation card', editing.title); update(d => appendDraftEvent({ ...d, findings: d.findings.filter(f => f.id !== editing.id) }, entry)); setEditing(null); }}/>}
  </div>;
}
function History({ data }: { data: Demo }) {
  const [selected, setSelected] = useState(data.versions.at(-1)!.submission.submissionVersion);
  const version = data.versions.find(v => v.submission.submissionVersion === selected)!;
  return <><label className="eb-field">Submission version<select aria-label="Submission version" value={selected} onChange={e => setSelected(Number(e.target.value) as 1 | 2)}>{data.versions.map(v => <option value={v.submission.submissionVersion} key={v.submission.submissionId}>V{v.submission.submissionVersion}{v.submission.submissionId === data.versions.at(-1)?.submission.submissionId ? ' · current' : ' · history'}</option>)}</select></label><ReviewNote version={version}/>{data.versions.length === 2 && <VersionComparison before={data.versions[0].submission} after={data.versions[1].submission}/>}<WorkSnapshot data={data} version={version}/></>;
}
