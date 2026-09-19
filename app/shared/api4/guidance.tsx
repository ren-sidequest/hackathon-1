import { nextStep } from './next-step';
import { SpotlightCard } from '../gold-interactions';
import React, { useEffect, useRef, useState } from 'react';
import type { Demo, RequirementId } from '../api4-types';
import { requirementNames } from './hr-model';

export type TaskIntent = { target: RequirementId; reason: string; criterion: string };

export function RoleStandards({ data, inspect }: { data: Demo; inspect: (criterion?:string) => void }) {
  const skillClass = (id: RequirementId) => id === 'sql' ? 'SQL' : id === 'data-analysis' ? 'DA' : 'BPS';
  return <section className="eb-panel r5-standards-overview"><div className="eb-heading"><h2>One shared standard, ten reviewable judgments</h2><button className="eb-action" onClick={()=>inspect()}>Read the rubric</button></div><p className="eb-muted">Fixed assessment weights · not candidate scores.</p><div className="r5-weight-track" aria-label="Ten equal-weight assessment standards">{data.rubric.criteria.map(c=><button className={`r5-weight-cell r5-skill-${skillClass(c.requirementId)}`} key={c.id} onClick={()=>inspect(c.id)} aria-label={`${c.id} · ${c.maxScore} points · open rubric`}><span>{c.id}</span><small>{c.maxScore}</small></button>)}</div><div className="r5-skill-cards">{data.rubric.requirements.map(r=><SpotlightCard className={`r5-skill-card r5-skill-${skillClass(r.id)}`} key={r.id}><header><small>{data.rubric.criteria.filter(c=>c.requirementId===r.id).length} standards</small><strong className="r5-skill-weight">{r.maxScore}<small>%</small></strong></header><h3>{r.title}</h3><details><summary>What this role needs</summary><p>{r.statement}</p></details></SpotlightCard>)}</div></section>;
}

export function CompanyOverview({ data, compare }: { data: Demo; compare: () => void }) {
  return <section className="eb-panel guide-company" aria-label="Role overview">
    <div className="guide-company-head"><span className="r5-avatar">HR</span><div><small>{data.company.name} · Synthetic company</small><h2>{data.job.title}</h2><div className="r5-meta"><span>{data.company.location}</span><span>{data.job.employmentType}</span><span>{data.job.experienceLevel}</span><span>{data.job.team}</span></div></div><button className="eb-action primary" onClick={compare}>View candidates →</button></div>
    <p className="guide-goal">{data.company.businessDescription}</p>
    <div className="guide-work-chain">{data.job.successStages.map((text, i) => <details key={text}><summary><span className="guide-step-icon" aria-hidden="true">{['≋', '⌕', '↗'][i]}</span><small>0{i + 1}</small><strong>{['Check the numbers', 'Explain the change', 'Recommend an action'][i]}</strong><span className="guide-expand">Details +</span></summary><p>{text}</p></details>)}</div>
    <details className="guide-background"><summary>Role context & limits</summary><p>{data.company.profileScope}</p><p>Collaborating teams: {data.job.collaboratingTeams.join(' · ')}. Supported by experienced analysts.</p><p>Hiring remains a human decision.</p></details>
  </section>;
}

export function Journey({ data, role, page, go }: { data: Demo; role: 'hr' | 'candidate'; page: string; go: (page: string) => void }) {
  const next = nextStep(data, role, page);
  const sent = data.task.status !== 'draft', hasWork = data.versions.length > 0;
  const status = data.workflow.isTerminal ? 'Review complete' : data.workflow.canResubmit ? 'V2 requested · Candidate to act' : hasWork ? 'Work submitted · HR to review' : sent ? 'Task sent · Candidate to act' : 'Application evidence available';
  const items = role === 'hr' ? [['comparison', 'Compare'], ['evidence', 'Inspect evidence'], ['tasks', sent ? 'Task & review' : 'Supplement if needed'], ['shortlist', 'Human decision']] : [['application', 'Materials'], ['tasks', 'Task brief'], ['workspace', 'Work on task'], ['history', 'Submission & feedback']];
  return <nav className="guide-journey" aria-label="Candidate journey"><div><strong>{data.candidate.name}</strong><span>{status}</span></div><ol>{items.map(([id, label], i) => {
    const unavailable = role === 'candidate' && ((id === 'workspace' && !data.workflow.canSubmit) || (id === 'history' && !hasWork));
    return <li key={id}><button aria-current={page === id ? 'step' : undefined} disabled={unavailable} title={unavailable ? id === 'history' ? 'Available after your first submission' : 'Available when a task is open for work' : undefined} onClick={() => go(id)}><span>{i + 1}</span>{label}</button></li>;
  })}</ol><div className="guide-journey-next"><span><strong>Next step</strong> {next.detail}</span>{next.page !== page && <button className="eb-action" onClick={() => go(next.page)}>{next.label} →</button>}</div></nav>;
}

export function FloatingNotice({ message, error, dismiss, action }: { message: string; error?: boolean; dismiss: () => void; action?: { label: string; run: () => void } }) {
  const [paused, setPaused] = useState(false);
  const close = useRef(dismiss); close.current = dismiss;
  useEffect(() => { if (!message || error || paused) return; const timer = window.setTimeout(() => close.current(), 7000); return () => clearTimeout(timer); }, [message, error, paused]);
  if (!message) return null;
  return <aside className="guide-toast" data-error={!!error} aria-label="Action feedback" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}><span className="guide-toast-icon" aria-hidden="true">{error ? '!' : message.includes('Saved on the shared service') ? '✓' : 'i'}</span><div><p role={error ? 'alert' : 'status'}>{message}</p>{action && <button className="eb-action" onClick={action.run}>{action.label} →</button>}</div><button className="eb-action" aria-label="Dismiss notice" onClick={dismiss}>×</button></aside>;
}

export function Deliverables({ target }: { target: RequirementId | null }) {
  const items = target === 'sql' ? ['Query & intended grain', 'Time window & joins', 'Validation checks & limits'] : target === 'data-analysis' ? ['Metric & denominator', 'Meaningful comparison', 'Interpretation & limitations'] : ['Evidence-backed findings', 'Hypotheses & missing evidence', 'Testable next action'];
  return <div className="guide-deliverables" aria-label="Suggested work structure">{items.map((item, i) => <div key={item}><span>{i + 1}</span><strong>{item}</strong></div>)}<small>Suggested structure · Explain what you can establish and what remains unknown.</small></div>;
}

export function TaskBrief({ name, title, target, reason, instructions, minutes }: { name: string; title: string; target: RequirementId | null; reason: string; instructions: string; minutes: number }) {
  return <div className="guide-task-brief"><small>WORK BRIEF · {name}</small><h2>{title}</h2><div className="r5-meta"><span>{target ? requirementNames[target] : 'Targeted evidence'}</span><span>{minutes} minutes suggested · no enforced deadline</span></div><div className="guide-gap"><small>WHY THIS TASK</small><p>{reason}</p></div><h3>What to do</h3><p className="eb-preserve">{instructions}</p><h3>Your work sample</h3><Deliverables target={target}/></div>;
}
