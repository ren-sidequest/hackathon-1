import React, { useState } from 'react';
import { SpotlightCard, StarBorder } from '../gold-interactions';
import { profiles } from './fixtures';
import type { PreviewController } from './preview-store';

// Coverage measures available evidence, never candidate ability or hiring rank.
export function ReviewDashboard({ controller, select }: { controller: PreviewController; select: (id: string, page?: string) => void }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const tasks = controller.state.tasks;
  const queue = profiles.map(profile => {
    const task = tasks[profile.id];
    const current = task?.versions.at(-1);
    const pending = current && !current.review;
    const incomplete = profile.assessment.results.coverage < 10;
    if (!pending && !incomplete) return null;
    return { id: `${profile.id}.${pending ? current.id : 'application'}`, profile,
      title: pending ? `Review V${current.version} work` : 'Inspect evidence gap',
      page: pending ? 'tasks' : 'evidence' };
  }).filter(item => item !== null);
  const visible = queue.filter(item => !hidden.includes(item.id));
  const stages = [
    ['Awaiting work', Object.values(tasks).filter(t => t?.status === 'sent').length],
    ['Review due', Object.values(tasks).filter(t => t?.versions.at(-1) && !t.versions.at(-1)!.review).length],
    ['Revision requested', Object.values(tasks).filter(t => t?.status === 'awaiting_revision').length],
    ['Closed tasks', Object.values(tasks).filter(t => t?.status === 'closed').length],
  ] as const;
  return <div className="r5-dashboard">
    <SpotlightCard className="eb-panel r5-coverage" aria-label="Evidence coverage overview">
      <div className="eb-heading"><div><small>APPLICATION MATERIALS</small><h2>Evidence coverage</h2></div><span className="r5-state">4 profiles</span></div>
      <p className="eb-muted">Assessed criteria out of ten · coverage is not a score.</p>
      <div className="r5-coverage-rows">{profiles.map(p => <button type="button" key={p.id} className="r5-coverage-row" onClick={() => select(p.id, 'evidence')} aria-label={`Inspect coverage for ${p.name}`}>
        <span className="r5-avatar">{p.initials}</span><strong>{p.name}</strong><span className="r5-coverage-track" aria-hidden="true"><i style={{ width: `${p.assessment.results.coverage * 10}%` }} /></span><span>{p.assessment.results.coverage}/10</span>
      </button>)}</div>
      <div className="r5-task-volume" aria-label="Task workload">{stages.map(([label, count]) => <div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div>
    </SpotlightCard>
    <StarBorder className="eb-panel r5-action-queue" aria-label="Review action queue"><div className="eb-heading"><div><small>NEXT STEPS</small><h2>Review queue</h2></div><span className="r5-state">{visible.length} items</span></div>
      <p className="eb-muted">Open the source before making a judgment.</p>
      {visible.length ? <ul>{visible.map(item => <li key={item.id}><div><strong>{item.profile.name}</strong><small>{item.title}</small></div><button className="eb-action" aria-label={`Review queue: ${item.profile.name}`} onClick={() => select(item.profile.id, item.page)}>Review</button><button className="eb-action r5-queue-hide" aria-label={`Hide reminder for ${item.profile.name}`} onClick={() => setHidden(all => [...all, item.id])}>Hide</button></li>)}</ul> : <p className="r5-queue-empty">No visible reminders.</p>}
      <div className="r5-queue-footer"><small>Hiding a reminder does not resolve evidence.</small>{hidden.length > 0 && <button className="eb-source-link" onClick={() => setHidden([])}>Restore hidden reminders</button>}</div>
    </StarBorder>
  </div>;
}
