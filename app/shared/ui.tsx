import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { applyTheme, readPreference, resolveTheme, sidebarKey, themeKey, writePreference, type Theme } from './preferences';

function Glyph({ name }: { name: 'sun' | 'moon' | 'menu' | 'close' | 'collapse' | 'brand' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'sun' && <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>}
    {name === 'moon' && <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>}
    {name === 'menu' && <path d="M4 6h16M4 12h16M4 18h16"/>}
    {name === 'close' && <path d="m6 6 12 12M6 18 18 6"/>}
    {name === 'collapse' && <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m7-12-3 4 3 4"/></>}
    {name === 'brand' && <><path d="M4 19V5h5v14m6 0V5h5v14M9 11h6M2 19h20"/></>}
  </svg>;
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(document.documentElement.dataset.theme ?? null, false));
  const preference = useRef(readPreference(themeKey));
  useEffect(() => {
    const system = matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const next = resolveTheme(preference.current, system.matches);
      applyTheme(next);
      setTheme(next);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === themeKey || event.key === null) {
        preference.current = readPreference(themeKey);
        update();
      }
    };
    system.addEventListener('change', update);
    window.addEventListener('storage', storage);
    // A lazy-loaded app may mount after another tab changes the preference.
    preference.current = readPreference(themeKey);
    update();
    return () => { system.removeEventListener('change', update); window.removeEventListener('storage', storage); };
  }, []);
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    preference.current = next;
    applyTheme(next);
    setTheme(next);
    writePreference(themeKey, next);
  };
  return <button className="eb-theme-switch" type="button" role="switch" aria-label="Night mode" aria-checked={theme === 'dark'} onClick={toggle} title={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}>
    <span className="eb-theme-thumb"/><span className="eb-theme-icon"><Glyph name="sun"/></span><span className="eb-theme-icon"><Glyph name="moon"/></span>
  </button>;
}

export type NavigationItem = { id: string; label: string; icon: ReactNode; count?: number; href?: string };
type SidebarProps = {
  role: 'hr' | 'candidate'; activePage: string; items: NavigationItem[];
  onNavigate: (id: string) => void; user: { initials: string; name: string; title: string };
  helpLabel: string; onHelp: () => void; onReset?: () => void;
};

