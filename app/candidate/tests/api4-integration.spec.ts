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
async function refresh(page:Page) {await page.getByRole('button',{name:'Refresh data',exact:true}).click();await expect(page.getByRole('button',{name:'Refresh data',exact:true})).toBeEnabled();await expect(page.getByTestId('connection-state')).toHaveAttribute('data-fresh','true');}
async function glide(page:Page,label:string,value:string) {await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('listbox',{name:label,exact:true}).locator(`[data-value="${value}"]`).click();await expect(page.getByRole('combobox',{name:label,exact:true})).toHaveAttribute('data-value',value);}
async function open(page:Page,role:'hr'|'candidate',id='amy-chen',section='') {await page.goto(`${role==='hr'?hrUrl:candidateUrl}/?candidateId=${id}${section?`#${section}`:''}`);await expect(page.getByTestId('connection-state')).toHaveAttribute('data-fresh','true');if(role==='candidate'||section==='evidence')await expect(page.getByRole('combobox',{name:'Current candidate',exact:true})).toHaveAttribute('data-value',id);}
async function chooseStage(page:Page,value:string) {await page.getByRole('combobox',{name:'Assessment stage',exact:true}).click();await page.getByRole('option',{name:value==='application_review'?/Application materials/:new RegExp('Task V'+value.slice(-1))}).click();}
async function sendTask(page:Page,id:string,target:string) {await open(page,'hr',id,'tasks');await glide(page,'Target skill',target);await page.getByLabel('Evidence gap / task reason',{exact:true}).fill('A bounded evidence gap needs verification.');await page.getByRole('button',{name:'Preview work brief',exact:true}).click();await page.getByRole('button',{name:'Continue to confirmation',exact:true}).click();await page.getByRole('button',{name:'Send task',exact:true}).click();await expect(page.getByRole('button',{name:'Send task',exact:true})).toHaveCount(0);}
async function start(page:Page,id='amy-chen') {await open(page,'candidate',id,'tasks');await page.getByRole('button',{name:'Start V1 draft',exact:true}).click();await expect(page.getByLabel('Executive summary',{exact:true})).toBeVisible();}
async function submit(page:Page,request:APIRequestContext,id:string,version:number,summary:string) {if(await page.getByRole('dialog',{name:'Private notebook',exact:true}).isVisible())await page.keyboard.press('Escape');if(!await page.getByLabel('Executive summary',{exact:true}).isVisible())await page.locator('.cp-summary > summary').click();await page.getByLabel('Executive summary',{exact:true}).fill(summary);await page.getByRole('button',{name:`Submit V${version}`,exact:true}).click();await page.getByRole('button',{name:`Confirm V${version} submission`,exact:true}).click();await expect.poll(async()=>(await read(request,id)).currentSubmissionVersion).toBe(version);await expect(page.getByRole('dialog')).toHaveCount(0);}
async function review(page:Page,decision:string,comment:string) {await page.getByRole('button',{name:decision,exact:true}).click();await page.getByLabel('Public review comment',{exact:true}).fill(comment);await page.getByRole('button',{name:'Save evidence review',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
async function restart() {const control=new URL('../../../.ci-results/api4-test-control.json',import.meta.url);const old=JSON.parse(await readFile(control,'utf8'));await writeFile(join(old.directory,'restart.request'),String(old.generation+1));await expect.poll(async()=>JSON.parse(await readFile(control,'utf8')).generation).toBe(old.generation+1);}
let runtimeErrors:string[]=[];
test.beforeEach(async({request,context})=>{runtimeErrors=[];const watch=(page:Page)=>page.on('pageerror',error=>runtimeErrors.push(error.message));context.pages().forEach(watch);context.on('page',watch);await reset(request);});
test.afterEach(()=>{expect(runtimeErrors).toEqual([]);});

async function switchRole(page:Page, name:string) {
  await page.getByRole('button',{name:'Switch demo role',exact:true}).click();
  await page.getByRole('menuitem',{name}).click();
}
test('T67 rehearsal: reset, four populated sections, distinct new card, submit, HR review, repeat',async({page,request},info)=>{
  await open(page,'candidate','amy-chen','tasks');
  await page.getByRole('button',{name:'Reset demo',exact:true}).click();
  await expect(page.getByRole('button',{name:'Archive and restart demo'})).toBeDisabled();
  await page.getByRole('checkbox',{name:/I understand/}).check();
  await page.getByRole('button',{name:'Archive and restart demo'}).click();
  await page.getByRole('button',{name:'Start V1 draft',exact:true}).click();
  await page.getByRole('button',{name:'Fill demo draft',exact:true}).click();
  for(const name of ['Key Findings','Hypotheses','Additional Evidence Needed','Recommended Next Steps']) await expect(page.getByRole('tab',{name:`${name} (1)`,exact:true})).toBeVisible();
  await expect(page.getByLabel('Executive summary',{exact:true})).not.toHaveValue('');
  await page.getByRole('button',{name:'Add Key Findings',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('Observation or idea',{exact:true})).toHaveValue('Paid Search is a priority segment');
  await page.getByRole('button',{name:'Save card',exact:true}).click();
  await page.getByRole('button',{name:'Fill demo draft',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Key Findings (2)',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Additional Evidence Needed (1)',exact:true}).click();
  await page.screenshot({path:info.outputPath('demo-prefill.png'),fullPage:true});
  await page.getByRole('button',{name:'Submit V1',exact:true}).click();
  await expect(page.getByRole('button',{name:'Confirm V1 submission',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Confirm V1 submission',exact:true}).click();
  await expect.poll(async()=>(await read(request)).currentSubmissionVersion).toBe(1);
  expect((await read(request)).submission.findings).toHaveLength(5);
  await switchRole(page,'Return to HR');await expect(page.getByTestId('connection-state')).toHaveAttribute('data-fresh','true');
  await nav(page,'Tasks & review');await review(page,'Confirm evidence','The sample separates observations from hypotheses and gives contrasting B3 outcomes.');
  expect((await read(request)).review.decision).toBe('confirm');
  const oldTask=(await read(request)).task.taskId;
  await page.getByRole('button',{name:'Reset demo',exact:true}).click();
  await page.getByRole('radio',{name:/Before HR sends/}).check();await page.getByRole('checkbox',{name:/I understand/}).check();
  await page.getByRole('button',{name:'Archive and restart demo'}).click();
  await expect.poll(async()=>(await read(request)).task.status).toBe('draft');
  expect((await read(request)).task.taskId).not.toBe(oldTask);expect((await read(request)).versions).toHaveLength(0);
  await switchRole(page,'Open Candidate view');await expect(page.getByTestId('connection-state')).toHaveAttribute('data-fresh','true');
  await expect(page.getByRole('button',{name:'Start V1 draft',exact:true})).toHaveCount(0);
});
test('T61 role round trip retains candidate, theme, sidebar width and HR criterion without writes',async({page,request},info)=>{
  const before=await read(request,'ann-li'), writes:string[]=[];page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});
  await open(page,'hr','ann-li','evidence');
  await page.getByRole('navigation',{name:'Evidence criteria'}).getByRole('button',{name:/^D2 ·/}).click();
  await page.getByRole('switch',{name:'Night mode'}).setChecked(false);
  await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
  await expect(page.locator('#eb-sidebar')).toHaveCSS('width','64px');
  const width=await page.locator('#eb-sidebar').evaluate(e=>e.getBoundingClientRect().width);
  await page.getByRole('button',{name:'Switch demo role',exact:true}).click();
  await expect(page.getByRole('menu')).toContainText('Ann Li');await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Switch demo role',exact:true})).toBeFocused();
  await switchRole(page,'Open Candidate view');await expect(page).toHaveURL(new RegExp(`${candidateUrl}/\\?candidateId=ann-li#application`));
  await expect(page.getByTestId('connection-state')).toHaveAttribute('data-fresh','true');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.locator('#eb-sidebar')).toHaveClass(/is-collapsed/);
  expect(await page.locator('#eb-sidebar').evaluate(e=>e.getBoundingClientRect().width)).toBe(width);
  await page.getByRole('button',{name:'Switch demo role',exact:true}).click();await page.screenshot({path:info.outputPath('role-switch-light.png')});await page.keyboard.press('Escape');
  await switchRole(page,'Return to HR');await expect(page).toHaveURL(new RegExp(`${hrUrl}/\\?candidateId=ann-li#evidence`));
  await expect(page.getByRole('navigation',{name:'Evidence criteria'}).getByRole('button',{name:/^D2 ·/})).toHaveAttribute('aria-expanded','true');
  await page.getByRole('switch',{name:'Night mode'}).setChecked(true);await page.getByRole('button',{name:'Switch demo role',exact:true}).click();await page.screenshot({path:info.outputPath('role-switch-dark.png')});
  expect(writes).toEqual([]);expect((await read(request,'ann-li')).revision).toBe(before.revision);
});
test('T62 saved candidate draft and private notes survive role navigation without entering URL or server',async({page,request})=>{
  await seedTask(request);await start(page);
  await page.getByLabel('Executive summary',{exact:true}).fill('Saved public draft for role switching');
  const notes=page.getByRole('tab',{name:'Private notebook',exact:true});await notes.click();await page.getByLabel('Private notes',{exact:true}).fill('PRIVATE ROLE SWITCH NOTE');await page.keyboard.press('Escape');
  const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});
  await switchRole(page,'Return to HR');await expect(page.getByTestId('connection-state')).toHaveAttribute('data-fresh','true');
  expect(page.url()).not.toContain('PRIVATE');await expect(page.locator('body')).not.toContainText('PRIVATE ROLE SWITCH NOTE');
  await switchRole(page,'Open Candidate view');await expect(page).toHaveURL(/candidateId=amy-chen#workspace$/);
  await expect(page.getByLabel('Executive summary',{exact:true})).toHaveValue('Saved public draft for role switching');
  await page.getByRole('tab',{name:'Private notebook',exact:true}).click();await expect(page.getByLabel('Private notes',{exact:true})).toHaveValue('PRIVATE ROLE SWITCH NOTE');
  expect(writes).toEqual([]);expect((await read(request)).submission).toBeNull();
});
test('T63 unsent HR task edits require explicit discard and can be kept',async({page,request})=>{
  await open(page,'hr','amy-chen','tasks');await glide(page,'Target skill','sql');await page.getByLabel('Evidence gap / task reason',{exact:true}).fill('Unsaved role transition reason');
  await switchRole(page,'Open Candidate view');await expect(page.getByRole('dialog',{name:'Keep your unsaved changes?'})).toBeVisible();
  await page.getByRole('button',{name:'Stay here',exact:true}).click();await expect(page.getByLabel('Evidence gap / task reason',{exact:true})).toHaveValue('Unsaved role transition reason');
  await switchRole(page,'Open Candidate view');await page.getByRole('button',{name:'Discard unsaved edits and switch',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(candidateUrl));await expect(page.getByTestId('connection-state')).toHaveAttribute('data-fresh','true');expect((await read(request)).task.status).toBe('draft');
});
test('T64 slow or failed arrival shows loading/error and disables role switch until current data is ready',async({page})=>{
  await open(page,'hr','david-liu','evidence');
  await page.route(`${backend}/api/demo**`,async route=>{await new Promise(resolve=>setTimeout(resolve,1200));await route.abort();});
  await switchRole(page,'Open Candidate view');await expect(page.getByRole('status',{name:'Loading workspace'})).toBeVisible();
  await page.getByRole('button',{name:'Switch demo role',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Return to HR'})).toHaveAttribute('aria-disabled','true');
  await expect(page.getByTestId('connection-error-code')).toBeVisible();await page.keyboard.press('Escape');
  await page.unroute(`${backend}/api/demo**`);await refresh(page);
  await page.getByRole('button',{name:'Switch demo role',exact:true}).click();await expect(page.getByRole('menu')).toContainText('David Liu');await expect(page.getByRole('menuitem',{name:'Return to HR'})).toHaveAttribute('aria-disabled','false');
});
test('T65 browser draft storage failure blocks silent role departure',async({page,request})=>{
  await seedTask(request);await start(page);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('evidencebridge.api4.draft.'))throw new DOMException('Full','QuotaExceededError');original.call(this,key,value);};});
  await page.getByLabel('Executive summary',{exact:true}).fill('Unsaved in-memory draft');
  await switchRole(page,'Return to HR');await expect(page.getByRole('dialog',{name:'Keep your unsaved changes?'})).toContainText('could not be saved');
  await page.getByRole('button',{name:'Stay here',exact:true}).click();await expect(page.getByLabel('Executive summary',{exact:true})).toHaveValue('Unsaved in-memory draft');
});
test('T66 uncertain requests disable switching and submission arrives in the other role after resolution',async({page,request})=>{
  await seedTask(request);await start(page);
  // Simulate a lost receipt with the established real backend still untouched by this request.
  await page.route(`${backend}/api/demo/submission`,route=>route.abort());
  await page.getByLabel('Executive summary',{exact:true}).fill('A shared role-switch submission');await page.getByRole('button',{name:'Submit V1',exact:true}).click();await page.getByRole('button',{name:'Confirm V1 submission',exact:true}).click();
  await expect(page.getByTestId('connection-error-code')).toBeVisible();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Switch demo role',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Return to HR'})).toHaveAttribute('aria-disabled','true');await page.keyboard.press('Escape');
  await page.unroute(`${backend}/api/demo/submission`);await page.getByRole('button',{name:'Retry original action',exact:true}).click();await expect.poll(async()=>(await read(request)).currentSubmissionVersion).toBe(1);
  await expect(page.getByTestId('connection-state')).toHaveAttribute('data-fresh','true');
  await switchRole(page,'Return to HR');await expect(page).toHaveURL(/candidateId=amy-chen#tasks$/);await expect(page.locator('body')).toContainText('A shared role-switch submission');
});

test('T27 assessment selectors work in a modal, preserve empty and NE marks, and initially locate B3',async({page,request},info)=>{
  const before=await read(request);await open(page,'hr','amy-chen','evidence');
  const ref=before.assessment.application_review.items.find((item:any)=>item.criterionId==='B3').sourceRefs[0];
  await expect(page.locator('.r5-inline-source mark')).toHaveText(ref.quote);
  await expect(page.getByRole('combobox',{name:'Review source',exact:true})).toHaveAttribute('data-value',ref.sourceId);
  await expect(page.locator('.r5-criterion.eb-spotlight')).toHaveCount(1);
  await expect(page.locator('.r5-criterion-toggle[aria-expanded=true]')).toHaveCount(1);await expect(page.locator('.r5-criterion-toggle[aria-expanded=true]')).toHaveCSS('border-top-width','1px');
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
  await page.getByRole('button',{name:'Explore data & calculations',exact:true}).click();
  await glide(page,'Filter channel',dataset.channels[0].channel);await expect(page.locator('.eb-data-overview tbody tr')).toHaveCount(1);
  await glide(page,'Filter channel','All channels');await glide(page,'Sort channel rows','traffic');
  const sorted=[...dataset.channels].sort((a:any,b:any)=>b.traffic-a.traffic);await expect(page.locator('.eb-data-overview tbody tr').first()).toContainText(sorted[0].channel);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Other resources',exact:true}).click();await page.getByRole('button',{name:'Website traffic',exact:true}).click();await glide(page,'Sort resource column','0');
  await page.getByRole('dialog').getByRole('button',{name:/Create card from row/}).first().click();
  await glide(page,'Evidence source','');await glide(page,'Evidence source','website_traffic.csv');await glide(page,'Self-reported confidence','Low');
  await page.getByLabel('Observation or idea').fill('Gold UI regression finding');await page.getByRole('button',{name:'Save card',exact:true}).click();
  const card=page.locator('.eb-board .eb-spotlight');await expect(card.getByLabel('Card title')).toHaveValue('Gold UI regression finding');await expect(card).toContainText('Self-confidence Low');
  for(const theme of ['dark','light']) {
    await page.getByRole('switch',{name:'Night mode'}).setChecked(theme==='dark');await card.hover();
    await expect(card).toHaveAttribute('data-spot-active','true');await expect(card).toHaveCSS('transform','none');
    await expect.poll(()=>card.evaluate(el=>getComputedStyle(el,'::before').opacity)).toBe('1');
    await page.screenshot({path:info.outputPath(`gold-workspace-${theme}.png`),fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});expect(await card.evaluate(el=>getComputedStyle(el,'::before').display)).toBe('none');
  await expect(page.locator('select')).toHaveCount(0);
  await submit(page,request,'amy-chen',1,'Preserve gold UI finding');await nav(page,'Work & feedback');
  await expect(page.locator('.eb-finding.eb-spotlight').filter({hasText:'Gold UI regression finding'})).toHaveCount(1);await glide(page,'Submission version','1');
  await open(page,'hr','amy-chen','tasks');await page.getByRole('button',{name:'Version history',exact:true}).click();await page.getByRole('button',{name:'Inspect this version',exact:true}).first().click();await expect(page.locator('select')).toHaveCount(0);
});

test('T23 server rubric keeps black-gold cards, exact criteria, focus return and both themes',async({page,request},info)=>{
  const data=await read(request), writes:string[]=[];page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});
  await open(page,'hr','amy-chen','company');await expect(page.getByRole('switch',{name:'Night mode'})).toBeChecked();
  await expect(page.locator('.uw-standard-links button')).toHaveCount(data.rubric.criteria.length);
  for(const r of data.rubric.requirements)await expect(page.locator('.uw-weight-bar > span').filter({hasText:r.title})).toContainText(`${r.maxScore}%`);
  const cell=page.locator('.uw-standard-links button').filter({hasText:'B3'});await cell.scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY);await cell.click();
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
  for(const id of people) {await open(page,'candidate',id);const d=await read(request,id);await expect(page.locator('.ia-person-bar > div > strong').getByText(d.candidate.name,{exact:true})).toBeVisible();expect(d.application.candidateId).toBe(id);await expect(page.getByText('Frontend mock · synthetic materials and illustrative marks',{exact:true})).toHaveCount(0);}
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
  await nav(candidate,'Work & feedback');const download=candidate.waitForEvent('download');await candidate.getByRole('button',{name:'Export work',exact:true}).click();expect(await readFile((await(await download).path())!,'utf8')).not.toContain('PRIVATE');
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
  await seedTask(request);await start(candidate);await candidate.getByLabel('Executive summary').fill('OLD-SESSION-DRAFT');await reset(request);await candidate.getByRole('button',{name:'Submit V1',exact:true}).click();await candidate.getByRole('button',{name:'Confirm V1 submission',exact:true}).click();await expect(candidate.getByTestId('connection-error-code')).toContainText('STALE_SESSION');expect((await read(request)).submission).toBeNull();await nav(candidate,'My task');await expect(candidate.getByRole('heading',{name:'No supplementary task requested',exact:true})).toBeVisible();await expect(candidate.getByText('OLD-SESSION-DRAFT',{exact:true})).toHaveCount(0);
});

