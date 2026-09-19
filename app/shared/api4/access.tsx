import React, { useCallback, useEffect, useState } from 'react';
import { Api4Error } from './client';

export const needsWriteAccess = (error: Api4Error | null) => !!error && (error.status === 401 || error.code === 'WRITE_AUTH_REQUIRED');
export function writeAccessUrl(base: string, origin: string): string | null {
  const url = new URL(base, origin);
  return url.origin === origin && url.pathname.replace(/\/$/, '') === '/gateway' ? `${origin}/gateway/write-access` : null;
}
export function useWriteAccess(base: string, error: Api4Error | null) {
  const url = writeAccessUrl(base, location.origin);
  const [status, setStatus] = useState<'checking' | 'read-only' | 'enabled' | 'unknown'>('checking');
  const check = useCallback(async () => {
    if (!url) { setStatus('unknown'); return; }
    try {
      const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(8000) });
      setStatus(response.ok ? 'enabled' : response.status === 401 ? 'read-only' : 'unknown');
    } catch { setStatus('unknown'); }
  }, [url]);
  useEffect(() => { void check(); window.addEventListener('focus', check); return () => window.removeEventListener('focus', check); }, [check]);
  useEffect(() => { if (needsWriteAccess(error)) setStatus('read-only'); }, [error]);
  return { url, status, check };
}
export function PermissionHelp({ base, error }: { base: string; error: Api4Error | null }) {
  if (!needsWriteAccess(error)) return null;
  const url = writeAccessUrl(base, location.origin);
  return <div className="eb-feedback" role="status"><strong>Editing access required.</strong> Your input and original request are kept. {url ? <a className="eb-action" href={url} target="_blank" rel="noopener noreferrer">Enable editing</a> : <span>Ask the host to enable editing for this service.</span>}<p>Sign in in the new tab, return here, then retry the original action. Do not refresh this page while editing.</p></div>;
}
