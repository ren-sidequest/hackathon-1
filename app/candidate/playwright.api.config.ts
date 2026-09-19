import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'api-integration.spec.ts',
  outputDir: '../../.ci-results/api-ui', workers: 1, fullyParallel: false,
  retries: 0, timeout: 60000,
  use: { viewport: { width: 1440, height: 1000 }, colorScheme: 'light', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run build --prefix ../backend && node tests/api-server.mjs', url: 'http://127.0.0.1:8789/healthz', reuseExistingServer: false, timeout: 120000 },
    { command: 'npm run dev -- --port 5373 --strictPort', url: 'http://127.0.0.1:5373', env: { VITE_APP_MODE: 'connected', VITE_API_BASE_URL: 'http://127.0.0.1:8789' }, reuseExistingServer: false },
    { command: 'npm run dev --prefix ../hr -- --port 5386 --strictPort', url: 'http://127.0.0.1:5386', env: { VITE_APP_MODE: 'connected', VITE_API_BASE_URL: 'http://127.0.0.1:8789' }, reuseExistingServer: false },
  ],
});
