import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'shared-ui.spec.ts',
  outputDir: '../../.ci-results/shared-ui',
  fullyParallel: true, retries: 0, timeout: 30000,
  use: { viewport: { width: 1536, height: 1000 }, colorScheme: 'light', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run dev -- --port 5273 --strictPort', url: 'http://127.0.0.1:5273', reuseExistingServer: !process.env.CI },
    { command: 'npm run dev --prefix ../hr -- --port 5286 --strictPort', url: 'http://127.0.0.1:5286', reuseExistingServer: !process.env.CI },
  ],
});
