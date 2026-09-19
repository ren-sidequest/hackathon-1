import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApiState } from './use-api';
import type { Citation, Demo, Resource, Version } from './api-types';
import { decisionLabel, download, resolveCitation, sections, workMarkdown } from './api';
import { resourceFinding, resourceRows } from './workspace-model';
import type { Finding } from './api-types';

export function ApiNotice({ api }: { api: ApiState }) {
  return <div className="eb-api-status">
    <div className="eb-api-status-line"><span>{api.data ? (api.fresh ? 'Shared local case · API 2.0' : 'Cached view · connection unavailable') : 'Connect to the shared local case'}</span><button className="eb-action" onClick={() => void api.refresh()} disabled={api.loading}>{api.loading ? 'Refreshing…' : 'Refresh shared case'}</button></div>
    {api.error && <div className="eb-feedback" role="alert"><strong>{api.error.code}</strong> — {api.error.message}{api.error.requestId && <small>Request ID: {api.error.requestId}</small>}</div>}
    {api.pending.map(p => <div className="eb-feedback" key={p.path}>Awaiting the original {p.path.slice(1)} receipt. <button className="eb-action" disabled={api.busy.includes(p.path === '/analysis' ? 'analysis' : 'write')} onClick={() => void api.retry(p.path)}>Retry original action</button></div>)}
    {!api.data && !api.loading && <p>Start the matching API 2.0 backend at <code>{api.base}</code>, then refresh. This build does not replace missing API data with a local simulation.</p>}
  </div>;
}
export function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current!; d.showModal(); return () => d.close(); }, []);
  return <dialog ref={ref} className="eb-dialog" aria-label={title} onCancel={close} onClick={e => { if (e.target === ref.current) close(); }}><header><h2>{title}</h2><button className="eb-action" onClick={close} aria-label="Close dialog">×</button></header>{children}</dialog>;
}
export function Heading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return <div className="eb-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>{children}</div>;
}
export function ResourceList({ resources, onEvent, onCreateFinding }: { resources: Resource[]; onEvent?: (title: string) => void; onCreateFinding?: (finding: Finding) => void }) {
  const [selected, setSelected] = useState<Resource | null>(null);
  const [search, setSearch] = useState('');
  const matches = resources.filter(r => `${r.name} ${r.description}`.toLowerCase().includes(search.toLowerCase()));
  return <><label className="eb-field">Find a resource<input type="search" aria-label="Find a resource" value={search} onChange={e => setSearch(e.target.value)}/></label><div className="eb-resources">{matches.map(r => <div key={r.id}><button className="eb-source-link" onClick={() => { setSelected(r); onEvent?.(`Viewed ${r.id}`); }}>{r.name}</button><small>{r.columns.length ? `${r.rows.length} rows · ${r.columns.length} columns` : 'Business context'} · {r.sizeBytes.toLocaleString()} bytes</small><button className="eb-action" aria-label={`Download ${r.name}`} onClick={() => { download(r.name, r.content, r.mimeType); onEvent?.(`Downloaded ${r.id}`); }}>Download</button></div>)}</div>{!matches.length && <p role="status">No matching resources.</p>}{selected && <Dialog title={selected.name} close={() => setSelected(null)}><ResourcePreview key={selected.id} resource={selected} onCreateFinding={onCreateFinding ? finding => { setSelected(null); onCreateFinding(finding); } : undefined}/></Dialog>}</>;
}
function ResourcePreview({ resource, onCreateFinding }: { resource: Resource; onCreateFinding?: (finding: Finding) => void }) {
  const [query, setQuery] = useState(''), [column, setColumn] = useState(-1), [descending, setDescending] = useState(false);
  const rows = resourceRows(resource, query, column, descending);
  return <><p>{resource.description}</p><small>Synthetic dataset · {resource.datasetVersion}</small>{resource.text ? <pre>{resource.text}</pre> : <><div className="eb-data-controls"><label>Filter rows<input type="search" aria-label="Filter resource rows" value={query} onChange={e => setQuery(e.target.value)}/></label><label>Sort column<select aria-label="Sort resource column" value={column} onChange={e => setColumn(Number(e.target.value))}><option value={-1}>Source order</option>{resource.columns.map((c, i) => <option key={c} value={i}>{c}</option>)}</select></label><button className="eb-action" disabled={column < 0} onClick={() => setDescending(!descending)}>{descending ? 'Descending' : 'Ascending'}</button></div><p role="status">{rows.length} / {resource.rows.length} rows · original source row numbers retained</p><div className="eb-table-scroll"><table><thead><tr><th>Row</th>{resource.columns.map(c => <th key={c}>{c}</th>)}{onCreateFinding && <th>Use evidence</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.row}><td>{row.row}</td>{row.cells.map((c, j) => <td key={j}>{c}</td>)}{onCreateFinding && <td><button className="eb-action" aria-label={`Create card from row ${row.row}`} onClick={() => onCreateFinding(resourceFinding(resource, row))}>Create card</button></td>}</tr>)}</tbody></table></div></>}{onCreateFinding && <button className="eb-action primary" onClick={() => onCreateFinding(resourceFinding(resource))}>Create card with this source</button>}<button className="eb-action" onClick={() => download(resource.name, resource.content, resource.mimeType)}>Download resource</button></>;
}
export function ApplicationSources({ data }: { data: Demo }) {
  const [source, setSource] = useState<Demo['application']['sources'][number] | null>(null);
  return <><div className="eb-resources">{data.application.sources.map(s => <div key={s.id}><button className="eb-source-link" onClick={() => setSource(s)}>{s.name}</button><small>{s.kind} · {s.provenance}</small></div>)}</div>{source && <Dialog title={source.name} close={() => setSource(null)}><p>Preset synthetic application material. No upload or dynamic parsing is claimed.</p><pre>{source.content}</pre><button className="eb-action" onClick={() => download(source.name, source.content)}>Download material</button></Dialog>}</>;
}
export function VersionPicker({ data, selected, onSelect }: { data: Demo; selected: number; onSelect: (v: number) => void }) {
  return <label className="eb-version-picker">Submission version <select aria-label="Submission version" value={selected} onChange={e => onSelect(Number(e.target.value))}>{data.versions.map(v => <option key={v.submission.submissionVersion} value={v.submission.submissionVersion}>V{v.submission.submissionVersion}{v.submission.submissionVersion === data.currentSubmissionVersion ? ' · current' : ' · history, read only'}</option>)}</select></label>;
}
export function ReviewNote({ version }: { version: Version }) {
  return version.review ? <section className="eb-panel eb-review-note"><h3>V{version.submission.submissionVersion}: {decisionLabel(version.review.decision)}</h3><p className="eb-preserve">{version.review.comment}</p><small>{new Date(version.review.reviewedAt).toLocaleString()} · Human evidence review, not a hiring decision</small></section> : <p className="eb-muted">Awaiting human review for V{version.submission.submissionVersion}.</p>;
}
export function Snapshot({ version }: { version: Version }) {
  const s = version.submission;
  return <section className="eb-panel" data-submission-id={s.submissionId}><div className="eb-heading"><h2>V{s.submissionVersion} work sample</h2><button className="eb-action" onClick={() => download(`work-sample-v${s.submissionVersion}.md`, `# V${s.submissionVersion} · ${s.submissionId}\n\n${workMarkdown(s)}`, 'text/markdown')}>Download V{s.submissionVersion} brief</button></div><small>Immutable snapshot · {new Date(s.submittedAt).toLocaleString()}</small><h3>Executive summary</h3><p className="eb-preserve">{s.summary}</p>{sections.map(section => <section key={section}><h3>{section}</h3>{s.findings.filter(f => f.section === section).map(f => <article className="eb-finding" key={f.id}><h4>{f.title}</h4><p className="eb-preserve">{f.detail}</p><small>Source: {f.source || 'Not supplied'} · Self-reported confidence: {f.confidence}</small></article>)}{!s.findings.some(f => f.section === section) && <p className="eb-muted">No evidence supplied in this section.</p>}</section>)}</section>;
}
export function ProcessTimeline({ events }: { events: Version['submission']['processEvidence'] }) {
  return <section className="eb-panel"><h2>Process evidence</h2><p className="eb-muted">Client-reported actions; these are not independent proof of ability or time spent.</p>{events.length ? <ol className="eb-events">{events.map(e => <li key={e.id}><time>{new Date(e.at).toLocaleString()}</time><strong>{e.title}</strong>{e.detail && <p>{e.detail}</p>}</li>)}</ol> : <p>No process events supplied.</p>}</section>;
}
export function AnalysisView({ version, refresh, onCitation }: { version: Version; refresh: () => void; onCitation?: (citation: Citation) => void }) {
  const [selected, setSelected] = useState<Citation | null>(null);
  const { analysis, submission } = version;
  const result = analysis.result;
  const valid = !result || (analysis.submissionId === submission.submissionId && analysis.contentFingerprint === submission.contentFingerprint && result.submissionId === submission.submissionId && result.contentFingerprint === submission.contentFingerprint);
  const source = selected ? resolveCitation(version, selected) : null;
  return <section className="eb-analysis"><h2>V{submission.submissionVersion} observable evidence</h2>
    <p className="eb-muted">Analysis: <strong>{analysis.status}</strong>. AI does not confirm evidence or make a hiring decision.</p>
    {analysis.errorCode && <p className="eb-feedback" role="status">{analysis.errorCode} · The saved work remains available for human review.</p>}
    {!valid && <p className="eb-feedback">The analysis binding does not match this version. <button className="eb-action" onClick={refresh}>Refresh evidence</button></p>}
    {valid && result && <><div className="eb-observation-map" aria-label="Observation coverage">{result.observations.map(o => <div key={o.dimension} data-observed={o.status === 'observed'}><span aria-hidden="true">{o.status === 'observed' ? '●' : '○'}</span><strong>{o.dimension}</strong><small>{o.status === 'observed' ? 'Text present' : 'Not observed'}</small></div>)}</div><div className="eb-panel"><strong>{result.mode === 'manual_simulation' ? 'Manual rules simulation · not a model run' : result.mode === 'live' ? 'Server-side model extraction' : 'Saved model result · replay'}</strong><p>{result.mode === 'manual_simulation' ? 'These observations show that text is present; they do not establish reasoning quality.' : `Model: ${result.model ?? 'Unavailable'} · ${result.provenance.generatedAt}`}</p><small>Prompt: {result.promptVersion}</small></div>{result.observations.map(o => <article className="eb-panel" key={o.dimension}><div className="eb-heading"><h3>{o.dimension}</h3><span className={`eb-chip ${o.status === 'not_observed' ? 'is-warning' : ''}`}>{o.status === 'observed' ? 'Observed text evidence' : 'Not observed'}</span></div><p className="eb-preserve">{o.statement}</p><p><strong>Scope:</strong> {o.scope}</p><p><strong>Uncertainty:</strong> {o.uncertainty}</p>{o.citations.map((c, i) => <button className="eb-citation" key={i} onClick={() => onCitation ? onCitation(c) : setSelected(c)}>{c.quote}</button>)}</article>)}</>}
    {!result && <p>No observation result is available for this version. Review the original work directly.</p>}
    {selected && <Dialog title={`V${submission.submissionVersion} source quotation`} close={() => setSelected(null)}>{source ? <><small>{source.sourceId} · {source.location}</small><pre data-source-version={submission.submissionId}>{source.text.slice(0, selected.start)}<mark>{source.text.slice(selected.start, selected.end)}</mark>{source.text.slice(selected.end)}</pre></> : <p role="alert">The citation is invalid for this version. Refresh the shared case; no different sample has been substituted.</p>}</Dialog>}
  </section>;
}

export function EvidenceReview({ version, refresh }: { version: Version; refresh: () => void }) {
  const [citation, setCitation] = useState<Citation | null>(null);
  const source = citation ? resolveCitation(version, citation) : null;
  const mark = useRef<HTMLElement>(null);
  useEffect(() => { if (citation) mark.current?.scrollIntoView({ block: 'center' }); }, [citation]);
  return <div className="eb-review-grid"><div className="eb-review-source">{citation && <section className="eb-panel" aria-label="Selected source quotation" tabIndex={-1}><div className="eb-heading"><h2>V{version.submission.submissionVersion} · exact source</h2><button className="eb-action" onClick={() => setCitation(null)}>Clear quotation</button></div>{source ? <><small>{source.sourceId} · {source.location}</small><pre data-source-version={version.submission.submissionId}>{source.text.slice(0, citation.start)}<mark ref={mark}>{source.text.slice(citation.start, citation.end)}</mark>{source.text.slice(citation.end)}</pre></> : <p role="alert">The citation is invalid for this version. No different sample has been substituted.</p>}</section>}<Snapshot version={version}/></div><aside><AnalysisView version={version} refresh={refresh} onCitation={setCitation}/></aside></div>;
}
