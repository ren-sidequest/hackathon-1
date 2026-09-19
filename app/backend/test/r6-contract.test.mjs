import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRevision5App } from '../dist/r5/app.js';
import { calculateScores } from '../dist/r5/scoring.js';

// Independent R6 assertions. Local synthetic records only; no model calls or human calibration.
const PEOPLE = ['amy-chen', 'ann-li', 'david-liu', 'jamie-parker'];
const IDS = ['S1','S2','S3','D1','D2','D3','B1','B2','B3','B4'];
const TARGETS = ['sql','data-analysis','business-problem-solving'];
const HOST = '127.0.0.1:8787';
async function fixture(t, options={}) {
  const app = await createRevision5App({databasePath:':memory:',analysisMode:'manual_simulation',...options});
  await app.ready(); t.after(()=>app.close()); return app;
}
function result(r, status=200) { assert.equal(r.statusCode,status,r.body); return r.json().data; }
async function read(app, id=PEOPLE[0]) { return result(await app.inject({method:'GET',url:`/api/demo?candidateId=${id}`,headers:{host:HOST}})); }
const base = d => ({schemaVersion:'4.0',sessionId:d.sessionId,candidateId:d.candidate.id,jobId:d.job.id,datasetVersion:d.datasetVersion});
const binding = d => ({...base(d),taskId:d.task.taskId,targetRequirementId:d.task.targetRequirementId});
function post(app,path,payload,key=randomUUID()) { return app.inject({method:'POST',url:`/api/demo${path}`,headers:{host:HOST,'content-type':'application/json','idempotency-key':key},payload}); }
function sendBody(d,target='sql') { return {...binding(d),targetRequirementId:target,templateId:d.taskTemplates[target].templateId,instructions:'TEST-STUB R6: explain the targeted original evidence and its limitations.',gapReason:'TEST-STUB explicit reviewer-selected evidence gap.'}; }
async function sent(app,id=PEOPLE[0],target='sql') { return result(await post(app,'/task/send',sendBody(await read(app,id),target))); }
function work(d,version=1) { return {...binding(d),submissionVersion:version,previousSubmissionId:version===2?d.submission.submissionId:null,previousContentFingerprint:version===2?d.submission.contentFingerprint:null,summary:`R6-${d.candidate.id}-V${version}: 🔎 中文. Conversion = orders / sessions. The cause remains unknown.`,findings:[],processEvidence:[]}; }
const analysis = d=>({...binding(d),submissionId:d.submission.submissionId,contentFingerprint:d.submission.contentFingerprint});
const review = (d,decision='confirm')=>({...analysis(d),decision,comment:'TEST-STUB public feedback: show the comparison and explain its limitations.'});
async function rejected(app,path,payload,statuses=[400,409],key=randomUUID()) {
  const before=await Promise.all(PEOPLE.map(id=>read(app,id))); const r=await post(app,path,payload,key);
  assert.ok(statuses.includes(r.statusCode),r.body); assert.equal(typeof r.json().error?.code,'string');
  assert.deepEqual(await Promise.all(PEOPLE.map(id=>read(app,id))),before); return r.json();
}
function ref(d,source=d.application.sources[0]) {
  return {candidateId:d.candidate.id,evidenceSnapshotId:d.application.evidenceSnapshotId,fingerprint:d.application.fingerprint,sourceId:source.sourceId,location:source.location,start:0,end:Math.min(60,source.text.length),quote:source.text.slice(0,60)};
}
function assessment(d,marks=IDS.map(()=>2)) {
  const r=ref(d); return {...base(d),stage:'application_review',evidenceSnapshotId:d.application.evidenceSnapshotId,fingerprint:d.application.fingerprint,submissionId:null,contentFingerprint:null,rubricVersion:d.rubricVersion,expectedAssessmentRevision:d.assessment.application_review?.assessmentRevision??0,reuseApplication:null,operatorLabel:'TEST-STUB R6 engineering check, not human calibration',items:IDS.map((criterionId,i)=>({criterionId,mark:marks[i],rationale:'Synthetic test annotation, not a real assessment.',support:'Literal bounded material inspected.',gaps:'Independent verification remains open.',uncertainty:'This engineering test does not measure capability.',nextStep:'A reviewer should inspect the original material.',checkedSourceIds:[r.sourceId],sourceRefs:marks[i]==='NE'?[]:[r]}))};
}
function shortlist(d,action='retain') { return {...base(d),action,reason:'TEST-STUB explicit reviewer choice, not automatic ranking.',stage:'application_review',evidenceSnapshotId:d.application.evidenceSnapshotId,fingerprint:d.application.fingerprint,assessmentRevision:d.assessment.application_review.assessmentRevision,rubricVersion:d.rubricVersion,expectedShortlistRevision:d.shortlist.revision,operatorLabel:'TEST-STUB R6 engineering check'}; }

