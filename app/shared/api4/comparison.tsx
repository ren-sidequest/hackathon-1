import React, { useMemo, useState, type CSSProperties } from 'react';
import { Heading, Dialog } from '../api-ui';
import { GlideSelect } from '../glide-select';
import type { CandidateId, Comparison, Demo, RequirementId } from '../api4-types';
import { CoverageCell } from './coverage-cell';
import { comparisonPage, profileLabels, type CandidateFilter } from './comparison-model';
import { prioritizedGaps } from './gaps';
import { annotationLabel, compareValue, percent, requirements, requirementNames, resolveSourceRef, type CompareSort } from './hr-model';
import search from './icons/search.svg';
import filters from './icons/sliders-horizontal.svg';
import file from './icons/file-text.svg';
import quote from './icons/quote.svg';
import question from './icons/circle-help.svg';
import previous from './icons/chevron-left.svg';
import next from './icons/chevron-right.svg';
import arrow from './icons/arrow-right.svg';
import './comparison.css';

function Icon({src}:{src:string}) {return <span aria-hidden="true" className="cx-icon" style={{'--cx-icon':`url("${src}")`} as CSSProperties}/>;}
type Props={comparison:Comparison;criteria:Demo['rubric']['criteria'];initialId:CandidateId;select:(id:CandidateId,page?:string,criterion?:string)=>void;rubric:()=>void;fullJD:()=>void};
export function CandidateComparison({comparison,criteria,initialId,select,rubric,fullJD}:Props) {
  const [sort,setSort]=useState<CompareSort>('default'),[filter,setFilter]=useState<CandidateFilter>('all');
  const [query,setQuery]=useState(''),[page,setPage]=useState(0),[size,setSize]=useState(20),[showFilter,setShowFilter]=useState(false),[info,setInfo]=useState(false);
  const [selection,setSelection]=useState<{id:CandidateId;criterion:string}>({id:initialId,criterion:'B3'});
  const view=useMemo(()=>comparisonPage(comparison.candidates,query,filter,sort,page,size),[comparison.candidates,query,filter,sort,page,size]);
  const row=view.rows.find(r=>r.candidate.id===selection.id)??view.rows[0];
  const activeId=row?.candidate.id===selection.id?selection.criterion:'B3';
  const standard=criteria.find(c=>c.id===activeId)??criteria[0];
  const item=row?.assessment?.items.find(i=>i.criterionId===standard.id);
  const ref=item?.sourceRefs.find(r=>row && resolveSourceRef(row.candidate.id,row.application,r));
  const inspect=(id:CandidateId,criterion='B3')=>setSelection({id,criterion});
  const inspectSkill=(id:CandidateId,skill:RequirementId)=>{
    const candidate=comparison.candidates.find(r=>r.candidate.id===id)!;
    const gap=prioritizedGaps(candidate).find(g=>g.targetRequirementId===skill);
    inspect(id,gap?.criterionId??criteria.find(c=>c.requirementId===skill)?.id??'B3');
  };
  const openEvidence=()=>{if(row)select(row.candidate.id,'evidence',standard.id);};
  return <section className="cx-page">
    <div className="cx-layout">
      <div className="cx-list-area">
        <Heading eyebrow={`${comparison.company.name} · ${comparison.job.title}`} title="Compare candidates"/>
        <div className="cx-toolbar">
          <label className="cx-search"><Icon src={search}/><input type="search" aria-label="Search candidates" placeholder="Search name" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
          <button className={`eb-action cx-filter-toggle ${filter!=='all'?'primary':''}`} aria-expanded={showFilter} aria-controls="candidate-filters" onClick={()=>setShowFilter(!showFilter)}><Icon src={filters}/>Filter{filter!=='all' && <span className="cx-filter-count">1</span>}</button>
          <span className="cx-count"><strong>{view.total}</strong> candidates</span>
          <GlideSelect ariaLabel="Compare sort" value={sort} onChange={value=>{setSort(value as CompareSort);setPage(0);}} options={[{value:'default',label:'Display order'},{value:'overall',label:'Core match · complete only'},...requirements.map(r=>({value:r,label:`${requirementNames[r]} · complete only`}))]}/>
        </div>
        {showFilter && <div className="cx-filter-panel" id="candidate-filters"><label>Show<GlideSelect ariaLabel="Candidate list filter" value={filter} onChange={v=>{setFilter(v as CandidateFilter);setPage(0);}} options={[{value:'all',label:'All candidates'},{value:'retained',label:'Retained candidates'},{value:'needs_evidence',label:'Needs evidence'}]}/></label><button className="eb-source-link" onClick={()=>{setFilter('all');setQuery('');setPage(0);}}>Clear filters</button></div>}
        <section className="eb-panel cx-list">
          <div className="eb-table-scroll" role="region" aria-label="Candidate comparison table" tabIndex={0}>
            <table className="cx-table"><thead><tr><th>Candidate</th><th>Core evidence match</th><th data-local-raw>SQL</th><th>Data analysis</th><th>Business reasoning</th></tr></thead>
              <tbody>{view.rows.map(candidate=>{
                const scores=candidate.assessment?.score,id=candidate.candidate.id,value=compareValue(candidate,sort);
                const tied=value!==null && comparison.candidates.filter(other=>compareValue(other,sort)===value).length>1;
                return <tr key={id} data-candidate={id} data-selected={id===row?.candidate.id} onClick={()=>inspect(id)}>
                  <td><button className="cx-person" aria-label={`Preview ${candidate.candidate.name}`} aria-pressed={id===row?.candidate.id} onClick={e=>{e.stopPropagation();inspect(id);}}><span className="r5-avatar">{candidate.candidate.name.split(' ').map(n=>n[0]).join('')}</span><span><strong>{candidate.candidate.name}</strong><small>{profileLabels[id]??'Application materials'}</small></span></button>{candidate.shortlist.status!=='not_retained' && <small className="cx-retain-status">{candidate.shortlist.status==='retained'?'Retained':'Reconfirmation needed'}</small>}</td>
                  <td><strong className="cx-match">{scores?.overallPercentage!=null?percent(scores.overallPercentage):scores?.status==='needs_evidence'?'Needs evidence':'Not assessed'}</strong>{sort!=='default' && <small className="cx-rank-note">{value===null?'Not ranked · incomplete evidence':tied?'Tied on selected comparison':''}</small>}</td>
                  {requirements.map(skill=>{
                    const score=scores?.skills.find(s=>s.requirementId===skill),numeric=score?.percentage!=null;
                    return <td key={skill}><button className="cx-skill" aria-label={`Inspect ${candidate.candidate.name} ${requirementNames[skill]}`} onClick={e=>{e.stopPropagation();inspectSkill(id,skill);}}><strong>{numeric?percent(score!.percentage):!score||score.pendingCount?'Not assessed':'Missing evidence'}</strong><span className={`cx-bar ${numeric?'':'is-missing'}`} aria-hidden="true">{numeric && <i style={{width:`${score!.percentage}%`}}/>}</span></button></td>;
                  })}
                </tr>;
              })}</tbody>
            </table>
          </div>
          {!view.rows.length && <div className="cx-empty" role="status"><h2>No matching candidates</h2><p>Try another name or clear the filters.</p><button className="eb-action" onClick={()=>{setQuery('');setFilter('all');setPage(0);}}>Show all candidates</button></div>}
          <footer className="cx-pagination"><span role="status" aria-live="polite">Showing {view.start}–{view.end} of {view.total}</span><GlideSelect ariaLabel="Candidates per page" value={String(size)} onChange={v=>{setSize(Number(v));setPage(0);}} options={[3,10,20,50].map(n=>({value:String(n),label:`${n} per page`}))}/><button className="eb-action cx-page-button" aria-label="Previous candidates" disabled={!view.page} onClick={()=>setPage(view.page-1)}><Icon src={previous}/></button><span>{view.page+1}/{view.pages}</span><button className="eb-action cx-page-button" aria-label="Next candidates" disabled={view.page+1===view.pages} onClick={()=>setPage(view.page+1)}><Icon src={next}/></button></footer>
        </section>
        <div className="cx-footnote"><small>Synthetic materials · Rule-based scores · NE is not zero</small><button className="eb-source-link" onClick={()=>setInfo(true)}>Scoring & scope</button></div>
      </div>
      {row ? <aside className="eb-panel cx-preview" aria-label="Selected candidate evidence" data-candidate={row.candidate.id}>
        <header className="cx-preview-heading"><small>Currently viewing</small><h2>{row.candidate.name}</h2></header>
        <div className="cx-preview-body"><div className="cx-preview-skill"><h3>{requirementNames[standard.requirementId as RequirementId]}</h3><GlideSelect ariaLabel="Preview standard" value={standard.id} onChange={v=>inspect(row.candidate.id,v)} options={criteria.map(c=>({value:c.id,label:`${c.id} · ${typeof row.assessment?.items.find(i=>i.criterionId===c.id)?.mark==='number'?row.assessment!.items.find(i=>i.criterionId===c.id)!.mark+'/4':row.assessment?.items.find(i=>i.criterionId===c.id)?.mark??'—'}`}))}/></div>
          <ol className="cx-evidence-chain">
            <li><span className="cx-chain-icon"><Icon src={file}/></span><div><h3>Role requirement</h3><p className="cx-clamp" title={standard.observableSupport}>{standard.observableSupport}</p></div></li>
            <li><span className="cx-chain-icon"><Icon src={quote}/></span><div><h3>Cited evidence</h3>{ref?<button className="cx-quote" aria-label={`Open ${row.candidate.name}`} onClick={openEvidence}><span className="cx-clamp">{ref.quote}</span></button>:<p className="cx-missing">No source quotation for this standard.</p>}<button className="eb-source-link cx-source-link" onClick={openEvidence}>View original source</button></div></li>
            <li><span className="cx-chain-icon"><Icon src={question}/></span><div><h3>Open question</h3><p className="cx-clamp" title={item?.nextStep}>{item?.nextStep??'Review the original material before assessing.'}</p></div></li>
          </ol>
          <div className="cx-preview-actions"><button className="eb-action primary" onClick={openEvidence}>View full evidence<Icon src={arrow}/></button><button className="eb-action" onClick={()=>select(row.candidate.id,'shortlist')}>Human retain decision</button></div>
          <small className="cx-annotation">{annotationLabel(row.assessment?.annotationMode)}</small>
        </div>
      </aside>:<aside className="eb-panel cx-preview cx-preview-empty"><h2>Select a candidate</h2><p>Evidence appears here when a candidate is available.</p></aside>}
    </div>
    {info && <Dialog title="Scoring & comparison scope" close={()=>setInfo(false)}><p aria-label="Applications reviewed">{comparison.applicationsReviewed}/{comparison.candidates.length} Applications reviewed · includes NE judgments</p><p className="r6-complete-count">{comparison.candidatesWithCompleteCoreEvidence}/{comparison.candidates.length} complete core evidence</p><p>SQL, Data Analysis and Business Problem Solving only; this is not a full JD match. {comparison.sortPolicy} {comparison.limitations}</p><button className="eb-action" onClick={()=>{setInfo(false);rubric();}}>View ten assessment standards</button><button className="eb-action" onClick={fullJD}>View full JD requirements</button>{row && <><h3>{row.candidate.name} · Score details</h3><CoverageCell row={row} criteria={criteria} inspect={criterion=>select(row.candidate.id,'evidence',criterion)}/><p>{annotationLabel(row.assessment?.annotationMode)} · revision {row.assessment?.assessmentRevision??'—'}</p></>}</Dialog>}
  </section>;
}
