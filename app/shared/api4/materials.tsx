import React, { useState } from 'react';
import type { Demo, SourceRef } from '../api4-types';
import { Dialog } from '../api-ui';
import { download } from '../api';
import { resolveSourceRef } from './hr-model';

type Material = Demo['application']['sources'][number];
export const materialTitle = (source: Material) => source.kind === 'application' ? 'Original CV · public extract' : source.sourceId.replace(/_/g, ' ');
export function materialUrl(base: string, path: string): string | null {
  // Only service-relative allowlisted PDF routes; never trust an arbitrary URL.
  return /^\/api\/demo\/materials\/(?:[a-z0-9-]+\/)?[a-z0-9-]+\.pdf$/.test(path) ? `${base.replace(/\/$/, '')}${path}` : null;
}
export function PdfLink({ base, path, children }: { base: string; path: string; children: React.ReactNode }) {
  const url = materialUrl(base, path);
  return url ? <a className="eb-action" href={url} target="_blank" rel="noopener noreferrer">{children}</a> : <span>Original PDF unavailable</span>;
}
export function MaterialProvenance({ source, base }: { source: Material; base: string }) {
  if (!source.provenance) return <p>Source provenance unavailable. Do not infer origin or verification.</p>;
  return <div className="r6-provenance"><span className="r5-state">{source.kind === 'application' ? 'Original fictional CV' : 'Synthetic demo work sample'}</span><p>{source.provenance.disclosure}</p><small>{source.provenance.pageNumbers.length ? `PDF page ${source.provenance.pageNumbers.join(', ')}` : 'Companion text · not a submitted task'}</small>{source.provenance.downloadUrl && <PdfLink base={base} path={source.provenance.downloadUrl}>Download original CV PDF</PdfLink>}<details><summary>Source details</summary><p>{source.sourceId} · {source.location}</p><p>{source.provenance.filePath}</p><p>Displayed text SHA-256: {source.provenance.sha256}</p></details></div>;
}
export function MaterialDialog({ data, source, quote, base, close }: { data: Demo; source: Material; quote?: SourceRef; base: string; close: () => void }) {
  const valid = !quote || resolveSourceRef(data.candidate.id, data.application, quote);
  return <Dialog title={`${data.candidate.name} · ${materialTitle(source)}`} close={close}><MaterialProvenance source={source} base={base}/>{valid ? <pre className="r6-source-text">{quote ? <>{source.text.slice(0, quote.start)}<mark>{source.text.slice(quote.start, quote.end)}</mark>{source.text.slice(quote.end)}</> : source.text}</pre> : <p role="alert">This quotation does not match this person and application snapshot.</p>}<button className="eb-action" onClick={() => download(`${data.candidate.id}-${source.sourceId}.txt`, source.text)}>Download displayed text</button></Dialog>;
}
export function ApplicationMaterials({ data, base }: { data: Demo; base: string }) {
  const [source, setSource] = useState<Material | null>(null);
  return <section className="eb-panel r6-materials"><h2>Application source library</h2><p>Original CV and synthetic past-project companions. These are separate from company task data and submitted V1/V2 work.</p><div className="r6-material-grid">{data.application.sources.map(s => <button className="r5-source-card" key={s.sourceId} onClick={() => setSource(s)}><strong>{materialTitle(s)}</strong><small>{s.kind === 'application' ? 'Original CV' : 'Synthetic demo work'} · Read source →</small></button>)}</div>{source && <MaterialDialog data={data} base={base} source={source} close={() => setSource(null)}/>}</section>;
}
const categoryNames = { essential: 'Essential', desirable: 'Desirable', responsibility: 'Responsibilities' };
const statusNames = { claimed_in_cv: 'Claimed in CV', work_sample_evidence: 'Work sample evidence', further_evidence_needed: 'Further evidence needed', not_reviewed: 'Not reviewed' };
export function JobRequirements({ data, base, alignment = false }: { data: Demo; base: string; alignment?: boolean }) {
  const [quote, setQuote] = useState<SourceRef | null>(null);
  const source = quote && data.application.sources.find(s => s.sourceId === quote.sourceId && s.location === quote.location);
  return <section className="eb-panel r6-jd" aria-label={alignment ? 'Candidate JD alignment' : 'Job requirements'}><div className="eb-heading"><div><h2>{alignment ? 'JD requirements · evidence alignment' : 'Full job requirements'}</h2><p>{data.job.jd.requirements.length} requirements · no additional match percentage</p></div><PdfLink base={base} path={data.job.jd.source.downloadUrl}>Download original JD PDF</PdfLink></div><p className="eb-muted">{alignment ? 'A CV claim and a remaining evidence gap can coexist. These labels are not independent verification.' : 'Check the role basis before comparing candidates. The ten analytical standards cover part of this JD.'}</p>
    {(Object.keys(categoryNames) as Array<keyof typeof categoryNames>).map(category => <div key={category} className="r6-jd-group"><h3>{categoryNames[category]}</h3>{data.job.jd.requirements.filter(r => r.category === category).map(r => {
      const match = alignment ? data.application.jdAlignment.find(a => a.jdRequirementId === r.id) : null;
      const jdValid = data.job.jd.source.text.slice(r.start, r.end) === r.quote;
      return <details key={r.id} className="r6-jd-row"><summary><span>{r.statement}</span>{match && <span className="r6-statuses">{match.statuses.map(status => <small key={status} className={`r6-tag ${status}`}>{statusNames[status]}</small>)}</span>}</summary>{match && <><p>{match.summary}</p><div className="guide-gap"><small>REMAINING UNKNOWN / CHECK NEXT</small><p>{match.remainingUnknowns}</p></div>{match.sourceRefs.map((ref, i) => resolveSourceRef(data.candidate.id, data.application, ref) ? <button key={i} className="eb-citation" onClick={() => setQuote(ref)}>{ref.quote}<small>{ref.sourceId} · Locate original passage →</small></button> : <p key={i} role="alert">Source binding unavailable; do not treat this passage as verified.</p>)}</>}<p><strong>JD source · page {r.page}:</strong> {jdValid ? r.quote : 'Source range unavailable'}</p>{r.criterionIds.length > 0 && <small>Related analytical standards: {r.criterionIds.join(' · ')}</small>}</details>;
    })}</div>)}<details className="r6-jd-original"><summary>Read original JD text</summary><pre className="r6-source-text">{data.job.jd.source.text}</pre><small>JD version: {data.jdVersion} · Original PDF SHA-256: {data.job.jd.sha256}</small></details>{quote && source && <MaterialDialog data={data} base={base} source={source} quote={quote} close={() => setQuote(null)}/>}</section>;
}
