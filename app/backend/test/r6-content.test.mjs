import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { CANDIDATE_IDS, CANDIDATES, COMPANY, JOB, TASK_TEMPLATES, getApplication, validateSourceRef, validateAssessmentItems } from '../dist/r5/fixtures.js';
import { RUBRIC } from '../dist/r5/rubric.js';
import { calculateScores } from '../dist/r5/scoring.js';
import { createSeed } from '../dist/r5/task-seed.js';

const PEOPLE=['amy-chen','ann-li','david-liu','jamie-parker'];
const NAMES=['Amy Chen','Ann Li','David Liu','Jamie Parker'];
const IDS=['S1','S2','S3','D1','D2','D3','B1','B2','B3','B4'];
const content=fileURLToPath(new URL('../content/r6/',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const originalHashes={
  'job-description.pdf':'93a45567de59b2aa8580b490f9bd7995fcf528246ca5df2cd5438a0939b87e89',
  'amy-chen/cv.pdf':'4b7598a5d39bfdb99c0de7e99d088318bf9a6dfbfd606425b28abd1cfde6560c',
  'ann-li/cv.pdf':'2ea623c0d56a555d379ae4b96b4c3c2f8972b95ec3ce10504ed5b226124169b9',
  'david-liu/cv.pdf':'2aa6c97fc472ba97dffa451eee56f297fe917ed8f8906875cd58072559790c78',
  'jamie-parker/cv.pdf':'c13b285ba0a0a8d1d53440ea280d5ef55c5d1c288dd57ca36027499b39e85537',
  'harbourcart-task-dataset.json':'5269aed70e4a304b8ed642aec7c49a46ba52f22004cf6753572c4e587321d090',
};
const companions={
  'amy-chen':['channel_analysis.sql','channel_analysis.md'],
  'ann-li':['cohort_extract.sql','churn_method_note.md'],
  'david-liu':['task_queries.sql','project_readme.md'],
  'jamie-parker':['social_reporting.md','campaign_brief.md'],
};
function english(value,path='root') {
  if(typeof value==='string')assert.equal(/[\u3400-\u9fff]/u.test(value),false,`Unexpected CJK server-authored text at ${path}: ${value.slice(0,120)}`);
  else if(value && typeof value==='object')for(const [key,item] of Object.entries(value))english(item,`${path}.${key}`);
}

test('R6 five original PDF byte hashes and historical task snapshot remain unchanged',async()=>{
  for(const [file,expected] of Object.entries(originalHashes))assert.equal(sha(await readFile(resolve(content,file))),expected,file);
});
test('R6 new identities and junior-role scope do not inherit fabricated company facts',()=>{
  assert.deepEqual(CANDIDATE_IDS,PEOPLE);assert.deepEqual(CANDIDATES.map(p=>p.name),NAMES);assert.equal(COMPANY.name,'Harbour Retail');assert.equal(JOB.title,'Junior Data Analyst');
  for(const field of ['approximateHeadcount','dedicatedRecruitingTeam','budgetApprover','hiringManager'])assert.ok(!(field in COMPANY)||COMPANY[field]===null||COMPANY[field]==='Unknown',`Unsupported JD fact ${field}`);
  assert.equal(RUBRIC.label,'Core analytical evidence match');assert.deepEqual(RUBRIC.requirements.map(r=>r.maxScore),[30,30,40]);assert.equal(RUBRIC.calibrationStatus,'human_calibration_pending');
});
test('R6 eight work samples retain disclosure and public CV text minimizes contact information',async()=>{
  for(const id of PEOPLE){
    for(const file of companions[id])assert.match(await readFile(resolve(content,id,file),'utf8'),/synthetic demo work sample/i);
    const text=await readFile(resolve(content,id,'cv-public.txt'),'utf8');assert.doesNotMatch(text,/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|04XX\s*XXX\s*XXX/i);
    assert.match(await readFile(resolve(content,id,'cv-extracted.txt'),'utf8'),/Page 1/);
  }
});
test('R6 40 initial judgments are distinct owned source-backed AI-authored assessments',()=>{
  const snapshots=PEOPLE.map(getApplication);assert.equal(new Set(snapshots.map(s=>s.fingerprint)).size,4);assert.equal(new Set(snapshots.map(s=>s.evidenceSnapshotId)).size,4);
  let judgments=0;
  for(const snapshot of snapshots){
    const baseline=snapshot.baseline;assert.equal(baseline.annotationMode,'ai_authored');assert.equal(baseline.label,'AI-authored demo assessment · Human calibration pending');assert.equal(baseline.provenance.humanCalibration,'pending');assert.equal(baseline.provenance.externalExpertValidation,false);
    assert.deepEqual(baseline.items.map(i=>i.criterionId).sort(),[...IDS].sort());validateAssessmentItems(snapshot,baseline.items,IDS);
    for(const item of baseline.items){
      judgments++;assert.ok(item.checkedSourceIds.length);for(const id of item.checkedSourceIds)assert.ok(snapshot.sources.some(s=>s.sourceId===id));
      for(const field of ['rationale','support','gaps','uncertainty','nextStep'])assert.ok(item[field]?.trim());
      if(item.mark!=='NE')assert.ok(item.sourceRefs.length,`${snapshot.candidateId}/${item.criterionId}`);
      for(const ref of item.sourceRefs){assert.equal(validateSourceRef(snapshot,ref),true);assert.equal(ref.candidateId,snapshot.candidateId);assert.equal(ref.evidenceSnapshotId,snapshot.evidenceSnapshotId);assert.equal(ref.fingerprint,snapshot.fingerprint);}
    }
    assert.deepEqual(baseline.score,calculateScores(baseline.items));assert.equal(baseline.score.assessmentComplete,true);
    if(baseline.items.some(i=>i.mark==='NE')){assert.equal(baseline.score.complete,false);assert.equal(baseline.score.overallPercentage,null);}
  }
  assert.equal(judgments,40);
});
test('R6 citation validator uses UTF-16 offsets and rejects partial emoji or stale source bindings',()=>{
  const text='A🔎中文\nvisible excerpt';const snapshot={candidateId:'amy-chen',evidenceSnapshotId:'qa-snapshot',fingerprint:'a'.repeat(64),sources:[{sourceId:'qa.txt',location:'/sources/0/text',text,kind:'application'}]};
  const ref={candidateId:snapshot.candidateId,evidenceSnapshotId:snapshot.evidenceSnapshotId,fingerprint:snapshot.fingerprint,sourceId:'qa.txt',location:'/sources/0/text',start:1,end:6,quote:'🔎中文\n'};
  assert.equal(validateSourceRef(snapshot,ref),true);
  for(const patch of [{candidateId:'ann-li'},{fingerprint:'b'.repeat(64)},{start:2,end:3,quote:text.slice(2,3)},{start:1,end:2,quote:text.slice(1,2)},{start:0,end:999},{start:0.5},{end:1}])assert.equal(validateSourceRef(snapshot,{...ref,...patch}),false,JSON.stringify(patch));
});
test('R6 server-authored company, role, rubric, template and initial assessment content is English',()=>{
  english(COMPANY);english(JOB);english(RUBRIC);english(TASK_TEMPLATES);
  for(const id of PEOPLE){const application=getApplication(id);english(application.baseline);english(application.initialReport);english(application.jdAlignment);}
});
test('R6 company-task dataset reconciles periods/channels/device subset without invented weekly trend',()=>{
  const seed=createSeed();assert.equal(seed.datasetVersion,'harbour-retail-2026-09-v1');const {previous,current}=seed.dataset.metrics;
  assert.deepEqual([previous.sessions,current.sessions,previous.orders,current.orders],[1000000,1180000,34000,30680]);assert.equal(previous.conversionPct,3.4);assert.equal(current.conversionPct,2.6);assert.equal(seed.dataset.trafficTrend.length,2);
  for(const period of ['previous','current'])for(const key of ['sessions','orders','adSpendCents'])assert.equal(seed.dataset.records.filter(r=>r.period===period).reduce((a,r)=>a+r[key],0),seed.dataset.metrics[period][key]);
  const ids=seed.dataset.resources.map(r=>r.id);assert.ok(ids.includes('channel_comparison.csv'));assert.ok(ids.includes('current_paid_search_devices.csv'));assert.equal(ids.includes('campaign_performance.csv'),false);assert.equal(ids.includes('landing_page_performance.csv'),false);
  const device=seed.dataset.resources.find(r=>r.id==='current_paid_search_devices.csv');const si=device.columns.indexOf('sessions'),oi=device.columns.indexOf('orders');assert.equal(device.rows.reduce((a,r)=>a+Number(r[si]),0),426000);assert.equal(device.rows.reduce((a,r)=>a+Number(r[oi]),0),7668);
  for(const resource of seed.dataset.resources){assert.equal(resource.datasetVersion,seed.datasetVersion);assert.equal(resource.sizeBytes,Buffer.byteLength(resource.content));assert.doesNotMatch(resource.content,/4\.8\s*s/);}
  for(const [target,template] of Object.entries(TASK_TEMPLATES)){assert.equal(template.targetRequirementId,target);assert.equal(template.datasetVersion,seed.datasetVersion);assert.equal(template.timeboxMinutes,20);assert.equal(template.timeboxEnforced,false);for(const id of template.resourceIds)assert.ok(ids.includes(id));}
});
test('R6 past-project numeric populations remain separate from shared company task',async()=>{
  const amy=await readFile(resolve(content,'amy-chen/channel_analysis.md'),'utf8');assert.match(amy,/4,000 to 5,000/);assert.match(amy,/200 to 225/);assert.equal(200/4000*100,5);assert.equal(225/5000*100,4.5);
  const ann=await readFile(resolve(content,'ann-li/churn_method_note.md'),'utf8');assert.match(ann,/45,000/);assert.match(ann,/0\.82.*separate internship/);assert.equal(6750+38250,45000);assert.equal(31500+6750+6750,45000);assert.equal(4725+1012+1013,6750);
  const david=await readFile(resolve(content,'david-liu/project_readme.md'),'utf8');assert.match(david,/no period-over-period business comparison/i);
  const jamie=await readFile(resolve(content,'jamie-parker/social_reporting.md'),'utf8');assert.match(jamie,/400 in May and 520 in June/);assert.equal(360+24+16,400);assert.equal(450+45+25,520);assert.equal(980-900,80);
});

test('R6 complete JD requirement map retains original page-aware quotes and no second match percentage',()=>{
  const jd=JOB.jd;assert.equal(jd.version,'harbour-retail-junior-analyst-jd-v1');assert.equal(jd.pages,4);assert.equal(jd.sha256,originalHashes['job-description.pdf']);assert.equal(jd.source.sha256,sha(jd.source.text));
  const requirements=jd.requirements;assert.equal(new Set(requirements.map(r=>r.id)).size,requirements.length);
  assert.ok(requirements.filter(r=>r.category==='essential').length>=8);assert.ok(requirements.filter(r=>r.category==='desirable').length>=5);assert.ok(requirements.some(r=>r.category==='responsibility'));
  for(const requirement of requirements){
    assert.equal(jd.source.text.slice(requirement.start,requirement.end),requirement.quote,requirement.id);assert.ok(requirement.page>=1&&requirement.page<=4);
    const pageMarker=`--- Page ${requirement.page} ---`;const pageStart=jd.source.text.indexOf(pageMarker);assert.ok(pageStart>=0,requirement.id);assert.ok(requirement.start>=pageStart);
    const nextPage=jd.source.text.indexOf(`--- Page ${requirement.page+1} ---`);if(nextPage>=0)assert.ok(requirement.end<=nextPage,requirement.id);
    for(const criterionId of requirement.criterionIds)assert.ok(IDS.includes(criterionId));
  }
  const all=requirements.map(r=>r.statement).join('\n');for(const pattern of [/Excel|spreadsheet/i,/report|dashboard|visuali/i,/written/i,/verbal/i,/degree/i,/learn/i,/accuracy|accurate/i,/Python.*R|R.*Python/i,/Power BI|Tableau|business.intelligence/i,/non.technical/i])assert.match(all,pattern);
  for(const id of PEOPLE){const application=getApplication(id);assert.deepEqual(application.jdAlignment.map(a=>a.jdRequirementId).sort(),requirements.map(r=>r.id).sort());
    for(const entry of application.jdAlignment){assert.ok(entry.statuses.length);assert.ok(entry.summary.trim());assert.ok(entry.remainingUnknowns.trim());for(const ref of entry.sourceRefs)assert.equal(validateSourceRef(application,ref),true,`${id}/${entry.jdRequirementId}`);for(const key of Object.keys(entry))assert.doesNotMatch(key,/percentage|score|matchRate/i);}
  }
});

test('R6 portable manifest verifies every declared hash/size and explains modified companion material',async()=>{
  const manifest=JSON.parse(await readFile(resolve(content,'manifest.json'),'utf8'));assert.equal(manifest.packVersion,'harbour-retail-applications-v1');assert.equal(manifest.originalPdfCount,5);assert.equal(manifest.syntheticCompanionCount,8);assert.equal(manifest.calibration.humanCalibration,'pending');
  assert.equal(new Set(manifest.files.map(f=>f.file)).size,manifest.files.length);
  for(const entry of manifest.files){
    const path=resolve(content,entry.file);assert.ok(!relative(content,path).startsWith('..'));assert.ok(!entry.file.startsWith('/'));const bytes=await readFile(path);assert.equal(sha(bytes),entry.sha256,entry.file);assert.equal(bytes.length,entry.sizeBytes,entry.file);
    if(entry.changedFromInput){const change=manifest.changes.find(c=>c.file===entry.file);assert.ok(change?.reason?.trim(),`Undocumented modification ${entry.file}`);assert.equal(change.sha256,entry.sha256);assert.equal(change.originalSha256,entry.originalSha256);}
  }
  assert.equal(manifest.files.filter(f=>f.origin==='synthetic_demo_work_sample').length,8);assert.equal(manifest.files.filter(f=>f.file.endsWith('.pdf')).length,5);
});
test('R6 public provenance pins each displayed source to same-person portable bytes and disclosed redaction',async()=>{
  const repository=fileURLToPath(new URL('../../../',import.meta.url));
  for(const id of PEOPLE){const application=getApplication(id);assert.equal(application.sources.length,3);
    for(const source of application.sources){const p=source.provenance;assert.ok(p);assert.ok(p.filePath.startsWith(`app/backend/content/r6/${id}/`));assert.equal(sha(await readFile(resolve(repository,p.filePath))),p.sha256);assert.equal(sha(source.text),p.sha256);assert.ok(p.disclosure.trim());
      if(p.origin==='user_supplied_fictional_cv'){assert.deepEqual(p.pageNumbers,[1]);assert.equal(p.redaction.originalSha256,originalHashes[`${id}/cv.pdf`]);const original=await readFile(resolve(content,id,'cv-extracted.txt'),'utf8');if(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|04XX\s*XXX\s*XXX/i.test(original))assert.ok(p.redaction.removedFields.length);else assert.deepEqual(p.redaction.removedFields,[]);assert.equal(p.downloadUrl,`/api/demo/materials/${id}/cv.pdf`);}
      else {assert.equal(p.origin,'synthetic_demo_work_sample');assert.deepEqual(p.pageNumbers,[]);assert.match(p.disclosure,/not attached to the original CV/i);}
    }
  }
});