test('R6 new contract explicitly selects new identities and rejects legacy identity/version without mutation',async t=>{
  const app=await fixture(t); const comparison=result(await app.inject({method:'GET',url:'/api/demo/comparison',headers:{host:HOST}}));
  assert.equal(comparison.schemaVersion,'4.0'); assert.deepEqual(comparison.candidates.map(x=>x.candidate.id).sort(),[...PEOPLE].sort());
  for(const id of ['alex-chen','maya-patel','leo-zhang','sam-taylor','unknown']) {
    const r=await app.inject({method:'GET',url:`/api/demo?candidateId=${id}`,headers:{host:HOST}});
    assert.equal(r.statusCode,id==='unknown'?400:409,r.body); assert.ok(r.json().error.code);
  }
  const initial=await read(app); assert.equal(initial.schemaVersion,'4.0'); assert.equal(initial.task.targetRequirementId,null); assert.equal(initial.task.templateId,null); assert.equal(initial.workflow.canSubmit,false);
  await rejected(app,'/task/send',{...sendBody(initial),schemaVersion:'3.0'},[400,409]);
  await rejected(app,'/task/send',{...sendBody(initial),sessionId:'legacy-session'},[409]);
  await rejected(app,'/task/send',{...sendBody(initial),datasetVersion:'harbourcart-2026-09-v1'},[409]);
  await rejected(app,'/task/send',{...sendBody(initial),targetRequirementId:'sql',templateId:initial.taskTemplates['data-analysis'].templateId},[409]);
});

for(const [index,target] of TARGETS.entries()) test(`R6 ${target}: explicit task, V1 More, immutable V1, terminal V2 and no V3`,async t=>{
  const app=await fixture(t); const id=PEOPLE[index]; let d=await sent(app,id,target);
  const originalAssessment=structuredClone(d.assessment); const body=work(d),key=randomUUID();
  d=result(await post(app,'/submission',body,key),201); const replay=await post(app,'/submission',body,key); result(replay,201); assert.equal(replay.json().meta.replayed,true);
  await rejected(app,'/submission',{...body,summary:'Changed replay content'},[409],key);
  await rejected(app,'/submission',work(d,2),[409]);
  d=result(await post(app,'/analysis',analysis(d))); assert.equal(d.analysis.result.mode,'manual_simulation');
  const v1=d; d=result(await post(app,'/review',review(d,'needs_more_evidence'))); const frozen=structuredClone(d.versions[0]);
  assert.deepEqual(d.assessment,originalAssessment); assert.equal(d.shortlist.status,'not_retained');
  d=result(await post(app,'/submission',work(d,2)),201); assert.deepEqual(d.versions[0],frozen); assert.equal(d.analysis.status,'not_started');
  assert.equal(d.assessment.task_v2,null); assert.equal(d.submission.candidateId,id);
  await rejected(app,'/review',review(v1),[409]); await rejected(app,'/analysis',analysis(v1),[409]);
  await rejected(app,'/review',review(d,'needs_more_evidence'),[409]);
  await rejected(app,'/submission',{...work(d,2),submissionVersion:3},[400]);
  d=result(await post(app,'/review',review(d,index%2?'evidence_still_insufficient':'confirm')));
  assert.equal(d.workflow.isTerminal,true); assert.equal(d.workflow.canSubmit,false); assert.equal(d.workflow.remainingSubmissions,0);
  assert.deepEqual(d.versions[0],frozen); assert.deepEqual(d.assessment,originalAssessment); assert.equal(d.shortlist.status,'not_retained');
  for(const other of PEOPLE.filter(x=>x!==id)) assert.deepEqual((await read(app,other)).versions,[]);
});

