import { demoFindings, sections, type Finding } from './data';
export type Stage = 'application' | 'received' | 'working' | 'submitted' | 'reviewed';
export type Review = 'confirmed' | 'more' | 'insufficient' | null;
export type Material = { name: string; size: number };
export type Event = { id: string; at: string; title: string; detail?: string };
export type State = {
  version: 1; stage: Stage; resume: Material | null; project: Material | null;
  findings: Finding[]; events: Event[]; summary: string; notes: string;
  savedAt: string | null; submittedAt: string | null; review: Review;
};
export const storageKey = 'evidencebridge.candidate.demo.v1';
export const initialState: State = { version: 1, stage: 'application', resume: null, project: null, findings: [], events: [], summary: '', notes: '', savedAt: null, submittedAt: null, review: null };
type Base = { at: string; id: string };
export type Action =
  | { type: 'MATERIAL'; kind: 'resume' | 'project'; material: Material | null }
  | { type: 'LOAD_APPLICATION' }
  | ({ type: 'APPLY' | 'START' | 'SAVE' | 'SUBMIT' | 'LOAD_FINDINGS' } & Base)
  | ({ type: 'UPSERT'; finding: Finding } & Base)
  | ({ type: 'DELETE'; findingId: string } & Base)
  | ({ type: 'EVENT'; title: string; detail?: string } & Base)
  | ({ type: 'REVIEW'; review: Exclude<Review, null> } & Base)
  | { type: 'SUMMARY' | 'NOTES'; value: string }
  | { type: 'RESET' };
const editable = (state: State) => state.stage === 'working';
const event = (state: State, a: Base, title: string, detail?: string): Event[] => [...state.events, { id: a.id, at: a.at, title, detail }].slice(-100);
export function submissionIssues(state: State): string[] {
  const issues = sections.filter(section => !state.findings.some(f => f.section === section && f.title.trim())).map(s => `Add at least one card to ${s}.`);
  if (!state.summary.trim()) issues.push('Add an executive summary.');
  return issues;
}
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET': return { ...initialState };
    case 'MATERIAL': return state.stage === 'application' ? { ...state, [action.kind]: action.material } : state;
    case 'LOAD_APPLICATION': return state.stage === 'application' ? { ...state, resume: { name: 'Alex_Chen_Resume.pdf', size: 245760 }, project: { name: 'Retail_Analysis_Project.pdf', size: 1258291 } } : state;
    case 'APPLY': return state.stage === 'application' && state.resume ? { ...state, stage: 'received', events: event(state, action, 'Application submitted', 'A targeted task is available in this demo.') } : state;
    case 'START': return state.stage === 'received' ? { ...state, stage: 'working', events: event(state, action, 'Started the task', 'Conversion Drop Investigation') } : state;
    case 'UPSERT': {
      if (!editable(state) || !action.finding.title.trim()) return state;
      const exists = state.findings.some(f => f.id === action.finding.id);
      return { ...state, findings: exists ? state.findings.map(f => f.id === action.finding.id ? action.finding : f) : [...state.findings, action.finding], events: event(state, action, `${exists ? 'Updated' : 'Added'} ${action.finding.section.toLowerCase()} card`, action.finding.title) };
    }
    case 'DELETE': return editable(state) ? { ...state, findings: state.findings.filter(f => f.id !== action.findingId), events: event(state, action, 'Removed an investigation card') } : state;
    case 'SUMMARY': return editable(state) ? { ...state, summary: action.value } : state;
    case 'NOTES': return editable(state) ? { ...state, notes: action.value } : state;
    case 'SAVE': return editable(state) ? { ...state, savedAt: action.at, events: event(state, action, 'Saved draft') } : state;
    case 'LOAD_FINDINGS': return editable(state) ? { ...state, findings: demoFindings.map(f => ({ ...f })), summary: 'The conversion decline is concentrated in Paid Search, where a rise in traffic coincides with lower conversion. Mobile landing-page performance is a second plausible contributor. These observations do not establish causality. Compare campaign cohorts and validate the mobile funnel before increasing ad spend.', events: event(state, action, 'Loaded example investigation', 'Demo content loaded explicitly; these are not recorded candidate actions.') } : state;
    case 'EVENT': return state.stage === 'working' ? { ...state, events: event(state, action, action.title, action.detail) } : state;
    case 'SUBMIT': return editable(state) && submissionIssues(state).length === 0 ? { ...state, stage: 'submitted', submittedAt: action.at, review: null, events: event(state, action, 'Submitted work sample', 'Final work sample and process evidence shared for review.') } : state;
    case 'REVIEW': return state.stage === 'submitted' ? { ...state, stage: action.review === 'more' ? 'working' : 'reviewed', review: action.review, events: event(state, action, action.review === 'confirmed' ? 'Review complete — evidence confirmed' : action.review === 'more' ? 'More evidence requested — draft reopened' : 'Review complete — evidence still insufficient', 'Simulated HR response for the local demonstration.') } : state;
  }
}
export function restore(raw: string | null): State {
  if (!raw) return { ...initialState };
  try {
    const s = JSON.parse(raw) as State;
    const material = (m: Material | null) => m === null || (typeof m?.name === 'string' && typeof m?.size === 'number' && Number.isFinite(m.size) && m.size >= 0);
    if (s.version !== 1 || !['application','received','working','submitted','reviewed'].includes(s.stage) || !material(s.resume) || !material(s.project) || typeof s.summary !== 'string' || typeof s.notes !== 'string' || ![null,'confirmed','more','insufficient'].includes(s.review)) throw new Error();
    if (![s.savedAt,s.submittedAt].every(v => v === null || (typeof v === 'string' && Number.isFinite(Date.parse(v))))) throw new Error();
    if (!Array.isArray(s.findings) || !s.findings.every(f => typeof f.id === 'string' && sections.includes(f.section) && [f.title,f.detail,f.source].every(v => typeof v === 'string') && ['High','Medium','Low'].includes(f.confidence))) throw new Error();
    if (!Array.isArray(s.events) || !s.events.every(e => typeof e.id === 'string' && typeof e.title === 'string' && typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) && (e.detail === undefined || typeof e.detail === 'string'))) throw new Error();
    return s;
  } catch { return { ...initialState }; }
}
export function stamp(): Base { return { at: new Date().toISOString(), id: crypto.randomUUID() }; }
