import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { workspaceEntry } from '../shared/workspace-entry';

export default defineConfig({
  plugins: [workspaceEntry('hr')],
  // Shared source must resolve React from this app's own locked installation.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
});
