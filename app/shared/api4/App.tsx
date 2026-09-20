import { PermissionHelp } from './access';
import { workspacePresentation, type WorkspacePresentation } from './workspace-presentation';
import { IdentityRegion, IdentitySwitchNotice } from './identity-transition';
import './identity-transition.css';
import { candidateSelection, clearRetiredDemoStorage } from './current-demo';
import { savedActionDestination } from './next-step';
import React, { useEffect, useState } from 'react';
import { Sidebar, useSidebar } from '../ui';
import { Dialog } from '../api-ui';
import { GlideSelect } from '../glide-select';
import { useApi4 } from './controller';
import type { RetentionFilter } from './retained-model';
import type { CandidateId } from '../api4-types';
import HRConnected from './hr';
import CandidateConnected from './candidate';
import '../revision5/revision5.css';
import type { EvidenceFocus } from './coverage-cell';
import { FloatingNotice } from './guidance';
import './guidance.css';
import './responsive.css';
import './structure.css';
import './presentation.css';
import './workspace-system.css';
import './reference-layout.css';
import './retained.css';
import { WorkspaceStatus, WorkspaceInfo, useDemoNotice } from './workspace-shell';

const hrPages = [['company', 'Company & role'], ['comparison', 'Compare candidates'], ['evidence', 'Candidate details'], ['tasks', 'Tasks & review'], ['shortlist', 'Retention & review']];
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
  const [retentionFilter,setRetentionFilter]=useState<RetentionFilter>('retained');
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
  const [held,setHeld]=useState<WorkspacePresentation|null>(null);
  useEffect(()=>{if(data&&comparison&&!needsSelection)setHeld({role,data,comparison});else if(needsSelection)setHeld(null);},[role,data,comparison,needsSelection]);
  const presentation=workspacePresentation(role,needsSelection,data,comparison,held);
  const shownData=presentation?.data, shownComparison=presentation?.comparison;
  const switching=!!shownData&&!!candidateId&&shownData.candidate.id!==candidateId;
  const displayController=switching?{...controller,busy:true,analysisBusy:true}:controller;
  const [noticeVisible, dismissDemoNotice] = useDemoNotice(controller.base);
  const localReview = document.documentElement.lang === 'zh-CN';
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
    if(next==='shortlist'&&page!=='shortlist')setRetentionFilter('retained');
    setPage(next); history.replaceState(null, '', `${location.pathname}${location.search}#${next}`);
    sidebar.closeMobile(); if(next!==page)window.scrollTo(0, 0);
  };
  const select = (id: CandidateId, target?: string, criterion?: string) => {
    if(id===candidateId&&!criterion&&(!target||target===page))return;
    setEvidenceFocus(criterion ? {criterion,request:performance.now()} : undefined);
    setSelection({ candidateId: id, needsSelection: false }); setDismissedNotice(controller.notice);
    const url = new URL(location.href); url.searchParams.set('candidateId', id); history.replaceState(null, '', url);
    if (target && target!==page) go(target);
  };
  const displayName = comparison?.candidates.find(row => row.candidate.id === candidateId)?.candidate.name ?? candidateId ?? 'Choose a candidate';
  const shownName = switching ? shownData!.candidate.name : displayName;
  const initials = shownName.split(/\s+/).map(part => part[0]).slice(0, 2).join('');
  return <div className="eb-connected r5-app guide-app api4-app">
    <a href="#api4-main" className="eb-skip eb-action" onClick={e => { e.preventDefault(); document.getElementById('api4-main')?.focus(); }}>Skip to content</a>
    <Sidebar role={role} workspaceName={role === 'hr' ? (shownData??data)?.company.name ?? 'Hiring workspace' : 'Candidate'} controller={sidebar} activePage={page} items={pages.map(([id, label], index) => ({ id, label, icon: <NavIcon index={index}/> }))} onNavigate={next => go(next === 'report' ? 'company' : next === 'home' ? 'application' : next)} user={{ initials: role === 'hr' ? 'HR' : initials, name: role === 'hr' ? 'Hiring reviewer' : shownName, title: role === 'hr' ? (shownData??data)?.company.name ?? 'Hiring team' : 'Synthetic candidate' }} helpLabel="How to use this workspace" onHelp={() => setHelp(true)}/>
    <div className="eb-main" data-eb-content><header className="eb-api-topbar ia-topbar">{sidebar.menuButton}<span className="ia-breadcrumb">{role === 'hr' ? 'Hiring workspace' : 'Candidate workspace'} / {pages.find(p => p[0] === page)?.[1]}</span>{localReview && <button className="eb-action ia-environment" onClick={()=>setHelp(true)}>Local Chinese review</button>}<WorkspaceStatus controller={controller} info={()=>setHelp(true)}/></header>
      <main id="api4-main" tabIndex={-1} className="eb-content">
        {noticeVisible && <aside className="eb-panel ia-first-notice" aria-label="Shared demo notice"><span>Shared demo · Saved changes are visible to other visitors. Use sample data only.</span><button className="eb-source-link" onClick={dismissDemoNotice}>Got it</button></aside>}
        {(controller.error || controller.pending || controller.analysisPending || (!data && !needsSelection && !controller.loading)) && <section className="eb-panel ia-connection-alert" aria-label="Connection action required">
          <PermissionHelp base={controller.base} error={controller.error}/>
          {controller.error && <p role="alert" className="eb-feedback">{controller.error.message} <small data-testid="connection-error-code">{controller.error.code}</small></p>}
          {!needsSelection && controller.pending && <p className="eb-feedback">An original saved action for {pendingName(controller.pending.body.candidateId)} is waiting for confirmation. <button className="eb-action" disabled={controller.busy} onClick={() => void controller.retry()}>Retry original action</button></p>}
          {!needsSelection && controller.analysisPending && <p className="eb-feedback">An analysis request for {pendingName(controller.analysisPending.body.candidateId)} is waiting for confirmation. Human review remains available. <button className="eb-action" disabled={controller.analysisBusy} onClick={() => void controller.retryAnalysis()}>Retry original analysis</button></p>}
          {!data && !needsSelection && !controller.loading && <p>The shared case is unavailable. Check the connection details or contact the host, then refresh.</p>}
        </section>}
        {needsSelection && comparison && <section className="eb-panel" aria-label="Current demo candidates"><h1>Choose a candidate</h1><p>The demo has been updated. Select a candidate to continue.</p><div className="eb-actions">{comparison.candidates.map(row => <button key={row.candidate.id} className="eb-action" onClick={() => select(row.candidate.id)}>{row.candidate.name}</button>)}</div></section>}
        <FloatingNotice message={controller.error && controller.error !== dismissedError ? [controller.error.message,controller.notice].filter(Boolean).join(' ') : controller.notice !== dismissedNotice ? controller.notice : ''} error={!!controller.error && controller.error !== dismissedError} dismiss={() => { setDismissedNotice(controller.notice); setDismissedError(controller.error); }} action={noticeAction}/>
        {!needsSelection && role === 'candidate' && <div className="r5-person-bar ia-person-bar"><span className="r5-avatar">{initials}</span><div><strong>{shownName}</strong><small className="ia-person-context">{shownData?.job.title}</small></div><label>Switch candidate<GlideSelect ariaLabel="Current candidate" value={candidateId ?? ''} onChange={value => select(value as CandidateId)} options={(comparison?.candidates ?? []).map(row => ({value: row.candidate.id, label: row.candidate.name}))}/></label></div>}
        {shownData && (role==='candidate'||page!=='shortlist') && <IdentitySwitchNotice pending={switching} failed={!!controller.error} requestedName={displayName} displayedName={shownData.candidate.name}/>}
        {role==='hr' && shownData && shownComparison && <HRConnected key={`${shownData.sessionId}.${shownData.fixtureVersion}.${shownData.jdVersion}.${shownData.rubricVersion}.${shownData.datasetVersion}.${page==='shortlist'?'shortlist':shownData.candidate.id}`} data={shownData} comparison={shownComparison} requestedCandidateId={candidateId} controller={displayController} page={page} go={go} select={select} evidenceFocus={evidenceFocus} retentionFilter={retentionFilter} setRetentionFilter={setRetentionFilter}/>}
        {role==='candidate' && shownData && shownComparison && <IdentityRegion pending={switching}><CandidateConnected key={`${shownData.sessionId}.${shownData.fixtureVersion}.${shownData.jdVersion}.${shownData.rubricVersion}.${shownData.datasetVersion}.${shownData.candidate.id}.${shownData.task.taskId}.${shownData.workflow.nextSubmissionVersion ?? shownData.currentSubmissionVersion ?? 1}`} data={shownData} controller={displayController} page={page} go={go}/></IdentityRegion>}
        <footer className="eb-footer">EvidenceBridge · Reviewable evidence. Human decisions. · Formal state lives in the shared service.</footer>
      </main>
    </div>
    {help && <Dialog title="Using EvidenceBridge" close={() => setHelp(false)}><WorkspaceInfo controller={controller}/>{localReview && <section className="ia-local-help"><h3>Local Chinese review</h3><p>Chinese text is a reading aid. Original evidence, source offsets and scores are unchanged. This local database is separate from the public website.</p><a href="/review-guide.html" target="_blank" rel="noreferrer">Open Chinese rehearsal guide</a></section>}</Dialog>}

  </div>;
}
