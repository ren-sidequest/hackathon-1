import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

// Real HTTP, independent owned Node processes, disposable synthetic SQLite files, zero external model calls.
const cwd = fileURLToPath(new URL('../', import.meta.url));
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output-dir')) throw Error('Usage: node scripts/verify-r5.mjs [--output-dir PATH]');
const output = resolve(args[1] ?? join(repository, '.ci-results', 'r5-http'));
await mkdir(output, { recursive: true, mode: 0o700 });
const run = await mkdtemp(join(output, 'run-')); const databaseDir = join(run, 'databases'); await mkdir(databaseDir, { mode: 0o700 });
const admin = randomBytes(32).toString('hex'); const logs = []; const execute = promisify(execFile);
const PEOPLE = ['alex-chen','maya-patel','leo-zhang','sam-taylor'];
const TEMPLATES = [['sql','harbourcart-sql-v1'],['data-analysis','harbourcart-data-analysis-v1'],['business-problem-solving','harbourcart-bps-v1']];
const IDS = ['S1','S2','S3','D1','D2','D3','B1','B2','B3','B4'];
const report = { schemaVersion:'3.0', startedAt:new Date().toISOString(), node:process.version,
  scope:'TEST-STUB/manual-rule independent-process HTTP engineering acceptance; not browser, real model, human calibration or deployment.',
  modelCalls:0, checks:[], errorsObserved:[], commands:['node dist/r5/server.js','node scripts/migrate-v3.mjs'], status:'running' };
