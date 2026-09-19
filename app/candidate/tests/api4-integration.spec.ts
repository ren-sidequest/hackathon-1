import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const backend=`http://127.0.0.1:${process.env.EB_API4_TEST_BACKEND_PORT ?? '8894'}`, candidateUrl=`http://127.0.0.1:${process.env.EB_API4_TEST_CANDIDATE_PORT ?? '6474'}`, hrUrl=`http://127.0.0.1:${process.env.EB_API4_TEST_HR_PORT ?? '6487'}`;
const token='API4-UI-SYNTHETIC-test-reset-token';
const people=['amy-chen','ann-li','david-liu','jamie-parker'];
async function read(request:APIRequestContext,id='amy-chen') {const r=await request.get(`${backend}/api/demo?candidateId=${id}`);expect(r.ok()).toBeTruthy();return (await r.json()).data;}
async function reset(request:APIRequestContext) {const {data}=await(await request.get(`${backend}/api/demo/comparison`)).json();const r=await request.post(`${backend}/api/demo/reset`,{headers:{'Idempotency-Key':crypto.randomUUID(),'X-Demo-Admin-Token':token},data:{schemaVersion:'4.0',sessionId:data.sessionId}});expect(r.ok()).toBeTruthy();return (await r.json()).data;}
const base=(d:any)=>({schemaVersion:'4.0',sessionId:d.sessionId,candidateId:d.candidate.id,jobId:d.job.id,datasetVersion:d.datasetVersion});
const binding=(d:any)=>({...base(d),taskId:d.task.taskId,targetRequirementId:d.task.targetRequirementId});
async function post(request:APIRequestContext,path:string,data:unknown) {const r=await request.post(`${backend}/api/demo${path}`,{headers:{'Idempotency-Key':crypto.randomUUID()},data});expect(r.ok(),await r.text()).toBeTruthy();return (await r.json()).data;}
async function seedTask(request:APIRequestContext,id='amy-chen',target='business-problem-solving') {const d=await read(request,id);return post(request,'/task/send',{...binding(d),targetRequirementId:target,templateId:d.taskTemplates[target].templateId,instructions:`Synthetic ${target} test task; show bounded original evidence.`,gapReason:'A specific evidence gap needs a bounded check.'});}
async function seedSubmission(request:APIRequestContext,id='amy-chen',summary='Synthetic current work') {const d=await read(request,id);return post(request,'/submission',{...binding(d),submissionVersion:d.workflow.nextSubmissionVersion,previousSubmissionId:d.workflow.nextSubmissionVersion===2?d.submission.submissionId:null,previousContentFingerprint:d.workflow.nextSubmissionVersion===2?d.submission.contentFingerprint:null,summary,findings:[],processEvidence:[]});}
async function nav(page:Page,name:string) {await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();}
async function refresh(page:Page) {await page.getByRole('button',{name:'Refresh shared case',exact:true}).click();await expect(page.getByRole('button',{name:'Refresh shared case',exact:true})).toBeEnabled();await expect(page.getByText('Connected · four-person shared case',{exact:true})).toBeVisible();}
async function glide(page:Page,label:string,value:string) {await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('listbox',{name:label,exact:true}).locator(`[data-value="${value}"]`).click();await expect(page.getByRole('combobox',{name:label,exact:true})).toHaveAttribute('data-value',value);}
async function open(page:Page,role:'hr'|'candidate',id='amy-chen',section='') {await page.goto(`${role==='hr'?hrUrl:candidateUrl}/?candidateId=${id}${section?`#${section}`:''}`);await expect(page.getByText('Connected · four-person shared case',{exact:true})).toBeVisible();if(role==='candidate'||(section!=='' && !['company','comparison'].includes(section)))await expect(page.getByRole('combobox',{name:'Current candidate',exact:true})).toHaveAttribute('data-value',id);}
async function chooseStage(page:Page,value:string) {await page.getByRole('combobox',{name:'Assessment stage',exact:true}).click();await page.getByRole('option',{name:value==='application_review'?/Application materials/:new RegExp('Task V'+value.slice(-1))}).click();}
async function sendTask(page:Page,id:string,target:string) {await open(page,'hr',id,'tasks');await glide(page,'Target skill',target);await page.getByLabel('Evidence gap / task reason',{exact:true}).fill('A bounded evidence gap needs verification.');await page.getByRole('button',{name:'Preview work brief',exact:true}).click();await page.getByRole('button',{name:'Continue to confirmation',exact:true}).click();await page.getByRole('button',{name:'Send task',exact:true}).click();await expect(page.getByRole('button',{name:'Send task',exact:true})).toHaveCount(0);}
async function start(page:Page,id='amy-chen') {await open(page,'candidate',id,'tasks');await page.getByRole('button',{name:'Start V1 draft',exact:true}).click();await expect(page.getByLabel('Executive summary',{exact:true})).toBeVisible();}
async function submit(page:Page,request:APIRequestContext,id:string,version:number,summary:string) {await page.getByLabel('Executive summary',{exact:true}).fill(summary);await page.getByRole('button',{name:`Submit V${version}`,exact:true}).click();await page.getByRole('button',{name:`Confirm V${version} submission`,exact:true}).click();await expect.poll(async()=>(await read(request,id)).currentSubmissionVersion).toBe(version);await expect(page.getByRole('dialog')).toHaveCount(0);}
async function review(page:Page,decision:string,comment:string) {await page.getByRole('button',{name:decision,exact:true}).click();await page.getByLabel('Public review comment',{exact:true}).fill(comment);await page.getByRole('button',{name:'Save evidence review',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
async function restart() {const control=new URL('../../../.ci-results/api4-test-control.json',import.meta.url);const old=JSON.parse(await readFile(control,'utf8'));await writeFile(join(old.directory,'restart.request'),String(old.generation+1));await expect.poll(async()=>JSON.parse(await readFile(control,'utf8')).generation).toBe(old.generation+1);}
let runtimeErrors:string[]=[];
test.beforeEach(async({request,context})=>{runtimeErrors=[];const watch=(page:Page)=>page.on('pageerror',error=>runtimeErrors.push(error.message));context.pages().forEach(watch);context.on('page',watch);await reset(request);});
test.afterEach(()=>{expect(runtimeErrors).toEqual([]);});

test('T27 assessment selectors work in a modal, preserve empty and NE marks, and initially locate B3',async({page,request},info)=>{
  const before=await read(request);await open(page,'hr','amy-chen','evidence');
  const ref=before.assessment.application_review.items.find((item:any)=>item.criterionId==='B3').sourceRefs[0];
  await expect(page.locator('.r5-inline-source mark')).toHaveText(ref.quote);
  await expect(page.getByRole('combobox',{name:'Review source',exact:true})).toHaveAttribute('data-value',ref.sourceId);
  await expect(page.locator('.r5-criterion.eb-spotlight')).toHaveCount(1);
  await expect(page.locator('.r5-criterion-toggle[aria-expanded=true] .eb-star-trail')).toHaveCount(1);
  await page.getByText('Assessment history & source binding',{exact:true}).click();
  await glide(page,'Assessment revision','1');await expect(page.locator('.r5-inline-source mark')).toHaveText(ref.quote);
  await glide(page,'Assessment revision','latest');
  await page.getByRole('button',{name:'Edit human assessment',exact:true}).click();
  await glide(page,'Edit criterion','B3');
  for(const value of ['NE','','0','4'])await glide(page,'Human mark',value);
  await glide(page,'Candidate source',before.application.sources[0].sourceId);
  const trigger=page.getByRole('combobox',{name:'Human mark',exact:true});
  await trigger.click();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('data-value','4');await expect(trigger).toBeFocused();
  await trigger.click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();await expect(trigger).toHaveAttribute('aria-expanded','false');
  await expect(page.getByRole('dialog').locator('select')).toHaveCount(0);
  await trigger.click();await expect(page.getByRole('listbox',{name:'Human mark',exact:true})).toHaveCSS('opacity','1');await page.screenshot({path:info.outputPath('gold-assessment-menu.png')});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await read(request)).assessment).toEqual(before.assessment);
  await page.getByRole('button',{name:'Human retain decision',exact:true}).click();await glide(page,'Shortlist basis stage','application_review');await page.getByRole('button',{name:'Cancel',exact:true}).click();
});

test('T28 workspace filters, resource sorting and evidence editor share gold selects without losing data',async({page,request},info)=>{
  await seedTask(request);await start(page);
  const dataset=(await read(request)).dataset;
  await glide(page,'Filter channel',dataset.channels[0].channel);await expect(page.locator('.eb-data-overview tbody tr')).toHaveCount(1);
  await glide(page,'Filter channel','All channels');await glide(page,'Sort channel rows','traffic');
  const sorted=[...dataset.channels].sort((a:any,b:any)=>b.traffic-a.traffic);await expect(page.locator('.eb-data-overview tbody tr').first()).toContainText(sorted[0].channel);
  await page.getByRole('button',{name:'website_traffic.csv',exact:true}).click();await glide(page,'Sort resource column','0');
  await page.getByRole('dialog').getByRole('button',{name:/Create card from row/}).first().click();
  await glide(page,'Evidence source','');await glide(page,'Evidence source','website_traffic.csv');await glide(page,'Self-reported confidence','Low');
  await page.getByLabel('Observation or idea').fill('Gold UI regression finding');await page.getByRole('button',{name:'Save card',exact:true}).click();
  const card=page.locator('.eb-board .eb-spotlight').filter({hasText:'Gold UI regression finding'});await expect(card).toContainText('Self-confidence Low');
  for(const theme of ['dark','light']) {
    await page.getByRole('switch',{name:'Night mode'}).setChecked(theme==='dark');await card.hover();
    await expect(card).toHaveAttribute('data-spot-active','true');await expect(card).toHaveCSS('transform','none');
    await expect.poll(()=>card.evaluate(el=>getComputedStyle(el,'::before').opacity)).toBe('1');
    await page.screenshot({path:info.outputPath(`gold-workspace-${theme}.png`),fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});expect(await card.evaluate(el=>getComputedStyle(el,'::before').display)).toBe('none');
  await expect(page.locator('select')).toHaveCount(0);
  await submit(page,request,'amy-chen',1,'Preserve gold UI finding');await nav(page,'Work & feedback');
  await expect(page.locator('.eb-finding.eb-spotlight')).toContainText('Gold UI regression finding');await glide(page,'Submission version','1');
  await open(page,'hr','amy-chen','tasks');await glide(page,'Submission version','1');await expect(page.locator('select')).toHaveCount(0);
});

test('T23 server rubric keeps black-gold cards, exact criteria, focus return and both themes',async({page,request},info)=>{
  const data=await read(request), writes:string[]=[];page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});
  await open(page,'hr','amy-chen','company');await expect(page.getByRole('switch',{name:'Night mode'})).toBeChecked();
  await expect(page.locator('.r5-weight-cell')).toHaveCount(data.rubric.criteria.length);
  for(const r of data.rubric.requirements)await expect(page.locator('.r5-skill-card').filter({has:page.getByRole('heading',{name:r.title,exact:true})})).toContainText(`${r.maxScore}%`);
  const cell=page.locator('.r5-weight-cell').filter({hasText:'B3'});await cell.scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY);await cell.click();
  await expect(page.getByRole('dialog').locator('details[open] summary')).toContainText('B3');await expect(page.getByRole('dialog')).toContainText(data.rubric.criteria.find((c:any)=>c.id==='B3').observableSupport);
  await page.keyboard.press('Escape');await expect(cell).toBeFocused();expect(await page.evaluate(()=>scrollY)).toBe(before);
  for(const theme of ['dark','light']) {await page.getByRole('switch',{name:'Night mode'}).setChecked(theme==='dark');await page.evaluate(async()=>{scrollTo(0,0);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});await page.screenshot({path:info.outputPath(`api4-standards-${theme}.png`),fullPage:true});}
  expect(writes).toEqual([]);expect((await read(request)).revision).toBe(data.revision);
});

test('T24 connected evidence retains stable scrolling, gold selector and stable two-card layout',async({page,request},info)=>{
  const data=await read(request);await page.setViewportSize({width:1536,height:1050});await open(page,'hr','amy-chen','evidence');
  const rail=page.getByRole('navigation',{name:'Evidence criteria'});await expect(rail.getByRole('button')).toHaveCount(10);
  await rail.scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);await rail.getByRole('button',{name:/^S1 ·/}).click();expect(await page.evaluate(()=>scrollY)).toBe(y);
  const ref=data.assessment.application_review.items.find((x:any)=>x.criterionId==='S1').sourceRefs[0];await expect(page.locator('.r5-inline-source mark')).toHaveText(ref.quote);
  const hovered=rail.getByRole('button',{name:/^D1 ·/});await hovered.hover();await expect(hovered).toHaveCSS('transform','none');
  expect(await hovered.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe(await rail.evaluate(e=>getComputedStyle(e).backgroundColor));
  const source=await page.locator('.r5-original-pane').boundingBox();
  const body=await page.locator('.r5-assessment-grid>section').boundingBox();expect(Math.abs(source!.y-body!.y)).toBeLessThan(2);expect(source!.x).toBeLessThan(body!.x);
  for(const theme of ['dark','light']) {await page.getByRole('switch',{name:'Night mode'}).setChecked(theme==='dark');await page.getByRole('combobox',{name:'Assessment stage',exact:true}).click();await expect(page.getByRole('listbox',{name:'Assessment stage',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath(`api4-stage-${theme}.png`),fullPage:true});await page.keyboard.press('Escape');}
  expect((await read(request)).revision).toBe(data.revision);
});

test('T01 four explicit service identities, actual company/resources and no preview state',async({page,request})=>{
  await open(page,'hr');await expect(page.locator('tbody tr')).toHaveCount(4);await expect(page.locator('.eb-workspace')).toContainText('Harbour Retail');await expect(page.locator('body')).not.toContainText('HarbourCart');await page.getByRole('link',{name:'EvidenceBridge home'}).click();await expect(page).toHaveURL(/#company$/);await nav(page,'Compare candidates');
  for(const id of people) {await open(page,'candidate',id);const d=await read(request,id);await expect(page.getByRole('heading',{name:d.candidate.name,exact:true})).toBeVisible();expect(d.application.candidateId).toBe(id);await expect(page.getByText('Frontend mock · synthetic materials and illustrative marks',{exact:true})).toHaveCount(0);}
  const writes=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('evidencebridge.revision5.ui-preview')));expect(writes).toEqual([]);
});

test('T02 comparison uses server numbers and owned UTF-16 source quotations',async({page,request})=>{
  await open(page,'hr');const d=await read(request);await expect(page.locator('tr[data-candidate="amy-chen"]')).toContainText(d.assessment.application_review.score.overallPercentage.toFixed(1)+'%');await expect(page.locator('tr[data-candidate="david-liu"]')).toContainText('Needs evidence');
  await page.getByRole('button',{name:'Open Amy Chen',exact:true}).click();await page.locator('.r5-criterion-body .eb-citation').first().click();const ref=d.assessment.application_review.items.find((x:any)=>x.criterionId==='B3').sourceRefs[0];await expect(page.locator('.r5-inline-source mark')).toHaveText(ref.quote);
  await glide(page,'Current candidate','ann-li');await expect(page.getByRole('combobox',{name:'Current candidate',exact:true})).toHaveAttribute('data-value','ann-li');const other=await read(request,'ann-li');await expect(page.locator('.r5-inline-source')).toContainText(other.candidate.name);await expect(page.locator('.r5-inline-source mark')).not.toHaveText(ref.quote);
});

test('T03 Amy BPS real V1 → More → V2 → Confirm, private draft exclusion and immutable version history',async({page:candidate,context,request},info)=>{
  const hr=await context.newPage(), writes:string[]=[];candidate.on('request',r=>{if(r.method()==='POST')writes.push(r.postData()??'');});
  await sendTask(hr,'amy-chen','business-problem-solving');await start(candidate);
  await candidate.getByRole('tab',{name:'Private notebook',exact:true}).click();await candidate.getByLabel('Private notes',{exact:true}).fill('PRIVATE-API4-ALEX-DO-NOT-SHARE');
  const first='😀中文 API4 Alex V1: Paid Search is a signal, not a proven cause.';await submit(candidate,request,'amy-chen',1,first);
  await nav(candidate,'Work & feedback');const download=candidate.waitForEvent('download');await candidate.getByRole('button',{name:'Export V1 public work',exact:true}).click();expect(await readFile((await(await download).path())!,'utf8')).not.toContain('PRIVATE');
  await refresh(hr);await expect(hr.getByText(first,{exact:true}).first()).toBeVisible();await hr.getByRole('button',{name:'Run evidence analysis',exact:true}).click();await expect.poll(async()=>(await read(request)).analysis.status).toBe('succeeded');await hr.locator('.eb-review-grid .eb-citation:visible').first().click();await expect(hr.locator('[data-source-version] mark')).toContainText('😀中文 API4 Alex V1');await hr.getByRole('button',{name:'Clear quotation',exact:true}).click();
  await review(hr,'Needs More Evidence','Compare matched cohorts and retain uncertainty.');const frozen=(await read(request)).versions[0];
  await refresh(candidate);await nav(candidate,'My task');await candidate.getByRole('button',{name:'Copy V1 public work into V2',exact:true}).click();await candidate.getByRole('tab',{name:'Private notebook',exact:true}).click();await expect(candidate.getByLabel('Private notes')).toHaveValue('');
  await submit(candidate,request,'amy-chen',2,'😀中文 API4 Alex V2: use a matched cohort before changing spend.');await refresh(hr);await expect(hr.getByRole('button',{name:'Needs More Evidence',exact:true})).toHaveCount(0);await review(hr,'Confirm evidence','V2 supports a bounded confirmation.');
  const final=await read(request);expect(final.versions[0]).toEqual(frozen);expect(final.workflow.isTerminal).toBe(true);expect(final.assessment.task_v2).toBeNull();expect(final.shortlist.status).toBe('not_retained');expect(JSON.stringify(final)).not.toContain('PRIVATE');expect(writes.join('')).not.toContain('PRIVATE');
  await refresh(candidate);await nav(candidate,'Work & feedback');await glide(candidate,'Submission version','1');await expect(candidate.getByText(first,{exact:true}).first()).toBeVisible();await glide(candidate,'Submission version','2');await expect(candidate.getByText('V2 supports a bounded confirmation.',{exact:true})).toBeVisible();await expect(candidate.getByRole('button',{name:/Start V3|Copy V1|Start V2/})).toHaveCount(0);
  await hr.screenshot({path:info.outputPath('amy-bps-v2-confirmed.png'),fullPage:true});
});

for(const [n,id,target,decision] of [[4,'ann-li','sql','Evidence Still Insufficient'],[5,'david-liu','data-analysis','Confirm evidence'],[6,'jamie-parker','sql','Confirm evidence']]) {
  test(`T0${n} ${id} has the same real targeted submission/review controls`,async({page:candidate,context,request})=>{
    const hr=await context.newPage();await sendTask(hr,String(id),String(target));await start(candidate,String(id));await submit(candidate,request,String(id),1,`Synthetic ${id} original ${target} work, bounded uncertainty.`);await refresh(hr);await hr.getByRole('button',{name:'Run evidence analysis',exact:true}).click();await expect.poll(async()=>(await read(request,String(id))).analysis.status).toBe('succeeded');
    const analyzed=await read(request,String(id));expect(analyzed.analysis.result.observations.map((x:any)=>x.dimension)).toEqual(target==='sql'?['S1','S2','S3']:['D1','D2','D3']);await review(hr,String(decision),'This first-version evidence decision is final.');await refresh(candidate);await nav(candidate,'My task');await expect(candidate.getByRole('button',{name:/Start V2|Copy V1|Start V3/})).toHaveCount(0);expect((await read(request,String(id))).workflow.isTerminal).toBe(true);
    for(const other of people.filter(p=>p!==id))expect((await read(request,other)).submission).toBeNull();
  });
}

test('T07 human assessment appends a service revision without changing immutable baseline or auto-retaining',async({page,request})=>{
  await open(page,'hr','amy-chen','evidence');const before=await read(request);await page.getByRole('button',{name:'Edit human assessment',exact:true}).click();await page.getByLabel('Judgment reason',{exact:true}).fill('A human-reviewed bounded revision from the original source.');await page.getByLabel('Assessment operator label',{exact:true}).fill('Synthetic QA reviewer');await page.getByRole('button',{name:'Save assessment revision',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const after=await read(request);expect(after.assessment.application_review.assessmentRevision).toBe(2);expect(after.application.baseline).toEqual(before.application.baseline);expect(after.assessment.history).toHaveLength(before.assessment.history.length+1);expect(after.shortlist.status).toBe('not_retained');await page.reload();await expect(page.getByText('Human assessment · revision 2',{exact:true})).toBeVisible();
});

test('T09 lost submission response reuses the exact persisted idempotency receipt after reload',async({page:candidate,request})=>{
  await seedTask(request);await start(candidate);await candidate.getByLabel('Executive summary').fill('Lost-response receipt test.');const posts:{key:string;body:string|null}[]=[];let lost=false;
  await candidate.route('**/api/demo/submission',async route=>{posts.push({key:route.request().headers()['idempotency-key'],body:route.request().postData()});if(!lost){lost=true;await route.fetch();await route.abort();}else await route.continue();});
  await candidate.getByRole('button',{name:'Submit V1',exact:true}).click();await candidate.getByRole('button',{name:'Confirm V1 submission',exact:true}).click();await expect(candidate.getByRole('dialog').getByRole('button',{name:'Retry original action',exact:true})).toBeVisible();await candidate.reload();await candidate.getByRole('button',{name:'Retry original action',exact:true}).click();await expect(candidate.getByRole('button',{name:'Retry original action',exact:true})).toHaveCount(0);expect(posts).toHaveLength(2);expect(posts[0]).toEqual(posts[1]);expect((await read(request)).versions).toHaveLength(1);
});

test('T10 server reset makes an old-session submission stale and leaves new case empty',async({page:candidate,request})=>{
  await seedTask(request);await start(candidate);await candidate.getByLabel('Executive summary').fill('OLD-SESSION-DRAFT');await reset(request);await candidate.getByRole('button',{name:'Submit V1',exact:true}).click();await candidate.getByRole('button',{name:'Confirm V1 submission',exact:true}).click();await expect(candidate.locator('details').filter({has:candidate.locator('summary',{hasText:'Connection details & diagnostics'})})).toContainText('STALE_SESSION');expect((await read(request)).submission).toBeNull();await nav(candidate,'My task');await expect(candidate.getByRole('heading',{name:'No supplementary task requested',exact:true})).toBeVisible();await expect(candidate.getByText('OLD-SESSION-DRAFT',{exact:true})).toHaveCount(0);
});

test('T11 stale assessment revision is rejected and preserves the second reviewer form',async({page,context,request})=>{
  const other=await context.newPage();for(const p of [page,other]) {await open(p,'hr','amy-chen','evidence');await p.getByRole('button',{name:'Edit human assessment',exact:true}).click();await p.getByLabel('Assessment operator label').fill('Synthetic reviewer');}
  await page.getByLabel('Judgment reason').fill('First reviewer saved decision.');await page.getByRole('button',{name:'Save assessment revision',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await other.getByLabel('Judgment reason').fill('KEEP SECOND REVIEWER INPUT');await other.getByRole('button',{name:'Save assessment revision',exact:true}).click();await expect(other.getByRole('dialog')).toBeVisible();await expect(other.getByLabel('Judgment reason')).toHaveValue('KEEP SECOND REVIEWER INPUT');await expect(other.locator('details').filter({has:other.locator('summary',{hasText:'Connection details & diagnostics'})})).toContainText('ASSESSMENT_CONFLICT');expect((await read(request)).assessment.application_review.assessmentRevision).toBe(2);
});

test('T12 unavailable service keeps local draft and never substitutes preview data',async({page:candidate,request})=>{
  await seedTask(request);await start(candidate);await candidate.getByLabel('Executive summary').fill('KEEP-API4-DRAFT');await candidate.route('**/api/demo?**',route=>route.abort());await candidate.getByRole('button',{name:'Refresh shared case',exact:true}).click();await expect(candidate.locator('details').filter({has:candidate.locator('summary',{hasText:'Connection details & diagnostics'})})).toContainText('CONNECTION_UNCERTAIN');await expect(candidate.getByLabel('Executive summary')).toHaveValue('KEEP-API4-DRAFT');await expect(candidate.getByText('Frontend mock · synthetic materials and illustrative marks',{exact:true})).toHaveCount(0);await candidate.unroute('**/api/demo?**');await refresh(candidate);await submit(candidate,request,'amy-chen',1,'Recovered real API draft.');
});

test('T13 a slow previous candidate response never becomes the newly selected identity',async({page})=>{
  await open(page,'candidate');await page.route('**/api/demo?candidateId=ann-li',async route=>{const r=await route.fetch();await new Promise(r=>setTimeout(r,800));await route.fulfill({response:r});});
  await glide(page,'Current candidate','ann-li');await glide(page,'Current candidate','jamie-parker');await expect(page.getByRole('heading',{name:'Jamie Parker',exact:true})).toBeVisible();await page.waitForTimeout(1000);await expect(page.getByRole('heading',{name:'Jamie Parker',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Ann Li',exact:true})).toHaveCount(0);
});

test('T14 administrator reset CLI clears four test cases without placing its token in either browser',async({page,request})=>{
  for(const id of people)await seedTask(request,id,'sql');await open(page,'candidate');const before=await read(request);const cli=join(process.env.EB_API4_BACKEND_ROOT ?? fileURLToPath(new URL('../../..',import.meta.url)),'app/backend/scripts/reset.mjs');const {stdout}=await promisify(execFile)(process.execPath,[cli],{env:{PATH:process.env.PATH,BASE_URL:backend,DEMO_ADMIN_TOKEN:token}});expect(JSON.parse(stdout).candidatesReset).toBe(4);await refresh(page);expect((await read(request)).sessionId).not.toBe(before.sessionId);expect(await page.evaluate(()=>JSON.stringify(localStorage)+document.body.innerText)).not.toContain(token);
});

test('T15 temporary SQLite survives service close/reopen and both windows read the saved snapshot',async({page:candidate,context,request})=>{
  await seedTask(request);const before=await seedSubmission(request,'amy-chen','PERSISTED-API4-SNAPSHOT');await restart();const after=await read(request);expect(after).toEqual(before);const hr=await context.newPage();await open(candidate,'candidate','amy-chen','history');await open(hr,'hr','amy-chen','tasks');await expect(candidate.getByText('PERSISTED-API4-SNAPSHOT',{exact:true}).first()).toBeVisible();await expect(hr.getByText('PERSISTED-API4-SNAPSHOT',{exact:true}).first()).toBeVisible();
});

test('T16 candidate drafts survive reload but are isolated by identity and task session',async({page,request})=>{
  await seedTask(request);await seedTask(request,'ann-li','sql');await start(page);await page.getByLabel('Executive summary').fill('AMY-ONLY-DRAFT');await glide(page,'Current candidate','ann-li');await nav(page,'My task');await page.getByRole('button',{name:'Start V1 draft',exact:true}).click();await expect(page.getByLabel('Executive summary')).toHaveValue('');await page.getByLabel('Executive summary').fill('ANN-ONLY-DRAFT');await page.reload();await expect(page.getByLabel('Executive summary')).toHaveValue('ANN-ONLY-DRAFT');await glide(page,'Current candidate','amy-chen');await expect(page.getByLabel('Executive summary')).toHaveValue('AMY-ONLY-DRAFT');expect((await read(request)).submission).toBeNull();
});

test('T08 shortlist persists independently, turns stale on new work, and preserves all human actions',async({page,request})=>{
  await open(page,'hr','amy-chen','shortlist');
  async function decide(button:string,reason:string) {await page.getByRole('button',{name:button,exact:true}).click();await page.getByLabel('Human shortlist reason').fill(reason);await page.getByLabel('Shortlist operator label').fill('Synthetic QA reviewer');await page.getByRole('button',{name:'Save shortlist decision',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
  await decide('Retain candidate','Retain original application for discussion.');expect((await read(request)).shortlist.status).toBe('retained');
  await seedTask(request);await seedSubmission(request);await refresh(page);await expect(page.locator('section[data-candidate="amy-chen"]')).toContainText('Reconfirmation needed');
  await decide('Reconfirm with current basis','Explicitly review the new work basis.');const reconfirmed=await read(request);expect(reconfirmed.shortlist.status).toBe('retained');expect(reconfirmed.shortlist.basis.stage).toBe('task_v1');expect(reconfirmed.review).toBeNull();expect(reconfirmed.assessment.task_v1).toBeNull();
  await page.reload();await decide('Remove from retained','Continue evidence discussion before retaining.');const removed=await read(request);expect(removed.shortlist.status).toBe('not_retained');expect(removed.shortlist.history.map((h:any)=>h.action)).toEqual(['retain','reconfirm','remove']);expect(removed.submission).toEqual(reconfirmed.submission);await nav(page,'Compare candidates');await expect(page.locator('tbody tr')).toHaveCount(4);
});

test('T17 real resources, row-to-card, dark mode and desktop navigation retain the existing UI',async({page,request},info)=>{
  await seedTask(request);await start(page);await expect(page.locator('.eb-metrics').getByText('1,180,000',{exact:true})).toBeVisible();await expect(page.locator('.eb-metrics').getByText('30,680',{exact:true})).toBeVisible();await expect(page.getByText('31,200',{exact:true})).toHaveCount(0);
  await page.getByLabel('Find a resource',{exact:true}).fill('website');await page.getByRole('button',{name:'website_traffic.csv',exact:true}).click();await page.getByLabel('Filter resource rows').fill('Paid Search');await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(2);await page.getByRole('dialog').getByRole('button',{name:/Create card from row/}).first().click();await expect(page.getByRole('combobox',{name:'Evidence source',exact:true})).toHaveAttribute('data-value','website_traffic.csv');await page.getByLabel('Observation or idea').fill('A bounded data observation');await page.getByRole('button',{name:'Save card',exact:true}).click();await expect(page.locator('.eb-board')).toContainText('A bounded data observation');
  await expect(page.getByRole('switch',{name:'Night mode'})).toBeChecked();await page.getByRole('switch',{name:'Night mode'}).click();await expect(page.getByRole('switch',{name:'Night mode'})).not.toBeChecked();await page.getByRole('switch',{name:'Night mode'}).click();await page.reload();await expect(page.getByRole('switch',{name:'Night mode'})).toBeChecked();await page.screenshot({path:info.outputPath('api4-workspace-desktop.png'),fullPage:true});
});

test('T18 in-flight analysis does not block human review and its late result never reopens the closed version',async({page:hr,request})=>{
  await seedTask(request);await seedSubmission(request,'amy-chen','TEST_DELAY: bounded evidence, awaiting human review.');await open(hr,'hr','amy-chen','tasks');const late=hr.waitForResponse(r=>r.url().endsWith('/api/demo/analysis')&&r.request().method()==='POST');await hr.getByRole('button',{name:'Run evidence analysis',exact:true}).click();await expect.poll(async()=>(await read(request)).analysis.status).toBe('running');await review(hr,'Confirm evidence','Human review may finish while extraction is pending.');expect((await(await late).json()).error.code).toBe('STALE_ANALYSIS');const final=await read(request);expect(final.workflow.isTerminal).toBe(true);expect(final.analysis.status).toBe('failed');expect(final.analysis.errorCode).toBe('AI_REVIEW_CLOSED');expect(final.analysis.result).toBeNull();await refresh(hr);await expect(hr.getByRole('button',{name:'Needs More Evidence',exact:true})).toHaveCount(0);await expect(hr.getByText('Human review may finish while extraction is pending.',{exact:true})).toBeVisible();
});

test('T19 SQL task marks are server-calculated, application reuse is explicit, and V2 starts unassessed',async({page,request})=>{
  await seedTask(request,'ann-li','sql');const before=await seedSubmission(request,'ann-li','😀 SQL checks: unique order IDs, period boundaries and denominator reconciliation.');await open(page,'hr','ann-li','evidence');await chooseStage(page,'task_v1');await page.getByRole('button',{name:'Edit human assessment',exact:true}).click();
  for(const criterion of ['S1','S2','S3']) {await glide(page,'Edit criterion',criterion);await glide(page,'Human mark','2');for(const label of ['Judgment reason','Support / checked scope','Missing evidence / counter-evidence','Uncertainty','Next step'])await page.getByLabel(label,{exact:true}).fill(`${criterion}: bounded synthetic review of visible original SQL text.`);await page.getByLabel('Exact source quotation').fill(before.submission.summary);await page.getByRole('button',{name:'Add source quotation',exact:true}).click();}
  await page.getByLabel('Explicitly reuse application assessment').check();await page.getByLabel('Assessment operator label').fill('Synthetic task reviewer');await page.getByRole('button',{name:'Save assessment revision',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const assessed=await read(request,'ann-li');expect(assessed.assessment.task_v1.score.skills.find((s:any)=>s.requirementId==='sql').percentage).toBe(50);expect(assessed.assessment.task_v1.reusedItems).toHaveLength(7);expect(assessed.assessment.application_review).toEqual(before.assessment.application_review);expect(assessed.review).toBeNull();expect(assessed.shortlist.status).toBe('not_retained');
  await post(request,'/review',{...binding(assessed),submissionId:assessed.submission.submissionId,contentFingerprint:assessed.submission.contentFingerprint,decision:'needs_more_evidence',comment:'Clarify the join boundary.'});await seedSubmission(request,'ann-li','V2 adds a bounded join check.');await refresh(page);await chooseStage(page,'task_v2');expect((await read(request,'ann-li')).assessment.task_v2).toBeNull();await expect(page.locator('.r5-evidence-rail .r5-mark').filter({hasText:'Not assessed'})).toHaveCount(10);await chooseStage(page,'task_v1');await expect(page.getByRole('button',{name:'Edit human assessment',exact:true})).toBeDisabled();
});

test('T20 failed analysis exposes its status and leaves original work and manual review usable',async({page,request})=>{
  await seedTask(request);const submitted=await seedSubmission(request,'amy-chen','TEST_DISABLED: limited work still open for human review.');await open(page,'hr','amy-chen','tasks');await page.getByRole('button',{name:'Run evidence analysis',exact:true}).click();await expect(page.locator('details').filter({has:page.locator('summary',{hasText:'Connection details & diagnostics'})})).toContainText('AI_DISABLED');await review(page,'Evidence Still Insufficient','The visible work still leaves an evidence gap.');const final=await read(request);expect(final.submission).toEqual(submitted.submission);expect(final.analysis.status).toBe('failed');expect(final.workflow.isTerminal).toBe(true);expect(final.assessment.task_v1).toBeNull();
});

test('T21 a stale V1 review form keeps its comment after another client advances to V2',async({page,request})=>{
  await seedTask(request);const one=await seedSubmission(request);await open(page,'hr','amy-chen','tasks');await page.getByRole('button',{name:'Confirm evidence',exact:true}).click();await page.getByLabel('Public review comment').fill('KEEP THIS V1 REVIEW COMMENT');
  await post(request,'/review',{...binding(one),submissionId:one.submission.submissionId,contentFingerprint:one.submission.contentFingerprint,decision:'needs_more_evidence',comment:'Another reviewer opened the bounded V2.'});await seedSubmission(request,'amy-chen','A new V2 from another window.');
  const conflict=page.waitForResponse(r=>r.url().endsWith('/api/demo/review')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save evidence review',exact:true}).click();expect((await conflict).status()).toBe(409);await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Public review comment')).toHaveValue('KEEP THIS V1 REVIEW COMMENT');const current=await read(request);expect(current.currentSubmissionVersion).toBe(2);expect(current.review).toBeNull();expect(current.versions[0].review.decision).toBe('needs_more_evidence');
});

test('T22 confirmed save followed by GET failure is not reported as a fresh view or duplicated',async({page,request})=>{
  await open(page,'hr','amy-chen','evidence');await page.getByRole('button',{name:'Edit human assessment',exact:true}).click();await page.getByLabel('Judgment reason').fill('SAVED BUT VIEW REFRESH FAILED');await page.getByLabel('Assessment operator label').fill('Synthetic reviewer');await page.route('**/api/demo?**',route=>route.abort());await page.getByRole('button',{name:'Save assessment revision',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Judgment reason')).toHaveValue('SAVED BUT VIEW REFRESH FAILED');await expect(page.locator('details').filter({has:page.locator('summary',{hasText:'Connection details & diagnostics'})})).toContainText('CONNECTION_UNCERTAIN');await expect(page.getByText(/Saved on the shared service.*Refresh is still needed/)).toBeVisible();expect((await read(request)).assessment.application_review.assessmentRevision).toBe(2);await page.unroute('**/api/demo?**');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await refresh(page);await expect(page.getByText('Human assessment · revision 2',{exact:true})).toBeVisible();expect((await read(request)).assessment.application_review.assessmentRevision).toBe(2);
});


test('T25 guided overview, stable review panels, contextual task and themed feedback',async({page,context,request},info)=>{
  await open(page,'hr','amy-chen','company');
  await expect(page.getByLabel('Role overview')).toContainText('Junior Data Analyst');
  await expect(page.locator('.guide-work-chain details')).toHaveCount(3);
  await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:info.outputPath('company-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'View candidates →',exact:true}).click();
  await page.getByRole('button',{name:'Open Amy Chen',exact:true}).click();
  const left=page.locator('.guide-review-grid>.r5-original-pane'), right=page.locator('.guide-review-grid>section');
  expect(Math.abs((await left.boundingBox())!.height-(await right.boundingBox())!.height)).toBeLessThan(2);
  await page.getByRole('button',{name:/^S2 ·/}).click();
  const y=await page.evaluate(()=>scrollY);
  await page.getByRole('button',{name:/^B3 ·/}).click();
  expect(Math.abs(await page.evaluate(()=>scrollY)-y)).toBeLessThan(2);
  await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:info.outputPath('evidence-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'Prepare task from B3',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Target skill',exact:true})).toHaveAttribute('data-value','business-problem-solving');
  await expect(page.getByLabel('Evidence gap / task reason',{exact:true})).not.toHaveValue('');
  await page.getByLabel('Evidence gap / task reason',{exact:true}).fill('Keep this B3 evidence gap while checking the source.');
  await page.getByRole('button',{name:'← Back to evidence · B3',exact:true}).click();
  await expect(page.getByRole('button',{name:/^B3 ·/})).toHaveAttribute('aria-expanded','true');
  await nav(page,'Targeted tasks');
  await expect(page.getByLabel('Evidence gap / task reason',{exact:true})).toHaveValue('Keep this B3 evidence gap while checking the source.');
  await page.getByRole('button',{name:'Preview work brief',exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:info.outputPath('task-brief-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'Continue to confirmation',exact:true}).click();
  expect((await read(request)).task.status).toBe('draft');
  await page.getByRole('button',{name:'Send task',exact:true}).click();
  await expect(page.getByLabel('Action feedback')).toContainText('Task sent');
  await expect(page.getByRole('navigation',{name:'Candidate journey'})).toContainText('Candidate to act');
  const candidate=await context.newPage();await start(candidate);
  await expect(candidate.getByRole('navigation',{name:'Work area shortcuts'})).toBeVisible();
  await submit(candidate,request,'amy-chen',1,'A bounded comparison with explicitly stated uncertainty.');
  await expect(candidate).toHaveURL(/#history$/);
  await expect(candidate.getByLabel('Action feedback')).toContainText('Work submitted');
  await candidate.screenshot({path:info.outputPath('submitted-dark.png'),fullPage:true});
  await page.evaluate(()=>document.documentElement.dataset.theme='light');
  await nav(page,'Company & role');await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:info.outputPath('company-light.png'),fullPage:true});
  await nav(page,'Evidence & marks');await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:info.outputPath('evidence-light.png'),fullPage:true});

});

test('T26 coverage labels show independent server values and open the owned criterion',async({page,request},info)=>{
  await page.setViewportSize({width:1440,height:1100});
  await open(page,'hr');
  const compare=await(await request.get(`${backend}/api/demo/comparison`)).json();
  for(const row of compare.data.candidates) {
    const cell=page.locator(`tr[data-candidate="${row.candidate.id}"] .guide-coverage-cell`);
    const score=row.assessment.score;
    const numeric=score.criteria.filter((c:any)=>typeof c.mark==='number').length;
    await expect(cell.locator('.guide-coverage-track button')).toHaveCount(10);
    await expect(cell.locator('[data-state=covered]')).toHaveCount(numeric);
    await expect(cell.locator('.guide-coverage-badge strong')).toHaveText(`${numeric} / 10`);
    await expect(cell.locator('.guide-points-badge>strong')).toHaveText(`${score.accruedScore.toFixed(1)} / 100`);
    await expect(cell.locator('.guide-coverage-badge')).toHaveAttribute('data-state',numeric===10?'complete':'partial');
    const bounds=(await cell.boundingBox())!;
    expect(bounds.height).toBeLessThanOrEqual(66);
    expect(bounds.width).toBeLessThanOrEqual(180);
    const badges=await cell.locator('.guide-coverage-labels>div').all();
    expect(Math.abs((await badges[0].boundingBox())!.y-(await badges[1].boundingBox())!.y)).toBeLessThan(1);
  }
  await expect(page.locator('.r5-compare-table')).toHaveCSS('min-width','950px');
  expect(await page.locator('.eb-table-scroll').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
  await page.locator('tr[data-candidate="amy-chen"] .guide-coverage-cell').screenshot({path:info.outputPath('coverage-dark.png')});
  await page.locator('.r5-compare-table').screenshot({path:info.outputPath('comparison-dark.png')});
  await page.getByRole('switch',{name:'Night mode'}).click();
  await page.locator('tr[data-candidate="amy-chen"] .guide-coverage-cell').screenshot({path:info.outputPath('coverage-light.png')});
  await page.locator('.r5-compare-table').screenshot({path:info.outputPath('comparison-light.png')});
  await page.getByRole('button',{name:/Jamie Parker · B4 ·/}).click();
  await expect(page.getByRole('combobox',{name:'Current candidate',exact:true})).toHaveAttribute('data-value','jamie-parker');
  await expect(page.getByRole('button',{name:/^B4 ·/})).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('button',{name:/^B4 ·/})).toBeFocused();
  await nav(page,'Compare candidates');
  await page.getByRole('button',{name:/Amy Chen · S1 ·/}).click();
  await expect(page.getByRole('combobox',{name:'Current candidate',exact:true})).toHaveAttribute('data-value','amy-chen');
  await expect(page.getByRole('button',{name:/^S1 ·/})).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('.r5-inline-source')).toContainText('Amy Chen');
  await nav(page,'Compare candidates');
  await page.getByRole('button',{name:/Amy Chen · B4 ·/}).click();
  await expect(page.getByRole('button',{name:/^B4 ·/})).toHaveAttribute('aria-expanded','true');
});


test('T29 explicit target, distinct reviewed counts and stage report exports', async({page,request},info)=>{
  await open(page,'hr');
  const list=(await (await request.get(`${backend}/api/demo/comparison`)).json()).data;
  const counts=page.getByLabel('Applications reviewed',{exact:true});
  await expect(counts).toContainText(`${list.candidates.filter((r:any)=>r.assessment?.score.assessmentComplete).length}/4`);
  await expect(counts).toContainText(`${list.candidates.filter((r:any)=>r.assessment?.score.complete).length}/4 complete core evidence`);
  await expect(page.getByRole('columnheader',{name:'Core analytical evidence match'})).toBeVisible();
  await open(page,'hr','amy-chen','tasks');
  await expect(page.getByRole('combobox',{name:'Target skill',exact:true})).toHaveAttribute('data-value','');
  await page.getByLabel('Evidence gap / task reason',{exact:true}).fill('A meaningful gap needs checking.');
  await expect(page.getByRole('button',{name:'Preview work brief',exact:true})).toBeDisabled();
  await glide(page,'Target skill','sql');
  await page.getByLabel('Evidence gap / task reason',{exact:true}).fill('Verify the join grain.');
  await page.getByRole('button',{name:'Preview work brief',exact:true}).click();
  await expect(page.locator('.guide-task-brief')).toContainText('SQL');
  await nav(page,'Evidence & marks');
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export assessment report',exact:true}).click();
  const file=await downloaded;expect(file.suggestedFilename()).toContain('amy-chen-application_review');
  const report=await readFile((await file.path())!,'utf8');
  expect(report).toContain('Mark: 2');expect(report).toContain('Full JD alignment');expect(report).toContain('UTF-16');expect(report).toContain('not a full JD match');
  for(const theme of ['dark','light']) {await page.getByRole('switch',{name:'Night mode'}).setChecked(theme==='dark');await page.screenshot({path:info.outputPath(`polish-${theme}.png`),fullPage:true});}
});

test('T30 HTML authentication failure keeps a submission and retries its exact request',async({page,request})=>{
  await seedTask(request);await start(page);
  await page.getByLabel('Executive summary',{exact:true}).fill('PRESERVE-AUTH-DRAFT');
  const attempts:Array<{body:string|null;key:string|undefined}>=[];let allow=false;
  await page.route('**/api/demo/submission',async route=>{
    attempts.push({body:route.request().postData(),key:route.request().headers()['idempotency-key']});
    if(!allow)await route.fulfill({status:401,contentType:'text/html',body:'<html>Login required</html>'});else await route.continue();
  });
  await page.getByRole('button',{name:'Submit V1',exact:true}).click();
  await page.getByRole('button',{name:'Confirm V1 submission',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Editing access required');
  await expect(page.getByLabel('Executive summary',{exact:true})).toHaveValue('PRESERVE-AUTH-DRAFT');
  expect((await read(request)).submission).toBeNull();
  allow=true;await dialog.getByRole('button',{name:'Retry original action',exact:true}).click();
  await expect(dialog).toHaveCount(0);expect(attempts).toHaveLength(2);expect(attempts[1]).toEqual(attempts[0]);
  expect((await read(request)).submission.summary).toBe('PRESERVE-AUTH-DRAFT');
  await expect(page.getByRole('heading',{name:'Work and public feedback'})).toBeVisible();
});


test('T31 JD requirements preserve multiple statuses and exact owned sources for all four people',async({page,request},info)=>{
  for(const id of people) {
    const d=await read(request,id);await open(page,'hr',id,'evidence');
    await page.getByText('Full JD alignment · 19 requirements',{exact:true}).click();
    const section=page.getByRole('region',{name:'Candidate JD alignment',exact:true});
    await expect(section.locator('.r6-jd-row')).toHaveCount(d.job.jd.requirements.length);
    const alignment=d.application.jdAlignment.find((a:any)=>a.statuses.length>1 && a.sourceRefs.length>0);
    const requirement=d.job.jd.requirements.find((r:any)=>r.id===alignment.jdRequirementId);
    const row=section.locator('.r6-jd-row').filter({has:page.locator('summary span',{hasText:requirement.statement})});
    await expect(row.locator('.r6-tag')).toHaveCount(alignment.statuses.length);
    await row.locator('summary').click();await row.getByRole('button').first().click();
    const ref=alignment.sourceRefs[0];await expect(page.getByRole('dialog').locator('mark')).toHaveText(ref.quote);
    await expect(page.getByRole('dialog')).toContainText(d.candidate.name);await page.keyboard.press('Escape');
  }
  await page.screenshot({path:info.outputPath('jd-alignment-desktop.png'),fullPage:true});
});

test('T32 task suggestions use current service priority and still require explicit human confirmation',async({page,request})=>{
  const id='jamie-parker',d=await read(request,id),gap=[...d.gapSuggestions].sort((a:any,b:any)=>a.priority-b.priority)[0];
  await open(page,'hr',id,'comparison');const row=page.locator(`tr[data-candidate="${id}"]`);
  await expect(row.locator('.r5-gap')).toContainText(gap.summary);await row.locator('.r5-gap').click();
  await expect(page.getByRole('button',{name:new RegExp('^'+gap.criterionId+' ·')})).toHaveAttribute('aria-expanded','true');
  await nav(page,'Targeted tasks');await page.locator('.r6-gaps details').first().locator('summary').click();
  await page.getByRole('button',{name:`Prepare optional ${gap.criterionId} task`,exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Target skill',exact:true})).toHaveAttribute('data-value',gap.targetRequirementId);
  await expect(page.getByLabel('Evidence gap / task reason',{exact:true})).toHaveValue(`${gap.summary} ${gap.nextStep}`);
  expect((await read(request,id)).task.status).toBe('draft');
  await page.getByRole('button',{name:'Preview work brief',exact:true}).click();await page.getByRole('button',{name:'Continue to confirmation',exact:true}).click();
  expect((await read(request,id)).task.status).toBe('draft');await page.getByRole('button',{name:'Send task',exact:true}).click();
  await expect.poll(async()=>(await read(request,id)).task.targetRequirementId).toBe(gap.targetRequirementId);
});

test('T33 legacy identity and content-version drafts cannot silently become new work',async({page,request})=>{
  await page.goto(`${candidateUrl}/?candidateId=alex-chen#application`);
  await expect(page.getByText(/This link belongs to an old or unknown identity/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'Amy Chen',exact:true})).toHaveCount(0);
  await page.evaluate(()=>localStorage.setItem('evidencebridge.api3.draft.old.alex-chen.task.v1',JSON.stringify({summary:'LEGACY PUBLIC TEXT',notes:'LEGACY PRIVATE NOTES',findings:[]})));
  await page.getByRole('button',{name:'Choose current demo identity',exact:true}).click();await expect(page.getByRole('heading',{name:'Amy Chen',exact:true})).toBeVisible();
  await page.locator('.r6-archived > summary').click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export draft 1 public text',exact:true}).click();
  const file=await downloaded,text=await readFile((await file.path())!,'utf8');expect(text).toContain('LEGACY PUBLIC TEXT');expect(text).not.toContain('LEGACY PRIVATE');
  await seedTask(request);await refresh(page);await nav(page,'My task');await page.getByRole('button',{name:'Start V1 draft',exact:true}).click();await page.getByLabel('Executive summary').fill('OLD CONTENT DRAFT');
  await page.route('**/api/demo?candidateId=amy-chen',async route=>{const response=await route.fetch();const json=await response.json();json.data.fixtureVersion='test-new-content-version';await route.fulfill({response,json});});
  await page.route('**/api/demo/comparison',async route=>{const response=await route.fetch();const json=await response.json();json.data.fixtureVersion='test-new-content-version';await route.fulfill({response,json});});
  await refresh(page);await expect(page.getByRole('button',{name:'Start V1 draft',exact:true})).toBeVisible();await page.getByRole('button',{name:'Start V1 draft',exact:true}).click();await expect(page.getByLabel('Executive summary')).toHaveValue('');
  expect(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('OLD CONTENT DRAFT')))).toBe(true);expect((await read(request)).submission).toBeNull();
});

test('T34 original PDF links and downloaded bytes match supplied materials',async({page,request})=>{
  const {createHash}=await import('node:crypto');
  for(const id of people) {
    const d=await read(request,id);await open(page,'candidate',id,'application');await page.getByRole('button',{name:/Original CV · public extract/}).click();
    const source=d.application.sources.find((s:any)=>s.provenance?.downloadUrl),link=page.getByRole('link',{name:'Download original CV PDF',exact:true});
    await expect(link).toHaveAttribute('href',backend+source.provenance.downloadUrl);
    const pdf=await request.get((await link.getAttribute('href'))!);expect(pdf.ok()).toBe(true);expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect(createHash('sha256').update(await pdf.body()).digest('hex')).toBe(source.provenance.redaction.originalSha256);
    await page.keyboard.press('Escape');await page.getByText('Review full JD · 19 requirements',{exact:true}).click();
    const jd=page.getByRole('link',{name:'Download original JD PDF',exact:true});await expect(jd).toHaveAttribute('href',backend+d.job.jd.source.downloadUrl);
    const response=await request.get((await jd.getAttribute('href'))!);expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(d.job.jd.sha256);
  }
});

test('T35 incompatible API3 response is visible and never falls back to a preview',async({page})=>{
  await page.route('**/api/demo/comparison',async route=>{const response=await route.fetch();const json=await response.json();json.data.schemaVersion='3.0';await route.fulfill({response,json});});
  await page.goto(hrUrl);await expect(page.getByRole('alert').filter({hasText:'This mode needs EvidenceBridge API4'}).first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Compare candidate evidence',exact:true})).toHaveCount(0);
});

test('T36 no-ID bootstrap uses the service list rather than a hardcoded default person',async({page})=>{
  await page.route('**/api/demo/comparison',async route=>{const response=await route.fetch();const json=await response.json();json.data.candidates.reverse();await route.fulfill({response,json});});
  await page.goto(candidateUrl);await expect(page.getByRole('heading',{name:'Jamie Parker',exact:true})).toBeVisible();await expect(page).toHaveURL(/candidateId=jamie-parker/);
});
