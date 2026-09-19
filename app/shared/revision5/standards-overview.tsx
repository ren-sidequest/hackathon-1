import React, { useEffect, useRef, useState } from 'react';
import { SpotlightCard } from '../gold-interactions';
import { Rubric } from './assessment-ui';
import { criteria } from './fixtures';
import { skillName, skills, type Skill } from './model';

function SkillIcon({ skill }: { skill: Skill }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {skill === 'SQL' ? <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></> : skill === 'DA' ? <><path d="M4 3v17h17M8 16v-4m5 4V8m5 8V4"/></> : <><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h4m-2-3 3 3-3 2"/></>}
  </svg>;
}

/** Fixed rubric composition only. Never represents an individual candidate's results. */
export function StandardsOverview({ compare }: { compare: () => void }) {
  const [active, setActive] = useState<Skill | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (!selected) trigger.current?.focus({ preventScroll: true }); }, [selected]);
  return <section className="eb-panel r5-standards-overview" aria-labelledby="standards-overview-title">
    <div className="eb-heading"><div><small className="eyebrow">ONE ROLE · ONE SHARED RUBRIC</small><h2 id="standards-overview-title">One shared standard, ten reviewable judgments</h2></div><span className="r5-state">{criteria.length * 10} points total</span></div>
    <p className="eb-muted">Fixed assessment weights · not candidate scores. Select a standard to read its evidence requirements.</p>
    <nav className="r5-weight-track" aria-label="Ten equal-weight assessment standards" onMouseLeave={() => setActive(null)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(null); }}>
      {criteria.map(c => <button key={c.id} type="button" className={`r5-weight-cell r5-skill-${c.skill}`} data-active={active === c.skill} aria-label={`${c.id} · ${c.title} · 10 points`} onMouseEnter={() => setActive(c.skill)} onFocus={() => setActive(c.skill)} onClick={event => { trigger.current = event.currentTarget; setSelected(c.id); }}><span>{c.id}</span><small>10</small></button>)}
    </nav>
    <div className="r5-skill-cards">{skills.map(skill => {
      const group = criteria.filter(c => c.skill === skill);
      return <SpotlightCard key={skill} className={`r5-skill-card r5-skill-${skill}`} aria-label={`${skillName[skill]} assessment standards`} onMouseEnter={() => setActive(skill)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(skill)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(null); }}>
        <header><span className="r5-skill-icon"><SkillIcon skill={skill}/></span><strong className="r5-skill-weight">{group.length * 10}<small>%</small></strong></header>
        <h3>{skillName[skill]}</h3><p>{group.length} standards · 10 points each</p>
        <ul>{group.map(c => <li key={c.id}><button type="button" onClick={event => { trigger.current = event.currentTarget; setSelected(c.id); }}><span>{c.id}</span><span>{c.title}</span><span aria-hidden="true">↗</span></button></li>)}</ul>
      </SpotlightCard>;
    })}</div>
    <footer className="r5-standards-footer"><div><ul className="r5-role-constraints" aria-label="Shared role constraints"><li>Small team</li><li>Incomplete information</li><li>Evidence before ad spend</li></ul><small>Same requirements for every candidate.</small></div><button className="eb-action primary" onClick={compare}>Compare four candidates</button></footer>
    {selected && <Rubric initialCriterion={selected} close={() => setSelected(null)}/>}
  </section>;
}
