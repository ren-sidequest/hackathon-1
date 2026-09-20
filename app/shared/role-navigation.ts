import type { Demo } from './api4-types';
import { readPreference, sidebarKey, themeKey, writePreference } from './preferences';

export type WorkspaceRole = 'hr' | 'candidate';
export const rolePages = {
  hr: ['company', 'comparison', 'evidence', 'tasks', 'shortlist'],
  candidate: ['application', 'tasks', 'workspace', 'history'],
};
export const arrivalKey = '_ebRole';
let arrivingRole: WorkspaceRole | null = null;
export const isRoleArrival = (role: WorkspaceRole) => arrivingRole === role;
const presentationKeys = [arrivalKey, '_ebTheme', '_ebSidebar'];
export function initializeRoleArrival(role: WorkspaceRole) {
  const url = new URL(location.href);
  if (url.searchParams.get(arrivalKey) !== role) return;
  arrivingRole = role;
  const theme = url.searchParams.get('_ebTheme'), sidebar = url.searchParams.get('_ebSidebar');
  if (theme === 'light' || theme === 'dark') writePreference(themeKey, theme);
  if (sidebar === 'collapsed' || sidebar === 'expanded') writePreference(sidebarKey(role), sidebar);
}
export function clearRoleArrival() {
  const url = new URL(location.href);
  presentationKeys.forEach(key => url.searchParams.delete(key));
  history.replaceState(null, '', url);
}
// Only trusted build configuration may name a different origin, and only loopback in development.
export function roleDestination(role: WorkspaceRole, current: string, configured = '', development = false): URL {
  const from = new URL(current), target = new URL(configured || `/${role}/`, from);
  const loopback = (url: URL) => url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (target.username || target.password || !['http:', 'https:'].includes(target.protocol) || (target.origin !== from.origin && !(development && loopback(from) && loopback(target)))) throw new Error('Role switching needs a same-origin workspace URL.');
  target.search = ''; target.hash = '';
  return target;
}
export function roleLink(target: URL, role: WorkspaceRole, data: Demo, collapsed: boolean, theme: string | null) {
  const url = new URL(target);
  url.searchParams.set('candidateId', data.candidate.id);
  url.searchParams.set(arrivalKey, role);
  url.searchParams.set('_ebTheme', theme === 'light' ? 'light' : 'dark');
  url.searchParams.set('_ebSidebar', collapsed ? 'collapsed' : 'expanded');
  url.hash = role === 'candidate' ? (data.task.status === 'draft' ? 'application' : 'tasks') : (data.currentSubmissionVersion ? 'tasks' : 'evidence');
  return url.href;
}
type View = { page?: string; scroll?: number; criterion?: string; stage?: string; section?: string };
function viewKey(data: Demo, part: string) {
  // Presentation only: never transfer drafts, notes, evidence, marks or saved request bodies.
  return ['evidencebridge.role-view.v1', import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787', data.schemaVersion, data.sessionId, data.fixtureVersion, data.jdVersion, data.rubricVersion, data.datasetVersion, data.candidate.id, data.task.taskId, part].join('.');
}
export function readRoleView(data: Demo, part: string): View {
  try {
    const value = JSON.parse(sessionStorage.getItem(viewKey(data, part)) || '{}');
    if (!value || typeof value !== 'object') return {};
    return {
      page: typeof value.page === 'string' ? value.page : undefined,
      scroll: Number.isFinite(value.scroll) ? Math.max(0, Math.min(value.scroll, 100000)) : 0,
      criterion: /^(S[1-3]|D[1-3]|B[1-4])$/.test(value.criterion) ? value.criterion : undefined,
      stage: ['application_review', 'task_v1', 'task_v2'].includes(value.stage) ? value.stage : undefined,
      section: ['assessment', 'materials', 'history'].includes(value.section) ? value.section : undefined,
    };
  } catch { return {}; }
}
export function saveRoleView(data: Demo, part: string, view: View) {
  try { sessionStorage.setItem(viewKey(data, part), JSON.stringify(view)); } catch { /* Navigation remains available without optional memory. */ }
}
export function storedRoleTheme() { return readPreference(themeKey); }
