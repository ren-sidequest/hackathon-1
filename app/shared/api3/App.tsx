import React, { useEffect, useState } from 'react';
import { Sidebar, useSidebar } from '../ui';
import { Dialog } from '../api-ui';
import { GlideSelect } from '../glide-select';
import { candidateIds } from './client';
import { useApi3 } from './controller';
import type { CandidateId } from '../api3-types';
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
  const [candidateId, setCandidateId] = useState<CandidateId>(() => {
    const id = new URL(location.href).searchParams.get('candidateId') as CandidateId;
    return candidateIds.includes(id) ? id : 'alex-chen';
  });
  const [page, setPage] = useState(() => pages.some(p => p[0] === location.hash.slice(1)) ? location.hash.slice(1) : pages[role === 'hr' ? 1 : 0][0]);
  const [evidenceFocus,setEvidenceFocus]=useState<EvidenceFocus | undefined>();
  const [help, setHelp] = useState(false), [dismissedNotice, setDismissedNotice] = useState('');
  const [dismissedError, setDismissedError] = useState<unknown>(null);
  const controller = useApi3(role, candidateId), sidebar = useSidebar(role);
  const { data, comparison } = controller;
  useEffect(() => { if(!controller.notice) setDismissedNotice(''); }, [controller.notice]);
  const go = (next: string) => {
    if (!pages.some(p => p[0] === next)) return;
    setPage(next); history.replaceState(null, '', `${location.pathname}${location.search}#${next}`);
    sidebar.closeMobile(); window.scrollTo(0, 0);
  };
  const select = (id: CandidateId, target?: string, criterion?: string) => {
    setEvidenceFocus(criterion ? {criterion,request:performance.now()} : undefined);
    setCandidateId(id); setDismissedNotice(controller.notice);
    const url = new URL(location.href); url.searchParams.set('candidateId', id); history.replaceState(null, '', url);
    if (target) go(target);
  };
  const displayName = comparison?.candidates.find(row => row.candidate.id === candidateId)?.candidate.name ?? candidateId;
  const initials = displayName.split(/\s+/).map(part => part[0]).slice(0, 2).join('');
  return <div className="eb-connected r5-app guide-app">
    <a href="#api3-main" className="eb-skip eb-action" onClick={e => { e.preventDefault(); document.getElementById('api3-main')?.focus(); }}>Skip to content</a>
    <Sidebar role={role} controller={sidebar} activePage={page} items={pages.map(([id, label], index) => ({ id, label, icon: <NavIcon index={index}/> }))} onNavigate={go} user={{ initials: role === 'hr' ? 'HR' : initials, name: role === 'hr' ? 'Operations lead' : displayName, title: role === 'hr' ? 'HarbourCart' : 'Synthetic candidate' }} helpLabel="Connected guide" onHelp={() => setHelp(true)}/>
    <div className="eb-main" data-eb-content><header className="eb-api-topbar">{sidebar.menuButton}<span>{role === 'hr' ? 'Hiring workspace' : 'Candidate workspace'} / {pages.find(p => p[0] === page)?.[1]}</span><span className="r5-mode">API3 · shared service</span></header>
      <main id="api3-main" tabIndex={-1} className="eb-content">
        <section className="eb-api-status" aria-label="Shared service status"><div className="eb-heading"><span>{controller.fresh ? 'Connected · four-person shared case' : controller.loading ? 'Loading shared case…' : 'Refresh required · service data not current'}</span><button className="eb-action" disabled={controller.loading} onClick={() => void controller.refresh()}>{controller.loading ? 'Refreshing…' : 'Refresh shared case'}</button></div><small>Synthetic company and materials · Human judgments, server-calculated scores · Demo identities, not account authentication</small>
          {controller.error && <p role="alert" className="eb-feedback"><strong>{controller.error.code}</strong> — {controller.error.message}{controller.error.requestId && <small>Request ID: {controller.error.requestId}</small>}</p>}
          {controller.pending && <p className="eb-feedback">Original {controller.pending.path.slice(1)} receipt for {String(controller.pending.body.candidateId)} is unresolved. <button className="eb-action" disabled={controller.busy} onClick={() => void controller.retry()}>Retry original action</button></p>}
          {controller.analysisPending && <p className="eb-feedback">Analysis receipt for {String(controller.analysisPending.body.candidateId)} is unresolved. Human review remains available. <button className="eb-action" disabled={controller.analysisBusy} onClick={() => void controller.retryAnalysis()}>Retry original analysis</button></p>}
          {!data && !controller.loading && <p>Start the matching API3 backend at <code>{controller.base}</code>, then refresh. No local mock has replaced the service.</p>}
        </section>
        <FloatingNotice message={controller.error && controller.error !== dismissedError ? [controller.error.message,controller.notice].filter(Boolean).join(' ') : controller.notice !== dismissedNotice ? controller.notice : ''} error={!!controller.error && controller.error !== dismissedError} dismiss={() => { setDismissedNotice(controller.notice); setDismissedError(controller.error); }} action={controller.error ? {label:controller.pending ? 'Retry saved request' : 'Check latest status',run:()=>void(controller.pending ? controller.retry() : controller.refresh())} : data && !['company','comparison'].includes(page) ? { label: role === 'candidate' ? 'View work & feedback' : 'View task status', run: () => go(role === 'candidate' ? 'history' : 'tasks') } : undefined}/>
        {!['company','comparison'].includes(page) && <div className="r5-person-bar"><span className="r5-avatar">{initials}</span><div><strong>{displayName}</strong><small>{data?.candidate.background ?? 'Select an explicit demo identity'}</small></div><label>Demo identity<GlideSelect ariaLabel="Current candidate" value={candidateId} onChange={value => select(value as CandidateId)} options={candidateIds.map(id => ({value: id, label: comparison?.candidates.find(row => row.candidate.id === id)?.candidate.name ?? id}))}/></label></div>}
        {data && !['company', 'comparison'].includes(page) && <Journey data={data} role={role} page={page} go={go}/>}
        {data && comparison && (role === 'hr'
          ? <HRConnected key={`${data.sessionId}.${data.candidate.id}`} data={data} comparison={comparison} controller={controller} page={page} go={go} select={select} evidenceFocus={evidenceFocus}/>
          : <CandidateConnected key={`${data.sessionId}.${data.candidate.id}.${data.task.taskId}.${data.workflow.nextSubmissionVersion ?? data.currentSubmissionVersion ?? 1}`} data={data} controller={controller} page={page} go={go}/>)}
        <footer className="eb-footer">EvidenceBridge · Reviewable evidence. Human decisions. · Formal state lives in the shared service.</footer>
      </main>
    </div>
    {help && <Dialog title="Shared API3 workflow" close={() => setHelp(false)}><p>Use the HR and Candidate windows against the same backend. Choose the intended candidate explicitly; refresh to receive the other window’s work.</p><p>Application materials and baseline annotations are synthetic presets. Baseline provenance identifies AI-authored annotation and pending human calibration. Scores use the public rubric and are not hiring probabilities.</p><p>Assessment, evidence review and the retained list are separate decisions. Only V1 More opens one V2; historical work stays read only. Private notes remain browser drafts and are excluded from submitted work and exports.</p><p>Model availability is shown honestly. There is no automatic fallback to mock data, no live SQL execution and no general upload or account system. Administrator reset remains a local script, outside this page.</p></Dialog>}
  </div>;
}
