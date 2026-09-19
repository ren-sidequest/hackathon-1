import React, { useEffect, useState } from 'react';
import { Sidebar, useSidebar } from '../ui';
import { Dialog } from '../api-ui';
import { GlideSelect } from '../glide-select';
import { profiles } from './fixtures';
import { usePreview } from './preview-store';
import { HRPreview } from './hr-preview';
import { CandidatePreview } from './candidate-preview';
import './revision5.css';

const hrPages=[['company','Company & role'],['comparison','Compare candidates'],['evidence','Evidence & marks'],['tasks','Targeted tasks'],['shortlist','Retained candidates']];
const candidatePages=[['application','My materials'],['tasks','My task'],['workspace','Investigation'],['history','Work & feedback']];
function NavIcon({index}:{index:number}) {
  const paths=['M4 21V5l8-3 8 3v16M8 9h2m4 0h2M8 13h2m4 0h2M10 21v-4h4v4','M4 19V9m8 10V4m8 15v-7','M7 4h10v16H7zM10 8h4m-4 4h4m-4 4h2','M4 6h16M4 12h16M4 18h10','m5 12 4 4L19 6'];
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[index%paths.length]}/></svg>;
}
export default function Revision5App({role:initialRole}:{role:'hr'|'candidate'}) {
  const [role,setRole]=useState(initialRole), [page,setPage]=useState(initialRole==='hr'?'comparison':'application');
  const [candidateId,setCandidateId]=useState(profiles[0].id), [help,setHelp]=useState(false);
  const controller=usePreview(), sidebar=useSidebar(role);
  const [dismissedNotice,setDismissedNotice]=useState('');
  const profile=profiles.find(p=>p.id===candidateId)!;
  useEffect(()=>{document.documentElement.dataset.role=role;},[role]);
  const pages=role==='hr'?hrPages:candidatePages;
  const go=(id:string)=>{setDismissedNotice(controller.notice);setPage(pages.some(p=>p[0]===id)?id:role==='hr'?'comparison':'application');sidebar.closeMobile();window.scrollTo(0,0);};
  const select=(id:string,target?:string)=>{setCandidateId(id);if(target)go(target);};
  const switchRole=(next:'hr'|'candidate')=>{setDismissedNotice(controller.notice);setRole(next);setPage(next==='hr'?'comparison':'tasks');};
  return <div className="eb-connected r5-app">
    <a href="#r5-main" className="eb-skip eb-action" onClick={e=>{e.preventDefault();document.getElementById('r5-main')?.focus();}}>Skip to content</a>
    <Sidebar role={role} controller={sidebar} activePage={page} items={pages.map(([id,label],index)=>({id,label,icon:<NavIcon index={index}/>}))} onNavigate={go} user={{initials:role==='hr'?'HR':profile.initials,name:role==='hr'?'Operations lead':profile.name,title:role==='hr'?'HarbourCart': 'Synthetic candidate'}} helpLabel="Preview guide" onHelp={()=>setHelp(true)}/>
    <div className="eb-main" data-eb-content>
      <header className="eb-api-topbar">{sidebar.menuButton}<span>{role==='hr'?'Hiring workspace':'Candidate workspace'} / {pages.find(p=>p[0]===page)?.[1]}</span><span className="r5-mode">Revision 5 · UI preview</span></header>
      <main id="r5-main" tabIndex={-1} className="eb-content">
        <section className="r5-preview-banner" aria-label="Preview status"><div><strong>Frontend mock · synthetic materials and illustrative marks</strong><details><summary>Local preview scope</summary><p>No new backend connection, model call or saved hiring decision. Changes stay in this browser origin. The API 2.0 build remains separate.</p></details></div><label>Preview role<GlideSelect ariaLabel="Preview role" value={role} onChange={value=>switchRole(value as typeof role)} options={[{value:'hr',label:'HR'},{value:'candidate',label:'Candidate'}]}/></label></section>
        {controller.error&&<p role="alert" className="eb-feedback">{controller.error}</p>}
        {controller.notice&&controller.notice!==dismissedNotice&&<p role="status" className="r5-notice">{controller.notice} <button className="eb-action" aria-label="Dismiss notice" onClick={()=>setDismissedNotice(controller.notice)}>×</button></p>}
        {(role==='candidate'||['evidence','tasks'].includes(page))&&<div className="r5-person-bar"><span className="r5-avatar">{profile.initials}</span><div><strong>{profile.name}</strong><small>{profile.subtitle}</small></div><label>Demo identity<GlideSelect ariaLabel="Current candidate" value={candidateId} onChange={value=>select(value)} options={profiles.map(p=>({value:p.id,label:p.name}))}/></label></div>}
        {role==='hr'?<HRPreview key={candidateId} profile={profile} page={page} go={go} select={select} controller={controller}/>:<CandidatePreview key={`${candidateId}.${controller.state.sessionId}`} profile={profile} page={page} go={go} controller={controller}/>}
        <footer className="eb-footer">EvidenceBridge · Reviewable evidence. Human decisions. · Preview identities are not accounts.</footer>
      </main>
    </div>
    {help&&<Dialog title="Revision 5 frontend preview" close={()=>setHelp(false)}><p>Start with Company & role, inspect the ten standards, then compare four illustrative application assessments. Open a criterion to see its original passage and anchored reasoning.</p><p>Marks edited here are local drafts, excluded from comparison until the future backend saves and calculates a reviewed assessment. Shortlist changes and task workflows are local mock interactions.</p><p>Use Preview role to explore both sides of this same browser fixture. Different ports have separate preview stores. The connected API 2.0 mode remains the real single-case integration.</p><p>All four candidates have the same controls. SQL is static review; supplied resources are not proof of personal ability.</p></Dialog>}
  </div>;
}
