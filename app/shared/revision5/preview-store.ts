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
export function usePreview() {
  const [initial] = useState(() => {
    try { const raw=localStorage.getItem(previewStorageKey); if(raw){const parsed=JSON.parse(raw);if(validState(parsed))return {state:parsed,error:''};return {state:initialPreview(),error:'Invalid preview data. A fresh UI fixture has been loaded; no API case was changed.'};} }
    catch {return {state:initialPreview(),error:'Preview storage is unavailable or unreadable. Editing is kept in this tab; saving may fail.'};}
    return {state:initialPreview(),error:''};
  });
  const [state,setState]=useState(initial.state), ref=useRef(state);
  const [error,setError]=useState(initial.error), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const accept=(s:PreviewState)=>{ref.current=s;setState(s);};
  useEffect(()=>{
    try {if(!localStorage.getItem(previewStorageKey))localStorage.setItem(previewStorageKey,JSON.stringify(ref.current));}catch{/* Warning already shown or surfaced on first save. */}
    const sync=(e:StorageEvent)=>{if(e.key!==previewStorageKey)return;try{const incoming=JSON.parse(e.newValue??'null');if(validState(incoming))accept(incoming);else setError('Preview state changed outside this tab. Reload before saving.');}catch{setError('Invalid preview state. Reload before saving.');}};
    window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
  },[]);
  const readLatest=()=>{const raw=localStorage.getItem(previewStorageKey);const saved=raw?JSON.parse(raw):ref.current;if(!validState(saved))throw new Error('Invalid preview storage. Reload before saving.');return saved;};
  const draft=(id:string,change:(draft:WorkDraft)=>WorkDraft)=>{
    const task=ref.current.tasks[id], version=nextVersion(task);if(!task||!version||busyRef.current)return;
    const key=draftKey(ref.current,id,task,version);
    const updated={...ref.current,workDrafts:{...ref.current.workDrafts,[key]:change(ref.current.workDrafts[key]??emptyDraft())}};
    accept(updated);
    try{localStorage.setItem(previewStorageKey,JSON.stringify(updated));}catch{setError('Draft is in this tab only: browser storage is unavailable. Keep the tab open.');}
  };
  const run=async(change:(s:PreviewState)=>PreviewState,message:string)=>{
    if(busyRef.current)return false;
    const expected=ref.current;busyRef.current=true;setBusy(true);setError('');setNotice('');
    try {
      // A short async boundary exercises candidate switching and real disabled/loading states.
      await new Promise(resolve=>setTimeout(resolve,180));
      const latest=readLatest();
      if(latest.sessionId!==expected.sessionId||latest.revision!==expected.revision){accept(latest);throw new Error('Preview changed in another tab. Inputs are kept; check the current version and retry.');}
      const updated={...change(latest),revision:latest.revision+1};
      localStorage.setItem(previewStorageKey,JSON.stringify(updated));accept(updated);setNotice(message);return true;
    } catch(e){setError(e instanceof Error?e.message:'Preview save failed. Your input is kept.');return false;}
    finally {busyRef.current=false;setBusy(false);}
  };
  return {state,error,notice,busy,draft,run,rubricVersion};
}
export type PreviewController = ReturnType<typeof usePreview>;
