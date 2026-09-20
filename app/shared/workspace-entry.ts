// Both independent HTML entries paint the same sized shell before React/downloaded chunks start.
// These presentation hints contain no business state, account identity or credentials.
export function workspaceEntry(role: 'hr' | 'candidate') {
  return {
    name: 'evidencebridge-workspace-entry',
    transformIndexHtml: {
      order: 'pre' as const,
      handler(html: string) {
        const boot = `(()=>{const role=${JSON.stringify(role)},q=new URL(location.href).searchParams;let theme='dark',side='expanded';try{theme=localStorage.getItem('evidencebridge.ui.theme.v1')||theme;side=localStorage.getItem('evidencebridge.ui.sidebar.'+role+'.v1')||side;}catch{}if(q.get('_ebRole')===role){theme=q.get('_ebTheme')||theme;side=q.get('_ebSidebar')||side;}document.documentElement.dataset.theme=theme==='light'?'light':'dark';document.documentElement.style.setProperty('--eb-entry-width',side==='collapsed'?'64px':'232px');})();`;
        const style = `html{background:#181a1c;color:#eee9db;color-scheme:dark}html[data-theme=light]{background:#f6f3ec;color:#302a20;color-scheme:light}.eb-entry{font:14px/1.6 system-ui,sans-serif;padding:32px;margin-left:var(--eb-entry-width,232px)}.eb-entry:before{content:'EB';box-sizing:border-box;position:fixed;inset:0 auto 0 0;width:var(--eb-entry-width,232px);padding:32px 16px;color:#d8b968;background:#060606;border-right:1px solid #605948}html[data-theme=light] .eb-entry:before{background:#fffdf7;color:#806127;border-color:#ded6c6}.eb-entry span{display:block;height:14px;margin-top:24px;width:55%;background:#343638;border-radius:6px}html[data-theme=light] .eb-entry span{background:#eee7d8}@media(max-width:700px){.eb-entry{margin-left:0}.eb-entry:before{display:none}}`;
        return {
          html: html.replace('<div id="root"></div>', `<div id="root"><div class="eb-entry" role="status">Opening ${role === 'hr' ? 'HR' : 'Candidate'} workspace…<span></span><span></span></div></div>`),
          tags: [{ tag: 'script', children: boot, injectTo: 'head-prepend' as const }, { tag: 'style', children: style, injectTo: 'head-prepend' as const }],
        };
      },
    },
  };
}
