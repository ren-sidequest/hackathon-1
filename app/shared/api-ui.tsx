import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApiState } from './use-api';
import type { Citation, Demo, Resource, Version } from './api-types';
import { decisionLabel, download, resolveCitation, sections, workMarkdown } from './api';

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
export function ResourceList({ resources, onEvent }: { resources: Resource[]; onEvent?: (title: string) => void }) {
  const [selected, setSelected] = useState<Resource | null>(null);
  return <><div className="eb-resources">{resources.map(r => <div key={r.id}><button className="eb-source-link" onClick={() => { setSelected(r); onEvent?.(`Viewed ${r.id}`); }}>{r.name}</button><small>{r.description}<br/>{r.sizeBytes.toLocaleString()} bytes</small><button className="eb-action" aria-label={`Download ${r.name}`} onClick={() => { download(r.name, r.content, r.mimeType); onEvent?.(`Downloaded ${r.id}`); }}>Download</button></div>)}</div>{selected && <Dialog title={selected.name} close={() => setSelected(null)}><p>{selected.description}</p><p className="eb-muted">Synthetic dataset · {selected.datasetVersion}</p>{selected.text ? <pre>{selected.text}</pre> : <div className="eb-table-scroll"><table><thead><tr>{selected.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{selected.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}<button className="eb-action" onClick={() => download(selected.name, selected.content, selected.mimeType)}>Download resource</button></Dialog>}</>;
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
export function AnalysisView({ version, refresh }: { version: Version; refresh: () => void }) {
  const [selected, setSelected] = useState<Citation | null>(null);
  const { analysis, submission } = version;
  const result = analysis.result;
  const valid = !result || (analysis.submissionId === submission.submissionId && analysis.contentFingerprint === submission.contentFingerprint && result.submissionId === submission.submissionId && result.contentFingerprint === submission.contentFingerprint);
  const source = selected ? resolveCitation(version, selected) : null;
  return <section className="eb-analysis"><h2>V{submission.submissionVersion} observable evidence</h2>
    <p className="eb-muted">Analysis: <strong>{analysis.status}</strong>. AI does not confirm evidence or make a hiring decision.</p>
    {analysis.errorCode && <p className="eb-feedback" role="status">{analysis.errorCode} · The saved work remains available for human review.</p>}
    {!valid && <p className="eb-feedback">The analysis binding does not match this version. <button className="eb-action" onClick={refresh}>Refresh evidence</button></p>}
    {valid && result && <><div className="eb-panel"><strong>{result.mode === 'manual_simulation' ? 'Manual rules simulation · not a model run' : result.mode === 'live' ? 'Server-side model extraction' : 'Saved model result · replay'}</strong><p>{result.mode === 'manual_simulation' ? 'These observations show that text is present; they do not establish reasoning quality.' : `Model: ${result.model ?? 'Unavailable'} · ${result.provenance.generatedAt}`}</p><small>Prompt: {result.promptVersion}</small></div>{result.observations.map(o => <article className="eb-panel" key={o.dimension}><div className="eb-heading"><h3>{o.dimension}</h3><span className={`eb-chip ${o.status === 'not_observed' ? 'is-warning' : ''}`}>{o.status === 'observed' ? 'Observed text evidence' : 'Not observed'}</span></div><p className="eb-preserve">{o.statement}</p><p><strong>Scope:</strong> {o.scope}</p><p><strong>Uncertainty:</strong> {o.uncertainty}</p>{o.citations.map((c, i) => <button className="eb-citation" key={i} onClick={() => setSelected(c)}>{c.quote}</button>)}</article>)}</>}
    {!result && <p>No observation result is available for this version. Review the original work directly.</p>}
    {selected && <Dialog title={`V${submission.submissionVersion} source quotation`} close={() => setSelected(null)}>{source ? <><small>{source.sourceId} · {source.location}</small><pre data-source-version={submission.submissionId}>{source.text.slice(0, selected.start)}<mark>{source.text.slice(selected.start, selected.end)}</mark>{source.text.slice(selected.end)}</pre></> : <p role="alert">The citation is invalid for this version. Refresh the shared case; no different sample has been substituted.</p>}</Dialog>}
  </section>;
}
