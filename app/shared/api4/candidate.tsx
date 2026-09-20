import { LegacyDrafts } from './legacy-drafts';
import { PermissionHelp } from './access';
import React, { useEffect, useRef, useState } from 'react';
import type { Demo } from '../api4-types';
import type { Api4Controller } from './controller';
import { Dialog, Heading } from '../api-ui';
import { appendDraftEvent, copyPublicSnapshot, draftKey, emptyDraft, event, readDraft, submissionIssues, submissionPayload, type CandidateDraft } from './candidate-draft';
import { CandidateMaterials, CandidateTask, CandidateEditor, CandidateHistory } from './candidate-pages';

type Props = { data: Demo; controller: Api4Controller; page: string; go: (page: string) => void };
// Reuse the established Candidate page/layout, but only API4 owns formal business state.
export default function CandidateConnected(props: Props) {
  const { data } = props;
  return <CandidateSession key={`${data.sessionId}.${data.fixtureVersion}.${data.jdVersion}.${data.rubricVersion}.${data.datasetVersion}.${data.candidate.id}.${data.task.taskId}.${data.workflow.nextSubmissionVersion ?? 'read-only'}`} {...props}/>;
}
function CandidateSession({ data, controller, page, go }: Props) {
  const { task, candidate, workflow } = data;
  const version = workflow.canSubmit && !workflow.isTerminal ? workflow.nextSubmissionVersion : null;
  const key = version ? draftKey(data, version) : '';
  const [draft, setDraft] = useState<CandidateDraft>(() => key ? readDraft(key) : emptyDraft());
  const draftRef = useRef(draft), alive = useRef(true);
  const [storageError, setStorageError] = useState(''), [submitError, setSubmitError] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const latest = data.versions.at(-1), sent = task.status !== 'draft';
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
    if (!version || !workflow.canSubmit || disabled || draftRef.current.started) return;
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
      if (alive.current) setConfirm(false); go('history');
    }
  };
  const draftActions = version ? (draft.started
    ? <button className="eb-action primary" disabled={disabled} onClick={() => go('workspace')}>Continue V{version} draft</button>
    : <DraftStartActions version={version} disabled={disabled} start={start}/>)
    : <><p>{workflow.isTerminal ? 'Evidence review is complete. No further submission is available.' : 'Your public snapshot is awaiting human review. V2 is not yet available.'}</p>{latest && <button className="eb-action" onClick={() => go('history')}>View submitted work</button>}</>;
  return <>
    {page === 'workspace' && <LegacyDrafts currentKey={key}/>}
    {storageError && <p className="eb-feedback" role="alert">{storageError}</p>}
    {page === 'application' && <CandidateMaterials data={data} base={controller.base}/>}
    {page === 'tasks' && <CandidateTask data={data} actions={draftActions} go={go}/>}
    {page === 'workspace' && (sent && version && draft.started
      ? <CandidateEditor data={data} draft={draft} update={update} record={record} disabled={disabled} version={version} go={go} submit={() => { setSubmitError(''); setConfirm(true); }}/>
      : <section className="cp-page"><Heading title="Investigation workspace"/><section className="eb-panel cp-empty"><h2>{workflow.isTerminal ? 'Task closed' : latest ? 'Your submitted work is saved' : 'Start from your targeted task'}</h2>{sent ? draftActions : <button className="eb-action primary" onClick={() => go('tasks')}>View task and work</button>}</section></section>)}
    {page === 'history' && <CandidateHistory data={data} go={go} actions={version === 2 ? <><button className="eb-action primary" disabled={disabled} onClick={() => go(draft.started ? 'workspace' : 'tasks')}>Read feedback and prepare V2</button><small>One revision only · V1 stays unchanged</small></> : null}/>}
    {confirm && version && <Dialog title={`Submit V${version} for ${candidate.name}?`} close={() => setConfirm(false)}><p>This creates an immutable public snapshot on the shared backend. Private notes stay in your local draft and are excluded from the request and exports.</p><details className="cp-submit-preview" open><summary>Public work preview</summary><h3>Executive summary</h3><p className="eb-preserve">{draft.summary || 'Not supplied'}</p>{draft.findings.map(f => <section key={f.id}><small>{f.section}</small><h3>{f.title}</h3><p className="eb-preserve">{f.detail}</p></section>)}</details>{submissionIssues(data, draft).map(issue => <p className="eb-feedback" key={issue}>{issue}</p>)}{submitError && <p role="alert">{submitError}</p>}<PermissionHelp base={controller.base} error={controller.error}/>{controller.error && <p className="eb-feedback" role="alert">{controller.error.message}</p>}{controller.pending && <p>The original request is awaiting its receipt. Your draft stays here. <button className="eb-action" disabled={controller.busy} onClick={async () => { if (await controller.retry()) { if (alive.current) setConfirm(false); go('history'); } }}>Retry original action</button></p>}<button className="eb-action primary" disabled={disabled || submissionIssues(data, draft).length > 0} onClick={() => void submit()}>{controller.busy ? 'Submitting…' : `Confirm V${version} submission`}</button></Dialog>}
  </>;
}
function DraftStartActions({ version, disabled, start }: { version: number; disabled: boolean; start: (copy?: boolean) => void }) {
  return <>{version === 2 && <p>Choose a blank V2 draft or copy your public V1 work. V1 stays unchanged and private notes are not copied.</p>}<button className="eb-action primary" disabled={disabled} onClick={() => start()}>Start V{version} draft</button>{version === 2 && <button className="eb-action" disabled={disabled} onClick={() => start(true)}>Copy V1 public work into V2</button>}</>;
}
