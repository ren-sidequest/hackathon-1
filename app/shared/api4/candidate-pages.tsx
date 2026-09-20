import React, { useState, type ReactNode } from 'react';
import type { Demo, Finding, Version } from '../api4-types';
import { Dialog, Heading, ProcessTimeline, ResourceList } from '../api-ui';
import { GlideSelect } from '../glide-select';
import { SpotlightCard } from '../gold-interactions';
import { CardEditor } from '../card-editor';
import { DataOverview, VersionComparison } from '../workspace-ui';
import { decisionLabel, download, workMarkdown } from '../api';
import { JobRequirements, MaterialDialog, PdfLink } from './materials';
import { Rubric } from './assessment';
import { WorkSnapshot } from './work';
import { appendDraftEvent, event, sections, type CandidateDraft } from './candidate-draft';
import { documentBlocks, sourcePeriodMetrics, sourceTitle, taskResources } from './candidate-content';
import { readingText } from './candidate-reading';
import './candidate-pages.css';
import { fillDemoDraft, nextExample, supportsExamples } from './rehearsal';

type Material = Demo['application']['sources'][number];
type Resource = Demo['dataset']['resources'][number];
type Updater = (fn: (draft: CandidateDraft) => CandidateDraft) => void;
const icons = ['search', 'lightbulb', 'file-text', 'target'];
function Icon({ name = 'file-text' }: { name?: string }) {
  return <i className={`cp-icon cp-icon-${name}`} aria-hidden="true"/>;
}
function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="cp-link" onClick={onClick}>{children}<Icon name="arrow-right"/></button>;
}
function Reading({ text }: { text: string }) {
  const blocks = documentBlocks(readingText(text));
  return <div className="cp-reading">{blocks.map((block, i) => block.type === 'table'
    ? <div className="cp-table-scroll" key={i}><table><thead><tr>{block.headers?.map((c, j) => <th key={j}>{c}</th>)}</tr></thead><tbody>{block.rows?.map((row, j) => <tr key={j}>{row.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody></table></div>
    : block.type === 'heading' ? <h3 key={i}>{block.text}</h3> : <p key={i}>{block.text}</p>)}</div>;
}
function Metrics({ values }: { values: ReturnType<typeof sourcePeriodMetrics> }) {
  return values.length ? <div className="cp-metrics">{values.map(m => <div key={m.label}><small>{m.label}</small><strong>{m.before}<span aria-hidden="true"> → </span>{m.after}</strong></div>)}</div> : null;
}

export function CandidateMaterials({ data, base }: { data: Demo; base: string }) {
  const [id, setId] = useState(data.application.sources.find(s => s.sourceId.endsWith('.md'))?.sourceId ?? data.application.sources[0]?.sourceId);
  const [dialog, setDialog] = useState<'jd' | 'rubric' | 'source' | null>(null);
  const source = data.application.sources.find(s => s.sourceId === id) ?? data.application.sources[0];
  return <section className="cp-page cp-materials">
    <Heading title="My materials"><span className="cp-subtitle">Role basis & personal application materials</span></Heading>
    <section className="eb-panel cp-role-band" aria-label="Role overview">
      <div className="cp-role-identity"><Icon name="building-2"/><div><strong>{data.company.name}</strong><h2>{data.job.title}</h2><small>{data.job.location} · {data.job.employmentType} · {data.job.team}</small></div></div>
      <button className="eb-action cp-role-entry" onClick={() => setDialog('jd')}><Icon/><span><strong>Job description</strong><small>{data.job.jd.requirements.length} requirements · Original JD</small></span><Icon name="arrow-right"/></button>
      <button className="eb-action cp-role-entry" onClick={() => setDialog('rubric')}><Icon name="sliders-horizontal"/><span><strong>Assessment standards</strong><small>{data.rubric.criteria.length} core standards</small></span></button>
    </section>
    <div className="cp-material-grid">
      <aside className="eb-panel cp-library"><header><h2>My application materials</h2><small>{data.application.sources.length} sources</small></header>
        {data.application.sources.map(s => <div className={`cp-library-item ${source?.sourceId === s.sourceId ? 'selected' : ''}`} key={s.sourceId}>
          <button className="cp-material-choice" aria-pressed={source?.sourceId === s.sourceId} onClick={() => setId(s.sourceId)}><Icon name={s.sourceId.endsWith('.sql') ? 'database' : 'file-text'}/><span><strong>{sourceTitle(s.sourceId)}</strong><small>{s.kind === 'application' ? 'Original fictional CV' : s.sourceId.endsWith('.sql') ? 'Query code · synthetic companion' : 'Project report · synthetic companion'}</small></span></button>
          {s.provenance?.downloadUrl && <PdfLink base={base} path={s.provenance.downloadUrl}>View original PDF</PdfLink>}
        </div>)}
        <small className="cp-library-note">Original CV and synthetic companions are labelled separately.</small>
      </aside>
      {source ? <MaterialPreview key={source.sourceId} source={source} open={() => setDialog('source')}/> : <section className="eb-panel"><h2>No application materials available</h2></section>}
    </div>
    {dialog === 'jd' && <Dialog title="Full job requirements" close={() => setDialog(null)}><JobRequirements data={data} base={base}/></Dialog>}
    {dialog === 'rubric' && <Rubric data={data} close={() => setDialog(null)}/>}
    {dialog === 'source' && source && <MaterialDialog data={data} source={source} base={base} close={() => setDialog(null)}/>}
  </section>;
}
function MaterialPreview({ source, open }: { source: Material; open: () => void }) {
  const [raw, setRaw] = useState(false);
  const metrics = sourcePeriodMetrics(source.text);
  const blocks = documentBlocks(source.text);
  const table = blocks.find(b => b.type === 'table');
  const lastHeading = blocks.reduce((last, b, i) => b.type === 'heading' ? i : last, -1);
  const note = blocks.slice(lastHeading + 1).filter(b => b.type === 'paragraph').map(b => b.text).join('\n');
  return <section className="eb-panel cp-preview">
    <header className="cp-preview-header"><Icon name={source.sourceId.endsWith('.sql') ? 'database' : 'file-text'}/><div><h2>{sourceTitle(source.sourceId)}</h2><small>{source.kind === 'application' ? 'Original fictional CV' : 'Personal past project · synthetic companion'}</small></div><LinkButton onClick={open}>Read original</LinkButton></header>
    {metrics.length ? <><Metrics values={metrics}/><h3>Channel data</h3><div className="cp-table-scroll"><table><thead><tr>{table?.headers?.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{table?.rows?.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div><h3>Project note</h3><p className="cp-material-excerpt">{readingText(note)}</p><small>Calculated from this source table · read the original for the full scope.</small></>
      : source.sourceId.endsWith('.sql') || source.kind === 'application' ? <pre className="cp-source-code" data-local-raw={source.sourceId.endsWith('.sql') || raw ? true : undefined}>{raw || source.sourceId.endsWith('.sql') ? source.text : readingText(source.text)}</pre> : <div className="cp-document-scroll"><Reading text={source.text}/></div>}
    <footer className="cp-preview-footer"><small>Read-only source · original text retained</small>{source.kind === 'application' && <button className="cp-link" aria-pressed={raw} onClick={() => setRaw(!raw)}>Original text</button>}<LinkButton onClick={open}>File details</LinkButton></footer>
  </section>;
}

export function CandidateTask({ data, actions, go }: { data: Demo; actions: ReactNode; go: (page: string) => void }) {
  const [resourcesOpen, setResourcesOpen] = useState(false), [resource, setResource] = useState<Resource | null>(null);
  const resources = taskResources(data), sent = data.task.status !== 'draft';
  const priority = ['business_context.md', 'website_traffic.csv', data.task.targetRequirementId === 'business-problem-solving' ? 'current_paid_search_devices.csv' : 'orders.csv'];
  const rank = (id: string) => priority.includes(id) ? priority.indexOf(id) : priority.length;
  const hints = ['What you observed', 'Separate explanations from facts', 'What is needed, and why', 'An action and a way to check it'];
  return <section className="cp-page cp-task"><Heading title="Your targeted task"><span className="cp-subtitle">{sent ? data.workflow.isTerminal ? 'Task closed' : 'Task received' : 'No task requested'}</span></Heading>
    {!sent ? <section className="eb-panel cp-empty"><Icon name="briefcase-business"/><h2>No supplementary task requested</h2><p>Your existing application materials remain available. A task is requested only for a specific evidence gap.</p><button className="eb-action" onClick={() => go('application')}>View application materials</button></section> : <div className="cp-task-grid">
      <section className="cp-task-brief"><h2>{data.task.title}</h2><p className="cp-muted">{data.rubric.requirements.find(r => r.id === data.task.targetRequirementId)?.title} · {data.task.timeboxMinutes} minutes suggested · no enforced deadline</p>
        <div className="cp-feedback-line"><strong>Why this task</strong><p>{data.task.gapReason}</p></div>
        <h3>Task brief</h3><p className="eb-preserve">{data.task.instructions}</p>
        <div className="cp-section-heading"><h3>Available resources · {resources.length}</h3><LinkButton onClick={() => setResourcesOpen(true)}>View all resources</LinkButton></div>
        <div className="cp-resource-list">{[...resources].sort((a, b) => rank(a.id) - rank(b.id)).slice(0, 3).map(r => <button className="eb-action" key={r.id} onClick={() => setResource(r)}><Icon/><strong>{sourceTitle(r.id)}</strong><small>{r.description}</small><Icon name="arrow-right"/></button>)}</div>
        <small>Company-provided synthetic task data, not personal project results.</small>
      </section>
      <aside className="cp-task-guidance"><h2>How to organise your work</h2><p>Start with a summary, then use cards to explain your reasoning.</p><div className="cp-deliverables">{sections.map((section, i) => <div key={section}><Icon name={icons[i]}/><div><strong>{section}</strong><small>{hints[i]}</small></div></div>)}</div><p className="cp-muted">Cards are optional. Incomplete work may still be submitted.</p>
        <div className="cp-draft-actions"><h3><Icon name="pencil"/> Your draft</h3><p>Drafts stay in this browser. Private notes are not submitted.</p>{actions}<LinkButton onClick={() => go('application')}>View application materials</LinkButton></div>
      </aside>
    </div>}
    {resourcesOpen && <Dialog title="Task-provided resources" close={() => setResourcesOpen(false)}><ResourceList resources={resources.map(r => ({ ...r, name: sourceTitle(r.id) }))}/></Dialog>}
    {resource && <ResourceDialog resource={resource} close={() => setResource(null)}/>}
  </section>;
}
function ResourceDialog({ resource, close }: { resource: Resource; close: () => void }) {
  return <Dialog title={sourceTitle(resource.id)} close={close}><small>Company-provided synthetic task data</small><p>{resource.description}</p><ResourceList resources={[{ ...resource, name: sourceTitle(resource.id) }]}/><pre className="cp-source-code">{readingText(resource.content)}</pre><details><summary>File details</summary><p data-local-raw>{resource.id} · {resource.datasetVersion}</p></details></Dialog>;
}

export function CandidateEditor({ data, draft, update, record, disabled, version, submit, go }: { data: Demo; draft: CandidateDraft; update: Updater; record: (title: string) => void; disabled: boolean; version: number; submit: () => void; go: (page: string) => void }) {
  const resources = taskResources(data), previous = data.versions.find(v => v.submission.submissionVersion === 1);
  const [section, setSection] = useState<Finding['section']>(version === 2 ? 'Additional Evidence Needed' : 'Key Findings');
  const [active, setActive] = useState<string | null>(null);
  const [resourceId, setResourceId] = useState(resources.find(r => r.id.endsWith('.md'))?.id ?? resources[0]?.id);
  const [modal, setModal] = useState<'resources' | 'notes' | 'explore' | 'previous' | 'resource' | null>(null);
  const [editing, setEditing] = useState<Finding | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(!draft.summary.trim());
  const demoAvailable = version === 1 && supportsExamples(data);
  const [useExamples, setUseExamples] = useState(true);
  const [exampleNotice, setExampleNotice] = useState('');
  const cards = draft.findings.filter(f => f.section === section), card = cards.find(f => f.id === active) ?? cards[0];
  const resource = resources.find(r => r.id === resourceId) ?? resources[0];
  const change = (patch: Partial<Finding>) => { if (card) update(d => ({ ...d, findings: d.findings.map(f => f.id === card.id ? { ...f, ...patch } : f) })); };
  const add = (target: Finding['section']) => {
    if (demoAvailable && useExamples) {
      const sample = nextExample(target, draft.findings);
      if (!sample) { setExampleNotice('All four distinct examples in this section are already used. Turn off demo examples to add your own card.'); return; }
      setExampleNotice(''); setEditing(sample); return;
    }
    setEditing({ id: crypto.randomUUID(), section: target, title: '', detail: '', source: resource?.id ?? '', confidence: 'Medium' });
  };
  const save = (finding: Finding) => {
    update(d => appendDraftEvent({ ...d, findings: d.findings.some(f => f.id === finding.id) ? d.findings.map(f => f.id === finding.id ? finding : f) : d.findings.length < 40 ? [...d.findings, finding] : d.findings }, event(`Saved ${finding.section}`, finding.title)));
    setSection(finding.section); setActive(finding.id); if (finding.source) setResourceId(finding.source); setEditing(null);
  };
  const remove = (finding: Finding) => { update(d => appendDraftEvent({ ...d, findings: d.findings.filter(f => f.id !== finding.id) }, event('Removed investigation card', finding.title))); setEditing(null); };
  return <section className="cp-page cp-workspace">
    <Heading title={data.task.title}><span className="cp-subtitle">{data.rubric.requirements.find(r => r.id === data.task.targetRequirementId)?.title} · V{version} draft</span><LinkButton onClick={() => go('tasks')}>View full task</LinkButton></Heading>
    {version === 2 && previous?.review && <div className="cp-feedback-line cp-feedback-inline"><strong>Recruiter feedback</strong><p>{previous.review.comment}</p></div>}
    {demoAvailable && <aside className="eb-panel rehearsal-tools" aria-label="Synthetic rehearsal examples"><div><strong>Demo examples · synthetic, editable</strong><p>Fill empty sections and summary without replacing your work. Four distinct examples per section; these are authored samples, not live AI output.</p></div><div className="eb-actions"><button className="eb-action" disabled={disabled || !!editing} onClick={() => { update(fillDemoDraft); setSummaryOpen(true); setUseExamples(true); setExampleNotice('Demo examples loaded where content was missing. Review before submitting.'); }}>Fill demo draft</button><label><input type="checkbox" checked={useExamples} onChange={e => { setUseExamples(e.target.checked); setExampleNotice(''); }}/> Prefill new cards with demo examples</label></div>{exampleNotice && <p role="status">{exampleNotice}</p>}</aside>}
    <div className="eb-panel cp-editor-grid">
      <aside className="cp-reference-rail">
        {version === 2 && previous && <div className="cp-previous"><div className="cp-section-heading"><h2>V1 · submitted, read-only</h2><LinkButton onClick={() => setModal('previous')}>View full V1</LinkButton></div><p className="cp-clamp">{previous.submission.summary}</p></div>}
        <h3>Reference material</h3>{resource ? <><GlideSelect ariaLabel="Reference material" value={resource.id} onChange={value => { setResourceId(value); record(`Opened ${value}`); }} options={resources.map(r => ({ value: r.id, label: sourceTitle(r.id) }))}/><small>Company-provided synthetic task data</small><p className="cp-resource-description">{resource.description}</p>{resource.id.endsWith('.md') ? <div className="cp-reference-text"><Reading text={resource.content}/></div> : <pre className="cp-reference-text">{resource.content}</pre>}<TaskTotals data={data}/><div className="cp-rail-links"><LinkButton onClick={() => setModal('resource')}>Read original</LinkButton><LinkButton onClick={() => setModal('resources')}>Other resources</LinkButton></div></> : <p>No task resources supplied.</p>}
        <button className="eb-action cp-explore" onClick={() => setModal('explore')}>Explore data & calculations</button>
      </aside>
      <div className="cp-editor-main eb-board">
        <div className="cp-section-heading"><h2>V{version} · {version === 2 ? 'This revision' : 'Your work'}</h2><small>{draft.savedAt ? `Local draft updated ${new Date(draft.savedAt).toLocaleTimeString()}` : 'Local draft'}</small></div>
        <div className="cp-section-tabs" role="tablist" aria-label="Investigation sections">{sections.map(s => <button key={s} type="button" role="tab" aria-selected={section === s} onClick={() => { setSection(s); setActive(null); const first = draft.findings.find(f => f.section === s); if (first?.source) setResourceId(first.source); }}>{s}<small> ({draft.findings.filter(f => f.section === s).length})</small></button>)}</div>
        <div className="cp-card-tools">{cards.length > 1 && <GlideSelect ariaLabel="Current card" value={card?.id ?? ''} onChange={value => { setActive(value); const selected = cards.find(f => f.id === value); if (selected?.source) setResourceId(selected.source); }} options={cards.map(f => ({ value: f.id, label: f.title }))}/>}<button className="cp-link" aria-label={`Add ${section}`} disabled={disabled || draft.findings.length >= 40} onClick={() => add(section)}>Add card</button><small>{draft.findings.length}/40 cards · optional</small></div>
        {card ? <SpotlightCard as="section" className="cp-inline-card eb-finding"><label className="eb-field">Observation or idea<input aria-label="Card title" maxLength={300} value={card.title} disabled={disabled} onChange={e => change({ title: e.target.value })}/></label><label className="eb-field">Reasoning & supporting evidence<textarea aria-label="Card reasoning" maxLength={4000} value={card.detail} disabled={disabled} onChange={e => change({ detail: e.target.value })}/></label><div className="cp-card-meta"><label>Evidence source<GlideSelect ariaLabel="Inline evidence source" value={card.source} onChange={value => { change({ source: value }); if (value) setResourceId(value); }} options={[{ value: '', label: 'Not supplied' }, ...resources.map(r => ({ value: r.id, label: sourceTitle(r.id) }))]} disabled={disabled}/></label><span>Self-confidence {card.confidence}</span><button className="cp-link" disabled={disabled} aria-label={`Edit ${card.title}`} onClick={() => setEditing(card)}>Edit details</button></div></SpotlightCard>
          : <div className="cp-card-empty"><Icon name={icons[sections.indexOf(section)]}/><h3>{section}</h3><p>Record your reasoning and link the source that supports it.</p><button className="eb-action" disabled={disabled || draft.findings.length >= 40} onClick={() => add(section)}>Create a card</button></div>}
        <details className="cp-summary" open={summaryOpen} onToggle={e => setSummaryOpen(e.currentTarget.open)}><summary>Executive summary</summary><label className="eb-field"><span className="cp-sr-only">Executive summary</span><textarea aria-label="Executive summary" maxLength={8000} value={draft.summary} disabled={disabled} onChange={e => update(d => ({ ...d, summary: e.target.value }))}/></label><small>{draft.summary.length}/8,000 characters · Private notes excluded</small></details>
        <footer className="cp-editor-footer"><button className="cp-link" role="tab" aria-selected={modal === 'notes'} aria-label="Private notebook" onClick={() => setModal('notes')}><Icon name="pencil"/><span>Private notebook<small>Local only · not submitted</small></span></button><button className="eb-action primary" disabled={disabled} aria-label={`Submit V${version}`} onClick={submit}>Preview & submit V{version}</button></footer>
      </div>
    </div>
    {modal === 'notes' && <Dialog title="Private notebook" close={() => setModal(null)}><p>Local draft only; excluded from HR views, public snapshots and exports.</p><label className="eb-field">Private notes<textarea aria-label="Private notes" value={draft.notes} disabled={disabled} onChange={e => update(d => ({ ...d, notes: e.target.value }))}/></label></Dialog>}
    {modal === 'previous' && previous && <Dialog title="V1 · submitted, read-only" close={() => setModal(null)}><WorkSnapshot data={data} version={previous}/></Dialog>}
    {modal === 'resource' && resource && <ResourceDialog resource={resource} close={() => setModal(null)}/>}
    {modal === 'resources' && <Dialog title="Task-provided resources" close={() => setModal(null)}><ResourceList resources={resources.map(r => ({ ...r, name: sourceTitle(r.id) }))} onEvent={record} onCreateFinding={!disabled && draft.findings.length < 40 ? finding => { setModal(null); setEditing(finding); } : undefined}/></Dialog>}
    {modal === 'explore' && <Dialog title="Explore data & calculations" close={() => setModal(null)}><DataOverview dataset={data.dataset} onEvent={record}/><p>SQL is reviewed as text; no query is executed here. Show formulas, denominators and limitations in your cards.</p></Dialog>}
    {editing && <CardEditor key={editing.id} finding={editing} resources={resources.map(r => ({ ...r, name: sourceTitle(r.id) }))} editable={!disabled} close={() => setEditing(null)} save={save} remove={() => remove(editing)}/>}
  </section>;
}
function TaskTotals({ data }: { data: Demo }) {
  const { previous: p, current: c } = data.dataset.metrics;
  return <div className="cp-table-scroll cp-task-totals"><table><caption>Company task totals</caption><thead><tr><th>Metric</th><th>Previous</th><th>Current</th></tr></thead><tbody>{[['Sessions', p.sessions.toLocaleString(), c.sessions.toLocaleString()], ['Orders', p.orders.toLocaleString(), c.orders.toLocaleString()], ['Conversion', `${p.conversionPct}%`, `${c.conversionPct}%`]].map(row => <tr key={row[0]}>{row.map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody></table></div>;
}

export function CandidateHistory({ data, actions, go }: { data: Demo; actions: ReactNode; go: (page: string) => void }) {
  const [selected, setSelected] = useState(data.versions.at(-1)?.submission.submissionVersion ?? 1);
  const version = data.versions.find(v => v.submission.submissionVersion === selected) ?? data.versions.at(-1);
  return <section className="cp-page cp-history"><Heading title="Work and public feedback">{version && <GlideSelect ariaLabel="Submission version" value={String(version.submission.submissionVersion)} onChange={value => setSelected(Number(value) as 1 | 2)} options={data.versions.map(v => ({ value: String(v.submission.submissionVersion), label: `V${v.submission.submissionVersion} · submitted` }))}/>}</Heading>
    {version ? <HistoryVersion key={version.submission.submissionId} data={data} version={version} actions={actions}/>
      : <section className="eb-panel cp-empty"><Icon/><h2>No formal work snapshot yet</h2><p>Your drafts are separate from submitted work.</p><button className="eb-action" onClick={() => go('tasks')}>View task status</button></section>}
  </section>;
}
function HistoryVersion({ data, version, actions }: { data: Demo; version: Version; actions: ReactNode }) {
  const [modal, setModal] = useState<'work' | 'process' | 'compare' | null>(null), [focus, setFocus] = useState<Finding | null>(null), [resource, setResource] = useState<Resource | null>(null);
  const s = version.submission;
  return <div className="cp-history-grid"><section className="cp-work-reading"><div className="cp-section-heading"><h2>{data.task.title}</h2><small>Read-only snapshot · V{s.submissionVersion}</small></div><div className="cp-history-summary"><small>Submitted summary</small><p className="cp-clamp">{s.summary}</p></div>
    <div className="cp-work-cards">{sections.map((section, i) => <SpotlightCard as="article" key={section} className={`eb-finding cp-work-card ${focus?.section === section ? 'selected' : ''}`}><header><Icon name={icons[i]}/><small>{section}</small></header>{s.findings.filter(f => f.section === section).length ? s.findings.filter(f => f.section === section).slice(0, 1).map(f => <div className="cp-finding-preview" key={f.id}><button className="cp-card-open" onClick={() => setFocus(f)}><h3>{f.title}</h3><p className="cp-clamp">{f.detail}</p></button>{f.source && <LinkButton onClick={() => { const r = data.dataset.resources.find(item => item.id === f.source); if (r) setResource(r); }}>{sourceTitle(f.source)}</LinkButton>}</div>) : <p className="cp-muted">No cards supplied in this section.</p>}{s.findings.filter(f => f.section === section).length > 1 && <button className="cp-link" onClick={() => setModal('work')}>View all cards ({s.findings.filter(f => f.section === section).length})</button>}</SpotlightCard>)}</div>
    <footer className="cp-history-tools"><LinkButton onClick={() => setModal('work')}>View complete work</LinkButton><LinkButton onClick={() => setModal('process')}>Process record</LinkButton>{data.versions.length === 2 && <LinkButton onClick={() => setModal('compare')}>Compare V1 → V2</LinkButton>}</footer>
  </section><aside className="cp-review-rail"><button className="cp-link" onClick={() => download(`${data.candidate.id}-${s.submissionId}-v${s.submissionVersion}-work.md`, `# ${data.candidate.name} · V${s.submissionVersion}\n\nSubmission: ${s.submissionId}\nFingerprint: ${s.contentFingerprint}\n\n${workMarkdown(s)}`, 'text/markdown')}><Icon/>Export work</button><div className="cp-review-body"><small>V{s.submissionVersion} · public feedback</small><h2>Recruiter feedback</h2><span className="r5-state">{version.review ? decisionLabel(version.review.decision) : 'Awaiting review'}</span>{version.review ? <><blockquote>{version.review.comment}</blockquote><small>{new Date(version.review.reviewedAt).toLocaleString()}</small></> : <p>Your work is saved. Feedback will appear after this version is reviewed.</p>}</div><div className="cp-review-actions">{actions}{data.workflow.isTerminal && <p>Task closed · no V3. Evidence confirmation is not a hiring decision.</p>}</div></aside>
    {modal === 'work' && <Dialog title={`V${s.submissionVersion} · public work snapshot`} close={() => setModal(null)}><WorkSnapshot data={data} version={version}/></Dialog>}
    {modal === 'process' && <Dialog title="Process record" close={() => setModal(null)}><ProcessTimeline events={s.processEvidence}/></Dialog>}
    {modal === 'compare' && data.versions.length === 2 && <Dialog title="Compare V1 → V2" close={() => setModal(null)}><VersionComparison before={data.versions[0].submission} after={data.versions[1].submission}/></Dialog>}
    {focus && <Dialog title={focus.title} close={() => setFocus(null)}><p>{focus.section}</p><p className="eb-preserve">{focus.detail}</p><small>Self-confidence {focus.confidence}</small>{focus.source && <p>{sourceTitle(focus.source)}</p>}</Dialog>}
    {resource && <ResourceDialog resource={resource} close={() => setResource(null)}/>}
  </div>;
}
