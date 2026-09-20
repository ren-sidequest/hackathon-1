import React from 'react';
import { readPreference, sidebarKey } from './preferences';
import type { WorkspaceRole } from './role-navigation';
import './role-switch.css';

export function WorkspaceBoot({ role }: { role: WorkspaceRole }) {
  const collapsed = readPreference(sidebarKey(role)) === 'collapsed';
  return <div className="eb-connected"><aside className={`eb-sidebar${collapsed ? ' is-collapsed' : ''}`} aria-hidden="true"><div className="eb-brand"><span className="eb-brand-mark">E</span><span className="eb-expanded">EvidenceBridge</span></div><div className="eb-workspace"><span className="eb-role-badge">{role === 'hr' ? 'HR' : 'C'}</span><span className="eb-expanded">{role === 'hr' ? 'Hiring workspace' : 'Candidate'}</span></div>{Array.from({ length: role === 'hr' ? 5 : 4 }, (_, i) => <div className="eb-nav-item" key={i}><span className="eb-boot-nav"/></div>)}</aside><main data-eb-content className="eb-role-loading"><p role="status">Opening {role === 'hr' ? 'HR' : 'Candidate'} workspace…</p><div className="eb-loading-line"/><div className="eb-loading-line"/></main></div>;
}
