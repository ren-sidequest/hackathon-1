import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({page}) => {
  page.on('pageerror', error => { throw error; });
});

async function nav(page:Page,label:string){await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:label,exact:true}).click();}
async function role(page:Page,value:'hr'|'candidate'){await page.getByLabel('Preview role',{exact:true}).selectOption(value);}
async function task(page:Page,name:string,skill='BPS'){
  await nav(page,'Targeted tasks');await page.getByLabel('Current candidate',{exact:true}).selectOption({label:name});
  await page.getByLabel('Target skill',{exact:true}).selectOption(skill);await page.getByRole('button',{name:'Send task in preview',exact:true}).click();
  await expect(page.getByRole('heading',{name:`Waiting for ${name}’s work`,exact:true})).toBeVisible();
}
async function submit(page:Page,version:number,text:string){
  await page.getByLabel('Executive summary',{exact:true}).fill(text);
  await page.getByRole('button',{name:`Submit V${version} in preview`,exact:true}).click();
  await page.getByRole('button',{name:`Confirm V${version} preview submission`,exact:true}).click();
  await expect(page.getByRole('heading',{name:`V${version} · public work snapshot`,exact:true})).toBeVisible();
}
async function review(page:Page,decision:string,comment:string){
  await page.getByRole('button',{name:decision,exact:true}).click();
  await expect(page.getByRole('button',{name:'Save local evidence review',exact:true})).toBeDisabled();
  await page.getByLabel('Public review comment',{exact:true}).fill(comment);
  await page.getByRole('button',{name:'Save local evidence review',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('four-person comparison: scope, NE, skill ordering, ties and the fourth person',async({page},info)=>{
  const calls:string[]=[];page.on('request',r=>{if(r.url().includes('/api/demo'))calls.push(r.url());});
  await page.goto('/');await expect(page.getByText('Frontend mock · synthetic materials and illustrative marks',{exact:true})).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  const alex=page.locator('tr[data-candidate="preview-alex"]');await expect(alex).toContainText('Needs evidence');await expect(alex).toContainText('8/10');await expect(alex).not.toContainText('0.0%');
  await page.getByLabel('Compare sort').selectOption('overall');await expect(page.locator('tbody tr').first()).toContainText('Leo Nguyen');
  await page.getByLabel('Compare sort').selectOption('SQL');await expect(page.locator('tbody tr').first()).toContainText('Sam Rivera');await expect(page.getByText('Tied on selected skill',{exact:true})).toHaveCount(2);
  await page.getByLabel('Compare sort').selectOption('default');await page.getByRole('button',{name:'Preview three-row view'}).click();await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.getByText('Showing 3 / 4 · everyone remains available',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'View all four',exact:true}).click();await expect(page.getByRole('button',{name:'Open Sam Rivera',exact:true})).toBeVisible();expect(calls).toEqual([]);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:info.outputPath('hr-comparison-light.png'),fullPage:true,animations:'disabled'});
});
test('anchored B3, exact emoji quotation and isolated source when switching candidate',async({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:'Open Alex Chen'}).click();
  await expect(page.getByText('2 ÷ 4 × 10 = 5/10 contribution',{exact:true})).toBeVisible();
  await page.locator('.eb-citation').click();await expect(page.locator('.r5-inline-source mark')).toHaveText('😀 Evidence request\nRequest campaign × device and checkout-step data.');await expect(page.locator('.r5-inline-source mark')).toBeInViewport();
  await page.getByLabel('Current candidate').selectOption({label:'Maya Patel'});
  await page.locator('.eb-citation').click();await expect(page.getByRole('region',{name:'Original source text'})).toContainText('Maya Patel');await expect(page.locator('.r5-inline-source mark')).not.toContainText('😀 Evidence request');
  await page.getByRole('button',{name:'View ten assessment standards'}).click();await expect(page.getByRole('dialog').locator('details')).toHaveCount(10);await expect(page.getByRole('dialog')).toContainText('One NE means no overall percentage');await page.keyboard.press('Escape');
  await page.getByRole('switch',{name:'Night mode'}).click();await page.screenshot({path:info.outputPath('hr-evidence-dark.png'),fullPage:true,animations:'disabled'});
});
test('assessment draft validates NE and source, survives reload, does not publish new percentages',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Open Alex Chen'}).click();await page.getByRole('button',{name:'Edit human assessment draft'}).click();
  await page.getByLabel('Human mark',{exact:true}).selectOption('NE');await page.getByLabel('Checked scope',{exact:true}).fill('');await page.getByRole('button',{name:'Save local assessment draft'}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('NE needs');
  await page.getByLabel('Checked scope',{exact:true}).fill('Checked only this synthetic project.');await page.getByLabel('Missing evidence / next step',{exact:true}).fill('Need a reproducible check.');await page.getByRole('button',{name:'Save local assessment draft'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await nav(page,'Compare candidates');await expect(page.locator('tr[data-candidate="preview-alex"]').locator('td').nth(1)).toContainText('75.0%');
  await page.reload();await page.getByRole('button',{name:'Open Alex Chen'}).click();await page.getByRole('button',{name:'Edit human assessment draft'}).click();await expect(page.getByLabel('Human mark',{exact:true})).toHaveValue('NE');
  await page.getByLabel('Human mark',{exact:true}).selectOption('4');await page.getByLabel('Exact source quotation',{exact:true}).fill('This passage belongs to nobody.');await page.getByRole('button',{name:'Save local assessment draft'}).click();await expect(page.getByRole('dialog')).toContainText('valid source quote');
});
test('all four may be retained; removing a person never deletes their application',async({page})=>{
  await page.goto('/');
  for(const name of ['Alex Chen','Maya Patel','Leo Nguyen','Sam Rivera']){
    await page.getByRole('button',{name:`Retain ${name}`,exact:true}).click();await expect(page.getByRole('button',{name:'Save local shortlist decision'})).toBeDisabled();await page.getByLabel('Human shortlist reason').fill(`Review ${name}'s particular strengths.`);await page.getByRole('button',{name:'Save local shortlist decision'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.reload();await nav(page,'Retained candidates');await expect(page.getByRole('button',{name:'Remove from retained',exact:true})).toHaveCount(4);
  const sam=page.locator('section.eb-panel').filter({has:page.getByRole('heading',{name:'Sam Rivera',exact:true})});await sam.getByRole('button',{name:'Remove from retained'}).click();await page.getByLabel('Human shortlist reason').fill('Discuss the evidence before retaining again.');await page.getByRole('button',{name:'Save local shortlist decision'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(sam).toContainText('Not retained');await page.getByRole('button',{name:'View all four candidates'}).click();await expect(page.locator('tbody tr')).toHaveCount(4);
});
for(const [name,skill] of [['Alex Chen','BPS'],['Maya Patel','SQL'],['Leo Nguyen','DA'],['Sam Rivera','SQL']]) {
  test(`${name}: template, V1/More/V2, private notes, source history and stale shortlist basis`,async({page},info)=>{
    await page.goto('/');await page.getByRole('button',{name:`Retain ${name}`,exact:true}).click();await page.getByLabel('Human shortlist reason').fill('Retain based on the original application.');await page.getByRole('button',{name:'Save local shortlist decision'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    await task(page,name,skill);await role(page,'candidate');await page.getByRole('button',{name:'Start V1 draft'}).click();
    await page.getByRole('tab',{name:'Private notebook'}).click();await page.getByLabel('Private notes').fill(`PRIVATE-${name}`);
    await page.getByRole('button',{name:'Add Key Findings'}).click();await page.getByLabel('Observation or idea').fill(`${name} unique finding`);await page.getByLabel('Reasoning & supporting evidence').fill('Bounded evidence, with uncertainty.');await page.getByRole('button',{name:'Save card'}).click();
    await submit(page,1,`${name} V1 unique text`);const v1Download=page.waitForEvent('download');await page.getByRole('button',{name:'Export V1 public work'}).click();expect(await readFile((await(await v1Download).path())!,'utf8')).not.toContain('PRIVATE');
    await role(page,'hr');await nav(page,'Retained candidates');await expect(page.getByText('Reconfirmation needed',{exact:true})).toHaveCount(1);
    await nav(page,'Targeted tasks');await expect(page.getByText(`${name} V1 unique text`,{exact:true})).toBeVisible();await expect(page.locator('body')).not.toContainText(`PRIVATE-${name}`);await review(page,'Needs More Evidence',`${name}: explain one discriminating comparison.`);
    await role(page,'candidate');await page.getByRole('button',{name:'Copy V1 public work into V2'}).click();await page.getByRole('tab',{name:'Private notebook'}).click();await expect(page.getByLabel('Private notes')).toHaveValue('');await expect(page.getByLabel('Executive summary')).toHaveValue(`${name} V1 unique text`);await submit(page,2,`${name} V2 revised text`);
    await role(page,'hr');await nav(page,'Targeted tasks');await expect(page.getByRole('button',{name:'Needs More Evidence',exact:true})).toHaveCount(0);await expect(page.getByText(`${name}: explain one discriminating comparison.`,{exact:true})).toHaveCount(0);
    await page.getByLabel('Submission version').selectOption('1');await expect(page.getByText(`${name} V1 unique text`,{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Confirm evidence',exact:true})).toHaveCount(0);await page.getByLabel('Submission version').selectOption('2');await review(page,'Confirm evidence',`${name}: bounded task evidence confirmed.`);
    await nav(page,'Evidence & marks');await page.getByLabel('Assessment stage').selectOption('task_v2');await expect(page.getByText('Not assessed',{exact:true})).toHaveCount(skill==='BPS'?4:3);await expect(page.getByText(/V2 has no inherited score/)).toBeVisible();
    await role(page,'candidate');await expect(page.getByText(`${name}: bounded task evidence confirmed.`,{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Start V3|Start V2|Copy V1/})).toHaveCount(0);
    await nav(page,'Work & feedback');await page.getByLabel('Submission version').selectOption('1');await expect(page.getByText(`${name}: explain one discriminating comparison.`,{exact:true})).toBeVisible();
    if(name==='Maya Patel')await page.screenshot({path:info.outputPath('maya-sql-history.png'),fullPage:true,animations:'disabled'});
  });
}
test('in-flight send stays with its candidate; drafts isolate by identity and survive reload',async({page})=>{
  await page.goto('/');await nav(page,'Targeted tasks');await page.getByRole('button',{name:'Send task in preview'}).click();await page.getByLabel('Current candidate').selectOption({label:'Maya Patel'});await expect(page.getByRole('button',{name:'Send task in preview'})).toBeEnabled();await page.getByRole('button',{name:'Send task in preview'}).click();await expect(page.getByRole('heading',{name:'Waiting for Maya Patel’s work'})).toBeVisible();
  await role(page,'candidate');await page.getByRole('button',{name:'Start V1 draft'}).click();await page.getByLabel('Executive summary').fill('MAYA DRAFT ONLY');await page.getByLabel('Current candidate').selectOption({label:'Alex Chen'});await expect(page.getByText('MAYA DRAFT ONLY',{exact:true})).toHaveCount(0);await nav(page,'My task');await page.getByRole('button',{name:'Start V1 draft'}).click();await expect(page.getByLabel('Executive summary')).toHaveValue('');
  await page.reload();await role(page,'candidate');await page.getByLabel('Current candidate').selectOption({label:'Maya Patel'});await page.getByRole('button',{name:'Continue V1 draft'}).click();await expect(page.getByLabel('Executive summary')).toHaveValue('MAYA DRAFT ONLY');
});
test('storage failure does not claim a saved shortlist and keeps the entered reason',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Retain Sam Rivera'}).click();await page.getByLabel('Human shortlist reason').fill('KEEP THIS UNSAVED REASON');
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Test storage denied');};});
  await page.getByRole('button',{name:'Save local shortlist decision'}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Test storage denied');await expect(page.getByLabel('Human shortlist reason')).toHaveValue('KEEP THIS UNSAVED REASON');
});
test('candidate entry, company standards, dark sidebar and mobile comparison remain usable',async({page},info)=>{
  await page.goto('http://127.0.0.1:5673');await expect(page.getByRole('heading',{name:'Your application materials'})).toBeVisible();await expect(page.getByLabel('Preview role')).toHaveValue('candidate');await role(page,'hr');await nav(page,'Company & role');await expect(page.getByRole('heading',{name:'HarbourCart Pty Ltd'})).toBeVisible();await expect(page.getByText(/Approximately 25 people/)).toBeVisible();
  await page.getByRole('switch',{name:'Night mode'}).click();await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await expect(page.locator('[data-eb-content]')).toHaveCSS('margin-left','64px');await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('dialog').getByRole('button',{name:'Compare candidates',exact:true}).click();await expect(page.getByRole('button',{name:'Open navigation'})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('mobile-comparison-dark.png'),fullPage:true,animations:'disabled'});
});

test('resource search, numeric sort and row-to-card preserve the exact source and private boundary',async({page},info)=>{
  await page.goto('/');await task(page,'Alex Chen');await role(page,'candidate');await page.getByRole('button',{name:'Start V1 draft'}).click();
  await expect(page.getByRole('navigation',{name:'Evidence workflow'}).locator('[aria-current=step]')).toContainText('Investigation');
  await page.getByLabel('Filter channel',{exact:true}).selectOption('Paid Search');
  await expect(page.locator('.eb-data-overview tbody tr')).toHaveCount(1);await expect(page.locator('.eb-channel-bars')).toContainText('1.80%');
  await page.getByLabel('Find a resource',{exact:true}).fill('website');await page.getByRole('button',{name:'website_traffic.csv',exact:true}).click();
  const dialog=page.getByRole('dialog');await page.getByLabel('Filter resource rows').fill('Paid Search');await expect(dialog.locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Sort resource column').selectOption({label:'sessions'});await page.getByRole('button',{name:'Ascending',exact:true}).click();
  await expect(dialog.locator('tbody tr').first()).toContainText('426000');
  const row=await dialog.locator('tbody tr').first().locator('td').first().innerText();
  await dialog.getByRole('button',{name:`Create card from row ${row}`,exact:true}).click();
  await expect(page.getByLabel('Evidence source',{exact:true})).toHaveValue('website_traffic.csv');
  await expect(page.getByLabel('Reasoning & supporting evidence')).toContainText(`Source row ${row}`);
  await page.getByLabel('Observation or idea').fill('Paid Search needs a controlled comparison');await page.getByRole('button',{name:'Save card'}).click();
  await expect(page.locator('.eb-board')).toContainText('sessions: 426000');
  await page.getByLabel('Find a resource',{exact:true}).fill('');
  await page.screenshot({path:info.outputPath('candidate-data-workspace.png'),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await expect(page.locator('[data-eb-content]')).toHaveCSS('margin-left','0px');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('candidate-workspace-mobile.png'),fullPage:true,animations:'disabled'});await page.setViewportSize({width:1536,height:1050});
  await page.getByRole('tab',{name:'Private notebook'}).click();await page.getByLabel('Private notes').fill('DO NOT SHARE ROW NOTES');
  await submit(page,1,'A limited observation from the supplied data.');await role(page,'hr');await nav(page,'Targeted tasks');
  await expect(page.locator('.eb-review-grid')).toContainText(`Source row ${row}`);await expect(page.locator('body')).not.toContainText('DO NOT SHARE ROW NOTES');
});