test('T11 stale assessment revision is rejected and preserves the second reviewer form',async({page,context,request})=>{
  const other=await context.newPage();for(const p of [page,other]) {await open(p,'hr','amy-chen','evidence');await p.getByRole('button',{name:'Edit human assessment',exact:true}).click();await p.getByLabel('Assessment operator label').fill('Synthetic reviewer');}
  await page.getByLabel('Judgment reason').fill('First reviewer saved decision.');await page.getByRole('button',{name:'Save assessment revision',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await other.getByLabel('Judgment reason').fill('KEEP SECOND REVIEWER INPUT');await other.getByRole('button',{name:'Save assessment revision',exact:true}).click();await expect(other.getByRole('dialog')).toBeVisible();await expect(other.getByLabel('Judgment reason')).toHaveValue('KEEP SECOND REVIEWER INPUT');await expect(other.getByTestId('connection-error-code')).toContainText('ASSESSMENT_CONFLICT');expect((await read(request)).assessment.application_review.assessmentRevision).toBe(2);
});

test('T12 unavailable service keeps local draft and never substitutes preview data',async({page:candidate,request})=>{
  await seedTask(request);await start(candidate);await candidate.getByLabel('Executive summary').fill('KEEP-API4-DRAFT');await candidate.route('**/api/demo?**',route=>route.abort());await candidate.getByRole('button',{name:'Refresh data',exact:true}).click();await candidate.getByRole('button',{name:'Workspace info',exact:true}).click();await expect(candidate.getByRole('dialog')).toContainText('CONNECTION_UNCERTAIN');await candidate.keyboard.press('Escape');await expect(candidate.getByLabel('Executive summary')).toHaveValue('KEEP-API4-DRAFT');await expect(candidate.getByText('Frontend mock · synthetic materials and illustrative marks',{exact:true})).toHaveCount(0);await candidate.unroute('**/api/demo?**');await refresh(candidate);await submit(candidate,request,'amy-chen',1,'Recovered real API draft.');
});

test('T13 a slow previous candidate response never becomes the newly selected identity',async({page})=>{
  await open(page,'candidate');await page.route('**/api/demo?candidateId=ann-li',async route=>{const r=await route.fetch();await new Promise(r=>setTimeout(r,800));await route.fulfill({response:r});});
  await glide(page,'Current candidate','ann-li');await glide(page,'Current candidate','jamie-parker');await expect(page.locator('.ia-person-bar > div > strong').getByText('Jamie Parker',{exact:true})).toBeVisible();await page.waitForTimeout(1000);await expect(page.locator('.ia-person-bar > div > strong').getByText('Jamie Parker',{exact:true})).toBeVisible();await expect(page.locator('.ia-person-bar > div > strong').getByText('Ann Li',{exact:true})).toHaveCount(0);
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
  await page.getByRole('button',{name:'All 4',exact:true}).click();
  async function decide(button:string,reason:string) {
    if(button==='Remove from retained') {
      await page.getByRole('button',{name:button,exact:true}).click();const form=page.getByRole('dialog');
      await form.getByLabel('Human shortlist reason').fill(reason);await form.getByLabel('Shortlist operator label').fill('Synthetic QA reviewer');await form.getByRole('button',{name:'Save shortlist decision',exact:true}).click();await expect(form).toHaveCount(0);
    } else {
      await page.getByLabel('Human shortlist reason').fill(reason);await page.getByLabel('Shortlist operator label').fill('Synthetic QA reviewer');await page.getByRole('button',{name:button,exact:true}).click();await expect(page.getByRole('button',{name:button,exact:true})).toHaveCount(0);await expect(page.getByTestId('connection-state')).toHaveAttribute('data-fresh','true');
    }
  }
  await decide('Retain candidate','Retain original application for discussion.');expect((await read(request)).shortlist.status).toBe('retained');
  await seedTask(request);await seedSubmission(request);await refresh(page);await expect(page.locator('.rd-dossier')).toContainText('Reconfirmation needed');
  await decide('Reconfirm with current basis','Explicitly review the new work basis.');const reconfirmed=await read(request);expect(reconfirmed.shortlist.status).toBe('retained');expect(reconfirmed.shortlist.basis.stage).toBe('task_v1');expect(reconfirmed.review).toBeNull();expect(reconfirmed.assessment.task_v1).toBeNull();
  await page.reload();await decide('Remove from retained','Continue evidence discussion before retaining.');const removed=await read(request);expect(removed.shortlist.status).toBe('not_retained');expect(removed.shortlist.history.map((h:any)=>h.action)).toEqual(['retain','reconfirm','remove']);expect(removed.submission).toEqual(reconfirmed.submission);await nav(page,'Compare candidates');await expect(page.locator('tbody tr')).toHaveCount(4);
});

test('T17 real resources, row-to-card, dark mode and desktop navigation retain the existing UI',async({page,request},info)=>{
  await seedTask(request);await start(page);await expect(page.locator('.cp-task-totals').getByText('1,180,000',{exact:true})).toBeVisible();await expect(page.locator('.cp-task-totals').getByText('30,680',{exact:true})).toBeVisible();await expect(page.getByText('31,200',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Other resources',exact:true}).click();await page.getByLabel('Find a resource',{exact:true}).fill('website');await page.getByRole('button',{name:'Website traffic',exact:true}).click();await page.getByLabel('Filter resource rows').fill('Paid Search');await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(2);await page.getByRole('dialog').getByRole('button',{name:/Create card from row/}).first().click();await expect(page.getByRole('combobox',{name:'Evidence source',exact:true})).toHaveAttribute('data-value','website_traffic.csv');await page.getByLabel('Observation or idea').fill('A bounded data observation');await page.getByRole('button',{name:'Save card',exact:true}).click();await expect(page.getByLabel('Card title')).toHaveValue('A bounded data observation');
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
  await post(request,'/review',{...binding(assessed),submissionId:assessed.submission.submissionId,contentFingerprint:assessed.submission.contentFingerprint,decision:'needs_more_evidence',comment:'Clarify the join boundary.'});await seedSubmission(request,'ann-li','V2 adds a bounded join check.');await refresh(page);await chooseStage(page,'task_v2');expect((await read(request,'ann-li')).assessment.task_v2).toBeNull();await expect(page.locator('.r5-evidence-rail .r5-mark[aria-label="Not assessed"]')).toHaveCount(10);await chooseStage(page,'task_v1');await expect(page.getByRole('button',{name:'Edit human assessment',exact:true})).toBeDisabled();
});

test('T20 failed analysis exposes its status and leaves original work and manual review usable',async({page,request})=>{
  await seedTask(request);const submitted=await seedSubmission(request,'amy-chen','TEST_DISABLED: limited work still open for human review.');await open(page,'hr','amy-chen','tasks');await page.getByRole('button',{name:'Run evidence analysis',exact:true}).click();await expect(page.getByTestId('connection-error-code')).toContainText('AI_DISABLED');await review(page,'Evidence Still Insufficient','The visible work still leaves an evidence gap.');const final=await read(request);expect(final.submission).toEqual(submitted.submission);expect(final.analysis.status).toBe('failed');expect(final.workflow.isTerminal).toBe(true);expect(final.assessment.task_v1).toBeNull();
});

test('T21 a stale V1 review form keeps its comment after another client advances to V2',async({page,request})=>{
  await seedTask(request);const one=await seedSubmission(request);await open(page,'hr','amy-chen','tasks');await page.getByRole('button',{name:'Confirm evidence',exact:true}).click();await page.getByLabel('Public review comment').fill('KEEP THIS V1 REVIEW COMMENT');
  await post(request,'/review',{...binding(one),submissionId:one.submission.submissionId,contentFingerprint:one.submission.contentFingerprint,decision:'needs_more_evidence',comment:'Another reviewer opened the bounded V2.'});await seedSubmission(request,'amy-chen','A new V2 from another window.');
  const conflict=page.waitForResponse(r=>r.url().endsWith('/api/demo/review')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save evidence review',exact:true}).click();expect((await conflict).status()).toBe(409);await expect(page.getByRole('complementary',{name:'Human evidence review',exact:true})).toBeVisible();await expect(page.getByLabel('Public review comment')).toHaveValue('KEEP THIS V1 REVIEW COMMENT');const current=await read(request);expect(current.currentSubmissionVersion).toBe(2);expect(current.review).toBeNull();expect(current.versions[0].review.decision).toBe('needs_more_evidence');
});

test('T22 confirmed save followed by GET failure is not reported as a fresh view or duplicated',async({page,request})=>{
  await open(page,'hr','amy-chen','evidence');await page.getByRole('button',{name:'Edit human assessment',exact:true}).click();await page.getByLabel('Judgment reason').fill('SAVED BUT VIEW REFRESH FAILED');await page.getByLabel('Assessment operator label').fill('Synthetic reviewer');await page.route('**/api/demo?**',route=>route.abort());await page.getByRole('button',{name:'Save assessment revision',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Judgment reason')).toHaveValue('SAVED BUT VIEW REFRESH FAILED');await expect(page.getByTestId('connection-error-code')).toContainText('CONNECTION_UNCERTAIN');await expect(page.getByText(/Saved on the shared service.*Refresh is still needed/)).toBeVisible();expect((await read(request)).assessment.application_review.assessmentRevision).toBe(2);await page.unroute('**/api/demo?**');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await refresh(page);await expect(page.getByText('Human assessment · revision 2',{exact:true})).toBeVisible();expect((await read(request)).assessment.application_review.assessmentRevision).toBe(2);
});


test('T25 guided overview, stable review panels, contextual task and themed feedback',async({page,context,request},info)=>{
  await open(page,'hr','amy-chen','company');
  await expect(page.getByLabel('Role overview')).toContainText('Junior Data Analyst');
  await expect(page.locator('.uw-requirement-table article')).toHaveCount(3);
  await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:info.outputPath('company-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'View candidates →',exact:true}).click();
  await page.getByRole('button',{name:'Open Amy Chen',exact:true}).click();
  const left=page.locator('.guide-review-grid>.r5-original-pane'), right=page.locator('.guide-review-grid>section');
  await expect(left).toBeVisible();await expect(right).toBeVisible();
  // The contextual criterion handoff can replace the assessment panel after navigation.
  // Measure one settled layout frame rather than dereferencing a detached node.
  await expect.poll(async()=>{const [a,b]=await Promise.all([left.boundingBox(),right.boundingBox()]);return a&&b?Math.abs(a.height-b.height):Infinity;}).toBeLessThan(2);
  // Make both criterion rows visible before measuring component-induced scroll.
  // Playwright's off-screen click scrolling is not a component layout jump.
  await page.getByRole('navigation',{name:'Evidence criteria',exact:true}).scrollIntoViewIfNeeded();
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
  await nav(page,'Tasks & review');
  await expect(page.getByLabel('Evidence gap / task reason',{exact:true})).toHaveValue('Keep this B3 evidence gap while checking the source.');
  await page.getByRole('button',{name:'Preview work brief',exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:info.outputPath('task-brief-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'Continue to confirmation',exact:true}).click();
  expect((await read(request)).task.status).toBe('draft');
  await page.getByRole('button',{name:'Send task',exact:true}).click();
  await expect(page.getByLabel('Action feedback')).toContainText('Task sent');
  await expect(page.getByRole('region',{name:'Task review queue'})).toContainText('Awaiting work');
  const candidate=await context.newPage();await start(candidate);
  await expect(candidate.getByRole('tablist',{name:'Investigation sections'})).toBeVisible();
  await submit(candidate,request,'amy-chen',1,'A bounded comparison with explicitly stated uncertainty.');
  await expect(candidate).toHaveURL(/#history$/);
  await expect(candidate.getByLabel('Action feedback')).toContainText('Work submitted');
  await candidate.screenshot({path:info.outputPath('submitted-dark.png'),fullPage:true});
  await page.evaluate(()=>document.documentElement.dataset.theme='light');
  await nav(page,'Company & role');await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:info.outputPath('company-light.png'),fullPage:true});
  await nav(page,'Candidate details');await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:info.outputPath('evidence-light.png'),fullPage:true});

});

test('T26 coverage labels show independent server values and open the owned criterion',async({page,request},info)=>{
  await page.setViewportSize({width:1440,height:1100});await open(page,'hr');
  const compare=await(await request.get(`${backend}/api/demo/comparison`)).json();
  for(const row of compare.data.candidates) {
    await page.getByRole('button',{name:`Preview ${row.candidate.name}`,exact:true}).click();
    await page.getByRole('button',{name:'Scoring & scope',exact:true}).click();
    const cell=page.getByRole('dialog').locator('.guide-coverage-cell'),score=row.assessment.score;
    const numeric=score.criteria.filter((c:any)=>typeof c.mark==='number').length;
    await expect(cell.locator('.guide-coverage-track button')).toHaveCount(10);
    await expect(cell.locator('[data-state=covered]')).toHaveCount(numeric);
    await expect(cell.locator('.guide-coverage-badge strong')).toHaveText(`${numeric} / 10`);
    await expect(cell.locator('.guide-points-badge>strong')).toHaveText(`${score.accruedScore.toFixed(1)} / 100`);
    await expect(cell.locator('.guide-coverage-badge')).toHaveAttribute('data-state',numeric===10?'complete':'partial');
    await cell.screenshot({path:info.outputPath(`coverage-${row.candidate.id}.png`)});
    await page.keyboard.press('Escape');
  }
  expect(await page.locator('.cx-list .eb-table-scroll').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
  for(const theme of ['dark','light']) {await page.getByRole('switch',{name:'Night mode'}).setChecked(theme==='dark');await page.locator('.cx-layout').screenshot({path:info.outputPath(`comparison-${theme}.png`)});}
  await page.getByRole('button',{name:'Scoring & scope',exact:true}).click();
  await page.getByRole('button',{name:/Jamie Parker · B4 ·/}).click();
  await expect(page.getByRole('combobox',{name:'Current candidate',exact:true})).toHaveAttribute('data-value','jamie-parker');
  await expect(page.getByRole('button',{name:/^B4 ·/})).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('button',{name:/^B4 ·/})).toBeFocused();
  for(const criterion of ['S1','B4']) {
    await nav(page,'Compare candidates');await page.getByRole('button',{name:'Preview Amy Chen',exact:true}).click();
    await page.getByRole('button',{name:'Scoring & scope',exact:true}).click();
    await page.getByRole('button',{name:new RegExp(`Amy Chen · ${criterion} ·`)}).click();
    await expect(page.getByRole('combobox',{name:'Current candidate',exact:true})).toHaveAttribute('data-value','amy-chen');
    await expect(page.getByRole('button',{name:new RegExp(`^${criterion} ·`)})).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('.r5-inline-source')).toContainText('Amy Chen');
  }
});

test('T29 explicit target, distinct reviewed counts and stage report exports', async({page,request},info)=>{
  await open(page,'hr');
  const list=(await (await request.get(`${backend}/api/demo/comparison`)).json()).data;
  await page.getByRole('button',{name:'Scoring & scope',exact:true}).click();
  const counts=page.getByLabel('Applications reviewed',{exact:true});
  await expect(counts).toContainText(`${list.candidates.filter((r:any)=>r.assessment?.score.assessmentComplete).length}/4`);
  await expect(page.locator('.r6-complete-count')).toContainText(`${list.candidates.filter((r:any)=>r.assessment?.score.complete).length}/4 complete core evidence`);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('columnheader',{name:'Core evidence match'})).toBeVisible();
  await open(page,'hr','amy-chen','tasks');
  await expect(page.getByRole('combobox',{name:'Target skill',exact:true})).toHaveAttribute('data-value','');
  await page.getByLabel('Evidence gap / task reason',{exact:true}).fill('A meaningful gap needs checking.');
  await expect(page.getByRole('button',{name:'Preview work brief',exact:true})).toBeDisabled();
  await glide(page,'Target skill','sql');
  await page.getByLabel('Evidence gap / task reason',{exact:true}).fill('Verify the join grain.');
  await page.getByRole('button',{name:'Preview work brief',exact:true}).click();
  await expect(page.locator('.guide-task-brief')).toContainText('SQL');
  await nav(page,'Candidate details');
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
    await page.getByRole('button',{name:'Materials & JD',exact:true}).click();
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
  await open(page,'hr',id,'comparison');await page.getByRole('button',{name:'Inspect Jamie Parker Business Problem Solving',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Preview standard',exact:true})).toHaveAttribute('data-value',gap.criterionId);
  await expect(page.locator('.cx-preview')).toContainText(d.assessment.application_review.items.find((i:any)=>i.criterionId===gap.criterionId).nextStep);
  await page.getByRole('button',{name:'View full evidence',exact:true}).click();
  await expect(page.getByRole('button',{name:new RegExp('^'+gap.criterionId+' ·')})).toHaveAttribute('aria-expanded','true');
  await nav(page,'Tasks & review');await page.getByText('Review suggested evidence gaps',{exact:true}).click();await page.locator('.r6-gaps details').first().locator('summary').click();
  await page.getByRole('button',{name:`Prepare optional ${gap.criterionId} task`,exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Target skill',exact:true})).toHaveAttribute('data-value',gap.targetRequirementId);
  await expect(page.getByLabel('Evidence gap / task reason',{exact:true})).toHaveValue(`${gap.summary} ${gap.nextStep}`);
  expect((await read(request,id)).task.status).toBe('draft');
  await page.getByRole('button',{name:'Preview work brief',exact:true}).click();await page.getByRole('button',{name:'Continue to confirmation',exact:true}).click();
  expect((await read(request,id)).task.status).toBe('draft');await page.getByRole('button',{name:'Send task',exact:true}).click();
  await expect.poll(async()=>(await read(request,id)).task.targetRequirementId).toBe(gap.targetRequirementId);
});

test('T33 legacy identity and content-version drafts cannot silently become new work',async({page,request})=>{
  await page.addInitScript(()=>localStorage.setItem('evidencebridge.api3.draft.old.alex-chen.task.v1',JSON.stringify({summary:'LEGACY PUBLIC TEXT',notes:'LEGACY PRIVATE NOTES',findings:[]})));
  await page.goto(`${candidateUrl}/?candidateId=alex-chen#application`);
  await expect(page.getByRole('heading',{name:'Choose a candidate',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Amy Chen',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('evidencebridge.api3.draft.old.alex-chen.task.v1'))).toBeNull();
  await expect(page.locator('.r6-archived')).toHaveCount(0);
  await page.getByRole('button',{name:'Amy Chen',exact:true}).click();await expect(page.locator('.ia-person-bar')).toContainText('Amy Chen');
  await expect(page.locator('body')).not.toContainText('LEGACY PUBLIC TEXT');
  await seedTask(request);await refresh(page);await nav(page,'My task');await page.getByRole('button',{name:'Start V1 draft',exact:true}).click();await page.getByLabel('Executive summary').fill('OLD CONTENT DRAFT');
  await page.route('**/api/demo?candidateId=amy-chen',async route=>{const response=await route.fetch();const json=await response.json();json.data.fixtureVersion='test-new-content-version';await route.fulfill({response,json});});
  await page.route('**/api/demo/comparison',async route=>{const response=await route.fetch();const json=await response.json();json.data.fixtureVersion='test-new-content-version';await route.fulfill({response,json});});
  await refresh(page);await expect(page.getByRole('button',{name:'Start V1 draft',exact:true})).toBeVisible();await page.getByRole('button',{name:'Start V1 draft',exact:true}).click();await expect(page.getByLabel('Executive summary')).toHaveValue('');
  expect(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('OLD CONTENT DRAFT')))).toBe(true);expect((await read(request)).submission).toBeNull();
});

test('T34 original PDF links and downloaded bytes match supplied materials',async({page,request})=>{
  const {createHash}=await import('node:crypto');
  for(const id of people) {
    const d=await read(request,id);await open(page,'candidate',id,'application');await page.getByRole('button',{name:/Personal CV Original fictional CV/}).click();await page.getByRole('button',{name:'Read original',exact:true}).click();
    const source=d.application.sources.find((s:any)=>s.provenance?.downloadUrl),link=page.getByRole('link',{name:'Download original CV PDF',exact:true});
    await expect(link).toHaveAttribute('href',backend+source.provenance.downloadUrl);
    const pdf=await request.get((await link.getAttribute('href'))!);expect(pdf.ok()).toBe(true);expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect(createHash('sha256').update(await pdf.body()).digest('hex')).toBe(source.provenance.redaction.originalSha256);
    await page.keyboard.press('Escape');await page.getByRole('button',{name:/Job description 19 requirements/}).click();
    const jd=page.getByRole('link',{name:'Download original JD PDF',exact:true});await expect(jd).toHaveAttribute('href',backend+d.job.jd.source.downloadUrl);
    const response=await request.get((await jd.getAttribute('href'))!);expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(d.job.jd.sha256);
  }
});

test('T35 incompatible API3 response is visible and never falls back to a preview',async({page})=>{
  await page.route('**/api/demo/comparison',async route=>{const response=await route.fetch();const json=await response.json();json.data.schemaVersion='3.0';await route.fulfill({response,json});});
  await page.goto(hrUrl);await expect(page.getByRole('alert').filter({hasText:'This mode needs EvidenceBridge API4'}).first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Compare candidates',exact:true})).toHaveCount(0);
});

test('T36 no-ID bootstrap uses the service list rather than a hardcoded default person',async({page})=>{
  await page.route('**/api/demo/comparison',async route=>{const response=await route.fetch();const json=await response.json();json.data.candidates.reverse();await route.fulfill({response,json});});
  await page.goto(candidateUrl);await expect(page.locator('.ia-person-bar > div > strong').getByText('Jamie Parker',{exact:true})).toBeVisible();await expect(page).toHaveURL(/candidateId=jamie-parker/);
});


for (const role of ['hr','candidate'] as const) test(`T37 ${role} retired and unknown links open current selection without stale requests or login UI`,async({page,request})=>{
  const before=await read(request), requests:string[]=[], writes:string[]=[];
  page.on('request',r=>{requests.push(r.url());if(r.method()==='POST')writes.push(r.url());});
  for (const id of ['alex-chen','maya-patel','leo-zhang','sam-taylor','unknown-person']) {
    await page.goto(`${role==='hr'?hrUrl:candidateUrl}/?candidateId=${id}&demo=preserved#${role==='hr'?'comparison':'application'}`);
    const picker=page.getByRole('region',{name:'Current demo candidates',exact:true});
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('button')).toHaveCount(4);
    await expect(page).not.toHaveURL(/candidateId=/);await expect(page).toHaveURL(/demo=preserved/);
    await expect(page.locator('body')).not.toContainText('Legacy applicant');
    await expect(page.locator('body')).not.toContainText('The shared case is unavailable');
    await expect(page.getByRole('link',{name:'Enable editing',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Check editing access',exact:true})).toHaveCount(0);
  }
  await page.getByRole('button',{name:'Ann Li',exact:true}).click();
  await expect(page).toHaveURL(/candidateId=ann-li/);
  await expect(page.getByTestId('connection-state')).toHaveAttribute('data-fresh','true');
  if(role==='candidate')await expect(page.locator('.ia-person-bar > div > strong').getByText('Ann Li',{exact:true})).toBeVisible();
  else await expect(page.locator('tr[data-candidate="ann-li"]')).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  expect(requests.filter(url=>url.includes('/write-access'))).toEqual([]);
  expect(requests.filter(url=>/\/api\/demo\?candidateId=(alex-chen|maya-patel|leo-zhang|sam-taylor|unknown-person)/.test(url))).toEqual([]);
  expect(writes).toEqual([]);expect(await read(request)).toEqual(before);
});

// Final frontend repair regressions: these use only the isolated API4 test service.
test('T38 dialog interior padding preserves input, while the actual backdrop still closes',async({page,request},info)=>{
  const before=await read(request),writes:string[]=[];
  page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});
  await open(page,'hr','amy-chen','evidence');
  await page.getByRole('button',{name:'Edit human assessment',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await page.getByLabel('Judgment reason',{exact:true}).fill('KEEP THIS UNSAVED HUMAN JUDGMENT');
  const box=(await dialog.boundingBox())!;
  const padding={x:box.x+6,y:box.y+box.height/2};
  expect(await dialog.evaluate((node,point)=>document.elementFromPoint(point.x,point.y)===node,padding)).toBe(true);
  await page.mouse.click(padding.x,padding.y);
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Judgment reason',{exact:true})).toHaveValue('KEEP THIS UNSAVED HUMAN JUDGMENT');
  await page.screenshot({path:info.outputPath('dialog-interior-padding-keeps-human-input.png')});
  await page.mouse.click(box.x-8,padding.y);
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([]);expect((await read(request)).assessment).toEqual(before.assessment);

  await seedTask(request);await start(page);
  await page.getByLabel('Executive summary',{exact:true}).fill('Keep the public draft while checking the confirmation dialog.');
  await page.getByRole('button',{name:'Submit V1',exact:true}).click();
  const submissionBox=(await dialog.boundingBox())!;
  const submissionPadding={x:submissionBox.x+6,y:submissionBox.y+submissionBox.height/2};
  expect(await dialog.evaluate((node,point)=>document.elementFromPoint(point.x,point.y)===node,submissionPadding)).toBe(true);
  await page.mouse.click(submissionPadding.x,submissionPadding.y);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Confirm V1 submission',exact:true})).toBeEnabled();
  await page.mouse.click(submissionBox.x-8,submissionPadding.y);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Executive summary',{exact:true})).toHaveValue('Keep the public draft while checking the confirmation dialog.');
  expect(writes).toEqual([]);expect((await read(request)).submission).toBeNull();
});

test('T39 direct Investigation entry offers V2 copy and preserves only V1 public work',async({page,request},info)=>{
  await seedTask(request);await start(page);
  const title='A public V1 finding to refine',detail='Paid Search is a signal to compare; this is not a proven cause.';
  const summary='Public V1 summary retained when the candidate opens Investigation directly.';
  const privateNote='PRIVATE-V1-DIRECT-WORKSPACE-MUST-NOT-COPY';
  await page.getByRole('button',{name:'Add Key Findings',exact:true}).click();
  await page.getByLabel('Observation or idea',{exact:true}).fill(title);
  await page.getByLabel('Reasoning & supporting evidence',{exact:true}).fill(detail);
  await glide(page,'Evidence source','website_traffic.csv');
  await page.getByRole('button',{name:'Save card',exact:true}).click();
  await page.getByRole('tab',{name:'Private notebook',exact:true}).click();
  await page.getByLabel('Private notes',{exact:true}).fill(privateNote);
  await submit(page,request,'amy-chen',1,summary);
  const first=await read(request);
  await post(request,'/review',{...binding(first),submissionId:first.submission.submissionId,contentFingerprint:first.submission.contentFingerprint,decision:'needs_more_evidence',comment:'Compare the same periods and explain which result would distinguish the hypotheses.'});
  const frozen=(await read(request)).versions[0],writes:string[]=[];
  page.on('request',r=>{if(r.method()==='POST')writes.push(r.postData()??'');});

  // Another client saved the review. Receive it with the documented manual refresh;
  // changing only the URL hash below is same-document navigation, not a new GET.
  await refresh(page);
  // Navigate directly rather than through My task: both entry routes must expose the copy action.
  await open(page,'candidate','amy-chen','workspace');
  await expect(page.getByRole('button',{name:'Start V2 draft',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Copy V1 public work into V2',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Copy V1 public work into V2',exact:true}).click();
  await expect(page.getByLabel('Executive summary',{exact:true})).toHaveValue(summary);
  await page.getByRole('tab',{name:/^Key Findings/}).click();
  await expect(page.locator('.eb-board .eb-finding')).toHaveCount(first.submission.findings.length);
  await expect(page.getByLabel('Card title')).toHaveValue(title);
  await expect(page.getByLabel('Card reasoning')).toHaveValue(detail);
  await page.getByRole('tab',{name:'Private notebook',exact:true}).click();
  await expect(page.getByLabel('Private notes',{exact:true})).toHaveValue('');
  const drafts=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('evidencebridge.api4.draft.')).map(([key,value])=>({key,value:JSON.parse(value)})));
  expect(drafts.find(d=>d.key.endsWith('.v1'))?.value.notes).toBe(privateNote);
  const copied=drafts.find(d=>d.key.endsWith('.v2'))?.value;
  expect(copied.summary).toBe(summary);expect(copied.findings).toEqual(first.submission.findings);expect(copied.notes).toBe('');
  expect(writes).toEqual([]);expect((await read(request)).versions).toEqual([frozen]);
  await page.screenshot({path:info.outputPath('direct-investigation-v2-public-copy.png'),fullPage:true});
  await page.reload();await expect(page.getByLabel('Executive summary',{exact:true})).toHaveValue(summary);
  await submit(page,request,'amy-chen',2,summary+' V2 adds a bounded follow-up.');
  const final=await read(request);
  expect(final.versions[0]).toEqual(frozen);expect(final.versions[1].submission.findings).toEqual(first.submission.findings);
  expect(JSON.stringify(final)).not.toContain(privateNote);expect(writes.join('')).not.toContain(privateNote);
});

for(const width of [1280,1440]) test(`T40 desktop ${width}px keeps criterion navigation accessible, evidence visible and desktop decisions in view`,async({page,request},info)=>{
  await page.setViewportSize({width,height:1000});
  await open(page,'hr','amy-chen','evidence');
  await expect(page.locator('.api4-app')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Collapse sidebar',exact:true})).toBeVisible();
  const standards=page.locator('.r5-evidence-rail .r5-criterion-toggle');
  await expect(standards).toHaveCount(10);
  const measures=await standards.evaluateAll(nodes=>nodes.map(node=>({
    width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,
    label:node.getAttribute('aria-label'),title:node.getAttribute('title'),
    mark:node.querySelector('.r5-mark')?.textContent,
    clientWidth:node.clientWidth,scrollWidth:node.scrollWidth
  })));
  for(const item of measures) {
    expect(item.width).toBeGreaterThanOrEqual(44);
    expect(item.height).toBeGreaterThanOrEqual(44);
    expect(item.label).toMatch(/^[SDB]\d · .+/);
    expect(item.title).toBe(item.label);
    expect(item.mark).toMatch(/^(?:[0-4]\/4|NE|Not assessed)$/);
    expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth+1);
  }
  await expect(page.locator('.r5-judgment-heading h2')).toBeVisible();
  await expect(page.locator('.pf-role-standard')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1 && document.body.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath(`criteria-readable-${width}.png`),fullPage:true});

  await nav(page,'Compare candidates');
  const tableScroll=page.locator('.cx-list .eb-table-scroll');
  const tableMetrics=await tableScroll.evaluate(node=>({clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,overflowX:getComputedStyle(node).overflowX}));
  expect(['auto','scroll']).toContain(tableMetrics.overflowX);
  expect(tableMetrics.scrollWidth).toBeLessThanOrEqual(tableMetrics.clientWidth+1);
  await expect(page.locator(".cx-table .cx-person")).toHaveCount(4);
  await expect(page.locator(".cx-table .cx-skill")).toHaveCount(12);
  await expect(page.getByRole("button",{name:"View full evidence",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1 && document.body.scrollWidth<=window.innerWidth+1 && window.scrollX===0)).toBe(true);
  await page.screenshot({path:info.outputPath(`comparison-contained-scroll-${width}.png`),fullPage:true});

  await seedTask(request);await start(page);
  const contentWidth=await page.locator('.api4-app .eb-content').evaluate(node=>node.clientWidth-parseFloat(getComputedStyle(node).paddingLeft)-parseFloat(getComputedStyle(node).paddingRight));
  expect(contentWidth).toBeLessThan(1200);
  const workbench=page.locator('.cp-editor-grid'),panels=workbench.locator(':scope > aside, :scope > div');
  await expect(panels).toHaveCount(2);
  const layout=await panels.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};}));
  expect((await workbench.evaluate(node=>getComputedStyle(node).gridTemplateColumns)).split(' ').filter(Boolean)).toHaveLength(2);
  expect(Math.abs(layout[0].y-layout[1].y)).toBeLessThan(2);
  expect(layout[0].right).toBeLessThanOrEqual(layout[1].x);
  expect(layout[1].width).toBeGreaterThan(layout[0].width);
  await expect(page.getByRole('tablist',{name:'Investigation sections'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Submit V1',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1 && document.body.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath(`workbench-two-columns-${width}.png`),fullPage:true});
});

// Page ownership regressions: compact shell and explicit handoff, without changing business rules.
test('T41 compact shell dismisses shared notice and details separate assessment from materials',async({page,request})=>{
  const before=await read(request);await open(page,'hr','amy-chen','evidence');
  await expect(page.locator('.eb-api-status')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Refresh data',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Got it',exact:true}).click();
  await page.getByRole('button',{name:'Materials & JD',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Application source library',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit human assessment',exact:true})).not.toBeVisible();
  await page.getByRole('button',{name:'Submission history',exact:true}).click();
  await expect(page.getByRole('heading',{name:'No formal work snapshot yet',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Application source library',exact:true})).toHaveCount(0);
  await nav(page,'Compare candidates');await page.reload();
  await expect(page.locator('.ia-first-notice')).toHaveCount(0);
  await page.getByRole('button',{name:'Workspace info',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('About this demonstration');
  await page.keyboard.press('Escape');expect(await read(request)).toEqual(before);
});

test('T42 task assessment handoff selects exact version even after an application criterion deep link',async({page,request})=>{
  await seedTask(request);const one=await seedSubmission(request,'amy-chen','A first bounded task submission.');
  await post(request,'/review',{...binding(one),submissionId:one.submission.submissionId,contentFingerprint:one.submission.contentFingerprint,decision:'needs_more_evidence',comment:'Explain the comparison method.'});
  await seedSubmission(request,'amy-chen','The revised task explains matched cohorts.');
  await open(page,'hr');await page.getByRole('button',{name:'Open Amy Chen',exact:true}).click();
  await nav(page,'Tasks & review');
  await expect(page.getByRole('region',{name:'Task review queue',exact:true}).locator('[data-candidate-id]')).toHaveCount(4);
  await expect(page.getByRole('button',{name:'Edit human assessment',exact:true})).not.toBeVisible();
  await page.getByRole('button',{name:'Open V2 assessment',exact:true}).click();
  await expect(page).toHaveURL(/#evidence$/);
  await expect(page.getByRole('combobox',{name:'Assessment stage',exact:true})).toHaveAttribute('data-value','task_v2');
  await nav(page,'Tasks & review');await glide(page,'Submission version','1');
  await page.getByRole('button',{name:'Open V1 assessment',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Assessment stage',exact:true})).toHaveAttribute('data-value','task_v1');
  await expect(page.getByRole('button',{name:'Edit human assessment',exact:true})).toBeDisabled();
});


test('T43 comparison filter is read-only and visible evidence opens the matching criterion',async({page,request})=>{
  const before=await read(request);await open(page,'hr');
  await page.getByRole('button',{name:'Filter',exact:true}).click();
  await glide(page,'Candidate list filter','retained');
  await expect(page.locator('.cx-table tbody tr')).toHaveCount(0);
  await glide(page,'Candidate list filter','all');
  await expect(page.locator('.cx-table tbody tr')).toHaveCount(4);
  await page.getByRole('button',{name:'Inspect Amy Chen SQL',exact:true}).click();
  await page.getByRole('button',{name:'View full evidence',exact:true}).click();
  await expect(page.locator('.r5-inline-source mark')).toBeVisible();
  await expect(page.locator('.pf-role-standard')).toBeVisible();
  expect(await read(request)).toEqual(before);
});


test('T44 an unassessed task keeps compact marks distinct from NE without overflowing',async({page,request})=>{
  await seedTask(request);await seedSubmission(request);
  await page.setViewportSize({width:1280,height:1000});
  await open(page,'hr','amy-chen','evidence');await chooseStage(page,'task_v1');
  const marks=page.locator('.r5-evidence-options .r5-mark');
  for(const mark of await marks.all()) {await expect(mark).toHaveText('—');await expect(mark).toHaveAttribute('aria-label','Not assessed');}
  const chips=await page.locator('.r5-criterion-toggle').evaluateAll(nodes=>nodes.map(n=>({width:n.clientWidth,scroll:n.scrollWidth})));
  for(const chip of chips)expect(chip.scroll).toBeLessThanOrEqual(chip.width+1);
  await expect(page.locator('.pf-current-mark')).toHaveText('Not assessed');
  expect((await read(request)).assessment.task_v1).toBeNull();
});


test('T45 narrow desktop evidence keeps judgments inside their scrollable panel',async({page})=>{
  await page.setViewportSize({width:1024,height:900});await open(page,'hr','amy-chen','evidence');
  const source=await page.locator('.pf-review-grid > .r5-original-pane').boundingBox();
  const judgment=await page.locator('.pf-review-grid > section').boundingBox();
  expect(Math.abs(source!.y-judgment!.y)).toBeLessThan(2);
  expect(source!.x+source!.width).toBeLessThanOrEqual(judgment!.x);
  await expect(page.getByRole('region',{name:'Scrollable evidence judgment',exact:true})).toHaveCSS('overflow-y','auto');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
});


test('T46 scalable comparison searches, paginates and previews without fetching or writing candidate state',async({page,request})=>{
  const before=await read(request);await open(page,'hr');
  const calls:string[]=[];page.on('request',r=>{if(r.url().includes('/api/demo'))calls.push(`${r.method()} ${r.url()}`);});
  await page.getByRole('button',{name:'Preview Ann Li',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'Selected candidate evidence',exact:true})).toHaveAttribute('data-candidate','ann-li');
  await page.getByRole('searchbox',{name:'Search candidates',exact:true}).fill('no such candidate');
  await expect(page.getByRole('heading',{name:'No matching candidates',exact:true})).toBeVisible();
  await expect(page.locator('.cx-preview .cx-quote')).toHaveCount(0);
  await page.getByRole('button',{name:'Show all candidates',exact:true}).click();
  await glide(page,'Candidates per page','3');await expect(page.locator('.cx-table tbody tr')).toHaveCount(3);
  await page.getByRole('button',{name:'Next candidates',exact:true}).click();await expect(page.locator('.cx-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.cx-preview')).toHaveAttribute('data-candidate','jamie-parker');
  await expect(page.getByRole('button',{name:'Next candidates',exact:true})).toBeDisabled();
  await page.getByRole('searchbox',{name:'Search candidates',exact:true}).fill('david');
  await expect(page.locator('.cx-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.cx-preview')).toHaveAttribute('data-candidate','david-liu');
  await expect(page.getByRole('combobox',{name:'Preview standard',exact:true})).toContainText('NE');
  await expect(page.getByRole('combobox',{name:'Preview standard',exact:true})).not.toContainText('NE/4');
  expect(calls).toEqual([]);expect(await read(request)).toEqual(before);
  await page.getByRole('button',{name:'Human retain decision',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retained 0',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'All 4',exact:true}).click();
  await expect(page.locator('.rd-dossier h2')).toHaveText('David Liu');
  await expect(page.locator('.rd-person[aria-current=true]')).toContainText('David Liu');
  expect((await read(request,'david-liu')).shortlist.status).toBe('not_retained');
});


test('T47 both workspaces share compact typography and company matrix uses authoritative rubric',async({page,request})=>{
  const d=await read(request);
  for(const [role,routes] of [['hr',['company','comparison','evidence','tasks','shortlist']],['candidate',['application','tasks','workspace','history']]] as const){
    for(const route of routes){
      await open(page,role,'amy-chen',route);
      const heading=page.locator('main h1:visible');await expect(heading).toHaveCount(1);
      const metrics=await heading.evaluate(n=>({font:getComputedStyle(n).fontSize,line:getComputedStyle(n).lineHeight}));
      const titleSize=role==='hr'&&route==='shortlist'?26:24;
      expect(metrics.font,`${role}/${route}`).toBe(`${titleSize}px`);expect(parseFloat(metrics.line)).toBeCloseTo(titleSize*1.3,1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  }
  await open(page,'hr','amy-chen','company');
  await expect(page.locator('.uw-standard-links button')).toHaveCount(10);
  for(const mark of d.rubric.marks) await expect(page.locator('.uw-mark-key')).toContainText(mark.meaning);
  await page.getByRole('button',{name:'Review full JD · 19 requirements',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText(d.job.title);
  expect((await read(request)).revision).toBe(d.revision);
});


test('T48 a final V1 review skips optional V2 rather than implying a second submission',async({page,request},info)=>{
  await seedTask(request);await seedSubmission(request);await open(page,'hr','amy-chen','tasks');
  await expect(page.locator('.uw-task-progress [aria-current=step]')).toContainText('V1 review');
  await page.screenshot({path:info.outputPath('task-v1-pending.png'),fullPage:true});
  await review(page,'Confirm evidence','The supplied evidence is sufficient for this bounded task.');
  await expect(page.locator('.uw-task-progress [aria-current=step]')).toContainText('Review complete');
  await expect(page.locator('.uw-task-progress [data-skipped=true]')).toHaveText('4V2 not requested');
  await expect(page.locator('.uw-task-progress [data-skipped=true]')).toHaveAttribute('data-past','false');
  expect((await read(request)).versions).toHaveLength(1);
});

test('T49 inline retained reason saves a reconfirmation and stale writes keep the draft',async({page,request})=>{
  await open(page,'hr','amy-chen','shortlist');
  await page.getByRole('button',{name:'All 4',exact:true}).click();
  await page.getByLabel('Human shortlist reason',{exact:true}).fill('Original retained reason.');
  await page.getByLabel('Shortlist operator label',{exact:true}).fill('QA human');
  await page.getByRole('button',{name:'Retain candidate',exact:true}).click();
  await page.getByRole('button',{name:'Edit decision',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save retain reason',exact:true})).toBeVisible();
  await page.getByLabel('Human shortlist reason',{exact:true}).fill('Edited reason, same evidence basis.');
  await page.getByRole('button',{name:'Save retain reason',exact:true}).click();
  await expect.poll(async()=>(await read(request)).shortlist.revision).toBe(2);
  await expect(page.locator('.rd-saved-reason')).toContainText('Edited reason, same evidence basis.');
  const before=await read(request);
  expect(before.shortlist.history.map((h:any)=>h.action)).toEqual(['retain','reconfirm']);
  expect(before.shortlist.basis).toEqual(before.shortlist.history[0].basis);
  expect(before.review).toBeNull();
  await page.getByRole('button',{name:'Edit decision',exact:true}).click();
  await page.getByLabel('Human shortlist reason',{exact:true}).fill('KEEP UNSAVED REASON');
  await post(request,'/shortlist',{...base(before),action:'reconfirm',reason:'Another reviewer reason.',...before.shortlist.basis,expectedShortlistRevision:2,operatorLabel:'Other QA'});
  const response=page.waitForResponse(r=>r.url().endsWith('/api/demo/shortlist')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save retain reason',exact:true}).click();
  expect((await response).status()).toBe(409);
  await expect(page.getByLabel('Human shortlist reason',{exact:true})).toHaveValue('KEEP UNSAVED REASON');
  expect((await read(request)).shortlist.reason).toBe('Another reviewer reason.');
  await page.getByRole('button',{name:'View all evidence',exact:true}).click();await page.getByRole('button',{name:'Discard edits and continue',exact:true}).click();await expect(page).toHaveURL(/#evidence$/);
  await expect(page.locator('.pf-dossier h1')).toHaveText('Amy Chen');
});

test('T50 approved three-column review and retained editor preserve desktop hierarchy',async({page,request},info)=>{
  await page.setViewportSize({width:1568,height:1013});await seedTask(request);await seedSubmission(request);
  await open(page,'hr','amy-chen','tasks');
  const notice=page.getByRole('button',{name:'Got it',exact:true});if(await notice.isVisible())await notice.click();
  const queue=await page.locator('.ia-task-queue').boundingBox(),work=await page.locator('.mf-task-main').boundingBox(),reviewPanel=await page.locator('.mf-review-panel').boundingBox();
  expect(queue!.x+queue!.width).toBeLessThan(work!.x);expect(work!.x+work!.width).toBeLessThan(reviewPanel!.x);
  expect(Math.abs(queue!.y-work!.y)).toBeLessThan(2);expect(Math.abs(work!.y-reviewPanel!.y)).toBeLessThan(2);
  await page.getByRole('button',{name:'Needs More Evidence',exact:true}).click();
  await expect(page.getByLabel('Public review comment')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Investigation cards',exact:true}).click();await expect(page.getByText('No investigation cards were supplied.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'View complete work',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Synthetic current work');await page.keyboard.press('Escape');
  await nav(page,'Retention & review');
  await page.getByRole('button',{name:'All 4',exact:true}).click();
  const editor=await page.locator('.mf-retention-editor').boundingBox(),heading=await page.locator('main h1').boundingBox();
  expect(editor!.y).toBeGreaterThan(heading!.y);
  const roster=await page.locator('.rd-roster').boundingBox();expect(roster!.x+roster!.width).toBeLessThan(editor!.x);
  await expect(page.getByLabel('Human shortlist reason')).toBeVisible();await expect(page.getByRole('button',{name:'Retain candidate',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1568);
  await page.screenshot({path:info.outputPath('retained-inline-editor.png'),fullPage:true});
});


test('T51 task preparation and waiting keep the review-page three-column skeleton',async({page,request})=>{
  await page.setViewportSize({width:1568,height:1003});await open(page,'hr','amy-chen','tasks');
  const panels=page.locator('.ia-task-queue,.mf-task-main,.mf-review-panel');await expect(panels).toHaveCount(3);
  const bounds=await panels.evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,height:r.height}}));
  expect(Math.max(...bounds.map(r=>r.y))-Math.min(...bounds.map(r=>r.y))).toBeLessThan(2);
  await expect(page.getByRole('heading',{name:'Task preview',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Preview work brief',exact:true})).toBeDisabled();
  expect((await read(request)).task.status).toBe('draft');
  await seedTask(request);await refresh(page);
  await expect(page.locator('.mf-task-main')).toContainText('Waiting for Amy Chen');
  await page.getByRole('button',{name:'Sent task brief',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Sent task brief');
});

test('T52 source reading has a compact toolbar without duplicate provenance cards',async({page})=>{
  await page.setViewportSize({width:1568,height:1003});await open(page,'hr','amy-chen','evidence');
  await expect(page.locator('.mf-source-toolbar .eb-glide')).toBeVisible();
  await expect(page.locator('.pf-source-origin')).toHaveCount(0);
  const toolbar=await page.locator('.mf-source-toolbar').boundingBox();expect(toolbar!.height).toBeLessThan(100);
  await expect(page.locator('.mf-source-file')).toBeVisible();await expect(page.locator('.r5-inline-source mark')).toBeVisible();
  await page.getByRole('button',{name:'Materials & JD',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Application source library',exact:true})).toBeVisible();
});


test('T55 inline basis selection preserves draft, history access, and both themes',async({page,request},info)=>{
  await seedTask(request);await seedSubmission(request);
  await open(page,'hr','amy-chen','shortlist');
  await page.getByRole('button',{name:'All 4',exact:true}).click();
  const basis=page.locator('.mf-decision-basis'),row=basis.locator('.mf-basis-current');
  await expect(basis.getByRole('heading',{name:'Decision basis'})).toHaveCSS('font-size','16px');
  await expect(row).toHaveCSS('font-size','13px');
  await expect(row.locator('.mf-icon')).toHaveCSS('width','20px');
  await expect(row.locator('.mf-icon')).toHaveAttribute('aria-hidden','true');
  expect(await row.locator('.mf-icon').evaluate(el=>getComputedStyle(el).maskImage)).not.toBe('none');
  await expect(row).toContainText('Task V1');await expect(row).toContainText('Not assessed');
  await expect(basis.locator('details,select')).toHaveCount(0);
  await page.getByLabel('Human shortlist reason',{exact:true}).fill('Keep this unsaved reason while inspecting the basis.');
  await page.getByRole('button',{name:'Change decision basis',exact:true}).press('Enter');
  await expect(page.getByRole('button',{name:'Finish choosing decision basis',exact:true})).toHaveAttribute('aria-expanded','true');
  await expect(row).toHaveCount(0);
  await expect(basis.getByRole('radio')).toHaveCount(2);
  await basis.getByRole('radio',{name:'Application materials',exact:true}).check();
  await expect(basis.locator('.mf-basis-choice[data-selected=true]')).toContainText('Assessment version 1');
  await expect(basis.getByText('Selection only updates the draft.')).toBeVisible();
  await page.getByRole('button',{name:'Finish choosing decision basis',exact:true}).press('Enter');
  await expect(row).toContainText('Application materials');await expect(row).toContainText('Assessment version 1');
  await page.getByRole('button',{name:'Decision records (0)',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Decision records'})).toContainText('No decisions recorded yet.');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Human shortlist reason',{exact:true})).toHaveValue('Keep this unsaved reason while inspecting the basis.');
  expect((await read(request)).shortlist.status).toBe('not_retained');
  await page.screenshot({path:info.outputPath('decision-basis-dark.png'),fullPage:true});
  await page.getByRole('switch',{name:'Night mode'}).click();await expect(row).toBeVisible();
  await page.screenshot({path:info.outputPath('decision-basis-light.png'),fullPage:true});
});


test('T56 retained-first filters preserve in-page selection, empty states and owned sources',async({page})=>{
  await open(page,'hr','ann-li','shortlist');
  const filters=page.getByRole('navigation',{name:'Shortlist filters'});
  await expect(filters.getByRole('button')).toHaveText(['Retained0','Reconfirmation needed0','All4']);
  await expect(filters.getByRole('button',{name:'Retained 0',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('heading',{name:'No retained candidates yet'})).toBeVisible();
  await filters.getByRole('button',{name:'All 4',exact:true}).click();
  await expect(page.locator('.rd-person')).toHaveCount(4);
  await page.getByRole('button',{name:'AC Amy Chen Not retained',exact:true}).click();
  await expect(page.locator('.rd-dossier h2')).toHaveText('Amy Chen');
  await expect(filters.getByRole('button',{name:'All 4',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page).toHaveURL(/candidateId=amy-chen#shortlist$/);
  await page.getByRole('button',{name:'channel_analysis.sql · View original',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('channel_period_metrics');
  await expect(page.getByRole('dialog').locator('mark')).toContainText('period_start');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'channel_analysis.sql · View original',exact:true})).toBeFocused();
  await filters.getByRole('button',{name:'Reconfirmation needed 0',exact:true}).click();
  await expect(page.getByRole('heading',{name:'No candidates need reconfirmation'})).toBeVisible();
});

// Delayed reads must not remove the visible workspace; the controller still owns identity authorization.
for (const section of ['tasks','evidence']) test(`T57 ${section} retains readonly content and interactive identity navigation during a delayed read`,async({page})=>{
  await open(page,'hr','amy-chen',section);
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  await page.route(`${backend}/api/demo?candidateId=ann-li`,async route=>{await gate;await route.continue();});
  try {
    if(section==='tasks')await page.locator('.ia-queue-items [data-candidate-id="ann-li"]').click();
    else await glide(page,'Current candidate','ann-li');
    await expect(page.locator('.ws-switch-notice')).toContainText('Still showing Amy Chen');
    const region=page.locator(section==='tasks'?'.uw-task-detail .ws-identity-region':'.pf-dossier .ws-identity-region');
    await expect(region).toHaveAttribute('inert','');
    if(section==='tasks'){
      await expect(page.locator('.ia-queue-items [data-candidate-id="ann-li"]')).toHaveAttribute('aria-current','true');
      await expect(page.locator('.uw-task-detail')).toContainText('Amy Chen');
      await expect(page.locator('.ia-queue-items [data-candidate-id="david-liu"]')).toBeEnabled();
    } else {
      await expect(page.locator('.pf-dossier h1')).toHaveText('Amy Chen');
      await expect(page.getByRole('combobox',{name:'Current candidate',exact:true})).toBeEnabled();
    }
  } finally {release();}
  await expect(page.locator('.ws-switch-notice')).toHaveCount(0);
  await expect(page.locator(section==='tasks'?'.uw-task-detail':'.pf-dossier h1')).toContainText('Ann Li');
});

test('T58 candidate draft stays bound to its owner across a delayed identity change',async({page,request})=>{
  await seedTask(request,'amy-chen');await seedTask(request,'ann-li');
  await start(page,'amy-chen');
  const summary='Amy-only local draft: identity switching regression';
  await page.getByLabel('Executive summary',{exact:true}).fill(summary);
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  await page.route(`${backend}/api/demo?candidateId=ann-li`,async route=>{await gate;await route.continue();});
  try {
    await glide(page,'Current candidate','ann-li');
    await expect(page.locator('.ws-switch-notice')).toContainText('Still showing Amy Chen');
    await expect(page.locator('.ws-identity-region')).toHaveAttribute('inert','');
    await expect(page.getByLabel('Executive summary',{exact:true})).toHaveValue(summary);
  } finally {release();}
  await expect(page.locator('.ws-switch-notice')).toHaveCount(0);
  await expect(page.getByLabel('Executive summary',{exact:true})).toHaveCount(0);
  await glide(page,'Current candidate','amy-chen');
  await expect(page.getByLabel('Executive summary',{exact:true})).toHaveValue(summary);
  expect((await read(request,'amy-chen')).currentSubmissionVersion).toBeNull();
  expect((await read(request,'ann-li')).currentSubmissionVersion).toBeNull();
});

test('T60 approved candidate layouts preserve actual sources, wide editing, four feedback categories and themes',async({page,request},info)=>{
  await page.setViewportSize({width:1506,height:1045});
  await open(page,'candidate','amy-chen','application');
  const notice=page.getByRole('button',{name:'Got it',exact:true});if(await notice.isVisible())await notice.click();
  await expect(page.locator('.cp-library-item')).toHaveCount(3);
  await expect(page.locator('.cp-materials')).toContainText('4,000');
  await expect(page.locator('.cp-materials')).not.toContainText('1,180,000');
  await expect(page.locator('.cp-role-band')).toContainText('19 requirements');
  await expect(page.locator('.cp-role-band')).toContainText('10 core standards');
  await page.screenshot({path:info.outputPath('candidate-materials.png'),fullPage:false});
  await page.getByRole('button',{name:/Channel analysis SQL Query code/}).click();await expect(page.locator('.cp-source-code')).toContainText('SELECT');
  await page.getByRole('button',{name:/Channel conversion report Project report/}).click();
  const d=await seedTask(request);await refresh(page);await nav(page,'My task');
  await expect(page.locator('.cp-task-grid')).toBeVisible();await expect(page.locator('.cp-resource-list>button')).toHaveCount(3);
  await page.screenshot({path:info.outputPath('candidate-task.png'),fullPage:false});
  const cards=[['Key Findings','More visits, fewer orders','Sessions increased, orders fell. This is an observation, not a diagnosis.','website_traffic.csv'],['Hypotheses','Channel mix or page changes','Both are plausible explanations, not established causes.','business_context.md'],['Additional Evidence Needed','Matched-period grouped data','Request campaign, device and landing-page counts for both periods.','current_paid_search_devices.csv'],['Recommended Next Steps','Collect evidence before changing spend','Review consistent definitions and missing data before increasing budget.','business_context.md']].map(([section,title,detail,source])=>({id:crypto.randomUUID(),section,title,detail,source,confidence:'Medium'}));
  await post(request,'/submission',{...binding(d),submissionVersion:1,previousSubmissionId:null,previousContentFingerprint:null,summary:'Request matched-period evidence before deciding on a budget increase.',findings:cards,processEvidence:[]});
  const v1=await read(request);await post(request,'/review',{...binding(v1),submissionId:v1.submission.submissionId,contentFingerprint:v1.submission.contentFingerprint,decision:'needs_more_evidence',comment:'Specify comparable periods and groups, and what different outcomes support or weaken.'});
  const frozenVersion=(await read(request)).versions[0];
  await refresh(page);await nav(page,'Work & feedback');
  await expect(page.locator('.cp-work-card')).toHaveCount(4);await expect(page.locator('.cp-review-body')).toContainText('Specify comparable periods');
  await page.screenshot({path:info.outputPath('candidate-history.png'),fullPage:false});
  await nav(page,'My task');await page.getByRole('button',{name:'Copy V1 public work into V2',exact:true}).click();
  const left=await page.locator('.cp-reference-rail').boundingBox(),right=await page.locator('.cp-editor-main').boundingBox();expect(right!.width).toBeGreaterThan(left!.width*1.5);
  await page.getByLabel('Card title',{exact:true}).fill('A testable comparison method');await page.getByLabel('Card reasoning',{exact:true}).fill('Compare matched groups in both periods using consistent definitions. Reweight the current period to the previous mix.\n\nIf the decline narrows, that supports a mix explanation. If rates still decline within groups, that weakens a mix-only explanation.\n\nThis is a plan, not an observed result. Historical device data remains missing.');
  await glide(page,'Inline evidence source','business_context.md');await expect(page.getByRole('combobox',{name:'Reference material',exact:true})).toHaveAttribute('data-value','business_context.md');
  await page.screenshot({path:info.outputPath('candidate-editor.png'),fullPage:false});
  await page.getByRole('switch',{name:'Night mode'}).setChecked(false);await page.screenshot({path:info.outputPath('candidate-editor-light.png'),fullPage:false});
  await page.setViewportSize({width:1100,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Submit V2',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('A testable comparison method');await page.keyboard.press('Escape');
  expect((await read(request)).versions[0]).toEqual(frozenVersion);expect((await read(request)).versions).toHaveLength(1);
});
