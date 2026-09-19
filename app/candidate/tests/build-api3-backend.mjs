import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// API3 is a historical regression target. Never silently run it against API4.
const root=resolve(process.env.EB_API3_BACKEND_ROOT || fileURLToPath(new URL('../../../',import.meta.url)));
const result=spawnSync(process.execPath,[resolve(root,'app/backend/node_modules/typescript/bin/tsc'),'-p',resolve(root,'app/backend/tsconfig.json')],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);

// A retained api3-types.ts is not proof that the executable still serves API3.
// Probe the selected executable in memory before creating any browser test DB.
const { createRevision5App }=await import(pathToFileURL(resolve(root,'app/backend/dist/r5/app.js')).href);
const app=await createRevision5App({analysisMode:'disabled'});
try {
  await app.ready();
  const response=await app.inject({method:'GET',url:'/healthz',headers:{host:'127.0.0.1:8787'}});
  if(response.statusCode!==200 || response.json().schemaVersion!=='3.0') {
    throw new Error('API3 regression requires an API3 executable. Set EB_API3_BACKEND_ROOT to the historical 80d153b checkout; API4 integration uses the current tree.');
  }
  console.log('API3 regression backend built and verified in memory.');
} finally { await app.close(); }
