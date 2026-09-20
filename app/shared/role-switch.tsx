import React, { useEffect, useRef, useState } from 'react';
import type { WorkspaceRole } from './role-navigation';
import './role-switch.css';

export type RoleSwitchProps = { candidateName: string; disabled: boolean; reason?: string; onSwitch: () => void };
export function RoleSwitch({ role, candidateName, disabled, reason, onSwitch }: RoleSwitchProps & { role: WorkspaceRole }) {
  const [open, setOpen] = useState(false), [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } if (event.key === 'Tab') setOpen(false); };
    const resize = () => setOpen(false);
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key); window.addEventListener('resize', resize); window.addEventListener('scroll', resize, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); window.removeEventListener('resize', resize); window.removeEventListener('scroll', resize, true); };
  }, [open]);
  const label = role === 'hr' ? 'HR workspace' : 'Candidate workspace';
  return <div className="eb-demo-switch">
    <button ref={trigger} className="eb-demo-trigger" aria-label="Switch demo role" aria-expanded={open} aria-controls="eb-role-menu" aria-haspopup="menu" title={`${label} · switch demo view`} onClick={() => {
      const box = trigger.current!.getBoundingClientRect();
      setPosition({ top: Math.max(8, box.top - 204), left: Math.max(8, Math.min(box.right - 240, window.innerWidth - 248)) }); setOpen(value => !value);
    }}><span>Demo</span><strong>{role === 'hr' ? 'HR' : 'Candidate'}</strong><span aria-hidden="true">⇄</span></button>
    {open && <div ref={menu} id="eb-role-menu" className="eb-role-menu" role="menu" aria-label="Demo workspace roles" style={position}>
      <small>DEMO VIEW</small><strong>{candidateName || 'Choose a candidate first'}</strong>
      <button role="menuitem" aria-disabled={disabled} title={reason} onClick={() => { if (!disabled) { setOpen(false); onSwitch(); } }}>{role === 'hr' ? 'Open Candidate view' : 'Return to HR'}<span aria-hidden="true">↗</span></button>
      <p>{disabled ? reason : 'Same candidate · shared saved evidence'}</p>
    </div>}
  </div>;
}
