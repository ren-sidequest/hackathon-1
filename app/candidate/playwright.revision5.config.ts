import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'revision5.spec.ts',outputDir:'../../.ci-results/revision5-ui',
  workers:2,fullyParallel:true,retries:0,timeout:45000,
  use:{baseURL:'http://127.0.0.1:5686',viewport:{width:1536,height:1050},colorScheme:'light',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:[
    {command:'npm run dev -- --port 5673 --strictPort',url:'http://127.0.0.1:5673',env:{VITE_APP_MODE:'revision5-preview'},reuseExistingServer:false},
    {command:'npm run dev --prefix ../hr -- --port 5686 --strictPort',url:'http://127.0.0.1:5686',env:{VITE_APP_MODE:'revision5-preview'},reuseExistingServer:false},
  ],
});
