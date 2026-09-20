import React, { useEffect, useState } from 'react';
import type { Api4Controller } from './controller';

export function useDemoNotice(base: string): [boolean, () => void] {
  const key = `evidencebridge.notice.shared-demo.${base}`;
  const read = () => { try { return sessionStorage.getItem(key) !== 'seen'; } catch { return true; } };
  const [visible, setVisible] = useState(read);
  useEffect(() => { setVisible(read()); }, [key]);
  return [visible, () => { setVisible(false); try { sessionStorage.setItem(key, 'seen'); } catch { /* Optional preference only. */ } }];
}

export function WorkspaceStatus({ controller, info }: { controller: Api4Controller; info: () => void }) {
  const [updated, setUpdated] = useState<string | null>(null);
  useEffect(() => { if (controller.fresh) setUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })); }, [controller.data, controller.fresh]);
  return <div className="ia-service-tools" aria-label="Shared service status">
    <span className="r5-state ia-sync-state" data-testid="connection-state" data-fresh={controller.fresh} role="status">{controller.loading ? 'Refreshing…' : controller.error || !controller.fresh ? 'Refresh needed' : 'Connected'}</span>
    {updated && <small className="eb-muted ia-updated">Updated {updated}</small>}
    <button className="eb-action" disabled={controller.loading} onClick={() => void controller.refresh()}>{controller.loading ? 'Refreshing…' : 'Refresh data'}</button>
    <button className="eb-source-link" onClick={info}>Workspace info</button>
  </div>;
}
export function WorkspaceInfo({ controller }: { controller: Api4Controller }) {
  const { data } = controller;
  return <>
    <h3>Working across two windows</h3><p>Use the HR and Candidate windows against the same backend. Choose the intended candidate explicitly; refresh to receive the other window’s work.</p>
    <h3>About this demonstration</h3><p>Shared demo · No sign-in required. Saved changes are visible in both workspaces and to other visitors.</p><p>Application materials include supplied fictional CVs and explicitly labelled synthetic work samples. Baseline provenance identifies AI-authored annotation and pending human calibration. Scores use the public rubric and are not hiring probabilities.</p>
    <p>Assessment, evidence review and the retained list are separate decisions. Only V1 More opens one V2; historical work stays read only. Private notes remain browser drafts and are excluded from submitted work and exports.</p>
    <p>Model availability is shown honestly. There is no automatic fallback to mock data, no live SQL execution and no general upload or account system. Administrator reset remains a local script, outside this page.</p>
    <details><summary>Connection details & diagnostics</summary><p>API4 · {controller.base}</p><p>Session: {data?.sessionId ?? 'Unavailable'} · Revision: {data?.revision ?? 'Unavailable'}</p><p>Rubric: {data?.rubricVersion ?? 'Unavailable'} · Dataset: {data?.datasetVersion ?? 'Unavailable'}</p><p>{data?.capabilities.analysisModeLabel}</p>{controller.error && <p>{controller.error.code} · Request ID: {controller.error.requestId || 'Not supplied'}</p>}</details>
  </>;
}
