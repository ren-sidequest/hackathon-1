import React, { useState } from 'react';
import { SpotlightCard } from './gold-interactions';
import type { Demo } from './api-types';
import { compareWork, workflowSteps, type PublicVersion } from './workspace-model';

export function WorkflowStrip({ status, started = false, version = 1 }: { status: string; started?: boolean; version?: number }) {
  if (status === 'draft' || status === 'none') return <div className="eb-workflow-wait">No task sent · application evidence remains available</div>;
  return <nav aria-label="Evidence workflow" className="eb-workflow"><ol>{workflowSteps(status, started, version).map((step, i) => <li key={i} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}><span aria-hidden="true">{step.state === 'done' ? '✓' : i + 1}</span>{step.label}</li>)}</ol><small>{status === 'awaiting_revision' ? 'V1 reviewed · one V2 revision open' : status === 'closed' ? 'Review complete · no further submission' : status === 'submitted' ? `V${version} awaiting human review` : started ? 'Draft in this browser' : 'Waiting for candidate work'} · Analysis optional</small></nav>;
}

export function VersionComparison({ before, after }: { before: PublicVersion; after: PublicVersion }) {
  const [open, setOpen] = useState(false);
  const diff = compareWork(before, after);
  const cardText = (f: PublicVersion['findings'][number]) => `${f.section}\n${f.title}\n${f.detail}\nSource: ${f.source || 'None'} · Self-confidence: ${f.confidence}`;
  return <details className="eb-panel eb-version-diff" onToggle={e => setOpen(e.currentTarget.open)}><summary>Compare V1 → V2 · {diff.added.length} added · {diff.edited.length} edited · {diff.removed.length} removed</summary>{open && <><p>Public snapshots only. Text changes do not imply improved quality or a new score.</p><small>{diff.unchanged} unchanged cards · Summary {diff.summaryChanged ? 'changed' : 'unchanged'}</small>{diff.summaryChanged && <div className="eb-diff-pair"><section><h3>V1 summary</h3><pre>{before.summary}</pre></section><section><h3>V2 summary</h3><pre>{after.summary}</pre></section></div>}{diff.edited.map(pair => <div key={pair.after.id} className="eb-diff-pair"><section><h3>V1 · edited card</h3><pre>{cardText(pair.before)}</pre></section><section><h3>V2 · edited card</h3><pre>{cardText(pair.after)}</pre></section></div>)}{diff.added.map(f => <section key={f.id}><h3>Added in V2</h3><pre>{cardText(f)}</pre></section>)}{diff.removed.map(f => <section key={f.id}><h3>Removed from V1</h3><pre>{cardText(f)}</pre></section>)}</>}</details>;
}

/** Bars share a zero baseline within each metric; the API only supplies period aggregates. */
export function DataOverview({ dataset, onEvent }: { dataset: Demo['dataset']; onEvent?: (title: string) => void }) {
  const [channel, setChannel] = useState('All channels');
  const [sort, setSort] = useState('default');
  const { previous, current, change } = dataset.metrics;
  const rows = dataset.channels.filter(c => channel === 'All channels' || c.channel === channel)
    .sort((a, b) => sort === 'conversion' ? a.conversion - b.conversion : sort === 'traffic' ? b.traffic - a.traffic : 0);
  const scale = Math.max(1, ...dataset.channels.flatMap(c => [c.previous, c.conversion]));
  const bar = (value: number, max: number, period: string, text: string) => <div className={`eb-data-bar ${period}`}><span className="eb-bar-track"><i style={{ width: `${Math.max(0, value) / max * 100}%` }}/></span><span>{text}</span></div>;
  return <section className="eb-data-overview" aria-label="Dataset overview"><div className="eb-heading"><div><h2>Website performance overview</h2><small>Previous 4 weeks → Last 4 weeks · {dataset.version}</small></div></div><div className="eb-metrics">{[
    ['Website traffic', current.sessions.toLocaleString(), `${change.trafficPct > 0 ? '+' : ''}${change.trafficPct.toFixed(1)}%`],
    ['Conversion rate', `${current.conversionPct.toFixed(2)}%`, `${change.conversionPercentagePoints.toFixed(2)} pp`],
    ['Total orders', current.orders.toLocaleString(), `${change.ordersPct.toFixed(1)}%`],
    ['Ad spend', `AUD ${(current.adSpendCents / 100).toLocaleString()}`, `${change.adSpendPct.toFixed(1)}%`],
  ].map(([label, value, delta]) => <SpotlightCard as="div" className="eb-metric" key={label}><small>{label}</small><strong>{value}</strong><small>{delta} vs previous period</small></SpotlightCard>)}</div>
    <h3>Four-week period comparison</h3><div className="eb-chart-legend"><span>▧ Previous</span><span>■ Current</span></div><div className="eb-period-bars">{(['sessions', 'orders'] as const).map(metric => <div key={metric}><strong>{metric === 'sessions' ? 'Sessions' : 'Orders'}</strong>{bar(previous[metric], Math.max(1, previous[metric], current[metric]), 'previous', previous[metric].toLocaleString())}{bar(current[metric], Math.max(1, previous[metric], current[metric]), 'current', current[metric].toLocaleString())}</div>)}</div>
    <div className="eb-data-controls"><label>Channel<select aria-label="Filter channel" value={channel} onChange={e => { setChannel(e.target.value); onEvent?.(`Filtered ${e.target.value}`); }}><option>All channels</option>{dataset.channels.map(c => <option key={c.id}>{c.channel}</option>)}</select></label><label>Sort rows<select aria-label="Sort channel rows" value={sort} onChange={e => setSort(e.target.value)}><option value="default">Dataset order</option><option value="conversion">Conversion · lowest first</option><option value="traffic">Sessions · highest first</option></select></label></div>
    <h3>Conversion by channel</h3><div className="eb-channel-bars" aria-label="Channel conversion comparison">{rows.map(c => <div key={c.id}><strong>{c.channel}</strong>{bar(c.previous, scale, 'previous', `${c.previous.toFixed(2)}%`)}{bar(c.conversion, scale, 'current', `${c.conversion.toFixed(2)}%`)}</div>)}</div>
    <div className="eb-table-scroll"><table><caption>Current period · selected channels</caption><thead><tr><th>Channel</th><th>Sessions</th><th>Orders</th><th>CVR</th><th>Traffic change</th></tr></thead><tbody>{rows.map(c => <tr key={c.id}><td>{c.channel}</td><td>{c.traffic.toLocaleString()}</td><td>{c.orders.toLocaleString()}</td><td>{c.conversion.toFixed(2)}%</td><td>{c.growth.toFixed(2)}%</td></tr>)}</tbody></table></div><small>Two aggregate periods, not a daily trend. Patterns alone do not establish causes.</small>
  </section>;
}