export function useSidebar(role: SidebarProps['role']) {
  const [collapsed, setCollapsed] = useState(() => readPreference(sidebarKey(role)) === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMobile = (restoreFocus = true) => {
    setMobileOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  return {
    collapsed, mobileOpen, closeMobile,
    toggleCollapsed: () => {
      setCollapsed(!collapsed);
      writePreference(sidebarKey(role), collapsed ? 'expanded' : 'collapsed');
    },
    menuButton: <button ref={triggerRef} type="button" className="eb-menu-button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="eb-sidebar" onClick={() => setMobileOpen(true)}><Glyph name="menu"/></button>,
  };
}

export function Sidebar({ role, activePage, items, onNavigate, user, helpLabel, onHelp, onReset, controller }: SidebarProps & { controller: ReturnType<typeof useSidebar> }) {
  const { collapsed, mobileOpen, closeMobile, toggleCollapsed } = controller;
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(closeMobile);
  closeRef.current = closeMobile;
  useEffect(() => {
    if (!mobileOpen) return;
    const node = panel.current!;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const content = document.querySelector<HTMLElement>('[data-eb-content]');
    const originalInert = content?.inert ?? false;
    if (content) content.inert = true;
    node.querySelector<HTMLButtonElement>('.eb-mobile-close')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const focusable = [...node.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')].filter(el => el.getClientRects().length > 0);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const wide = matchMedia('(min-width: 701px)');
    const resize = () => { if (wide.matches) closeRef.current(false); };
    document.addEventListener('keydown', keyboard);
    wide.addEventListener('change', resize);
    return () => {
      document.body.style.overflow = originalOverflow;
      if (content) content.inert = originalInert;
      document.removeEventListener('keydown', keyboard);
      wide.removeEventListener('change', resize);
    };
  }, [mobileOpen]);
  // Restore focus after the background has stopped being inert.
  useEffect(() => {
    if (!mobileOpen && matchMedia('(max-width: 700px)').matches && panel.current?.contains(document.activeElement)) {
      document.querySelector<HTMLButtonElement>('.eb-menu-button')?.focus();
    }
  }, [mobileOpen]);
  const visit = (id: string) => { closeMobile(); onNavigate(id); };
  return <>
    {mobileOpen && <div className="eb-sidebar-backdrop" aria-hidden="true" onClick={() => closeMobile()}/>}
    <aside ref={panel} id="eb-sidebar" className={`eb-sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-open' : ''}`} aria-label={`${role === 'hr' ? 'HR' : 'Candidate'} workspace`} role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined}>
      <button type="button" className="eb-mobile-close" aria-label="Close navigation" onClick={() => closeMobile()}><Glyph name="close"/></button>
      <a className="eb-brand" href={role === 'hr' ? '#report' : '#home'} aria-label="EvidenceBridge home" onClick={e => { e.preventDefault(); visit(role === 'hr' ? 'report' : 'home'); }}><span className="eb-brand-mark"><Glyph name="brand"/></span><span className="eb-expanded">EvidenceBridge</span></a>
      <div className="eb-workspace"><span className="eb-role-badge">{role === 'hr' ? 'HR' : 'C'}</span><div className="eb-expanded"><strong>{role === 'hr' ? 'HarbourCart' : 'Candidate'}</strong><small>{role === 'hr' ? 'Hiring workspace' : 'Your evidence workspace'}</small></div></div>
      <div className="eb-nav-label eb-expanded">WORKSPACE</div>
      <nav aria-label="Main navigation">{items.map(item => {
        const contents = <><span className="eb-nav-icon">{item.icon}</span><span className="eb-expanded eb-nav-text">{item.label}</span>{!!item.count && <span className="eb-nav-count">{item.count}</span>}<span className="eb-nav-tooltip" aria-hidden="true">{item.label}</span></>;
        const props = { className: `eb-nav-item${activePage === item.id ? ' is-active' : ''}`, 'aria-label': item.label, 'aria-current': activePage === item.id ? 'page' as const : undefined, onClick: (e: React.MouseEvent) => { e.preventDefault(); visit(item.id); } };
        return item.href ? <a key={item.id} href={item.href} {...props}>{contents}</a> : <button type="button" key={item.id} {...props}>{contents}</button>;
      })}</nav>
      <div className="eb-sidebar-bottom">
        <div className="eb-sidebar-theme"><span className="eb-expanded">Appearance</span><ThemeSwitch/></div>
        {onReset && <button className="eb-nav-item" type="button" aria-label="Reset demo" onClick={() => { closeMobile(); onReset(); }}><span className="eb-nav-icon">↺</span><span className="eb-expanded">Reset demo</span><span className="eb-nav-tooltip" aria-hidden="true">Reset demo</span></button>}
        <button className="eb-nav-item" type="button" aria-label={helpLabel} onClick={() => { closeMobile(); onHelp(); }}><span className="eb-nav-icon eb-help-icon">?</span><span className="eb-expanded">{helpLabel}</span><span className="eb-nav-tooltip" aria-hidden="true">{helpLabel}</span></button>
        <div className="eb-user" title={`${user.name} · ${user.title}`}><span className="eb-user-avatar">{user.initials}</span><span className="eb-expanded"><strong>{user.name}</strong><small>{user.title} · Demo</small></span></div>
        <button className="eb-collapse" type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="eb-sidebar"><Glyph name="collapse"/><span className="eb-expanded">Collapse sidebar</span><span className="eb-nav-tooltip" aria-hidden="true">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span></button>
      </div>
    </aside>
  </>;
}
