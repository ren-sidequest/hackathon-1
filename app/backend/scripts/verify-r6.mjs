import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Owned child process + temporary database. No browser, external model, live server or human calibration.
const cwd=fileURLToPath(new URL('../',import.meta.url));
const repository=fileURLToPath(new URL('../../../',import.meta.url));
const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--output-dir'))throw Error('Usage: node scripts/verify-r6.mjs [--output-dir PATH]');
const output=resolve(args[1]??join(repository,'.ci-results','r6-http'));await mkdir(output,{recursive:true,mode:0o700});
const run=await mkdtemp(join(output,'run-'));const database=join(run,'disposable-r6.sqlite');
const PEOPLE=['amy-chen','ann-li','david-liu','jamie-parker'];
const TARGETS=['sql','data-analysis','business-problem-solving'];
const report={schemaVersion:'4.0',startedAt:new Date().toISOString(),node:process.version,status:'running',scope:'Independent-process HTTP, manual simulation and disposable local SQLite; no browser, human calibration or deployment.',modelCalls:0,checks:[],errorsObserved:[]};
let active;const logs=[];
function pass(name){report.checks.push({name,status:'passed'});console.log(`PASS ${report.checks.length}: ${name}`);}
async function freePort(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function start(){
  const port=await freePort();let complete='';const child=spawn(process.execPath,['dist/r5/server.js'],{cwd,env:{...process.env,DEMO_CONTRACT:'4.0',DATABASE_PATH:database,PORT:String(port),ANALYSIS_MODE:'manual_simulation',DEMO_ADMIN_TOKEN:'',OPENAI_API_KEY:'',OPENAI_MODEL:'',ALLOWED_ORIGINS:'http://127.0.0.1:5173'},stdio:['ignore','pipe','pipe']});
  const service={base:`http://127.0.0.1:${port}`,child,async stop(){if(child.exitCode!==null||child.signalCode!==null)return;await new Promise(r=>{const timer=setTimeout(()=>child.kill('SIGKILL'),5000);child.once('exit',()=>{clearTimeout(timer);r();});child.kill('SIGTERM');});}};
  try {await new Promise((res,rej)=>{const timer=setTimeout(()=>rej(Error('Owned local R6 child startup timed out')),15000);child.stdout.on('data',c=>{logs.push(String(c));complete+=String(c);if(complete.includes('"event":"ready"')){clearTimeout(timer);res();}});child.stderr.on('data',c=>logs.push(String(c)));child.once('error',e=>{clearTimeout(timer);rej(e);});child.once('exit',code=>{clearTimeout(timer);rej(Error(`Owned child exited ${code}: ${logs.slice(-3).join('')}`));});});return service;}catch(e){await service.stop();throw e;}
}
async function http(path,body,status=200,headers={}){
  const r=await fetch(`${active.base}${path}`,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{...(body===undefined?{}:{'content-type':'application/json','idempotency-key':randomUUID()}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await r.json();assert.equal(r.status,status,`${path}: ${JSON.stringify(data.error??data)}`);return data;
}
const read=async(id=PEOPLE[0])=>(await http(`/api/demo?candidateId=${id}`)).data;
const snapshots=()=>Promise.all(PEOPLE.map(read));
const base=d=>({schemaVersion:'4.0',sessionId:d.sessionId,candidateId:d.candidate.id,jobId:d.job.id,datasetVersion:d.datasetVersion});
const binding=d=>({...base(d),taskId:d.task.taskId,targetRequirementId:d.task.targetRequirementId});
const sendBody=(d,target)=>({...binding(d),targetRequirementId:target,templateId:d.taskTemplates[target].templateId,instructions:'TEST-STUB R6: show the requested evidence and uncertainty.',gapReason:'TEST-STUB explicit reviewer selection; not a name-based recommendation.'});
const work=(d,version=1)=>({...binding(d),submissionVersion:version,previousSubmissionId:version===2?d.submission.submissionId:null,previousContentFingerprint:version===2?d.submission.contentFingerprint:null,summary:`R6-HTTP-${d.candidate.id}-V${version} 🔎 中文. Orders / sessions defines conversion; causal explanations remain unverified.`,findings:[],processEvidence:[]});
const analysis=d=>({...binding(d),submissionId:d.submission.submissionId,contentFingerprint:d.submission.contentFingerprint});
const review=(d,decision='confirm')=>({...analysis(d),decision,comment:'TEST-STUB public feedback: explain the denominator, comparison and limitations.'});
async function reject(name,path,body,status,headers={}){const before=await snapshots();const payload=await http(path,body,status,headers);assert.ok(payload.error?.code);assert.deepEqual(await snapshots(),before);report.errorsObserved.push({name,status,code:payload.error.code});pass(`${name}: explicit error, all four states unchanged`);}
async function restart(name){const before=await snapshots();const comparison=await http('/api/demo/comparison');await active.stop();active=await start();assert.deepEqual(await snapshots(),before);assert.deepEqual(await http('/api/demo/comparison'),comparison);pass(`${name}: identical four-person states after owned process restart`);}
try{
  active=await start();assert.equal((await http('/healthz')).status,'ok');const initial=await snapshots();
  assert.equal(new Set(initial.map(d=>d.sessionId)).size,1);assert.deepEqual(initial.map(d=>d.candidate.id),PEOPLE);assert.ok(initial.every(d=>d.schemaVersion==='4.0'&&d.task.targetRequirementId===null&&d.versions.length===0));
  pass('Fresh API4 database starts with four new identities and no inherited tasks/history');
  for(const old of ['alex-chen','maya-patel','leo-zhang','sam-taylor']){const bad=await http(`/api/demo?candidateId=${old}`,undefined,409);assert.ok(bad.error.code);}
  pass('All four legacy identity links fail explicitly rather than alias new people');
  await reject('Old schema client','/api/demo/task/send',{...sendBody(initial[0],'sql'),schemaVersion:'3.0'},409);
  for(let i=0;i<PEOPLE.length;i++){
    const id=PEOPLE[i],target=TARGETS[i%TARGETS.length];let d=(await http('/api/demo/task/send',sendBody(await read(id),target))).data;
    const baseline=structuredClone(d.assessment);const body=work(d),key=randomUUID();d=(await http('/api/demo/submission',body,201,{'idempotency-key':key})).data;
    assert.equal((await http('/api/demo/submission',body,201,{'idempotency-key':key})).meta.replayed,true);
    await reject(`${id} changed idempotency body`,'/api/demo/submission',{...body,summary:'Different body'},409,{'idempotency-key':key});
    d=(await http('/api/demo/analysis',analysis(d))).data;assert.equal(d.analysis.result.mode,'manual_simulation');
    const one=d;d=(await http('/api/demo/review',review(d,'needs_more_evidence'))).data;const frozen=structuredClone(d.versions[0]);
    d=(await http('/api/demo/submission',work(d,2),201)).data;assert.deepEqual(d.versions[0],frozen);assert.equal(d.analysis.status,'not_started');
    await reject(`${id} historical review`,'/api/demo/review',review(one),409);
    await reject(`${id} V2 More`,'/api/demo/review',review(d,'needs_more_evidence'),409);
    await reject(`${id} no V3`,'/api/demo/submission',{...work(d,2),submissionVersion:3},400);
    d=(await http('/api/demo/review',review(d,i%2?'evidence_still_insufficient':'confirm'))).data;
    assert.equal(d.workflow.isTerminal,true);assert.equal(d.workflow.remainingSubmissions,0);assert.deepEqual(d.assessment,baseline);assert.equal(d.shortlist.status,'not_retained');
    assert.deepEqual(d.versions[0],frozen);pass(`${id}/${target}: real HTTP V1, simulation, More, V2 and terminal review`);
    for(const future of PEOPLE.slice(i+1))assert.deepEqual((await read(future)).versions,[]);
  }
  await restart('Completed distinct target histories');
  const current=await read();await reject('Private note DTO','/api/demo/submission',{...work(current,2),notes:'R6-HTTP-PRIVATE-SENTINEL'},400);
  assert.equal(logs.join('').includes('R6-HTTP-PRIVATE-SENTINEL'),false);pass('Public output/logger retain no rejected private-note sentinel');
  const comparison=(await http('/api/demo/comparison')).data;assert.equal(comparison.stage,'application_review');assert.equal(comparison.candidates.length,4);pass('Comparison remains application stage after all four task histories');
  report.status='passed';
}catch(e){report.status='failed';report.failure=String(e?.stack??e);console.error(report.failure);process.exitCode=1;}
finally{if(active)await active.stop();report.finishedAt=new Date().toISOString();await writeFile(join(run,'report.json'),`${JSON.stringify(report,null,2)}\n`);await writeFile(join(run,'process.log'),logs.join(''));console.log(`R6 report: ${join(run,'report.json')}`);}
