import { PermissionHelp } from './access';
import { candidateSelection, clearRetiredDemoStorage } from './current-demo';
import { savedActionDestination } from './next-step';
import React, { useEffect, useState } from 'react';
import { Sidebar, useSidebar } from '../ui';
import { Dialog } from '../api-ui';
import { GlideSelect } from '../glide-select';
import { useApi4 } from './controller';
import type { CandidateId } from '../api4-types';
import HRConnected from './hr';
import CandidateConnected from './candidate';
import '../revision5/revision5.css';
import type { EvidenceFocus } from './coverage-cell';
import { FloatingNotice, Journey } from './guidance';
import './guidance.css';

const hrPages = [['company', 'Company & role'], ['comparison', 'Compare candidates'], ['evidence', 'Evidence & marks'], ['tasks', 'Targeted tasks'], ['shortlist', 'Retained candidates']];
const candidatePages = [['application', 'My materials'], ['tasks', 'My task'], ['workspace', 'Investigation'], ['history', 'Work & feedback']];
function NavIcon({ index }: { index: number }) {
  const paths = ['M4 21V5l8-3 8 3v16M8 9h2m4 0h2M8 13h2m4 0h2M10 21v-4h4v4', 'M4 19V9m8 10V4m8 15v-7', 'M7 4h10v16H7zM10 8h4m-4 4h4m-4 4h2', 'M4 6h16M4 12h16M4 18h10', 'm5 12 4 4L19 6'];
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[index % paths.length]}/></svg>;
}
export default function ConnectedApp({ role }: { role: 'hr' | 'candidate' }) {
  const pages = role === 'hr' ? hrPages : candidatePages;
  const [selection, setSelection] = useState(() => candidateSelection(location.href));
  const { candidateId, needsSelection } = selection;
  useEffect(() => {
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      try { clearRetiredDemoStorage(window[name]); } catch { /* Optional browser storage. */ }
    }
  }, []);
  useEffect(() => {
    if (needsSelection) {
      const url = new URL(location.href); url.searchParams.delete('candidateId');
      history.replaceState(null, '', url);
    }
  }, [needsSelection]);
  const [page, setPage] = useState(() => pages.some(p => p[0] === location.hash.slice(1)) ? location.hash.slice(1) : pages[role === 'hr' ? 1 : 0][0]);
  const [evidenceFocus,setEvidenceFocus]=useState<EvidenceFocus | undefined>();
  const [help, setHelp] = useState(false), [dismissedNotice, setDismissedNotice] = useState('');
  const [dismissedError, setDismissedError] = useState<unknown>(null);
  useEffect(() => {
    const syncLocation = () => {
      const next = location.hash.slice(1);
      if (pages.some(item => item[0] === next)) setPage(next);
      setSelection(candidateSelection(location.href));
      setEvidenceFocus(undefined);
    };
    window.addEventListener('hashchange', syncLocation);
    window.addEventListener('popstate', syncLocation);
    return () => { window.removeEventListener('hashchange', syncLocation); window.removeEventListener('popstate', syncLocation); };
  }, [pages]);
  const controller = useApi4(role, candidateId, needsSelection), sidebar = useSidebar(role);
  const { data, comparison } = controller;
  useEffect(() => { if (!needsSelection && !candidateId && data) { setSelection({ candidateId: data.candidate.id, needsSelection: false }); const url = new URL(location.href); url.searchParams.set('candidateId', data.candidate.id); history.replaceState(null, '', url); } }, [candidateId, data, needsSelection]);
  const pendingName = (owner: unknown) => comparison?.candidates.find(row => row.candidate.id === owner)?.candidate.name ?? 'the original candidate';
  const savedNext = controller.completedAction?.candidateId === candidateId ? savedActionDestination(controller.completedAction.path, role, controller.completedAction.stage) : null;
  const noticeAction = controller.error ? {
    label: controller.pending ? 'Retry saved request' : controller.analysisPending ? 'Retry analysis' : 'Check latest status',
    run: () => { void (controller.pending ? controller.retry() : controller.analysisPending ? controller.retryAnalysis() : controller.refresh()); }
  } : savedNext ? { label: savedNext.label, run: () => go(savedNext.page) } : undefined;
  useEffect(() => { if(!controller.notice) setDismissedNotice(''); }, [controller.notice]);
  const go = (next: string) => {
    if (!pages.some(p => p[0] === next)) return;
    setPage(next); history.replaceState(null, '', `${location.pathname}${location.search}#${next}`);
    sidebar.closeMobile(); window.scrollTo(0, 0);
  };
  const select = (id: CandidateId, target?: string, criterion?: string) => {
    setEvidenceFocus(criterion ? {criterion,request:performance.now()} : undefined);
    setSelection({ candidateId: id, needsSelection: false }); setDismissedNotice(controller.notice);
    const url = new URL(location.href); url.searchParams.set('candidateId', id); history.replaceState(null, '', url);
    if (target) go(target);
  };
  const displayName = comparison?.candidates.find(row => row.candidate.id === candidateId)?.candidate.name ?? candidateId ?? 'Choose a candidate';
  const initials = displayName.split(/\s+/).map(part => part[0]).slice(0, 2).join('');
  return <div className="eb-connected r5-app guide-app">
    <a href="#api4-main" className="eb-skip eb-action" onClick={e => { e.preventDefault(); document.getElementById('api4-main')?.focus(); }}>Skip to content</a>
    <Sidebar role={role} workspaceName={role === 'hr' ? data?.company.name ?? 'Hiring workspace' : 'Candidate'} controller={sidebar} activePage={page} items={pages.map(([id, label], index) => ({ id, label, icon: <NavIcon index={index}/> }))} onNavigate={next => go(next === 'report' ? 'company' : next === 'home' ? 'application' : next)} user={{ initials: role === 'hr' ? 'HR' : initials, name: role === 'hr' ? 'Hiring reviewer' : displayName, title: role === 'hr' ? data?.company.name ?? 'Hiring team' : 'Synthetic candidate' }} helpLabel="How to use this workspace" onHelp={() => setHelp(true)}/>
    <div className="eb-main" data-eb-content><header className="eb-api-topbar">{sidebar.menuButton}<span>{role === 'hr' ? 'Hiring workspace' : 'Candidate workspace'} / {pages.find(p => p[0] === page)?.[1]}</span><span className="r5-mode">Shared evidence workspace</span></header>
      <main id="api4-main" tabIndex={-1} className="eb-content">
        <section className="eb-api-status" aria-label="Shared service status"><div className="eb-heading"><span>{needsSelection && comparison ? 'Choose a candidate to continue' : controller.fresh ? 'Connected · four-person shared case' : controller.loading ? 'Loading shared case…' : 'Refresh required · service data not current'}</span><button className="eb-action" disabled={controller.loading} onClick={() => void controller.refresh()}>{controller.loading ? 'Refreshing…' : 'Refresh shared case'}</button></div><small>Demo materials · Server-calculated scores · Demo identities, not account authentication</small>
          <p className="guide-access">Shared demo · No sign-in required. Saved changes are visible in both workspaces and to other visitors.</p>
          <PermissionHelp base={controller.base} error={controller.error}/>{data && <p>{data.capabilities.analysisModeLabel} · {data.assessment.application_review ? data.assessment.application_review.operatorLabel : 'Not assessed'}</p>}
          {controller.error && <p role="alert" className="eb-feedback">{controller.error.message}</p>}
          <details><summary>Connection details & diagnostics</summary><p>API4 · {controller.base}</p><p>Session: {data?.sessionId ?? 'Unavailable'} · Revision: {data?.revision ?? 'Unavailable'}</p><p>Rubric: {data?.rubricVersion ?? 'Unavailable'} · Dataset: {data?.datasetVersion ?? 'Unavailable'}</p>{controller.error && <p>{controller.error.code} · Request ID: {controller.error.requestId || 'Not supplied'}</p>}</details>
          {!needsSelection && controller.pending && <p className="eb-feedback">An original saved action for {pendingName(controller.pending.body.candidateId)} is waiting for confirmation. <button className="eb-action" disabled={controller.busy} onClick={() => void controller.retry()}>Retry original action</button></p>}
          {!needsSelection && controller.analysisPending && <p className="eb-feedback">An analysis request for {pendingName(controller.analysisPending.body.candidateId)} is waiting for confirmation. Human review remains available. <button className="eb-action" disabled={controller.analysisBusy} onClick={() => void controller.retryAnalysis()}>Retry original analysis</button></p>}
          {!data && !needsSelection && !controller.loading && <p>The shared case is unavailable. Check the connection details or contact the host, then refresh.</p>}
        </section>
        {needsSelection && comparison && <section className="eb-panel" aria-label="Current demo candidates"><h1>Choose a candidate</h1><p>The demo has been updated. Select a candidate to continue.</p><div className="eb-actions">{comparison.candidates.map(row => <button key={row.candidate.id} className="eb-action" onClick={() => select(row.candidate.id)}>{row.candidate.name}</button>)}</div></section>}
        <FloatingNotice message={controller.error && controller.error !== dismissedError ? [controller.error.message,controller.notice].filter(Boolean).join(' ') : controller.notice !== dismissedNotice ? controller.notice : ''} error={!!controller.error && controller.error !== dismissedError} dismiss={() => { setDismissedNotice(controller.notice); setDismissedError(controller.error); }} action={noticeAction}/>
        {!needsSelection && !['company','comparison'].includes(page) && <div className="r5-person-bar"><span className="r5-avatar">{initials}</span><div><strong>{displayName}</strong><small>{data?.candidate.background ?? 'Select an explicit demo identity'}</small></div><label>Demo identity<GlideSelect ariaLabel="Current candidate" value={candidateId ?? ''} onChange={value => select(value as CandidateId)} options={(comparison?.candidates ?? []).map(row => ({value: row.candidate.id, label: row.candidate.name}))}/></label></div>}
        {data && !['company', 'comparison'].includes(page) && <Journey data={data} role={role} page={page} go={go}/>}
        {data && comparison && (role === 'hr'
          ? <HRConnected key={`${data.sessionId}.${data.fixtureVersion}.${data.jdVersion}.${data.rubricVersion}.${data.datasetVersion}.${data.candidate.id}`} data={data} comparison={comparison} controller={controller} page={page} go={go} select={select} evidenceFocus={evidenceFocus}/>
          : <CandidateConnected key={`${data.sessionId}.${data.fixtureVersion}.${data.jdVersion}.${data.rubricVersion}.${data.datasetVersion}.${data.candidate.id}.${data.task.taskId}.${data.workflow.nextSubmissionVersion ?? data.currentSubmissionVersion ?? 1}`} data={data} controller={controller} page={page} go={go}/>)}
        <footer className="eb-footer">EvidenceBridge · Reviewable evidence. Human decisions. · Formal state lives in the shared service.</footer>
      </main>
    </div>
    {help && <Dialog title="Using EvidenceBridge" close={() => setHelp(false)}><p>Use the HR and Candidate windows against the same backend. Choose the intended candidate explicitly; refresh to receive the other window’s work.</p><p>Application materials include supplied fictional CVs and explicitly labelled synthetic work samples. Baseline provenance identifies AI-authored annotation and pending human calibration. Scores use the public rubric and are not hiring probabilities.</p><p>Assessment, evidence review and the retained list are separate decisions. Only V1 More opens one V2; historical work stays read only. Private notes remain browser drafts and are excluded from submitted work and exports.</p><p>Model availability is shown honestly. There is no automatic fallback to mock data, no live SQL execution and no general upload or account system. Administrator reset remains a local script, outside this page.</p></Dialog>}
  </div>;
}
