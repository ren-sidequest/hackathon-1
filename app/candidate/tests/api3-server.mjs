// Test-only temporary SQLite service. No .env, formal DB or model credential reads.
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRevision5App } from '../../backend/dist/r5/app.js';
import { AnalysisError } from '../../backend/dist/analysis.js';
import { createTargetAnalyzer } from '../../backend/dist/r5/analysis.js';
const port=Number(process.env.EB_API3_TEST_BACKEND_PORT ?? 8793), candidatePort=process.env.EB_API3_TEST_CANDIDATE_PORT ?? '6373', hrPort=process.env.EB_API3_TEST_HR_PORT ?? '6386';
const directory = await mkdtemp(join(tmpdir(),'evidencebridge-api3-browser-'));
const control = new URL('../../../.ci-results/api3-test-control.json',import.meta.url);
const manual = createTargetAnalyzer({mode:'manual_simulation',apiKey:'',model:'',timeoutMs:2000,caseContext:''});
const options = {port,databasePath:join(directory,'test.sqlite'),adminToken:'API3-UI-SYNTHETIC-test-reset-token',allowedOrigins:[`http://127.0.0.1:${candidatePort}`,`http://127.0.0.1:${hrPort}`],analysisMode:'manual_simulation',
  analyzer:async submission => {
    if(submission.summary.includes('TEST_DISABLED'))throw new AnalysisError('AI_DISABLED',503);
    if(submission.summary.includes('TEST_DELAY'))await new Promise(resolve=>setTimeout(resolve,3500));
    return manual(submission);
  },
};
let app=await createRevision5App(options);
await app.listen({host:'127.0.0.1',port});
// A local control file also supports Windows, which has no SIGUSR2.
let restarting=false, closing=false, generation=0;
const restart=()=>{if(restarting||closing)return;restarting=true;void(async()=>{await app.close();app=await createRevision5App(options);await app.listen({host:'127.0.0.1',port});generation++;await writeFile(control,JSON.stringify({pid:process.pid,directory,generation}));restarting=false;})();};
process.on('SIGUSR2',restart);
const restartRequest=new URL('../../../.ci-results/api3-test-restart.json',import.meta.url);
const monitor=setInterval(()=>{void readFile(restartRequest,'utf8').then(text=>{const request=JSON.parse(text);if(request.pid===process.pid && request.generation===generation)restart();}).catch(()=>{});},200);
monitor.unref();
await import('node:fs/promises').then(({mkdir})=>mkdir(new URL('../../../.ci-results/',import.meta.url),{recursive:true}));
await writeFile(control,JSON.stringify({pid:process.pid,directory,generation}));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{closing=true;void app.close().then(async()=>{await rm(directory,{recursive:true,force:true});try{const state=JSON.parse(await readFile(control,'utf8'));if(state.pid===process.pid)await rm(control,{force:true});}catch{}process.exit(0);});});
