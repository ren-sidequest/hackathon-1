import React, { useState } from 'react';
import { download } from '../api';

/** Explicit public-text recovery only. Never imports a draft or exports private notes. */
export function recoveredPublicText(raw: string): string {
  const d = JSON.parse(raw);
  const text = (v: unknown) => typeof v === 'string' ? v : '';
  return ['Archived browser draft · not submitted, not rebound to a new candidate', text(d.summary), ...(Array.isArray(d.findings) ? d.findings.slice(0, 40).map((f: { title?: unknown; detail?: unknown }) => `${text(f.title)}\n${text(f.detail)}`) : [])].join('\n\n');
}
export function LegacyDrafts({ currentKey }: { currentKey: string }) {
  const [error, setError] = useState('');
  const [keys] = useState(() => {
    try { return Object.keys(localStorage).filter(k => /^evidencebridge\.api4\.draft\./.test(k) && k !== currentKey); }
    catch { return []; }
  });
  if (!keys.length) return null;
  return <details className="eb-panel r6-archived"><summary>Other browser drafts · {keys.length} kept separately</summary><p>These belong to another person, session or content version. Nothing is transferred or submitted automatically. Private notes stay in this browser.</p>{keys.map((key,i) => <div key={key}><details><summary>Draft {i+1} · storage identity</summary><code>{key}</code></details><button className="eb-action" onClick={() => { try { download(`archived-public-draft-${i+1}.txt`, recoveredPublicText(localStorage.getItem(key) ?? '{}')); setError(''); } catch { setError('This archived draft could not be read. Its stored copy was left unchanged.'); } }}>Export draft {i+1} public text</button></div>)}{error && <p role="alert">{error}</p>}</details>;
}
