import React, { useEffect, useRef, useState } from 'react';
import { SpotlightCard, StarBorder } from '../gold-interactions';
import type { CandidateId, Comparison, Demo, RequirementId } from '../api3-types';
import { Rubric } from './assessment';

export const skillClass: Record<RequirementId, string> = { sql: 'SQL', 'data-analysis': 'DA', 'business-problem-solving': 'BPS' };
function SkillIcon({ skill }: { skill: RequirementId }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {skill === 'sql' ? <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></> : skill === 'data-analysis' ? <><path d="M4 3v17h17M8 16v-4m5 4V8m5 8V4"/></> : <><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h4m-2-3 3 3-3 2"/></>}
  </svg>;
}

/** The API rubric is the only source for requirements, weights and criteria. */
export function StandardsOverview({ data, compare }: { data: Demo; compare: () => void }) {
  const [active, setActive] = useState<RequirementId | null>(null), [selected, setSelected] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (!selected) trigger.current?.focus({ preventScroll: true }); }, [selected]);
  return <section className="eb-panel r5-standards-overview" aria-labelledby="standards-overview-title">
    <div className="eb-heading"><div><small className="eyebrow">ONE ROLE · ONE SHARED RUBRIC</small><h2 id="standards-overview-title">One shared standard, ten reviewable judgments</h2></div><span className="r5-state">{data.rubric.rules.maxScore} points total</span></div>
    <p className="eb-muted">Fixed assessment weights · not candidate scores. Select a standard to read its evidence requirements.</p>
    <nav className="r5-weight-track" aria-label="Ten equal-weight assessment standards" onMouseLeave={() => setActive(null)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setActive(null); }}>
      {data.rubric.criteria.map(c => <button key={c.id} type="button" className={`r5-weight-cell r5-skill-${skillClass[c.requirementId]}`} data-active={active === c.requirementId} aria-label={`${c.id} · ${c.title} · ${c.maxScore} points`} onMouseEnter={() => setActive(c.requirementId)} onFocus={() => setActive(c.requirementId)} onClick={e => { trigger.current = e.currentTarget; setSelected(c.id); }}><span>{c.id}</span><small>{c.maxScore}</small></button>)}
    </nav>
    <div className="r5-skill-cards">{data.rubric.requirements.map(r => {
      const group = data.rubric.criteria.filter(c => c.requirementId === r.id);
      return <SpotlightCard key={r.id} className={`r5-skill-card r5-skill-${skillClass[r.id]}`} aria-label={`${r.title} assessment standards`} onMouseEnter={() => setActive(r.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(r.id)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setActive(null); }}>
        <header><span className="r5-skill-icon"><SkillIcon skill={r.id}/></span><strong className="r5-skill-weight">{r.maxScore / data.rubric.rules.maxScore * 100}<small>%</small></strong></header>
        <h3>{r.title}</h3><p>{group.length} standards · {r.maxScore} points total</p><ul>{group.map(c => <li key={c.id}><button type="button" onClick={e => { trigger.current = e.currentTarget; setSelected(c.id); }}><span>{c.id}</span><span>{c.title}</span><span aria-hidden="true">↗</span></button></li>)}</ul>
      </SpotlightCard>;
    })}</div>
    <footer className="r5-standards-footer"><div><ul className="r5-role-constraints" aria-label="Shared role constraints">{data.company.constraints.map(c => <li key={c}>{c}</li>)}</ul><small>{data.company.businessProblem}</small></div><button className="eb-action primary" onClick={compare}>Compare four candidates</button></footer>
    {selected && <Rubric data={data} initialCriterion={selected} close={() => setSelected(null)}/>}
  </section>;
}

/** Counts and reminders are derived from server comparison data, never preview fixtures. */
export function ReviewDashboard({ comparison, select }: { comparison: Comparison; select: (id: CandidateId, page?: string) => void }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const rows = comparison.candidates;
  const queue = rows.flatMap(row => {
    const pending = row.task.status === 'submitted';
    if (!pending && row.assessment?.score.coveragePercent === 100) return [];
    return [{ row, id: `${row.candidate.id}.${row.task.taskId}.${row.task.status}.${row.assessment?.assessmentRevision ?? 0}`, title: pending ? 'Review submitted work' : 'Inspect evidence gap', page: pending ? 'tasks' : 'evidence' }];
  });
  const visible = queue.filter(item => !hidden.includes(item.id));
  const stages = [['Awaiting work', 'sent'], ['Review due', 'submitted'], ['Revision requested', 'awaiting_revision'], ['Closed tasks', 'reviewed']] as const;
  return <div className="r5-dashboard">
    <SpotlightCard className="eb-panel r5-coverage" aria-label="Evidence coverage overview"><div className="eb-heading"><div><small>APPLICATION MATERIALS</small><h2>Evidence coverage</h2></div><span className="r5-state">{rows.length} profiles</span></div><p className="eb-muted">Assessed criteria out of ten · coverage is not a score.</p>
      <div className="r5-coverage-rows">{rows.map(row => <button type="button" key={row.candidate.id} className="r5-coverage-row" onClick={() => select(row.candidate.id, 'evidence')} aria-label={`Inspect coverage for ${row.candidate.name}`}><span className="r5-avatar">{row.candidate.name.split(' ').map(n => n[0]).join('')}</span><strong>{row.candidate.name}</strong><span className="r5-coverage-track" aria-hidden="true"><i style={{ width: `${row.assessment?.score.coveragePercent ?? 0}%` }}/></span><span>{row.assessment ? `${row.assessment.score.criteria.filter(c => typeof c.mark === 'number').length}/${comparison.rubric.criteria.length}` : 'Not assessed'}</span></button>)}</div>
      <div className="r5-task-volume" aria-label="Task workload">{stages.map(([label, status]) => <div key={status}><strong>{rows.filter(row => row.task.status === status).length}</strong><span>{label}</span></div>)}</div>
    </SpotlightCard>
    <StarBorder className="eb-panel r5-action-queue" aria-label="Review action queue"><div className="eb-heading"><div><small>NEXT STEPS</small><h2>Review queue</h2></div><span className="r5-state">{visible.length} items</span></div><p className="eb-muted">Open the source before making a judgment.</p>
      {visible.length ? <ul>{visible.map(item => <li key={item.id}><div><strong>{item.row.candidate.name}</strong><small>{item.title}</small></div><button className="eb-action" aria-label={`Review queue: ${item.row.candidate.name}`} onClick={() => select(item.row.candidate.id, item.page)}>Review</button><button className="eb-action r5-queue-hide" aria-label={`Hide reminder for ${item.row.candidate.name}`} onClick={() => setHidden(all => [...all, item.id])}>Hide</button></li>)}</ul> : <p className="r5-queue-empty">No visible reminders.</p>}
      <div className="r5-queue-footer"><small>Hiding a reminder does not resolve evidence.</small>{hidden.length > 0 && <button className="eb-source-link" onClick={() => setHidden([])}>Restore hidden reminders</button>}</div>
    </StarBorder>
  </div>;
}