const services = new Set(); let active;
function pass(name) { report.checks.push({ name, status:'passed' }); console.log(`PASS ${report.checks.length}: ${name}`); }
async function freePort() { const s=createServer(); await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve)); const p=s.address().port; await new Promise(resolve=>s.close(resolve)); return p; }
async function start(file, contract='3.0', mode='manual_simulation', pendingStub=false) {
  const port=await freePort();
  const childArgs=pendingStub?['--input-type=module','-e',`
    import {createRevision5App} from './dist/r5/app.js';
    const app=await createRevision5App({databasePath:process.env.DATABASE_PATH,adminToken:process.env.DEMO_ADMIN_TOKEN,
      analysisMode:'manual_simulation',analyzer:()=>new Promise(()=>{}),log:e=>process.stdout.write(JSON.stringify(e)+'\\n')});
    await app.listen({host:'127.0.0.1',port:Number(process.env.PORT)});
    process.stdout.write(JSON.stringify({event:'ready',testStub:'pending-analysis'})+'\\n');
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void app.close().then(()=>process.exit(0));});
  `]:['dist/r5/server.js'];
  const child=spawn(process.execPath,childArgs,{cwd,env:{...process.env,DEMO_CONTRACT:contract,PORT:String(port),DATABASE_PATH:file,
    ANALYSIS_MODE:mode,DEMO_ADMIN_TOKEN:admin,OPENAI_API_KEY:'',OPENAI_MODEL:'',AI_TIMEOUT_MS:'1000',
    ALLOWED_ORIGINS:'http://127.0.0.1:5173,http://127.0.0.1:5186'},stdio:['ignore','pipe','pipe']});
  const service={file,contract,mode,child,base:`http://127.0.0.1:${port}`,async stop(){
    if(child.exitCode!==null||child.signalCode!==null){services.delete(service);return;}
    await new Promise(resolve=>{const timer=setTimeout(()=>child.kill('SIGKILL'),5000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill('SIGTERM');});services.delete(service);
  }}; services.add(service);
  try {
    await new Promise((resolve,reject)=>{let stdout='';const timer=setTimeout(()=>reject(Error('Synthetic child startup timed out')),10000);
      child.stdout.on('data',chunk=>{const text=String(chunk);logs.push(text);stdout+=text;if(stdout.includes('"event":"ready"')){clearTimeout(timer);resolve();}});
      child.stderr.on('data',chunk=>logs.push(String(chunk)));child.once('error',e=>{clearTimeout(timer);reject(e);});
      child.once('exit',code=>{clearTimeout(timer);reject(Error(`Synthetic child exited ${code}`));});});
    return service;
  }catch(e){await service.stop();throw e;}
}
async function http(path,body,status=200,headers={},service=active){
  const response=await fetch(`${service.base}${path}`,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{...(body===undefined?{}:{'content-type':'application/json','idempotency-key':randomUUID()}),...headers},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const payload=await response.json();assert.equal(response.status,status,`${path}: ${JSON.stringify(payload.error??payload)}`);return payload;
}
const read=async(person=PEOPLE[0])=>(await http(`/api/demo?candidateId=${person}`)).data;
const compare=async()=>(await http('/api/demo/comparison')).data;
const base=d=>({schemaVersion:'3.0',sessionId:d.sessionId,candidateId:d.candidate.id,jobId:d.job.id,datasetVersion:d.datasetVersion});
const binding=d=>({...base(d),taskId:d.task.taskId,targetRequirementId:d.task.targetRequirementId});
const analysis=d=>({...binding(d),submissionId:d.submission.submissionId,contentFingerprint:d.submission.contentFingerprint});
const review=(d,decision='confirm')=>({...analysis(d),decision,comment:'TEST-STUB public review: clarify the matched comparison and limits; no causal conclusion yet.'});
const work=(d,version=1)=>({...binding(d),submissionVersion:version,previousSubmissionId:version===2?d.submission.submissionId:null,
  previousContentFingerprint:version===2?d.submission.contentFingerprint:null,
  summary:`R5-HTTP-${d.candidate.id}-V${version}-UNIQUE: 🔎 中文\nConversion changed from 3.4% to 2.6%; the cause is still uncertain.`,findings:[],processEvidence:[]});
async function send(d,template){return (await http('/api/demo/task/send',{...binding(d),targetRequirementId:template[0],templateId:template[1],
  instructions:'TEST-STUB targeted sample: describe your calculation, evidence and limitations.',gapReason:'TEST-STUB specific missing support.'})).data;}
async function snapshotAll(){return Promise.all(PEOPLE.map(read));}
async function negative(name,path,body,status=409,headers={}){const before=await snapshotAll();const failure=await http(path,body,status,headers);
  assert.ok(failure.error?.code);assert.deepEqual(await snapshotAll(),before);report.errorsObserved.push({name,status,code:failure.error.code});pass(`${name}: explicit error and no mutation`);}
async function restart(name){const expected=await snapshotAll();const comparison=await compare();const {file,contract,mode}=active;
  await active.stop();active=await start(file,contract,mode);assert.deepEqual(await snapshotAll(),expected);assert.deepEqual(await compare(),comparison);pass(`${name}: identical four-person state after process restart`);}
function evidence(d,stage='application_review'){
  if(stage==='application_review')return d.application;const v=d.versions.find(v=>`task_v${v.submission.submissionVersion}`===stage);
  return {candidateId:d.candidate.id,evidenceSnapshotId:v.evidenceSnapshotId,fingerprint:v.submission.contentFingerprint,sources:v.submission.sources};
}
function assess(d,stage='application_review',marks){const s=evidence(d,stage),source=s.sources[0],quote=source.text.slice(0,Math.min(source.text.length,100));
  const ids=stage==='application_review'?IDS:IDS.filter(id=>id.startsWith(d.task.targetRequirementId==='sql'?'S':d.task.targetRequirementId==='data-analysis'?'D':'B'));
  return {...base(d),stage,evidenceSnapshotId:s.evidenceSnapshotId,fingerprint:s.fingerprint,submissionId:stage==='application_review'?null:d.submission.submissionId,
    contentFingerprint:stage==='application_review'?null:d.submission.contentFingerprint,rubricVersion:d.rubricVersion,expectedAssessmentRevision:d.assessment[stage]?.assessmentRevision??0,
    reuseApplication:null,operatorLabel:'TEST-STUB HTTP verifier',items:ids.map((criterionId,i)=>({criterionId,mark:marks?.[i]??2,
      rationale:'TEST-STUB synthetic engineering annotation, not an actual human assessment.',support:'Inspected the bounded source.',gaps:'Independent verification remains open.',
      uncertainty:'This test does not establish real person capability.',nextStep:'Inspect original evidence and rubric.',checkedSourceIds:[source.sourceId],
      sourceRefs:marks?.[i]==='NE'?[]:[{candidateId:s.candidateId,evidenceSnapshotId:s.evidenceSnapshotId,fingerprint:s.fingerprint,sourceId:source.sourceId,location:source.location,start:0,end:quote.length,quote}]}))};}
function shortlist(d,action='retain',stage='application_review'){const s=evidence(d,stage);return {...base(d),action,reason:`TEST-STUB manual ${action}, literal bounded evidence only.`,stage,
  evidenceSnapshotId:s.evidenceSnapshotId,fingerprint:s.fingerprint,assessmentRevision:d.assessment[stage]?.assessmentRevision??null,rubricVersion:d.rubricVersion,
  expectedShortlistRevision:d.shortlist.revision,operatorLabel:'TEST-STUB HTTP verifier'};}
async function reset(){const d=await read();await http('/api/demo/reset',{schemaVersion:'3.0',sessionId:d.sessionId},200,{'x-demo-admin-token':admin});}
async function cli(script,args=[],expected=0){try{const r=await execute(process.execPath,[`scripts/${script}.mjs`,...args],{cwd,env:{...process.env,OPENAI_API_KEY:'',OPENAI_MODEL:''},timeout:20000});
    logs.push(r.stdout,r.stderr);assert.equal(expected,0);return r.stdout;
  }catch(e){if(expected===0)throw e;assert.equal(e.code,expected);logs.push(e.stdout??'',e.stderr??'');return e.stderr;}}
const sha=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
try {
  active=await start(join(databaseDir,'r5.sqlite'));
  const health=await http('/healthz');assert.equal(health.status,'ok');
  const noSelection=await http('/api/demo',undefined,400);assert.equal(noSelection.error.code,'INVALID_REQUEST');pass('API3 default requires candidate selection, health is SQLite-ready');
  for(const template of TEMPLATES){
    const untouched=await snapshotAll();assert.equal(new Set(untouched.map(d=>d.sessionId)).size,1);
    for(const person of PEOPLE){let d=await send(await read(person),template);const body=work(d);const key=randomUUID();
      d=(await http('/api/demo/submission',body,201,{'idempotency-key':key})).data;assert.equal(d.submission.summary,body.summary);
      const replay=await http('/api/demo/submission',body,201,{'idempotency-key':key});assert.equal(replay.meta.replayed,true);
      d=(await http('/api/demo/analysis',analysis(d))).data;assert.equal(d.analysis.result.mode,'manual_simulation');
      const dimensions=d.analysis.result.observations.map(o=>o.dimension);if(template[0]!=='business-problem-solving')assert.deepEqual(dimensions,template[0]==='sql'?['S1','S2','S3']:['D1','D2','D3']);
      const one=d;d=(await http('/api/demo/review',review(d,'needs_more_evidence'))).data;const old=structuredClone(d.versions[0]);
      d=(await http('/api/demo/submission',work(d,2),201)).data;assert.deepEqual(d.versions[0],old);assert.equal(d.analysis.status,'not_started');assert.equal(d.assessment.task_v2,null);
      await negative(`${person}/${template[0]} historical review`,'/api/demo/review',review(one));
      await negative(`${person}/${template[0]} V2 More`,'/api/demo/review',review(d,'needs_more_evidence'));
      d=(await http('/api/demo/review',review(d,PEOPLE.indexOf(person)%2?'evidence_still_insufficient':'confirm'))).data;
      assert.equal(d.workflow.isTerminal,true);assert.equal(d.workflow.canSubmit,false);assert.equal(d.versions.length,2);
      assert.equal(d.report.requirements.find(r=>r.requirementId===template[0]).status,PEOPLE.indexOf(person)%2?'uncertain':'verified');
      pass(`${person}/${template[0]} real HTTP unique V1→analysis→public More→V2→terminal`);
    }
    await restart(`${template[0]} complete histories`);await reset();
  }
  for(const decision of ['confirm','evidence_still_insufficient']){
    for(const person of PEOPLE){let d=await send(await read(person),TEMPLATES[PEOPLE.indexOf(person)%3]);d=(await http('/api/demo/submission',work(d),201)).data;
      d=(await http('/api/demo/review',review(d,decision))).data;assert.equal(d.workflow.remainingSubmissions,1);assert.equal(d.workflow.isTerminal,true);
      await negative(`${person} V1 ${decision} forbids V2`,'/api/demo/submission',work(d,2));}
    await reset();
  }
  for(const person of PEOPLE){let d=await read(person);d=(await http('/api/demo/shortlist',shortlist(d))).data;assert.equal(d.shortlist.status,'retained');}
  assert.equal((await compare()).candidates.filter(p=>p.shortlist.status==='retained').length,4);pass('All four people can be explicitly retained, independently of default display count');
  let d=await read(PEOPLE[3]);const oldReason=d.shortlist.reason;const oldBasis=d.shortlist.basis;
  d=(await http('/api/demo/assessment',assess(d,'application_review',[3,3,3,3,3,3,2,2,'NE','NE']),201)).data;
  assert.equal(d.assessment.application_review.score.accruedScore,55);assert.equal(d.assessment.application_review.score.coveragePercent,80);assert.equal(d.assessment.application_review.score.overallPercentage,null);
  assert.equal(d.shortlist.status,'needs_reconfirmation');assert.equal(d.shortlist.reason,oldReason);assert.deepEqual(d.shortlist.basis,oldBasis);
  pass('Rule vector A, assessment history and shortlist stale basis over real HTTP');
  const invalid=assess(d);invalid.items[9].sourceRefs[0].quote='Fabricated source';await negative('Final invalid criterion rolls back entire assessment','/api/demo/assessment',invalid,400);
  d=(await http('/api/demo/shortlist',shortlist(d,'reconfirm'))).data;d=await send(d,TEMPLATES[2]);
  d=(await http('/api/demo/submission',work(d),201)).data;assert.equal(d.shortlist.status,'needs_reconfirmation');
  const privateBody={...work(d,2),notes:'R5-PRIVATE-NOTES-SENTINEL'};await negative('Private notes extra DTO rejected','/api/demo/submission',privateBody,400);
  await restart('Assessments and four retained people including stale basis');
  await negative('Wrong admin token preserves entire session','/api/demo/reset',{schemaVersion:'3.0',sessionId:d.sessionId},403,{'x-demo-admin-token':'TEST-STUB-wrong-admin'});
  const oldRequest=review(d);await reset();await negative('Old session review after reset','/api/demo/review',oldRequest);
  for(const person of PEOPLE){const clean=await read(person);assert.equal(clean.shortlist.revision,0);assert.equal(clean.assessment.history.length,1);assert.deepEqual(clean.versions,[]);}
  pass('Administrator reset restores four baselines and clears dynamic histories');
  await active.stop();
  active=await start(join(databaseDir,'disabled.sqlite'),'3.0','disabled');d=await send(await read(),TEMPLATES[0]);d=(await http('/api/demo/submission',work(d),201)).data;
  const disabled=await http('/api/demo/analysis',analysis(d),503);assert.equal(disabled.error.code,'AI_DISABLED');
  d=(await http('/api/demo/review',review(d))).data;assert.equal(d.workflow.isTerminal,true);pass('Disabled analysis preserves work and permits human evidence review');await active.stop();

  // A genuinely interrupted provider boundary is simulated in a separate process, not by changing saved JSON.
  const crashFile=join(databaseDir,'interrupted.sqlite');active=await start(crashFile,'3.0','manual_simulation',true);
  d=await send(await read(),TEMPLATES[2]);d=(await http('/api/demo/submission',work(d),201)).data;
  const crashRequest=analysis(d),crashKey=randomUUID(),crashingService=active;
  const interrupted=fetch(`${active.base}/api/demo/analysis`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':crashKey},
    body:JSON.stringify(crashRequest),signal:AbortSignal.timeout(15000)}).then(response=>response.text(),()=>null);
  let pendingState;for(let attempt=0;attempt<100;attempt++){pendingState=await read();if(pendingState.analysis.status==='running')break;await new Promise(resolve=>setTimeout(resolve,20));}
  assert.equal(pendingState.analysis.status,'running');
  await new Promise(resolve=>{crashingService.child.once('exit',resolve);crashingService.child.kill('SIGKILL');});services.delete(crashingService);await interrupted;
  active=await start(crashFile);const recovered=await read();assert.equal(recovered.analysis.status,'failed');assert.equal(recovered.analysis.errorCode,'AI_INTERRUPTED');
  assert.deepEqual(recovered.submission,d.submission);const interruptedReceipt=await http('/api/demo/analysis',crashRequest,503,{'idempotency-key':crashKey});
  assert.equal(interruptedReceipt.error.code,'AI_INTERRUPTED');assert.equal(interruptedReceipt.error.retryable,true);
  for(const person of PEOPLE.slice(1))assert.deepEqual((await read(person)).versions,[]);
  await http('/api/demo/analysis',analysis(recovered));pass('SIGKILL pending TEST-STUB: stale lock reclaimed, analysis and receipt fail honestly, fresh-key retry succeeds');await active.stop();

  // Create an actual API2 database using the explicit old-contract server, then migrate a stopped owned copy.
  const source=join(databaseDir,'synthetic-v2.sqlite'),destination=join(databaseDir,'migrated-v3.sqlite'),backup=join(databaseDir,'backup-v2.sqlite');
  active=await start(source,'2.0');let old=(await http('/api/demo')).data;assert.equal(old.schemaVersion,'2.0');
  const legacyBase=()=>({schemaVersion:'2.0',sessionId:old.sessionId,taskId:old.task.taskId,datasetVersion:old.datasetVersion});
  old=(await http('/api/demo/task/send',{...legacyBase(),instructions:old.task.instructions})).data;
  const legacySubmit=version=>({...legacyBase(),candidateId:old.candidate.id,submissionVersion:version,previousSubmissionId:version===2?old.submission.submissionId:null,
    previousContentFingerprint:version===2?old.submission.contentFingerprint:null,summary:`R5-MIGRATION-V${version}-UNIQUE synthetic preserved work.`,findings:[],processEvidence:[]});
  const legacyAnalysis=()=>({...legacyBase(),submissionId:old.submission.submissionId,contentFingerprint:old.submission.contentFingerprint});
  old=(await http('/api/demo/submission',legacySubmit(1),201)).data;old=(await http('/api/demo/analysis',legacyAnalysis())).data;
  old=(await http('/api/demo/review',{...legacyAnalysis(),requirementId:old.task.requirementId,decision:'needs_more_evidence',comment:'MIGRATION-V1-PUBLIC-COMMENT: clarify the evidence.'})).data;
  old=(await http('/api/demo/submission',legacySubmit(2),201)).data;old=(await http('/api/demo/analysis',legacyAnalysis())).data;
  old=(await http('/api/demo/review',{...legacyAnalysis(),requirementId:old.task.requirementId,decision:'confirm',comment:'MIGRATION-V2-PUBLIC-COMMENT: bounded synthetic evidence.'})).data;
  await active.stop();const originalHash=await sha(source);
  const migrated=JSON.parse(await cli('migrate-v3',['--source',source,'--destination',destination,'--backup',backup]));
  assert.equal(migrated.formatVersion,3);assert.equal(migrated.archivedSubmissions,2);assert.equal(await sha(source),originalHash);
  const legacyDb=new DatabaseSync(source,{readOnly:true}),newDb=new DatabaseSync(destination,{readOnly:true});
  try{assert.equal(legacyDb.prepare('PRAGMA user_version').get().user_version,2);assert.equal(newDb.prepare('PRAGMA user_version').get().user_version,3);
    assert.deepEqual(newDb.prepare('SELECT * FROM legacy_v2_submissions ORDER BY submission_version').all(),legacyDb.prepare('SELECT * FROM submissions ORDER BY submission_version').all());
    assert.deepEqual(newDb.prepare('SELECT * FROM legacy_v2_idempotency ORDER BY session_id,path,key').all(),legacyDb.prepare('SELECT * FROM idempotency ORDER BY session_id,path,key').all());
  }finally{legacyDb.close();newDb.close();}
  active=await start(destination);const restored=await read();assert.equal(restored.sessionId,old.sessionId);assert.equal(restored.task.taskId,old.task.taskId);
  for(let i=0;i<2;i++){assert.deepEqual(restored.versions[i].submission,old.versions[i].submission);assert.deepEqual(restored.versions[i].analysis,old.versions[i].analysis);assert.deepEqual(restored.versions[i].review,old.versions[i].review);}
  for(const person of PEOPLE.slice(1))assert.deepEqual((await read(person)).versions,[]);await restart('Migrated Alex history and new independent candidates');await active.stop();
  active=await start(backup,'2.0');assert.deepEqual((await http('/api/demo')).data,old);await active.stop();
  const protectedHash=await sha(destination);await cli('migrate-v3',['--source',source,'--destination',destination,'--backup',join(databaseDir,'other-backup.sqlite')],1);
  assert.equal(await sha(destination),protectedHash);pass('Copy migration preserves old V1/V2 bytes, immutable archives, backup rollback and occupied-destination protection');
  await assert.rejects(()=>start(source,'3.0'));assert.equal(await sha(source),originalHash);
  await assert.rejects(()=>start(destination,'2.0'));pass('Both database generations reject an incompatible runtime rather than implicitly converting or clearing it');
  const archiveCheck=new DatabaseSync(destination);
  try{assert.throws(()=>archiveCheck.prepare('DELETE FROM legacy_v2_submissions').run(),/immutable v2 migration archive/);}finally{archiveCheck.close();}
  pass('Migrated raw legacy archive actively rejects later writes');
  for(const kind of ['analysis_quote','private_field']){
    const corrupt=join(databaseDir,`${kind}-v2.sqlite`),badDestination=join(databaseDir,`${kind}-v3.sqlite`),badBackup=join(databaseDir,`${kind}-backup.sqlite`);
    await copyFile(source,corrupt);const db=new DatabaseSync(corrupt);
    try{
      if(kind==='analysis_quote'){const row=db.prepare('SELECT state_json FROM demo_state WHERE id=1').get();const state=JSON.parse(row.state_json);
        state.versions[0].analysis.result.observations.find(o=>o.citations.length).citations[0].quote='TEST-STUB fabricated archived quote';
        db.prepare('UPDATE demo_state SET state_json=? WHERE id=1').run(JSON.stringify(state));
      }else{const row=db.prepare('SELECT id,snapshot_json FROM submissions ORDER BY submission_version LIMIT 1').get();const sub=JSON.parse(row.snapshot_json);
        // Intentional damage only to this owned disposable copy; the original source and migration archive keep their triggers.
        db.exec('DROP TRIGGER submissions_immutable');
        sub.notes='TEST-STUB private field in corrupt saved source';db.prepare('UPDATE submissions SET snapshot_json=? WHERE id=?').run(JSON.stringify(sub),row.id);}
    }finally{db.close();}
    const corruptHash=await sha(corrupt);await cli('migrate-v3',['--source',corrupt,'--destination',badDestination,'--backup',badBackup],1);
    assert.equal(await sha(corrupt),corruptHash);await assert.rejects(readFile(badDestination),{code:'ENOENT'});
    pass(`Malformed legacy ${kind} fails domain validation before destination publication and preserves source`);
  }
  assert.ok(logs.every(line=>!line.includes(admin)&&!line.includes('R5-PRIVATE-NOTES-SENTINEL')&&!line.includes('TEST-STUB-wrong-admin')));
  pass('Child server/CLI logs exclude administrator secrets and private-note sentinel');report.status='passed';
}catch(error){report.status='failed';report.failure={name:error.name,message:error.message};process.exitCode=1;console.error(`R5 verifier failed: ${error.name}: ${error.message}`);
}finally{
  for(const service of [...services])await service.stop();report.temporaryServicesStopped=services.size===0;
  await rm(databaseDir,{recursive:true,force:true});report.temporaryDatabasesRemoved=true;report.finishedAt=new Date().toISOString();report.passedChecks=report.checks.length;
  const safeLogs=logs.join('').split(admin).join('[redacted]');await writeFile(join(run,'server-cli.log'),safeLogs,{mode:0o600});
  await writeFile(join(run,'report.json'),`${JSON.stringify(report,null,2)}\n`,{mode:0o600});
  console.log(JSON.stringify({status:report.status,passedChecks:report.passedChecks,report:join(run,'report.json'),modelCalls:0,temporaryServicesStopped:report.temporaryServicesStopped,temporaryDatabasesRemoved:true}));
}
