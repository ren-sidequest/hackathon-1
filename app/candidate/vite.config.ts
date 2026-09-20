import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { workspaceEntry } from '../shared/workspace-entry';
export default defineConfig({
  plugins: [workspaceEntry('candidate'), react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5173, strictPort: true, fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
