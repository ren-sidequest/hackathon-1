import React from 'react';
import { Api4Error } from './client';

export const needsWriteAccess = (error: Api4Error | null) => !!error && (error.status === 401 || error.code === 'WRITE_AUTH_REQUIRED');

/** Unexpected gateway restrictions must preserve the original action, not start a login flow. */
export function PermissionHelp({ error }: { base: string; error: Api4Error | null }) {
  if (!needsWriteAccess(error)) return null;
  return <div className="eb-feedback" role="status"><strong>Editing access required by the service.</strong> This shared demo normally works without sign-in. Ask the host to check the gateway configuration. Your input and original request are kept; retry after service access is restored.</div>;
}
