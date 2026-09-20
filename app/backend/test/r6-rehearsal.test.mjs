import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createRevision5App } from '../dist/r5/app.js';
import { RevisionStore } from '../dist/r5/store.js';
import { RevisionService, freshState } from '../dist/r5/service.js';
const headers = { host: '127.0.0.1:8787', 'content-type': 'application/json' };
const base = d => ({schemaVersion:d.schemaVersion,sessionId:d.sessionId,candidateId:d.candidate.id,jobId:d.job.id,datasetVersion:d.datasetVersion});
const resetBody = (d, checkpoint='ready_for_v1') => ({...base(d),taskId:d.task.taskId,expectedRevision:d.revision,checkpoint});
const read = async (app,id='amy-chen') => (await app.inject({method:'GET',url:`/api/demo?candidateId=${id}`,headers})).json().data;
const post = (app,path,payload,key=randomUUID()) => app.inject({method:'POST',url:`/api/demo${path}`,headers:{...headers,'idempotency-key':key},payload});
const ok = (r,status=200) => { assert.equal(r.statusCode,status,r.body);return r.json().data; };
const work = d => ({...base(d),taskId:d.task.taskId,targetRequirementId:d.task.targetRequirementId,submissionVersion:1,previousSubmissionId:null,previousContentFingerprint:null,summary:'Synthetic rehearsal submission',findings:[],processEvidence:[]});

test('rehearsal archives one candidate atomically, replays once, rejects old tasks and survives restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'eb-rehearsal-')), path=join(dir,'demo.sqlite');
  let app=await createRevision5App({databasePath:path});
  try {
    let d=await read(app);const ann=await read(app,'ann-li');
    const body=resetBody(d),key=randomUUID();d=ok(await post(app,'/rehearsal/restart',body,key));
    assert.equal(d.task.status,'sent');assert.equal(d.workflow.canSubmit,true);assert.notEqual(d.task.taskId,body.taskId);
    assert.equal((await post(app,'/rehearsal/restart',body,key)).json().meta.replayed,true);
    const afterAnn=await read(app,'ann-li');assert.deepEqual({...afterAnn,revision:ann.revision},ann);
    const oldWork=work(d),oldKey=randomUUID();d=ok(await post(app,'/submission',oldWork,oldKey),201);
    const sub=d.submission;const binding={...base(d),taskId:d.task.taskId,targetRequirementId:d.task.targetRequirementId,submissionId:sub.submissionId,contentFingerprint:sub.contentFingerprint};
    d=ok(await post(app,'/review',{...binding,decision:'confirm',comment:'Synthetic human review'}));
    const beforeReset=structuredClone(d);d=ok(await post(app,'/rehearsal/restart',resetBody(d,'before_task')));
    assert.equal(d.task.status,'draft');assert.equal(d.submission,null);assert.equal(d.versions.length,0);
    assert.deepEqual(d.assessment.application_review,beforeReset.assessment.application_review);
    assert.equal((await post(app,'/submission',oldWork,oldKey)).statusCode,409);
    assert.equal((await post(app,'/review',{...binding,decision:'confirm',comment:'stale'})).statusCode,409);
    assert.equal((await post(app,'/rehearsal/restart',body)).statusCode,409);
    assert.equal((await post(app,'/rehearsal/restart',{...resetBody(d),candidateId:'ann-li'})).statusCode,409);
    assert.equal((await post(app,'/rehearsal/restart',{...resetBody(d),checkpoint:'invalid'})).statusCode,400);
    assert.equal((await post(app,'/reset',{schemaVersion:'4.0',sessionId:d.sessionId})).statusCode,503);
    await app.close();const db=new DatabaseSync(path,{readOnly:true});
    try { const rows=db.prepare('SELECT * FROM rehearsal_archives ORDER BY rowid').all();assert.equal(rows.length,2);const archived=JSON.parse(rows[1].state_json);assert.equal(archived.versions[0].submission.submissionId,sub.submissionId);assert.equal(archived.versions[0].review.decision,'confirm');assert.ok(JSON.parse(rows[1].receipts_json).length>=3); } finally {db.close();}
    app=await createRevision5App({databasePath:path});assert.deepEqual(await read(app),d);
  } finally {await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('rehearsal rejects concurrent stale revision without changing the case',async()=>{
  const app=await createRevision5App();try {
    const old=await read(app);await post(app,'/rehearsal/restart',resetBody(await read(app,'ann-li')));
    const before=await read(app);const r=await post(app,'/rehearsal/restart',resetBody(old));
    assert.equal(r.statusCode,409);assert.equal(r.json().error.code,'STALE_REHEARSAL');assert.deepEqual(await read(app),before);
  } finally {await app.close();}
});

test('archive failure rolls back state and existing receipts',()=>{
  const store=new RevisionStore(':memory:');
  try {
    const s=freshState();store.transaction(()=>{store.setState(s);store.saveReceipt(s.sessionId,'amy-chen','/test','test-key','hash',{status:200,body:{}});});
    const service=new RevisionService(store,async()=>{throw Error('unused');});
    const original=store.archiveCandidate.bind(store);
    store.archiveCandidate=(...args)=>{original(...args);throw Error('simulated disk failure');};
    assert.throws(()=>service.restart({schemaVersion:'4.0',sessionId:s.sessionId,candidateId:'amy-chen',jobId:'junior-data-analyst',datasetVersion:s.datasetVersion,taskId:s.people['amy-chen'].task.taskId,expectedRevision:s.revision,checkpoint:'ready_for_v1'},randomUUID()),/simulated disk failure/);
    assert.deepEqual(store.getState(),s);assert.ok(store.getReceipt(s.sessionId,'amy-chen','/test','test-key'));
  } finally {store.close();}
});

test('a running analysis prevents rehearsal reset without losing the submission',async()=>{
  let finish,started;const signal=new Promise(resolve=>{started=resolve;});
  const app=await createRevision5App({analysisMode:'live',analyzer:async()=>{started();await new Promise(resolve=>{finish=resolve;});throw Error('test provider fails');}});
  try {
    let d=ok(await post(app,'/rehearsal/restart',resetBody(await read(app))));d=ok(await post(app,'/submission',work(d)),201);
    const analysis=post(app,'/analysis',{...base(d),taskId:d.task.taskId,targetRequirementId:d.task.targetRequirementId,submissionId:d.submission.submissionId,contentFingerprint:d.submission.contentFingerprint});
    const running=Promise.resolve(analysis);await signal;
    const before=await read(app);const r=await post(app,'/rehearsal/restart',resetBody(before));
    assert.equal(r.statusCode,409);assert.equal(r.json().error.code,'ANALYSIS_RUNNING');assert.deepEqual(await read(app),before);
    finish();await running;
  } finally {finish?.();await app.close();}
});
