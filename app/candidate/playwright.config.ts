import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests', fullyParallel:true, retries:0, timeout:30000,
  use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1536,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'npm run dev -- --port 5173 --strictPort',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI},
});