for(const decision of ['confirm','evidence_still_insufficient']) test(`R6 V1 ${decision} terminates without granting V2`,async t=>{
  const app=await fixture(t); let d=await sent(app,'jamie-parker','business-problem-solving'); d=result(await post(app,'/submission',work(d)),201);
  d=result(await post(app,'/review',review(d,decision))); assert.equal(d.workflow.isTerminal,true); assert.equal(d.workflow.canResubmit,false);
  await rejected(app,'/submission',work(d,2),[409]);
});

test('R6 DTO limits and private notes fail atomically without logging private payloads',async t=>{
  const logs=[]; const app=await fixture(t,{log:x=>logs.push(x)}); let d=await sent(app); const payload=work(d); const sentinel='R6-PRIVATE-SENTINEL-UNPUBLISHED';
  const card={id:'card',section:'Key Findings',title:'Synthetic title',detail:'Synthetic detail',source:'website_traffic.csv',confidence:'Low'};
  const event={id:'event',at:'2026-09-19T00:00:00.000Z',title:'Synthetic event'};
  for(const invalid of [{...payload,notes:sentinel},{...payload,findings:[{...card,privateNotes:sentinel}]},{...payload,processEvidence:[{...event,notes:sentinel}]},{...payload,findings:Array.from({length:41},(_,i)=>({...card,id:`c${i}`}))},{...payload,processEvidence:Array.from({length:101},(_,i)=>({...event,id:`e${i}`}))}]) await rejected(app,'/submission',invalid,[400]);
  await rejected(app,'/submission',{...payload,summary:'x'.repeat(129*1024)},[413]);
  d=result(await post(app,'/submission',payload),201);
  for(const comment of ['','  ','x'.repeat(2001)]) await rejected(app,'/review',{...review(d),comment},[400]);
  assert.equal(JSON.stringify(logs).includes(sentinel),false); assert.equal(JSON.stringify(await read(app)).includes(sentinel),false);
});

test('R6 citation ownership and source/UTF-16 bindings reject wrong material without partial saves',async t=>{
  const app=await fixture(t); const d=await read(app); const good=assessment(d); const source=d.application.sources[0];
  for(const patch of [{candidateId:'ann-li'},{evidenceSnapshotId:'future-task-v2'},{fingerprint:'f'.repeat(64)},{sourceId:'website_traffic.csv'},{location:'another-location'},{start:-1},{end:source.text.length+1},{quote:'fabricated quotation'}]) {
    const bad=structuredClone(good); Object.assign(bad.items[9].sourceRefs[0],patch); await rejected(app,'/assessment',bad,[400]);
  }
  const bad=structuredClone(good);bad.items[0].criterionId='Z9';await rejected(app,'/assessment',bad,[400]);
  const missing=structuredClone(good);missing.items[0].mark=0;missing.items[0].sourceRefs=[];await rejected(app,'/assessment',missing,[400]);
  const accepted=result(await post(app,'/assessment',good),201);assert.equal(accepted.assessment.application_review.assessmentRevision,2);
  await rejected(app,'/assessment',good,[409]);
});

test('R6 assessment, review and shortlist remain separate; new evidence requests reconfirmation',async t=>{
  const app=await fixture(t); let d=await read(app); d=result(await post(app,'/shortlist',shortlist(d))); const priorBasis=structuredClone(d.shortlist.basis); const reason=d.shortlist.reason;
  d=result(await post(app,'/assessment',assessment(d,[3,3,3,3,3,3,2,2,'NE','NE'])),201);
  assert.equal(d.assessment.application_review.score.assessmentComplete,true); assert.equal(d.assessment.application_review.score.complete,false); assert.equal(d.assessment.application_review.score.overallPercentage,null);
  assert.equal(d.shortlist.status,'needs_reconfirmation'); assert.deepEqual(d.shortlist.basis,priorBasis); assert.equal(d.shortlist.reason,reason);
  d=result(await post(app,'/shortlist',shortlist(d,'reconfirm'))); assert.equal(d.shortlist.status,'retained');
  d=result(await post(app,'/task/send',sendBody(d,'data-analysis'))); d=result(await post(app,'/submission',work(d)),201);
  assert.equal(d.shortlist.status,'needs_reconfirmation'); const score=structuredClone(d.assessment.application_review.score);
  d=result(await post(app,'/review',review(d,'evidence_still_insufficient'))); assert.equal(d.shortlist.status,'needs_reconfirmation'); assert.deepEqual(d.assessment.application_review.score,score);
  const compare=result(await app.inject({method:'GET',url:'/api/demo/comparison',headers:{host:HOST}}));assert.equal(compare.stage,'application_review');assert.equal(compare.candidates.length,4);
});

