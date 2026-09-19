import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRevision5App } from '../dist/r5/app.js';
import { CRITERIA } from '../dist/r5/rubric.js';
const output=new URL('../../../docs/backend/r5/',import.meta.url);
const exampleDir=new URL('examples/',output);
const token='generated-local-example-token-only';
const apps=[]; const files=new Map();
const manifest={schemaVersion:'3.0',generatedAt:new Date().toISOString(),kind:'executed-in-memory-synthetic-fixtures',modelCalls:0,
  scope:'Owned four-candidate API 3.0 requests. Random IDs, hashes and times belong to this run; read fresh state in a running service. Preset annotations are AI-authored fixtures, not completed human calibration.',requests:[]};
const base=d=>({schemaVersion:d.schemaVersion,sessionId:d.sessionId,candidateId:d.candidate.id,jobId:d.job.id,datasetVersion:d.datasetVersion});
const task=d=>({...base(d),taskId:d.task.taskId,targetRequirementId:d.task.targetRequirementId});
const binding=d=>({...task(d),submissionId:d.submission.submissionId,contentFingerprint:d.submission.contentFingerprint});
const submit=d=>({...task(d),submissionVersion:d.workflow.nextSubmissionVersion,previousSubmissionId:d.submission?.submissionId??null,previousContentFingerprint:d.submission?.contentFingerprint??null,
  summary:'Synthetic candidate response: sessions rose to 1,180,000 while orders fell to 30,680; this describes the supplied aggregate, not a verified cause. 🔎\nCheck aligned time windows before a business decision.',
  findings:[{id:'finding-1',section:'Key Findings',title:'Clarify the denominator',detail:'Conversion uses completed orders divided by sessions; missing device history limits causal inference.',source:d.dataset.resources[0].id,confidence:'Low'}],processEvidence:[]});
