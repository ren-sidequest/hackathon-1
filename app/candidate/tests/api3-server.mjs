// Test-only temporary SQLite service. No .env, formal DB or model credential reads.
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRevision5App } from '../../backend/dist/r5/app.js';
import { AnalysisError } from '../../backend/dist/analysis.js';
import { createTargetAnalyzer } from '../../backend/dist/r5/analysis.js';
const directory = await mkdtemp(join(tmpdir(),'evidencebridge-api3-browser-'));
const control = new URL('../../../.ci-results/api3-test-control.json',import.meta.url);
const manual = createTargetAnalyzer({mode:'manual_simulation',apiKey:'',model:'',timeoutMs:2000,caseContext:''});
const options = {port:8793,databasePath:join(directory,'test.sqlite'),adminToken:'API3-UI-SYNTHETIC-test-reset-token',allowedOrigins:['http://127.0.0.1:6373','http://127.0.0.1:6386'],analysisMode:'manual_simulation',
  analyzer:async submission => {
    if(submission.summary.includes('TEST_DISABLED'))throw new AnalysisError('AI_DISABLED',503);
    if(submission.summary.includes('TEST_DELAY'))await new Promise(resolve=>setTimeout(resolve,3500));
    return manual(submission);
  },
};
let app=await createRevision5App(options);
await app.listen({host:'127.0.0.1',port:8793});
// File-based control works on Windows and Linux; only this test temp DB is reopened.
let restarting=false, closing=false, generation=0;
const restartRequest=join(directory,'restart.request');
const restartTimer=setInterval(async()=>{
  if(restarting||closing)return;
  restarting=true;
  try {
    let requested;
    try {requested=Number(await readFile(restartRequest,'utf8'));}catch(error){if(error.code==='ENOENT')return;throw error;}
    if(requested!==generation+1)return;
    await app.close();app=await createRevision5App(options);await app.listen({host:'127.0.0.1',port:8793});
    generation++;await writeFile(control,JSON.stringify({pid:process.pid,directory,generation}));
  }catch(error){console.error('Test service restart failed:',error.message);process.exitCode=1;}
  finally {restarting=false;}
},100);
await import('node:fs/promises').then(({mkdir})=>mkdir(new URL('../../../.ci-results/',import.meta.url),{recursive:true}));
await writeFile(control,JSON.stringify({pid:process.pid,directory,generation}));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{closing=true;clearInterval(restartTimer);void app.close().then(async()=>{await rm(directory,{recursive:true,force:true});try{const state=JSON.parse(await readFile(control,'utf8'));if(state.pid===process.pid)await rm(control,{force:true});}catch{}process.exit(0);});});