test('R6 disabled analysis keeps submitted work and still allows manual evidence review',async t=>{
  const app=await fixture(t,{analysisMode:'disabled'}); let d=await sent(app); d=result(await post(app,'/submission',work(d)),201);
  assert.equal(d.capabilities.analysisAvailable,false); const r=await post(app,'/analysis',analysis(d)); assert.equal(r.statusCode,503,r.body); assert.equal(r.json().error.code,'AI_DISABLED');
  const unchanged=await read(app);assert.deepEqual(unchanged.submission,d.submission);d=result(await post(app,'/review',review(unchanged)));assert.equal(d.workflow.isTerminal,true);
});

const VECTORS=[
  ['A',[3,3,3,3,3,3,2,2,'NE','NE'],55,80,null,[75,75,null]],
  ['B',[2,2,'NE',3,3,3,3,3,3,3],62.5,90,null,[null,75,75]],
  ['C',[3,3,3,4,3,3,3,3,3,4],80,100,80,[75,83.3,81.3]],
  ['D',[4,4,3,3,3,2,2,1,1,1],60,100,60,[91.7,66.7,31.3]],
];
for(const [name,marks,accrued,coverage,overall,skills] of VECTORS) test(`R6 independent arithmetic vector ${name}, unrelated to applicant ranking`,()=>{
  const score=calculateScores(IDS.map((criterionId,i)=>({criterionId,mark:marks[i]})));
  assert.equal(score.accruedScore,accrued);assert.equal(score.coveragePercent,coverage);assert.equal(score.overallPercentage,overall);assert.equal(score.assessmentComplete,true);
  assert.deepEqual(score.skills.map(x=>x.percentage===null?null:Number(x.percentage.toFixed(1))),skills);
});
test('R6 arithmetic distinguishes reviewed NE, observed zero and pending null',()=>{
  const zero=calculateScores(IDS.map(criterionId=>({criterionId,mark:0})));assert.equal(zero.complete,true);assert.equal(zero.overallPercentage,0);assert.equal(zero.coveragePercent,100);
  const missing=calculateScores(IDS.map(criterionId=>({criterionId,mark:'NE'})));assert.equal(missing.assessmentComplete,true);assert.equal(missing.complete,false);assert.equal(missing.coveragePercent,0);assert.equal(missing.overallPercentage,null);
  const pending=calculateScores([],{allowPartial:true});assert.equal(pending.assessmentComplete,false);assert.equal(pending.coveragePercent,null);assert.ok(pending.criteria.every(x=>x.status==='pending'&&x.mark===null));
});

test('R6 current assessment drives gap priorities and target suggestions, not candidate name or array order',async t=>{
  const app=await fixture(t); const d=await read(app); const request=assessment(d,[4,3,'NE',4,4,4,2,0,4,4]);
  const updated=result(await post(app,'/assessment',request),201);const gaps=updated.gapSuggestions;
  assert.deepEqual(gaps.map(g=>g.criterionId),['B2','B1','S3','S2']);
  assert.deepEqual(gaps.map(g=>g.severity),['observed_problem','material_gap','missing_evidence','minor_gap']);
  assert.deepEqual(gaps.map(g=>g.priority),[1,2,2,3]);
  for(const g of gaps){assert.equal(g.requiresHumanConfirmation,true);assert.equal(g.assessmentRevision,2);assert.ok(g.priorityReason);assert.ok(g.nextStep);assert.equal(g.fingerprint,d.application.fingerprint);assert.equal(g.targetRequirementId,g.criterionId.startsWith('S')?'sql':'business-problem-solving');}
  const different=await read(app,'ann-li'); const second=result(await post(app,'/assessment',assessment(different,[4,3,'NE',4,4,4,2,0,4,4])),201);
  assert.deepEqual(second.gapSuggestions.map(g=>[g.criterionId,g.severity,g.priority,g.targetRequirementId]),gaps.map(g=>[g.criterionId,g.severity,g.priority,g.targetRequirementId]));
  assert.equal(updated.task.targetRequirementId,null);assert.equal(second.task.targetRequirementId,null);
  const compare=result(await app.inject({method:'GET',url:'/api/demo/comparison',headers:{host:HOST}}));
  assert.equal(compare.applicationsReviewed,4);assert.equal(compare.candidatesWithCompleteCoreEvidence,compare.candidates.filter(c=>c.assessment.score.complete).length);
  assert.ok(compare.candidates.every(c=>c.assessmentComplete===true));
});

