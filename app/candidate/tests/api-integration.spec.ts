import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const backend = 'http://127.0.0.1:8789';
const candidateUrl = 'http://127.0.0.1:5373';
const hrUrl = 'http://127.0.0.1:5386';
test.beforeEach(async ({ request }) => {
  const { data } = await (await request.get(`${backend}/api/demo`)).json();
  const reset = await request.post(`${backend}/api/demo/reset`, { headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-Demo-Admin-Token': 'api-ui-test-only-reset-token' }, data: { schemaVersion:'2.0',sessionId:data.sessionId } });
  expect(reset.ok()).toBeTruthy();
});
async function refresh(page: Page) { await page.getByRole('button', {name:'Refresh shared case',exact:true}).click(); await expect(page.getByRole('button',{name:'Refresh shared case',exact:true})).toBeEnabled(); }
async function startPair(candidate: Page, hr: Page, summary: string) {
  await candidate.goto(`${candidateUrl}/#tasks`);
  await expect(candidate.getByRole('heading',{name:'Waiting for a targeted task'})).toBeVisible();
  await hr.goto(`${hrUrl}/#tasks`);
  await hr.getByLabel('Candidate instructions').fill('Use the shared evidence, retain uncertainty, and explain your next step.');
  await hr.getByRole('button',{name:'Confirm & Send to Candidate'}).click();
  await expect(hr.getByText('Sent version · read only')).toBeVisible();
  await refresh(candidate);
  await expect(candidate.getByText('Use the shared evidence, retain uncertainty, and explain your next step.',{exact:true})).toBeVisible();
  await candidate.getByRole('button',{name:'Start V1 draft',exact:true}).click();
  await candidate.getByRole('button',{name:'Preview work sample'}).click();
  await candidate.getByLabel('Executive summary',{exact:true}).fill(summary);
}
async function submit(candidate: Page, version: number) {
  await candidate.getByRole('button',{name:`Submit V${version} work sample`,exact:true}).click();
  await candidate.getByRole('button',{name:`Confirm V${version} submission`,exact:true}).click();
  await expect(candidate.getByRole('heading',{name:`V${version} submitted · in review`})).toBeVisible();
}
async function decide(hr: Page, label: string, comment: string) {
  await hr.getByRole('button',{name:label,exact:true}).click();
  await expect(hr.getByRole('button',{name:'Save review decision'})).toBeDisabled();
  await hr.getByLabel('Public review reason (required)').fill(comment);
  await hr.getByRole('button',{name:'Save review decision'}).click();
  await expect(hr.getByRole('dialog')).toHaveCount(0);
}

test('actual V1 → More → V2 → Confirm, immutable histories, quotations and private notes', async ({page:candidate,context,request},info) => {
  const hr=await context.newPage(); const errors:string[]=[]; const writes:string[]=[];
  for(const p of [candidate,hr])p.on('pageerror',e=>errors.push(e.message));
  candidate.on('request',r=>{if(r.method()==='POST')writes.push(r.postData()??'');});
  const first='😀中文 EB-UI-V1-UNIQUE: Paid Search deserves a controlled comparison.';
  const second='😀中文 EB-UI-V2-UNIQUE: Compare matching cohorts before changing spend.';
  await startPair(candidate,hr,first);
  await candidate.getByRole('button',{name:'Back to investigation'}).click();
  await candidate.getByRole('tab',{name:'Notebook',exact:true}).click();
  await candidate.getByLabel('Private notes',{exact:true}).fill('PRIVATE-V1-DO-NOT-SHARE');
  await candidate.getByRole('button',{name:'Add Key Findings',exact:true}).click();
  await candidate.getByLabel('Observation or idea').fill('😀中文 a bounded finding');
  await candidate.getByLabel('Reasoning & supporting evidence').fill('426,000 sessions and 7,668 orders show a pattern, not a cause.');
  await candidate.getByRole('combobox',{name:'Evidence source',exact:true}).click();await candidate.getByRole('listbox',{name:'Evidence source',exact:true}).getByRole('option',{name:'website_traffic.csv',exact:true}).click();
  await candidate.getByRole('button',{name:'Save card'}).click();
  await candidate.getByRole('button',{name:'Preview work sample'}).click();
  const downloadPromise=candidate.waitForEvent('download');await candidate.getByRole('button',{name:'Export public draft JSON'}).click();
  const downloaded=await downloadPromise;expect(await readFile((await downloaded.path())!,'utf-8')).not.toContain('PRIVATE');
  await submit(candidate,1);
  await hr.goto(`${hrUrl}/#review`); await refresh(hr);
  await expect(hr.locator('.eb-review-source').getByText(first,{exact:true})).toBeVisible();
  await hr.getByRole('button',{name:'Analyze current submission',exact:true}).click();
  await expect(hr.getByText('Manual rules simulation · not a model run',{exact:true})).toBeVisible();
  await expect(hr.getByText('Not observed',{exact:true}).first()).toBeVisible();
  await hr.locator('.eb-citation').first().click();
  await expect(hr.locator('.eb-review-source mark')).toContainText('😀中文');
  await expect(hr.locator('.eb-review-source mark')).toBeInViewport();
  await hr.getByRole('button',{name:'Clear quotation'}).click();
  const {data:v1} = await (await request.get(`${backend}/api/demo`)).json();
  await decide(hr,'Needs More Evidence','Compare the new cohort and retain the V1 evidence.');
  const {data:reviewedV1} = await (await request.get(`${backend}/api/demo`)).json();
  await refresh(candidate);
  await candidate.getByRole('button',{name:'View task and draft controls'}).click();
  await expect(candidate.getByText('Compare the new cohort and retain the V1 evidence.',{exact:true})).toBeVisible();
  await candidate.getByRole('button',{name:'Copy V1 into a V2 draft',exact:true}).click();
  await candidate.getByRole('tab',{name:'Notebook',exact:true}).click();
  await candidate.getByLabel('Private notes',{exact:true}).fill('PRIVATE-V2-DO-NOT-SHARE');
  await candidate.getByRole('button',{name:'Preview work sample'}).click();
  await candidate.getByLabel('Executive summary',{exact:true}).fill(second);
  await candidate.reload();await expect(candidate.getByLabel('Executive summary',{exact:true})).toHaveValue(second);
  const {data:drafting} = await (await request.get(`${backend}/api/demo`)).json();
  expect(drafting.versions).toEqual(reviewedV1.versions);
  await submit(candidate,2);
  await hr.goto(`${hrUrl}/#review`); await refresh(hr);
  await hr.getByRole('tab',{name:'Work & observations',exact:true}).click();
  await expect(hr.locator('.eb-review-source').getByText(second,{exact:true})).toBeVisible();
  await expect(hr.getByRole('button',{name:'Needs More Evidence',exact:true})).toHaveCount(0);
  const {data:v2} = await (await request.get(`${backend}/api/demo`)).json();
  expect(v2.versions[0]).toEqual(reviewedV1.versions[0]);
  expect(v2.submission.submissionId).not.toBe(v1.submission.submissionId);
  expect(v2.analysis.status).toBe('not_started');expect(v2.review).toBeNull();
  await hr.locator('.eb-version-diff summary').click();
  await expect(hr.locator('.eb-version-diff')).toContainText(first);
  await expect(hr.locator('.eb-version-diff')).toContainText(second);
  await hr.locator('.eb-version-diff summary').click();
  await hr.getByLabel('Submission version',{exact:true}).selectOption('1');
  await expect(hr.getByRole('button',{name:'Confirm evidence',exact:true})).toHaveCount(0);
  await hr.getByRole('tab',{name:'Work & observations',exact:true}).click();
  await expect(hr.locator('.eb-review-source').getByText(first,{exact:true})).toBeVisible();
  await hr.getByRole('tab',{name:'Work & observations',exact:true}).click();
  await hr.locator('.eb-citation').first().click();await expect(hr.locator('.eb-review-source mark')).toContainText('EB-UI-V1');
  await hr.getByRole('button',{name:'Clear quotation'}).click();
  await hr.getByLabel('Submission version',{exact:true}).selectOption('2');
  await hr.getByRole('button',{name:'Analyze current submission',exact:true}).click();
  await expect(hr.getByText('Manual rules simulation · not a model run',{exact:true})).toBeVisible();
  await hr.locator('.eb-citation').first().click();await expect(hr.locator('.eb-review-source mark')).toContainText('EB-UI-V2');await hr.getByRole('button',{name:'Clear quotation'}).click();
  await decide(hr,'Confirm evidence','V2 evidence supports a bounded BPS confirmation.');
  await refresh(candidate);
  await expect(candidate.getByRole('heading',{name:'Review complete · this task is closed'})).toBeVisible();
  await expect(candidate.getByRole('navigation',{name:'Evidence workflow'}).locator('[aria-current=step]')).toContainText('Closed');
  await expect(candidate.getByText('V2 evidence supports a bounded BPS confirmation.',{exact:true}).first()).toBeVisible();
  const {data:final} = await (await request.get(`${backend}/api/demo`)).json();
  expect(final.report.requirements.map((r:{status:string})=>r.status)).toEqual(['supported','supported','verified']);
  expect(final.workflow.canSubmit).toBe(false);expect(final.versions[0]).toEqual(reviewedV1.versions[0]);
  expect(JSON.stringify(final)).not.toContain('PRIVATE');expect(writes.join('')).not.toContain('PRIVATE');expect(errors).toEqual([]);
  await hr.getByRole('switch',{name:'Night mode'}).check();await expect(hr.locator('.eb-sidebar')).toHaveCSS('background-color','rgb(6, 6, 6)');
  await hr.screenshot({path:info.outputPath('hr-v2-confirmed-dark.png'),fullPage:true,animations:'disabled'});
  await candidate.screenshot({path:info.outputPath('candidate-v2-status.png'),fullPage:true,animations:'disabled'});
});

for(const [label,status] of [['Confirm evidence','verified'],['Evidence Still Insufficient','uncertain']] as const) {
  test(`V1 terminal ${label} never offers unused V2 capacity`,async({page:candidate,context,request})=>{
    const hr=await context.newPage();await startPair(candidate,hr,'A limited first answer.');await submit(candidate,1);await hr.goto(`${hrUrl}/#review`); await refresh(hr);
    await decide(hr,label,'The V1 decision is final for this bounded case.');
    await refresh(candidate);await candidate.goto(`${candidateUrl}/#tasks`);await expect(candidate.getByRole('button',{name:/Start V2|Copy V1|Continue V2/})).toHaveCount(0);
    const {data}=await(await request.get(`${backend}/api/demo`)).json();expect(data.workflow.remainingSubmissions).toBe(1);expect(data.workflow.canSubmit).toBe(false);expect(data.report.requirements[2].status).toBe(status);
  });
}
test('V2 insufficient is terminal; disabled analysis preserves human review',async({page:candidate,context,request})=>{
  const hr=await context.newPage();await startPair(candidate,hr,'TEST_DISABLED: an incomplete answer.');await submit(candidate,1);await hr.goto(`${hrUrl}/#review`); await refresh(hr);
  await hr.getByRole('button',{name:'Analyze current submission',exact:true}).click();await expect(hr.getByRole('alert')).toContainText('AI_DISABLED');
  await decide(hr,'Needs More Evidence','Please provide a testable hypothesis.');await refresh(candidate);await candidate.getByRole('button',{name:'View task and draft controls'}).click();await candidate.getByRole('button',{name:'Copy V1 into a V2 draft'}).click();await candidate.getByRole('button',{name:'Preview work sample'}).click();await candidate.getByLabel('Executive summary',{exact:true}).fill('V2 still has no testable explanation.');await submit(candidate,2);await hr.goto(`${hrUrl}/#review`); await refresh(hr);await decide(hr,'Evidence Still Insufficient','The second version still lacks discriminating evidence.');
  const {data}=await(await request.get(`${backend}/api/demo`)).json();expect(data.workflow.isTerminal).toBe(true);expect(data.workflow.nextSubmissionVersion).toBeNull();expect(data.report.requirements[2].status).toBe('uncertain');
});
test('lost POST response retains exact receipt through reload and never duplicates a submission',async({page:candidate,context,request})=>{
  const hr=await context.newPage();await startPair(candidate,hr,'NETWORK_RECEIPT_UNIQUE');const posts:{key:string|null;body:string|null}[]=[];let lost=false;
  await candidate.route('**/api/demo/submission',async route=>{posts.push({key:route.request().headers()['idempotency-key'],body:route.request().postData()});if(!lost){lost=true;await route.fetch();await route.abort();}else await route.continue();});
  await candidate.getByRole('button',{name:'Submit V1 work sample'}).click();await candidate.getByRole('button',{name:'Confirm V1 submission'}).click();
  await expect(candidate.getByRole('button',{name:'Retry original action'})).toBeVisible();await candidate.reload();await candidate.getByRole('button',{name:'Retry original action'}).click();await expect(candidate.getByRole('button',{name:'Retry original action'})).toHaveCount(0);
  expect(posts).toHaveLength(2);expect(posts[0]).toEqual(posts[1]);const {data}=await(await request.get(`${backend}/api/demo`)).json();expect(data.versions).toHaveLength(1);
});
test('review closes in-flight analysis; late result does not reopen V1 or leak into V2',async({page:candidate,context,request})=>{
  const hr=await context.newPage();await startPair(candidate,hr,'TEST_DELAY: a first bounded answer.');const lateResponse=hr.waitForResponse(r=>r.url().endsWith('/api/demo/analysis') && r.request().method()==='POST');await submit(candidate,1);await hr.goto(`${hrUrl}/#review`); await refresh(hr);await hr.getByRole('button',{name:'Analyze current submission',exact:true}).click();
  await expect.poll(async()=>{const {data}=await(await request.get(`${backend}/api/demo`)).json();return data.analysis.status;}).toBe('running');
  await decide(hr,'Needs More Evidence','Add evidence while the V1 analysis remains closed.');
  expect((await (await lateResponse).json()).error.code).toBe('STALE_ANALYSIS');
  await expect.poll(async()=>{const {data}=await(await request.get(`${backend}/api/demo`)).json();return data.versions[0].analysis.errorCode;}).toBe('AI_REVIEW_CLOSED');
  await hr.goto(`${hrUrl}/#review`); await refresh(hr);await hr.getByRole('tab',{name:'Work & observations'}).click();await expect(hr.getByText(/AI_REVIEW_CLOSED/).last()).toBeVisible();await expect(hr.getByRole('button',{name:'Start new analysis attempt'})).toHaveCount(0);
});
test('server reset isolates old drafts; stale binding is refreshed without replay into new case',async({page:candidate,context,request})=>{
  const hr=await context.newPage();await startPair(candidate,hr,'OLD_SESSION_PRIVATE_DRAFT');const {data}=await(await request.get(`${backend}/api/demo`)).json();
  // Reset exactly after the old-bound POST is issued, before it reaches the service.
  // Otherwise automatic refresh can legitimately remove the stale form before clicking.
  await candidate.route('**/api/demo/submission',async route=>{const reset=await request.post(`${backend}/api/demo/reset`,{headers:{'Idempotency-Key':crypto.randomUUID(),'X-Demo-Admin-Token':'api-ui-test-only-reset-token'},data:{schemaVersion:'2.0',sessionId:data.sessionId}});expect(reset.ok()).toBeTruthy();await route.continue();},{times:1});
  await candidate.getByRole('button',{name:'Submit V1 work sample'}).click();await candidate.getByRole('button',{name:'Confirm V1 submission'}).click();await expect(candidate.getByRole('alert')).toContainText('STALE_SESSION');await candidate.goto(`${candidateUrl}/#tasks`);await expect(candidate.getByRole('heading',{name:'Waiting for a targeted task'})).toBeVisible();await expect(candidate.getByText('OLD_SESSION_PRIVATE_DRAFT',{exact:true})).toHaveCount(0);
});
test('API dataset, downloads, theme/sidebar and narrow-screen navigation',async({page:candidate,context},info)=>{
  const hr=await context.newPage();await startPair(candidate,hr,'Data check');await candidate.getByRole('button',{name:'Back to investigation'}).click();await expect(candidate.locator('.eb-metrics').getByText('1,180,000',{exact:true})).toBeVisible();await expect(candidate.locator('.eb-metrics').getByText('30,680',{exact:true})).toBeVisible();await expect(candidate.getByText('426,000',{exact:true})).toBeVisible();await expect(candidate.getByText('31,200',{exact:true})).toHaveCount(0);
  const dl=candidate.waitForEvent('download');await candidate.getByRole('button',{name:'Download website_traffic.csv',exact:true}).click();expect(await readFile((await(await dl).path())!,'utf8')).toContain('426000');
  await candidate.getByRole('switch',{name:'Night mode'}).check();await candidate.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await expect(candidate.locator('[data-eb-content]')).toHaveCSS('margin-left','64px');await candidate.reload();await expect(candidate.getByRole('switch',{name:'Night mode'})).toBeChecked();await candidate.getByRole('button',{name:'Expand sidebar',exact:true}).click();await expect(candidate.locator('.eb-sidebar')).toHaveCSS('width','232px');await candidate.screenshot({path:info.outputPath('candidate-workspace-dark.png'),fullPage:true,animations:'disabled'});
  await candidate.setViewportSize({width:390,height:844});await candidate.getByRole('button',{name:'Open navigation'}).click();await expect(candidate.getByRole('dialog').getByRole('switch',{name:'Night mode'})).toBeVisible();await candidate.keyboard.press('Escape');await expect(candidate.getByRole('button',{name:'Open navigation'})).toBeFocused();expect(await candidate.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('unavailable API preserves local input and never falls back to simulated shared state', async ({page:candidate,context}) => {
  const hr = await context.newPage();
  await startPair(candidate,hr,'PRESERVE-MY-REAL-DRAFT');
  await candidate.route('**/api/demo', route => route.abort());
  await refresh(candidate);
  await expect(candidate.getByRole('alert')).toContainText('CONNECTION_UNCERTAIN');
  await expect(candidate.getByLabel('Executive summary',{exact:true})).toHaveValue('PRESERVE-MY-REAL-DRAFT');
  await expect(candidate.getByRole('button',{name:'Submit V1 work sample',exact:true})).toBeDisabled();
  await candidate.unroute('**/api/demo');
  await refresh(candidate);
  await expect(candidate.getByRole('button',{name:'Submit V1 work sample',exact:true})).toBeEnabled();
  await submit(candidate,1);
});

for (const [decision, heading] of [
  ['Confirm evidence', 'V2: Evidence confirmed'],
  ['Evidence Still Insufficient', 'V2: Evidence still insufficient'],
] as const) {
  test(`My Tasks shows the current V2 review after ${decision}, preserving V1 history`, async ({ page: candidate, context, request }, info) => {
    const hr = await context.newPage();
    const v1Comment = 'V1 feedback: explain which evidence would distinguish the hypotheses.';
    const v2Comment = `V2 final feedback: ${decision}. This task is closed.`;
    await startPair(candidate, hr, 'V1 task-page review regression.');
    await submit(candidate, 1);
    await hr.goto(`${hrUrl}/#review`);
    await refresh(hr);
    await decide(hr, 'Needs More Evidence', v1Comment);

    await candidate.goto(`${candidateUrl}/#tasks`);
    await refresh(candidate);
    await expect(candidate.getByRole('heading', { name: 'V1: Needs more evidence', exact: true })).toBeVisible();
    await expect(candidate.getByText(v1Comment, { exact: true })).toBeVisible();
    await candidate.getByRole('button', { name: 'Copy V1 into a V2 draft', exact: true }).click();
    await candidate.getByRole('button', { name: 'Preview work sample', exact: true }).click();
    await candidate.getByLabel('Executive summary', { exact: true }).fill('V2 task-page review regression.');
    await submit(candidate, 2);
    await candidate.goto(`${candidateUrl}/#tasks`);
    await refresh(candidate);
    await expect(candidate.getByText(v1Comment, { exact: true })).toHaveCount(0);

    await hr.goto(`${hrUrl}/#review`);
    await refresh(hr);
    await decide(hr, decision, v2Comment);
    await refresh(candidate);
    await expect(candidate.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(candidate.getByText(v2Comment, { exact: true })).toBeVisible();
    await expect(candidate.getByText(v1Comment, { exact: true })).toHaveCount(0);
    await expect(candidate.getByRole('button', { name: /Start V2|Copy V1|Continue V2|Start V3/ })).toHaveCount(0);
    await candidate.reload();
    await expect(candidate.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(candidate.getByText(v2Comment, { exact: true })).toBeVisible();
    await candidate.screenshot({ path: info.outputPath('candidate-tasks-v2-final.png'), fullPage: true, animations: 'disabled' });

    await candidate.getByRole('button', { name: 'View submitted versions', exact: true }).click();
    await candidate.getByLabel('Submission version', { exact: true }).selectOption('1');
    await expect(candidate.getByRole('heading', { name: 'V1: Needs more evidence', exact: true })).toBeVisible();
    await expect(candidate.getByText(v1Comment, { exact: true })).toBeVisible();
    await candidate.getByLabel('Submission version', { exact: true }).selectOption('2');
    await expect(candidate.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    const { data } = await (await request.get(`${backend}/api/demo`)).json();
    expect(data.versions.map((v: { review: { comment: string } }) => v.review.comment)).toEqual([v1Comment, v2Comment]);
  });
}