function assessment(d,stage='application_review'){
 const snap=stage==='application_review'?d.application:{evidenceSnapshotId:d.versions.at(-1).evidenceSnapshotId,fingerprint:d.submission.contentFingerprint};
 const record=d.assessment[stage];
 const items=stage==='application_review'?structuredClone(d.application.baseline.items):CRITERIA.filter(c=>c.requirementId===d.task.targetRequirementId).map(c=>({criterionId:c.id,mark:'NE',rationale:'Synthetic request records insufficient material for this criterion.',support:'Only a short aggregate statement was submitted.',gaps:'No criterion-specific complete demonstration.',uncertainty:'Independent work and practical performance remain unknown.',nextStep:'Human reviewer should inspect the submitted text and document remaining gaps.',checkedSourceIds:d.submission.sources.map(s=>s.sourceId),sourceRefs:[]}));
 return {...base(d),stage,evidenceSnapshotId:snap.evidenceSnapshotId,fingerprint:snap.fingerprint,submissionId:stage==='application_review'?null:d.submission.submissionId,contentFingerprint:stage==='application_review'?null:d.submission.contentFingerprint,
  rubricVersion:d.rubricVersion,expectedAssessmentRevision:record?.assessmentRevision??0,items,reuseApplication:stage==='application_review'?null:{assessmentRevision:d.assessment.application_review.assessmentRevision,evidenceSnapshotId:d.application.evidenceSnapshotId,fingerprint:d.application.fingerprint},operatorLabel:'Synthetic example operator; not an actual human validation'};
}
const shortlist=(d,action='retain')=>({...base(d),action,reason:'Synthetic human-decision example: retain for further review within the stated evidence limits.',stage:'application_review',evidenceSnapshotId:d.application.evidenceSnapshotId,fingerprint:d.application.fingerprint,assessmentRevision:d.assessment.application_review.assessmentRevision,rubricVersion:d.rubricVersion,expectedShortlistRevision:d.shortlist.revision,operatorLabel:'Synthetic example operator'});
async function scenario(mode='manual_simulation'){
 const app=await createRevision5App({analysisMode:mode,adminToken:token});apps.push(app);await app.ready();
 const request=async(name,path,body,expected=200,admin=false)=>{
  const headers={host:'127.0.0.1:8787',...(body===undefined?{}:{'content-type':'application/json','idempotency-key':`example-${name}`}),...(admin?{'x-demo-admin-token':token}:{})};
  const r=await app.inject({method:body===undefined?'GET':'POST',url:path,headers,...(body===undefined?{}:{payload:body})});
  const payload=r.json();assert.equal(r.statusCode,expected,`${name}: ${JSON.stringify(payload.error)}`);
  files.set(`${name}.response.json`,payload);if(body!==undefined)files.set(`${name}.request.json`,body);
  manifest.requests.push({name,mode,path,method:body===undefined?'GET':'POST',status:r.statusCode,responseFile:`${name}.response.json`,...(body===undefined?{}:{requestFile:`${name}.request.json`,headers:{'Content-Type':'application/json','Idempotency-Key':headers['idempotency-key'],...(admin?{'X-Demo-Admin-Token':'<LOCAL_ADMIN_TOKEN>'}:{})}})});
  return payload.data??payload;
 };
 return {app,request};
}
try{
 const {app,request}=await scenario();
 await request('comparison-initial','/api/demo/comparison');
 const initial={};for(const id of ['alex-chen','maya-patel','leo-zhang','sam-taylor'])initial[id]=await request(`initial-${id}`,`/api/demo?candidateId=${id}`);
 await request('error-missing-candidate','/api/demo',undefined,400);
 let alex=initial['alex-chen'];
 alex=await request('shortlist-retain','/api/demo/shortlist',shortlist(alex));
 alex=await request('application-assessment-revision','/api/demo/assessment',assessment(alex),201);
 assert.equal(alex.shortlist.status,'needs_reconfirmation');
 alex=await request('shortlist-reconfirm','/api/demo/shortlist',shortlist(alex,'reconfirm'));
 for(const [id,target] of [['alex-chen','business-problem-solving'],['maya-patel','sql'],['sam-taylor','data-analysis']]){
  let d=id==='alex-chen'?alex:initial[id];const template=d.taskTemplates[target];
  d=await request(`${id}-send`,'/api/demo/task/send',{...base(d),taskId:d.task.taskId,targetRequirementId:target,templateId:template.templateId,instructions:template.instructions,gapReason:'Synthetic example: a human identifies a bounded evidence gap.'});
  await request(`${id}-error-private-notes`,'/api/demo/submission',{...submit(d),notes:'PRIVATE-MUST-NOT-ENTER'},400);
  d=await request(`${id}-v1-submission`,'/api/demo/submission',submit(d),201);
  d=await request(`${id}-v1-analysis`,'/api/demo/analysis',binding(d));
  d=await request(`${id}-v1-assessment`,'/api/demo/assessment',assessment(d,'task_v1'),201);
  d=await request(`${id}-v1-more`,'/api/demo/review',{...binding(d),decision:'needs_more_evidence',comment:'Synthetic review: explain checks and limitations for the current target; one V2 is available.'});
  const previous=structuredClone(d.versions[0]);
  d=await request(`${id}-v2-submission`,'/api/demo/submission',{...submit(d),summary:submit(d).summary+' V2 clarifies that omitted raw evidence remains unavailable.'},201);
  assert.equal(d.assessment.task_v2,null);assert.deepEqual(d.versions[0],previous);
  await request(`${id}-error-v2-more`,'/api/demo/review',{...binding(d),decision:'needs_more_evidence',comment:'Third version is outside this finite task.'},409);
  d=await request(`${id}-v2-terminal`,'/api/demo/review',{...binding(d),decision:'evidence_still_insufficient',comment:'Synthetic terminal review: available evidence remains insufficient; this is not a hiring decision.'});
 }
 await request('comparison-final','/api/demo/comparison');
 await request('admin-reset','/api/demo/reset',{schemaVersion:'3.0',sessionId:alex.sessionId},200,true);
 const disabled=await scenario('disabled');let d=await disabled.request('disabled-initial','/api/demo?candidateId=leo-zhang');const t=d.taskTemplates.sql;
 d=await disabled.request('disabled-send','/api/demo/task/send',{...base(d),taskId:d.task.taskId,targetRequirementId:'sql',templateId:t.templateId,instructions:t.instructions,gapReason:'Synthetic failure-path test only; a well-supported candidate may skip a task.'});
 d=await disabled.request('disabled-submission','/api/demo/submission',submit(d),201);
 await disabled.request('analysis-disabled-error','/api/demo/analysis',binding(d),503);
 await disabled.request('analysis-failed-state','/api/demo?candidateId=leo-zhang');
 await mkdir(exampleDir,{recursive:true});
 await writeFile(new URL('openapi.json',output),`${JSON.stringify(app.swagger(),null,2)}\n`);
 files.set('manifest.json',manifest);
 for(const[name,value]of files)await writeFile(new URL(name,exampleDir),`${JSON.stringify(value,null,2)}\n`);
 console.log(`Executed ${manifest.requests.length} API3 requests; generated ${files.size} example files. No model calls or formal database changes.`);
}finally{await Promise.all(apps.map(a=>a.close()));}
