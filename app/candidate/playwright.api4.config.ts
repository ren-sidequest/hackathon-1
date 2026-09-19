import { defineConfig } from '@playwright/test';

const backendPort=process.env.EB_API4_TEST_BACKEND_PORT ?? '8894', candidatePort=process.env.EB_API4_TEST_CANDIDATE_PORT ?? '6474', hrPort=process.env.EB_API4_TEST_HR_PORT ?? '6487';

export default defineConfig({
  testDir: './tests', testMatch: 'api4-integration.spec.ts',
  outputDir: '../../.ci-results/api4-ui', workers: 1, fullyParallel: false,
  retries: 0, timeout: 90000,
  use: { actionTimeout: 15000, navigationTimeout: 30000, viewport: { width: 1440, height: 1000 }, colorScheme: 'light', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'node tests/build-api4-backend.mjs && node tests/api4-server.mjs', url: `http://127.0.0.1:${backendPort}/healthz`, reuseExistingServer: false, timeout: 120000 },
    { command: `npm run dev -- --port ${candidatePort} --strictPort`, url: `http://127.0.0.1:${candidatePort}`, env: { VITE_APP_MODE: 'api4-connected', VITE_API_BASE_URL: `http://127.0.0.1:${backendPort}` }, reuseExistingServer: false },
    { command: `npm run dev --prefix ../hr -- --port ${hrPort} --strictPort`, url: `http://127.0.0.1:${hrPort}`, env: { VITE_APP_MODE: 'api4-connected', VITE_API_BASE_URL: `http://127.0.0.1:${backendPort}` }, reuseExistingServer: false },
  ],
});
