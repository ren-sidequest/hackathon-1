import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'shared-ui.spec.ts',
  outputDir: '../../.ci-results/shared-ui',
  fullyParallel: true, retries: 0, timeout: 30000,
  use: { viewport: { width: 1536, height: 1000 }, colorScheme: 'light', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run dev -- --port 5573 --strictPort', url: 'http://127.0.0.1:5573', env: { VITE_APP_MODE: 'standalone' }, reuseExistingServer: false },
    { command: 'npm run dev --prefix ../hr -- --port 5586 --strictPort', url: 'http://127.0.0.1:5586', env: { VITE_APP_MODE: 'standalone' }, reuseExistingServer: false },
  ],
});
