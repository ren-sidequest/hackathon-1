import React from 'react';
import type { Comparison, Demo } from '../api4-types';

export type EvidenceFocus = { criterion: string; request: number };

/** Coverage counts numeric judgments (including 0), independently of their quality. */
export function CoverageCell({ row, criteria, inspect }: { row: Comparison['candidates'][number]; criteria: Demo['rubric']['criteria']; inspect: (criterion: string) => void }) {
  const score = row.assessment?.score;
  const covered = criteria.filter(c => typeof score?.criteria.find(item => item.criterionId === c.id)?.mark === 'number').length;
  const missing = criteria.filter(c => score?.criteria.find(item => item.criterionId === c.id)?.mark === 'NE').length;
  const pending = criteria.length - covered - missing;
  const state = !score ? 'pending' : covered === criteria.length ? 'complete' : 'partial';
  return <div className="guide-coverage-cell" aria-label={`${row.candidate.name} evidence coverage and accumulated points`}>
    <div className="guide-coverage-labels">
      <div className="guide-coverage-badge" data-state={state} title={state === 'complete' ? 'Complete evidence coverage' : !score ? 'Not assessed' : `${missing} insufficient · ${pending} not assessed`}><span>Coverage</span><strong>{score ? covered : '—'}<small> / {criteria.length}</small></strong></div>
      <div className="guide-points-badge"><div><span>Points</span><details><summary aria-label={`About accumulated points for ${row.candidate.name}`}>ⓘ</summary><p>{covered}/{criteria.length} criteria assessed; {missing} insufficient, {pending} not assessed. Accumulated points are not scaled up for missing evidence. Coverage is separate from score quality; neither is a hiring decision.</p></details></div><strong>{score ? score.accruedScore.toFixed(1) : '—'}<small> / 100</small></strong></div>
    </div>
    <div className="guide-coverage-track" aria-label="Inspect each assessment standard">{criteria.map(c => {
      const mark = score?.criteria.find(item => item.criterionId === c.id)?.mark;
      const status = typeof mark === 'number' ? `Assessed · ${mark}/4` : mark === 'NE' ? 'NE · insufficient evidence' : 'Not assessed';
      return <button key={c.id} data-state={typeof mark === 'number' ? 'covered' : mark === 'NE' ? 'missing' : 'pending'} aria-label={`${row.candidate.name} · ${c.id} · ${c.title} · ${status}`} title={`${c.id} · ${c.title}\n${status} · Open evidence`} onClick={()=>inspect(c.id)}><span aria-hidden="true">{typeof mark === 'number' ? '✓' : mark === 'NE' ? '−' : '·'}</span></button>;
    })}</div>
  </div>;
}