test('R6 concurrent person writes preserve ownership and global key never replays another person',async t=>{
  const app=await fixture(t); const initial=await Promise.all(PEOPLE.map(id=>read(app,id)));
  const bodies=initial.map((d,i)=>sendBody(d,TARGETS[i%3]));const responses=await Promise.all(bodies.map(body=>post(app,'/task/send',body)));
  const states=responses.map(r=>result(r));assert.deepEqual(states.map(d=>d.candidate.id),PEOPLE);
  const key=randomUUID();const firstBody=work(states[0]);result(await post(app,'/submission',firstBody,key),201);
  await rejected(app,'/submission',work(states[1]),[409],key);
  const remaining=await Promise.all(states.slice(1).map(d=>post(app,'/submission',work(d))));remaining.forEach(r=>result(r,201));
  const final=await Promise.all(PEOPLE.map(id=>read(app,id)));assert.equal(new Set(final.map(d=>d.submission.submissionId)).size,4);assert.equal(new Set(final.map(d=>d.submission.contentFingerprint)).size,4);
  for(const d of final){assert.equal(d.versions.length,1);assert.equal(d.submission.candidateId,d.candidate.id);assert.match(d.submission.summary,new RegExp(d.candidate.id));}
});

test('R6 fixed PDF downloads preserve declared originals and never expose arbitrary content paths',async t=>{
  const app=await fixture(t);const d=await read(app);
  for(const [path,expected] of [['job-description.pdf','93a45567de59b2aa8580b490f9bd7995fcf528246ca5df2cd5438a0939b87e89'],['amy-chen/cv.pdf','4b7598a5d39bfdb99c0de7e99d088318bf9a6dfbfd606425b28abd1cfde6560c'],['ann-li/cv.pdf','2ea623c0d56a555d379ae4b96b4c3c2f8972b95ec3ce10504ed5b226124169b9'],['david-liu/cv.pdf','2aa6c97fc472ba97dffa451eee56f297fe917ed8f8906875cd58072559790c78'],['jamie-parker/cv.pdf','c13b285ba0a0a8d1d53440ea280d5ef55c5d1c288dd57ca36027499b39e85537']]){
    const r=await app.inject({method:'GET',url:`/api/demo/materials/${path}`,headers:{host:HOST}});assert.equal(r.statusCode,200,r.body);assert.match(r.headers['content-type'],/application\/pdf/);const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(r.rawPayload).digest('hex'),expected);
  }
  for(const path of ['manifest.json','amy-chen/cv-extracted.txt','../.env','%2e%2e/%2e%2e/.env','alex-chen/cv.pdf']){
    const r=await app.inject({method:'GET',url:`/api/demo/materials/${path}`,headers:{host:HOST}});assert.ok([400,404].includes(r.statusCode),r.body);
  }
  assert.deepEqual(await read(app),d);
});

test('R6 version negotiation preserves approved-origin CORS on 409 and permits only declared preflight headers',async t=>{
  const app=await fixture(t); const origin='http://127.0.0.1:5173';const before=await read(app);
  const response=await app.inject({method:'GET',url:'/api/demo?candidateId=amy-chen',headers:{host:HOST,origin,'x-evidencebridge-schema-version':'3.0'}});
  assert.equal(response.statusCode,409,response.body);assert.equal(response.json().error.code,'SCHEMA_MISMATCH');assert.equal(response.headers['access-control-allow-origin'],origin);assert.equal(response.headers.vary,'Origin');assert.deepEqual(await read(app),before);
  const preflight=await app.inject({method:'OPTIONS',url:'/api/demo',headers:{host:HOST,origin,'access-control-request-method':'GET','access-control-request-headers':'x-evidencebridge-schema-version'}});
  assert.equal(preflight.statusCode,204,preflight.body);assert.match(preflight.headers['access-control-allow-headers'].toLowerCase(),/x-evidencebridge-schema-version/);
  const foreign=await app.inject({method:'GET',url:'/api/demo?candidateId=amy-chen',headers:{host:HOST,origin:'https://foreign.invalid','x-evidencebridge-schema-version':'4.0'}});assert.equal(foreign.statusCode,403,foreign.body);assert.equal(foreign.headers['access-control-allow-origin'],undefined);
});
