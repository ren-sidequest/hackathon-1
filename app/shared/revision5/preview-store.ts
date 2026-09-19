// Local preview interactions, deliberately isolated from API 2.0 and future server DTOs.
import { useEffect, useRef, useState } from 'react';
import { emptyDraft, publicWork } from '../api';
import { profiles } from './fixtures';
import { previewSubmissionIssues } from './work-validation';
import { assessmentKey, currentBasis, draftKey, nextVersion, rubricVersion, type AssessmentDraft, type PreviewState, type Profile, type Review, type Skill, type WorkDraft } from './model';

export const previewStorageKey = 'evidencebridge.revision5.ui-preview.v1';
export function initialPreview(): PreviewState {
  return {format:'revision5-ui-v1',sessionId:crypto.randomUUID(),revision:0,tasks:Object.fromEntries(profiles.map(p=>[p.id,null])),shortlist:Object.fromEntries(profiles.map(p=>[p.id,null])),assessmentDrafts:{},workDrafts:{}};
}
export function validState(value: unknown): value is PreviewState {
  if (!value || typeof value !== 'object') return false;
  const s = value as PreviewState;
  const record = (v: unknown) => Boolean(v && typeof v === 'object' && !Array.isArray(v));
  if (s.format !== 'revision5-ui-v1' || typeof s.sessionId !== 'string' || !Number.isInteger(s.revision) || s.revision < 0 || ![s.tasks,s.shortlist,s.assessmentDrafts,s.workDrafts].every(record)) return false;
  try {
    return profiles.every(p => Object.hasOwn(s.tasks,p.id) && Object.hasOwn(s.shortlist,p.id) && (!s.tasks[p.id] || (typeof s.tasks[p.id]!.id === 'string' && ['sent','submitted','awaiting_revision','closed'].includes(s.tasks[p.id]!.status) && Array.isArray(s.tasks[p.id]!.versions) && s.tasks[p.id]!.versions.length <= 2 && ['SQL','DA','BPS'].includes(s.tasks[p.id]!.skill) && s.tasks[p.id]!.versions.every(v => v.candidateId === p.id && typeof v.summary === 'string' && Array.isArray(v.findings) && Array.isArray(v.processEvidence)))))
      && Object.values(s.workDrafts).every(d => d && typeof d.summary === 'string' && typeof d.notes === 'string' && typeof d.started === 'boolean' && Array.isArray(d.findings) && Array.isArray(d.events))
      && Object.values(s.shortlist).every(r => r === null || (r && typeof r.retained === 'boolean' && typeof r.reason === 'string' && record(r.basis)))
      && Object.values(s.assessmentDrafts).every(d => d && profiles.some(p => p.id === d.candidateId) && Array.isArray(d.entries) && d.entries.length > 0 && d.entries.every(e => e && ['S1','S2','S3','D1','D2','D3','B1','B2','B3','B4'].includes(e.criterionId) && [null,0,1,2,3,4,'NE'].includes(e.mark) && [e.reason,e.scope,e.gap].every(t => typeof t === 'string')));
  } catch { return false; }
}
export function sendTask(state: PreviewState, profile: Profile, skill: Skill, instructions: string, reason: string): PreviewState {
  if (state.tasks[profile.id]) throw new Error('One task is already assigned to this candidate. Its target stays fixed.');
  if (!instructions.trim() || instructions.length > 4000 || !reason.trim()) throw new Error('Add a task reason and 1–4,000 characters of instructions.');
  return {...state,tasks:{...state.tasks,[profile.id]:{id:crypto.randomUUID(),skill,instructions,reason,status:'sent',versions:[]}}};
}
export function submitWork(state: PreviewState, profile: Profile, draft: WorkDraft): PreviewState {
  const task=state.tasks[profile.id], version=nextVersion(task);
  if (!task || !version) throw new Error('This candidate cannot submit another version.');
  const issues = previewSubmissionIssues(profile,task,draft);
  if (issues.length) throw new Error(issues.join(' '));
  const work={id:crypto.randomUUID(),version,candidateId:profile.id,taskId:task.id,snapshotId:crypto.randomUUID(),...publicWork(draft),submittedAt:new Date().toISOString(),review:null};
  return {...state,tasks:{...state.tasks,[profile.id]:{...task,status:'submitted',versions:[...task.versions,work]}}};
}
export function reviewWork(state: PreviewState, profile: Profile, versionId: string, decision: Review['decision'], comment: string): PreviewState {
  const task=state.tasks[profile.id], work=task?.versions.at(-1);
  if (!task || !work || work.id !== versionId || work.review || task.status !== 'submitted') throw new Error('Only the current unreviewed submission can be reviewed.');
  if (work.version === 2 && decision === 'needs_more_evidence') throw new Error('V2 is the final version.');
  if (!comment.trim() || comment.length > 2000) throw new Error('Add a public reason of 1–2,000 characters.');
  return {...state,tasks:{...state.tasks,[profile.id]:{...task,status:decision==='needs_more_evidence'?'awaiting_revision':'closed',versions:task.versions.map(v=>v.id===versionId?{...v,review:{decision,comment,at:new Date().toISOString()}}:v)}}};
}
export function retainCandidate(state: PreviewState, profile: Profile, retained: boolean, reason: string): PreviewState {
  if (!reason.trim() || reason.length > 2000) throw new Error('Add a shortlist reason of 1–2,000 characters.');
  return {...state,shortlist:{...state.shortlist,[profile.id]:{retained,reason,basis:currentBasis(profile,state.tasks[profile.id]),at:new Date().toISOString()}}};
}
export function saveAssessmentDraft(state: PreviewState, draft: AssessmentDraft): PreviewState {
  // Do not compute or publish scores in the frontend. Comparison remains on its reviewed fixture.
  return {...state,assessmentDrafts:{...state.assessmentDrafts,[assessmentKey(draft.candidateId,draft.stage)]:draft}};
}
// Drafts have their own session/person/task/version keys. A keystroke must never
// serialize an old copy of tasks, assessments or shortlist decisions.
export const previewDraftPrefix = `${previewStorageKey}.draft.`;
type PreviewStorage = Pick<Storage, 'getItem' | 'setItem'>;
function validDraft(d: unknown): d is WorkDraft {
  if (!d || typeof d !== 'object') return false;
  const value = d as WorkDraft;
  return typeof value.summary === 'string' && typeof value.notes === 'string' && typeof value.started === 'boolean' && Array.isArray(value.findings) && Array.isArray(value.events);
}
export function readPreview(storage: PreviewStorage, fallback: PreviewState): PreviewState {
  const raw = storage.getItem(previewStorageKey);
  const saved: unknown = raw ? JSON.parse(raw) : fallback;
  if (!validState(saved)) throw new Error('Invalid preview storage. Reload before saving.');
  const workDrafts = {...saved.workDrafts};
  for (const [id, task] of Object.entries(saved.tasks)) {
    if (!task) continue;
    for (const version of [1, 2]) {
      const key = draftKey(saved, id, task, version);
      const draft = storage.getItem(`${previewDraftPrefix}${key}`);
      if (draft) {
        const value: unknown = JSON.parse(draft);
        if (!validDraft(value)) throw new Error('Invalid preview draft. Keep your input and reload before saving.');
        workDrafts[key] = value;
      }
    }
  }
  return {...saved, workDrafts};
}
export function writePreviewBusiness(storage: PreviewStorage, state: PreviewState) {
  // One-time migration of old embedded drafts; an existing separate draft wins.
  for (const [key, draft] of Object.entries(state.workDrafts)) {
    const storageKey = `${previewDraftPrefix}${key}`;
    if (!storage.getItem(storageKey)) storage.setItem(storageKey, JSON.stringify(draft));
  }
  storage.setItem(previewStorageKey, JSON.stringify({...state, workDrafts:{}}));
}
export function changePreviewDraft(storage: PreviewStorage, expected: PreviewState, id: string, change: (draft: WorkDraft) => WorkDraft): PreviewState {
  const latest = readPreview(storage, expected);
  const task = latest.tasks[id], version = nextVersion(task);
  const expectedTask = expected.tasks[id];
  if (latest.sessionId !== expected.sessionId || task?.id !== expectedTask?.id || version !== nextVersion(expectedTask)) {
    throw new Error('Preview task changed in another tab. Refresh the current task before editing.');
  }
  if (!task || !version) return latest;
  const key = draftKey(latest, id, task, version);
  const changed = change(latest.workDrafts[key] ?? emptyDraft());
  storage.setItem(`${previewDraftPrefix}${key}`, JSON.stringify(changed));
  return {...latest, workDrafts:{...latest.workDrafts, [key]:changed}};
}
export function usePreview() {
  const [initial] = useState(() => {
    try { return {state:readPreview(localStorage, initialPreview()),error:''}; }
    catch {return {state:initialPreview(),error:'Preview storage is unavailable or unreadable. Editing is kept in this tab; saving may fail.'};}
  });
  const [state,setState]=useState(initial.state), ref=useRef(state);
  const [error,setError]=useState(initial.error), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const accept=(s:PreviewState)=>{ref.current=s;setState(s);};
  useEffect(()=>{
    try {if(!localStorage.getItem(previewStorageKey))writePreviewBusiness(localStorage,ref.current);}catch{/* Warning surfaced on first save. */}
    const sync=(e:StorageEvent)=>{
      if(e.key!==previewStorageKey && !e.key?.startsWith(previewDraftPrefix))return;
      try {
        // Read the current value, not a delayed event payload from an older revision.
        const incoming=readPreview(localStorage,ref.current);
        if(incoming.sessionId===ref.current.sessionId && incoming.revision<ref.current.revision)return;
        accept(incoming);
      } catch {setError('Invalid preview state. Reload before saving.');}
    };
    window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
  },[]);
  const readLatest=()=>readPreview(localStorage,ref.current);
  const draft=(id:string,change:(draft:WorkDraft)=>WorkDraft)=>{
    const expected=ref.current, task=expected.tasks[id], version=nextVersion(task);if(!task||!version||busyRef.current)return;
    try {accept(changePreviewDraft(localStorage,expected,id,change));}
    catch(e){
      // Keep an unsaved edit in memory when browser storage fails; do not publish it
      // over a different session/task or an already submitted version.
      let latest:PreviewState;
      try {latest=readLatest();} catch {latest=expected;}
      if(latest.sessionId===expected.sessionId && latest.tasks[id]?.id===task.id && nextVersion(latest.tasks[id])===version){
        const key=draftKey(latest,id,task,version);
        accept({...latest,workDrafts:{...latest.workDrafts,[key]:change(expected.workDrafts[key]??emptyDraft())}});
      } else accept(latest);
      setError(e instanceof Error?e.message:'Draft is in this tab only: browser storage is unavailable. Keep the tab open.');
    }
  };
  const run=async(change:(s:PreviewState)=>PreviewState,message:string)=>{
    if(busyRef.current)return false;
    const expected=ref.current;busyRef.current=true;setBusy(true);setError('');setNotice('');
    try {
      await new Promise(resolve=>setTimeout(resolve,180));
      const latest=readLatest();
      if(latest.sessionId!==expected.sessionId||latest.revision!==expected.revision){accept(latest);throw new Error('Preview changed in another tab. Inputs are kept; check the current version and retry.');}
      const updated={...change(latest),revision:latest.revision+1};
      writePreviewBusiness(localStorage,updated);accept(updated);setNotice(message);return true;
    } catch(e){setError(e instanceof Error?e.message:'Preview save failed. Your input is kept.');return false;}
    finally {busyRef.current=false;setBusy(false);}
  };
  return {state,error,notice,busy,draft,run,rubricVersion};
}
export type PreviewController = ReturnType<typeof usePreview>;
