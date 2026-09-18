import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Download, FileText, FileSpreadsheet, ExternalLink, Check, Clock3 } from 'lucide-react';
import { resources, csv, download, type Resource } from './data';
import { useCandidate } from './context';
import { stamp } from './state';
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'green'|'amber'|'blue'|'red'|'neutral' }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <header><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></header><div className="modal-body">{children}</div>
  </dialog>;
}
export function ResourceBrowser({ compact = false }: { compact?: boolean }) {
  const [selected, select] = useState<Resource | null>(null);
  const { dispatch, notify } = useCandidate();
  function open(resource: Resource) { select(resource); dispatch({ type: 'EVENT', title: `Viewed ${resource.name}`, ...stamp() }); }
  function save(resource: Resource) { download(resource.name, resource.text ?? csv(resource), resource.text ? 'text/markdown' : 'text/csv'); dispatch({ type: 'EVENT', title: `Downloaded ${resource.name}`, ...stamp() }); notify(`${resource.name} downloaded`); }
  return <><div className={compact ? 'resource-list compact' : 'resource-list'}>{resources.map(resource => <div className="resource-row" key={resource.name}>
    <button className="file-open" onClick={() => open(resource)} aria-label={`Open ${resource.name}`}>
      <span className={`file-icon ${resource.text ? 'md' : ''}`}>{resource.text ? <FileText size={19}/> : <FileSpreadsheet size={19}/>}</span>
      <span><strong>{resource.name}</strong><small>{compact ? `${new TextEncoder().encode(resource.text ?? csv(resource)).length.toLocaleString()} bytes` : resource.description}</small></span>
    </button>
    <button className="icon-button" aria-label={`Download ${resource.name}`} onClick={() => save(resource)}><Download size={15}/></button>
  </div>)}</div>{selected && <Modal title={selected.name} onClose={() => select(null)} wide><p className="muted">{selected.description}</p><Badge tone="blue">Synthetic demo data</Badge>
    {selected.text ? <pre className="context-document">{selected.text}</pre> : <div className="table-scroll resource-table"><table><thead><tr>{selected.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{selected.rows.map((row,i) => <tr key={i}>{row.map((value,j) => <td key={j}>{value}</td>)}</tr>)}</tbody></table></div>}
    <div className="modal-actions"><button className="button secondary" onClick={() => save(selected)}><Download size={16}/>Download file</button><button className="button primary" onClick={() => select(null)}>Back to investigation<ExternalLink size={15}/></button></div>
  </Modal>}</>;
}
export function Timeline() {
  const { state } = useCandidate();
  return <ol className="timeline">{state.events.length === 0 ? <li className="muted">Your investigation activity will appear here.</li> : state.events.map((event,i) => <li key={event.id}>
    <span className={`timeline-dot ${i === state.events.length-1 ? 'last' : ''}`}>{i === state.events.length-1 ? <Check size={10}/> : null}</span>
    <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString('en-AU',{ hour: '2-digit', minute: '2-digit' })}</time>
    <div><strong>{event.title}</strong>{event.detail && <p>{event.detail}</p>}</div>
  </li>)}</ol>;
}
export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <div className="empty"><span className="empty-icon"><Clock3 size={28}/></span><h2>{title}</h2><p>{children}</p>{action}</div>; }
