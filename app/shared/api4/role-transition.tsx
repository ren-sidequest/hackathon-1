import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from '../api-ui';
import { approveRoleLeave, cancelRoleLeave, roleLeaveWarnings, useRoleLeaveGuard } from '../role-leave-guard';
import { clearRoleArrival, isRoleArrival, readRoleView, roleDestination, roleLink, rolePages, saveRoleView, type WorkspaceRole } from '../role-navigation';
import type { Api4Controller } from './controller';

export function useRoleTransition(role: WorkspaceRole, controller: Api4Controller, page: string, collapsed: boolean, go: (page: string) => void) {
  const { data } = controller;
  const [warnings, setWarnings] = useState<string[] | null>(null), [leaving, setLeaving] = useState(false), [error, setError] = useState('');
  const restored = useRef(false), destination = useRef('');
  const navigate = useRef(go); navigate.current = go;
  const nextRole = role === 'hr' ? 'candidate' : 'hr';
  const pending = controller.busy || controller.analysisBusy || !!controller.pending || !!controller.analysisPending;
  useRoleLeaveGuard(pending, 'A request is still awaiting confirmation. Keep this view open until the saved action is resolved.');
  useEffect(() => {
    const resume = () => { cancelRoleLeave(); setLeaving(false); void controller.refresh(); };
    const show = (event: PageTransitionEvent) => { if (event.persisted) resume(); };
    window.addEventListener('pageshow', show);
    return () => window.removeEventListener('pageshow', show);
  }, [controller.refresh]);
  useEffect(() => {
    if (restored.current || !data || !controller.fresh || controller.loading) return;
    restored.current = true;
    if (!isRoleArrival(role)) return;
    const saved = readRoleView(data, `${role}.page`);
    if (saved.page && rolePages[role].includes(saved.page)) navigate.current(saved.page);
    clearRoleArrival();
    // The business components mount before restoring position; no stale evidence is copied.
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved.scroll ?? 0)));
    return () => cancelAnimationFrame(frame);
  }, [data, controller.fresh, controller.loading, role]);
  const leave = () => {
    if (!data || pending || !controller.fresh || controller.loading) return;
    saveRoleView(data, `${role}.page`, { page, scroll: window.scrollY });
    approveRoleLeave(); setLeaving(true); setWarnings(null);
    window.location.assign(destination.current);
  };
  const requestSwitch = () => {
    if (!data || pending || !controller.fresh || controller.loading || leaving) return;
    setError('');
    try {
      const configured = nextRole === 'hr' ? import.meta.env.VITE_HR_WORKSPACE_URL : import.meta.env.VITE_CANDIDATE_WORKSPACE_URL;
      destination.current = roleLink(roleDestination(nextRole, location.href, configured, import.meta.env.DEV), nextRole, data, collapsed, document.documentElement.dataset.theme ?? null);
      const issues = roleLeaveWarnings();
      if (issues.length) setWarnings(issues); else leave();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'The other workspace is unavailable.'); }
  };
  return {
    requestSwitch, leaving,
    disabled: !data || !controller.fresh || controller.loading || pending || leaving,
    reason: pending ? 'Resolve the pending action before switching.' : 'Wait for the selected candidate to finish loading.',
    feedback: <>{error && <p role="alert" className="eb-feedback">{error}</p>}{warnings && <Dialog title="Keep your unsaved changes?" close={() => setWarnings(null)}>{warnings.map(message => <p key={message}>{message}</p>)}<p>Saved submissions and browser drafts remain unchanged. Unsaved edits in this page will be lost if you leave.</p><div className="eb-actions"><button className="eb-action primary" onClick={() => setWarnings(null)}>Stay here</button><button className="eb-action" disabled={pending} onClick={leave}>Discard unsaved edits and switch</button></div></Dialog>}</>,
  };
}

export function RoleLoading({ role }: { role: WorkspaceRole }) {
  return <section className="eb-panel eb-role-loading" role="status" aria-label="Loading workspace"><strong>Opening {role === 'hr' ? 'HR' : 'Candidate'} workspace…</strong><p>Loading the selected candidate’s saved evidence.</p><div className="eb-loading-line"/><div className="eb-loading-line"/><div className="eb-loading-line"/></section>;
}
