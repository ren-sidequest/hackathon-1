import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Demo, Finding } from '../../shared/api-types';
import { event, sections, type Draft } from '../../shared/api';
import { ResourceList } from '../../shared/api-ui';
import { CardEditor } from '../../shared/card-editor';

export type DraftChange = (change: (draft: Draft) => Draft) => void;
export function ApiWorkspace({ data, draft, update, editable }: { data: Demo; draft: Draft; update: DraftChange; editable: boolean }) {
  const [tab, setTab] = useState('Explore');
  const [filter, setFilter] = useState('All channels');
  const [editing, setEditing] = useState<Finding | null>(null);
  const [showExample, setShowExample] = useState(false);
  const { dataset } = data;
  const channels = filter === 'All channels' ? dataset.channels : dataset.channels.filter(c => c.channel === filter);
  const record = (title: string) => { if (editable) update(d => ({ ...d, events: [...d.events, event(title)].slice(-100) })); };
  const metrics = dataset.metrics;
  const percent = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
  return <div className="eb-workbench">
    <section className="eb-panel"><h2>Data & resources</h2><small>Synthetic · {dataset.version}</small><ResourceList resources={dataset.resources} onEvent={record}/></section>
    <section className="eb-panel"><div className="eb-tabs" role="tablist" aria-label="Analysis tools">{['Explore','Charts','SQL','Python','Notebook'].map(t => <button className="eb-action" role="tab" aria-selected={tab === t} key={t} onClick={() => { setTab(t); setShowExample(false); record(`Opened ${t} analysis`); }}>{t}</button>)}</div>
      {['Explore','Charts'].includes(tab) && <>
        <h2>Website performance overview</h2><small>Previous 4 weeks / Last 4 weeks</small>
        {tab === 'Explore' && <div className="eb-metrics">{[
          ['Website traffic', metrics.current.sessions.toLocaleString(), percent(metrics.change.trafficPct)],
          ['Conversion rate', `${metrics.current.conversionPct.toFixed(1)}%`, `${metrics.change.conversionPercentagePoints.toFixed(1)} pp`],
          ['Total orders', metrics.current.orders.toLocaleString(), percent(metrics.change.ordersPct)],
          ['Ad spend', `AUD ${(metrics.current.adSpendCents / 100).toLocaleString()}`, percent(metrics.change.adSpendPct)],
        ].map(([label,value,change]) => <div className="eb-metric" key={label}><small>{label}</small><strong>{value}</strong><small>{change} vs. previous period</small></div>)}</div>}
        <h3>Four-week period comparison</h3><div className="eb-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={dataset.trafficTrend} margin={{ left: -20, right: 0 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="label" tick={{ fontSize: 10 }}/><YAxis yAxisId="traffic"/><YAxis yAxisId="conversion" orientation="right" domain={[0,5]}/><Tooltip/><Legend/><Bar isAnimationActive={false} dataKey="traffic" yAxisId="traffic" name="Sessions (000s)" fill="var(--chart-traffic)"/><Line isAnimationActive={false} dataKey="conversion" yAxisId="conversion" name="Conversion %" stroke="var(--chart-line)"/></ComposedChart></ResponsiveContainer></div>
        <h3>Conversion by channel</h3><div className="eb-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={channels} margin={{ left: -20 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="channel" tick={{ fontSize: 10 }}/><YAxis/><Tooltip/><Legend/><Bar isAnimationActive={false} dataKey="previous" name="Previous %" fill="var(--chart-previous)"/><Bar isAnimationActive={false} dataKey="conversion" name="Current %" fill="var(--analysis-blue)"/></BarChart></ResponsiveContainer></div>
        <label className="eb-field">Channel <select aria-label="Filter channel" value={filter} onChange={e => { setFilter(e.target.value); record(`Filtered ${e.target.value}`); }}><option>All channels</option>{dataset.channels.map(c => <option key={c.id}>{c.channel}</option>)}</select></label>
        <ChannelTable channels={channels}/>
      </>}
      {['SQL','Python'].includes(tab) && <><h2>{tab} guided example</h2><p className="eb-muted">This displays an example query and API-derived rows; it does not execute code.</p><pre className="eb-code">{tab === 'SQL' ? "SELECT channel, sessions, orders, conversion_pct\nFROM website_traffic\nWHERE period = 'current'\nORDER BY conversion_pct;" : "import pandas as pd\ntraffic = pd.read_csv('website_traffic.csv')\ncurrent = traffic[traffic['period'] == 'current']\ncurrent.sort_values('conversion_pct')"}</pre><button className="eb-action" onClick={() => { setShowExample(true); record(`Viewed ${tab} example results (not live execution)`); }}>Show example results</button>{showExample && <ChannelTable channels={[...dataset.channels].sort((a,b) => a.conversion - b.conversion)}/>}</>}
      {tab === 'Notebook' && <><h2>Private working notes</h2><p>Saved in this browser for this draft version. Never included in API requests or exports.</p><label className="eb-field" htmlFor="api-notebook">Private notes</label><textarea id="api-notebook" value={draft.notes} disabled={!editable} onChange={e => update(d => ({ ...d, notes: e.target.value }))}/></>}
    </section>
    <section className="eb-panel eb-board"><h2>Investigation Board</h2><p className="eb-muted">Separate observations, hypotheses and remaining unknowns. {draft.findings.length}/40 cards</p>{sections.map(section => <section key={section}><div className="eb-board-heading"><h3>{section}</h3><button className="eb-action" aria-label={`Add ${section}`} disabled={!editable || draft.findings.length >= 40} onClick={() => setEditing({ id: crypto.randomUUID(), section, title: '', detail: '', source: '', confidence: 'Medium' })}>+</button></div>{draft.findings.filter(f => f.section === section).map(f => <article className="eb-finding" key={f.id}><h4>{f.title}</h4><p className="eb-preserve">{f.detail}</p><small>{f.source || 'No source supplied'} · {f.confidence} self-confidence</small><div><button className="eb-action" aria-label={`Edit ${f.title}`} disabled={!editable} onClick={() => setEditing(f)}>Edit</button></div></article>)}{!draft.findings.some(f => f.section === section) && <p className="eb-muted">No cards yet. You may still submit an incomplete investigation for review.</p>}</section>)}</section>
    {editing && <CardEditor key={editing.id} finding={editing} resources={data.dataset.resources} editable={editable} close={() => setEditing(null)} save={finding => { update(d => ({ ...d, findings: d.findings.some(f => f.id === finding.id) ? d.findings.map(f => f.id === finding.id ? finding : f) : [...d.findings, finding], events: [...d.events, event(`Saved ${finding.section} card`, finding.title)].slice(-100) })); setEditing(null); }} remove={() => { update(d => ({ ...d, findings: d.findings.filter(f => f.id !== editing.id), events: [...d.events, event('Removed an investigation card')].slice(-100) })); setEditing(null); }}/>}</div>;
}
function ChannelTable({ channels }: { channels: Demo['dataset']['channels'] }) {
  return <div className="eb-table-scroll"><table><thead><tr><th>Channel</th><th>Sessions</th><th>Orders</th><th>CVR</th><th>Traffic change</th></tr></thead><tbody>{channels.map(c => <tr key={c.id}><td>{c.channel}</td><td>{c.traffic.toLocaleString()}</td><td>{c.orders.toLocaleString()}</td><td>{c.conversion.toFixed(2)}%</td><td>{c.growth.toFixed(2)}%</td></tr>)}</tbody></table></div>;
}
