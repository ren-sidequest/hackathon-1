import React, { useState, type CSSProperties } from 'react';
import type { Demo } from '../api4-types';
import { Dialog, Heading } from '../api-ui';
import { JobRequirements } from './materials';

import building from './icons/building-2.svg';
import briefcase from './icons/briefcase-business.svg';
import database from './icons/database.svg';
import chart from './icons/chart-no-axes-column-increasing.svg';
import bulb from './icons/lightbulb.svg';
function Symbol({src}:{src:string}) { return <span className="uw-symbol" aria-hidden="true"><span style={{'--symbol':`url("${src}")`} as CSSProperties}/></span>; }

export function CompanyWorkspace({data,base,compare,inspect}:{data:Demo;base:string;compare:()=>void;inspect:(id?:string)=>void}) {
  const [jd,setJD]=useState(false);
  return <section className="uw-company">
    <Heading eyebrow="A concrete SME · Synthetic company" title="Company & role"/>
    <section className="eb-panel uw-company-summary" aria-label="Role overview">
      <div className="uw-company-identity"><Symbol src={building}/><div><h2>{data.company.name}</h2><small>Synthetic company</small><p>{data.company.businessDescription}</p></div></div>
      <div className="uw-company-identity"><Symbol src={briefcase}/><div><h2>{data.job.title}</h2><p>{data.company.location} · {data.job.employmentType} · {data.job.experienceLevel}</p></div></div>
      <button className="eb-action primary" onClick={compare}>View candidates →</button>
    </section>
    <div className="uw-company-grid">
      <section className="eb-panel"><h2>Evidence this role needs</h2>
        <div className="uw-requirement-head"><span>Skill</span><span>Observable work</span><span>Expected material</span><span>Standards</span></div><div className="uw-requirement-table">{data.rubric.requirements.map((r,i)=><article key={r.id}>
          <div className="uw-skill-title"><Symbol src={[database,chart,bulb][i]}/><h3>{r.title}</h3></div><div><strong>{['Check the numbers','Explain the change','Recommend an action'][i]}</strong><p>{r.statement}</p></div>
          <div><strong>{["Query & checks","Calculations & analysis","Decision & validation"][i]}</strong></div><div className="uw-standard-links">{data.rubric.criteria.filter(c=>c.requirementId===r.id).map(c=><button className="eb-action" key={c.id} title={c.title} aria-label={`${c.id} · ${c.maxScore} points · open rubric`} onClick={()=>inspect(c.id)}>{c.id}<small>{c.maxScore}</small></button>)}</div>
        </article>)}</div>
        <details><summary>Role context & limits</summary><p>{data.company.profileScope}</p>{data.job.successStages.map(stage=><p key={stage}>{stage}</p>)}<p>{data.job.collaboratingTeams.join(' · ')}</p></details>
      </section>
      <aside className="eb-panel uw-rules"><h2>How assessment works</h2><p>Fixed assessment weights · not candidate scores.</p>
        <div className="uw-weight-bar" aria-label="Ten equal-weight assessment standards">{data.rubric.requirements.map(r=><span key={r.id} style={{flex:r.maxScore}}><strong>{r.maxScore}%</strong><small>{r.title}</small></span>)}</div>
        <p>Criterion contribution = Mark ÷ 4 × 10</p>
        <dl className="uw-mark-key">{data.rubric.marks.map(m=><div key={m.mark}><dt data-local-raw>{m.mark}</dt><dd>{m.meaning}</dd></div>)}</dl>
        <small>Not assessed means no judgment yet, and is distinct from NE and 0.</small>
        <div className="eb-actions"><button className="eb-action" onClick={()=>setJD(true)}>Review full JD · {data.job.jd.requirements.length} requirements</button><button className="eb-action" onClick={()=>inspect()}>Read the rubric</button></div>
      </aside>
    </div>
    {jd && <Dialog title="Full job requirements" close={()=>setJD(false)}><JobRequirements data={data} base={base}/></Dialog>}
  </section>;
}
