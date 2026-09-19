import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CandidateId, Comparison, Demo } from '../api3-types';
import { Api3Client, Api3Error, type Pending } from './client';

export type Api3Controller = {
  data: Demo | null; comparison: Comparison | null; error: Api3Error | null;
  loading: boolean; busy: boolean; pending: Pending | null; notice: string; fresh: boolean; base: string;
  analysisBusy: boolean; analysisPending: Pending | null; retryAnalysis: () => Promise<boolean>;
  refresh: () => Promise<void>; write: (path: string, body: Record<string, unknown>) => Promise<boolean>; retry: () => Promise<boolean>;
};
const asError = (error: unknown) => error instanceof Api3Error ? error : new Api3Error('CLIENT_ERROR', 'The operation did not complete. Your input has been kept.');
export function useApi3(role: 'hr' | 'candidate', candidateId: CandidateId): Api3Controller {
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
  const client = useMemo(() => new Api3Client(base, `evidencebridge.api3.receipt.${role}.${base}`), [base, role]);
  const analysisClient = useMemo(() => new Api3Client(base, `evidencebridge.api3.analysis-receipt.${role}.${base}`), [base, role]);
  const [data, setData] = useState<Demo | null>(null), [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState<Api3Error | null>(null), [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [fresh, setFresh] = useState(false);
  const [pending, setPending] = useState(client.pending);
  const [analysisPending, setAnalysisPending] = useState(analysisClient.pending), [analysisBusy, setAnalysisBusy] = useState(false);
  const identity = useRef(candidateId); identity.current = candidateId;
  const current = useRef(data); current.current = data;
  const mounted = useRef(true), sequence = useRef(0), writing = useRef(false), analyzing = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current++; }; }, []);

  const fetchCurrent = useCallback(async (preserveError = false) => {
    const person = identity.current, request = ++sequence.current;
    setLoading(true); setFresh(false);
    if (!preserveError) setError(null);
    try {
      let [next, list] = await Promise.all([client.read(person), client.comparison()]);
      // A reset between the two GETs must not combine old and new sessions.
      if (next.sessionId !== list.sessionId || next.revision !== list.revision) [next, list] = await Promise.all([client.read(person), client.comparison()]);
      if (next.sessionId !== list.sessionId || next.revision !== list.revision) throw new Api3Error('REFRESH_CONFLICT', 'The shared case changed while loading. Refresh again.');
      if (!mounted.current || request !== sequence.current || person !== identity.current) return false;
      if (current.current?.sessionId === next.sessionId && current.current.revision > next.revision) return false;
      client.reconcile(next); analysisClient.reconcile(next); setPending(client.pending); setAnalysisPending(analysisClient.pending);
      current.current = next; setData(next); setComparison(list); setFresh(true);
      return true;
    } catch (e) {
      if (mounted.current && request === sequence.current && person === identity.current) setError(asError(e));
      return false;
    } finally { if (mounted.current && request === sequence.current) setLoading(false); }
  }, [client, analysisClient]);
  const refresh = useCallback(async () => { await fetchCurrent(); }, [fetchCurrent]);
  useEffect(() => { setNotice(''); void refresh(); }, [candidateId, refresh]);

  const execute = async (action: () => ReturnType<Api3Client['retry']>, owner: unknown, session: unknown, isAnalysis = false, path = '') => {
    const lock = isAnalysis ? analyzing : writing, transport = isAnalysis ? analysisClient : client;
    if (lock.current) return false;
    lock.current = true; if (isAnalysis) setAnalysisBusy(true); else setBusy(true); setError(null); setNotice('');
    let committed = false;
    try {
      await action(); committed = !transport.pending;
      let refreshed = false;
      if (mounted.current) { setPending(client.pending); setAnalysisPending(analysisClient.pending); refreshed = await fetchCurrent(); }
      const same = owner === identity.current && session === current.current?.sessionId;
      const saved = path === '/submission' ? 'Work submitted · waiting for human review.' : path === '/task/send' ? 'Task sent · available in the candidate workspace.' : path === '/review' ? 'Evidence review saved · public feedback is available.' : path === '/assessment' ? 'Human assessment saved · server scores updated.' : path === '/shortlist' ? 'Shortlist decision saved.' : 'Action saved.';
      if (mounted.current) setNotice(session !== current.current?.sessionId ? 'The session changed during this action. Only the current session is shown.' : committed ? `${saved} Saved on the shared service for ${owner}.${refreshed ? '' : ' Refresh is still needed before continuing.'}` : `Analysis is running for ${owner}; refresh or retry the original action.`);
      return committed && same && refreshed;
    } catch (e) {
      if (mounted.current) {
        const problem = asError(e);
        if (owner === identity.current) { setError(problem); if (problem.uncertain && !isAnalysis) setFresh(false); }
        else setNotice(`The action for ${owner} did not complete (${problem.code}). Its response was not applied to this person.`);
        setPending(client.pending); setAnalysisPending(analysisClient.pending);
        // Preserve the precise error and all editor input, but reload conflict state.
        if (asError(e).status === 409 || asError(e).code.startsWith('AI_')) await fetchCurrent(true);
      }
      return false;
    } finally { lock.current = false; if (mounted.current) { if (isAnalysis) setAnalysisBusy(false); else setBusy(false); setPending(client.pending); setAnalysisPending(analysisClient.pending); } }
  };
  const write = (path: string, body: Record<string, unknown>) => {
    if (!fresh || loading || body.candidateId !== identity.current || body.sessionId !== current.current?.sessionId) {
      setError(new Api3Error('STALE_VIEW', 'Refresh the selected person and reopen this action against the current session. Your input is kept.'));
      return Promise.resolve(false);
    }
    const isAnalysis = path === '/analysis';
    return execute(() => (isAnalysis ? analysisClient : client).write(path, body), body.candidateId, body.sessionId, isAnalysis, path);
  };
  const retry = () => execute(() => client.retry(), client.pending?.body.candidateId, client.pending?.body.sessionId, false, client.pending?.path);
  const retryAnalysis = () => execute(() => analysisClient.retry(), analysisClient.pending?.body.candidateId, analysisClient.pending?.body.sessionId, true);
  return { data: data?.candidate.id === candidateId ? data : null, comparison, error, loading, busy, pending, analysisBusy, analysisPending, notice, fresh: fresh && data?.candidate.id === candidateId, base, refresh, write, retry, retryAnalysis };
}
