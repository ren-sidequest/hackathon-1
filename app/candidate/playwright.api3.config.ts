import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'api3-integration.spec.ts',
  outputDir: '../../.ci-results/api3-ui', workers: 1, fullyParallel: false,
  retries: 0, timeout: 90000,
  use: { actionTimeout: 15000, navigationTimeout: 30000, viewport: { width: 1440, height: 1000 }, colorScheme: 'light', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run build --prefix ../backend && node tests/api3-server.mjs', url: 'http://127.0.0.1:8793/healthz', reuseExistingServer: false, timeout: 120000 },
    { command: 'npm run dev -- --port 6373 --strictPort', url: 'http://127.0.0.1:6373', env: { VITE_APP_MODE: 'api3-connected', VITE_API_BASE_URL: 'http://127.0.0.1:8793' }, reuseExistingServer: false },
    { command: 'npm run dev --prefix ../hr -- --port 6386 --strictPort', url: 'http://127.0.0.1:6386', env: { VITE_APP_MODE: 'api3-connected', VITE_API_BASE_URL: 'http://127.0.0.1:8793' }, reuseExistingServer: false },
  ],
});
