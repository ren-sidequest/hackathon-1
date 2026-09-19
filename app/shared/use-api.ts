import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from './api';
import type { Demo } from './api-types';

export function useApi(role: 'hr' | 'candidate') {
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
  const [clients] = useState(() => [new ApiClient(base, `eb.api2.${role}.${base}.write`), new ApiClient(base, `eb.api2.${role}.${base}.analysis`)]);
  const [data, setData] = useState<Demo | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [fresh, setFresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string[]>([]);
  const [receiptChange, setReceiptChange] = useState(0);
  const sequence = useRef(0);
  const active = useRef(new Set<string>());
  const refresh = useCallback(async (clearError = true) => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const response = await clients[0].read();
      if (request === sequence.current) {
        setData(previous => previous?.sessionId === response.data.sessionId && previous.revision > response.data.revision ? previous : response.data);
        clients.forEach(c => { c.discardStale(response.data); c.settleAnalysis(response.data); });
        setFresh(true); if (clearError) setError(null);
        setReceiptChange(n => n + 1);
      }
      return response.data;
    } catch (e) {
      if (request === sequence.current) { setFresh(false); setError(e instanceof ApiError ? e : new ApiError('READ_FAILED', 'Shared state could not be loaded.')); }
      return null;
    } finally { if (request === sequence.current) setLoading(false); }
  }, [clients]);
  useEffect(() => { void refresh(); const focus = () => { void refresh(false); }; window.addEventListener('focus', focus); window.addEventListener('hashchange', focus); return () => { window.removeEventListener('focus', focus); window.removeEventListener('hashchange', focus); }; }, [refresh]);
  useEffect(() => {
    if (data?.analysis.status !== 'running') return;
    const timer = setInterval(() => { void refresh(false); }, 2000);
    return () => clearInterval(timer);
  }, [data?.analysis.status, refresh]);
  const perform = async (path: string, body?: Record<string, unknown>, retry = false) => {
    const client = clients[path === '/analysis' ? 1 : 0];
    const lock = path === '/analysis' ? 'analysis' : 'write';
    if (active.current.has(lock)) return false;
    if (!fresh && !retry) { setError(new ApiError('REFRESH_REQUIRED', 'Refresh the shared case before writing.')); return false; }
    active.current.add(lock); setBusy([...active.current]); setError(null);
    let ok = false;
    try { if (retry) await client.retry(); else await client.write(path, body!); ok = true; }
    catch (e) { setError(e instanceof ApiError ? e : new ApiError('ACTION_FAILED', 'Action failed. Your inputs are kept.')); }
    finally {
      // Always read current state; never apply historical POST receipts to the UI.
      const current = await refresh(false);
      active.current.delete(lock); setBusy([...active.current]); setReceiptChange(n => n + 1);
      if (!current) ok = false;
    }
    return ok;
  };
  void receiptChange;
  return { data, error, fresh, loading, busy, base, refresh,
    write: (path: string, body: Record<string, unknown>) => perform(path, body),
    pending: clients.map(c => c.pending).filter(p => p !== null),
    retry: (path: string) => perform(path, undefined, true),
  };
}
export type ApiState = ReturnType<typeof useApi>;
