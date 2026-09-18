import { expect, test, type Page } from '@playwright/test';
async function demo(page:Page) { await page.goto('/');await page.getByRole('button',{name:'Demo controls'}).click();await page.getByRole('button',{name:'Open populated workspace'}).click(); }
async function submit(page:Page) { await page.getByRole('button',{name:'Preview work sample'}).click();await page.getByRole('button',{name:'Submit Work Sample'}).click();await page.getByRole('button',{name:'Confirm submission'}).click();await expect(page.getByRole('heading',{name:'Your work is with the hiring team'})).toBeVisible(); }
test('complete application → investigate → submit → review loop',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'Submit Application',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Add your resume');
  await page.getByRole('button',{name:'Load Demo Application'}).click();await page.getByRole('button',{name:'Submit Application',exact:true}).click();await page.getByRole('button',{name:'Start investigation'}).click();
  await page.getByRole('button',{name:'Open campaigns.csv',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Spring discovery');await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByLabel('Filter channel').selectOption('Paid Search');await expect(page.locator('.channel-table tbody tr')).toHaveCount(1);
  await page.getByRole('button',{name:'Load example investigation'}).click();await page.getByRole('button',{name:'Load example',exact:true}).click();
  await page.getByRole('button',{name:'Edit Paid Search has the sharpest conversion decline'}).click();await page.getByLabel('Your observation or idea').fill('Paid search needs deeper investigation');await page.getByRole('button',{name:'Save card'}).click();
  await page.getByRole('button',{name:'Save Draft'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Paid search needs deeper investigation'})).toBeVisible();
  await submit(page);await page.getByRole('button',{name:'View submitted work'}).click();await expect(page.getByRole('button',{name:'Submit Work Sample'})).toHaveCount(0);
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Download brief'}).click();expect((await dl).suggestedFilename()).toBe('Alex_Chen_Investigation.md');
  await page.getByRole('button',{name:'Demo controls'}).click();await page.getByRole('button',{name:'Simulate HR confirmation'}).click();await expect(page.getByRole('heading',{name:'Your evidence has been confirmed'})).toBeVisible();expect(errors).toEqual([]);
});
test('board CRUD, incomplete submission and notebook survive refresh',async({page})=>{
  await demo(page);await page.getByRole('button',{name:'Add Hypotheses',exact:true}).click();await page.getByLabel('Your observation or idea').fill('Check device mix');await page.getByLabel('Reasoning & supporting evidence').fill('Compare equivalent cohorts before concluding.');await page.getByRole('button',{name:'Save card'}).click();
  await page.getByRole('button',{name:'Edit Check device mix'}).click();await page.getByRole('button',{name:'Delete card'}).click();await expect(page.getByRole('heading',{name:'Check device mix'})).toHaveCount(0);
  await page.getByRole('tab',{name:'Notebook',exact:true}).click();await page.getByLabel('Private working notes').fill('Private rough notes');await page.reload();await page.getByRole('tab',{name:'Notebook',exact:true}).click();await expect(page.getByLabel('Private working notes')).toHaveValue('Private rough notes');
  await page.getByRole('button',{name:'Preview work sample'}).click();await page.getByLabel('Executive summary', {exact:true}).fill('');await page.getByRole('button',{name:'Submit Work Sample'}).click();await expect(page.getByRole('dialog')).toContainText('Add an executive summary');
});
test('SQL and Python show labelled simulated output; resources download',async({page})=>{
  await demo(page);
  for(const name of ['SQL','Python Beta']) {await page.getByRole('tab',{name,exact:true}).click();await page.getByRole('button',{name:'Show example results'}).click();await expect(page.getByText('Example output · 5 rows')).toBeVisible();}
  await page.getByRole('link',{name:'Resources',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download website_traffic.csv',exact:true}).click();expect((await pending).suggestedFilename()).toBe('website_traffic.csv');
});
test('request more evidence reopens work and never marks it confirmed',async({page})=>{
  await demo(page);await submit(page);await page.getByRole('button',{name:'Demo controls'}).click();await page.getByRole('button',{name:'Simulate request for more evidence'}).click();await expect(page.getByRole('heading',{name:'A little more evidence is needed'})).toBeVisible();await page.getByRole('button',{name:'Continue to your task'}).click();await page.getByRole('button',{name:'Continue investigation'}).click();await expect(page.getByRole('button',{name:'Save Draft'})).toBeEnabled();await submit(page);
});
test('insufficient review remains distinct; reset clears the whole demo',async({page})=>{
  await demo(page);await submit(page);await page.getByRole('button',{name:'Demo controls'}).click();await page.getByRole('button',{name:'Simulate insufficient evidence'}).click();await expect(page.getByText('Evidence still insufficient',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Demo controls'}).click();await page.getByRole('button',{name:'Reset all demo work'}).click();await expect(page.getByRole('heading',{name:'Your application',exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Alex_Chen_Resume.pdf')).toHaveCount(0);
});
test('mobile navigation, modal keyboard dismissal and layout',async({page})=>{
  await page.setViewportSize({width:390,height:844});await demo(page);await expect(page.getByRole('heading',{name:'Conversion Drop Investigation',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('link',{name:'Resources',exact:true}).click();await page.getByRole('button',{name:'Open business_context.md',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});


test('invalid files are rejected and local PDF selection works',async({page})=>{
  await page.goto('/');
  await page.locator('#resume-file').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('demo')});
  await expect(page.getByRole('alert')).toContainText('non-empty PDF');
  await page.locator('#resume-file').setInputFiles({name:'Synthetic_Resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic fixture')});
  await expect(page.getByText('Synthetic_Resume.pdf')).toBeVisible();
  await page.getByRole('button',{name:'Submit Application',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start investigation'})).toBeVisible();
});

test('blocked browser storage warns without losing in-tab interactions',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};});
  await demo(page);await expect(page.getByRole('alert')).toContainText('Browser storage is unavailable');
  await page.getByRole('button',{name:'Save Draft'}).click();
  await expect(page.getByRole('status')).toContainText('kept in this tab only');
  await submit(page);
});

test('desktop page review and screenshot evidence',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.screenshot({path:testInfo.outputPath('application.png'),fullPage:true});
  await page.getByRole('button',{name:'Load Demo Application'}).click();await page.getByRole('button',{name:'Submit Application',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start investigation'})).toBeVisible();await page.screenshot({path:testInfo.outputPath('tasks.png'),fullPage:true});
  await page.getByRole('button',{name:'Start investigation'}).click();
  await page.getByRole('button',{name:'Load example investigation'}).click();await page.getByRole('button',{name:'Load example',exact:true}).click();
  await page.getByRole('button',{name:'Dismiss notification'}).click();
  await expect(page.locator('.recharts-bar-rectangle path')).toHaveCount(15);
  await page.screenshot({path:testInfo.outputPath('workspace.png'),fullPage:true});
  await page.getByRole('button',{name:'Preview work sample'}).click();await page.screenshot({path:testInfo.outputPath('sample.png'),fullPage:true});
  await page.getByRole('tab',{name:'Process evidence',exact:true}).click();await page.screenshot({path:testInfo.outputPath('timeline.png'),fullPage:true});
  await page.getByRole('button',{name:'Submit Work Sample'}).click();await page.getByRole('button',{name:'Confirm submission'}).click();
  await expect(page.getByRole('heading',{name:'Your work is with the hiring team'})).toBeVisible();await page.screenshot({path:testInfo.outputPath('status.png'),fullPage:true});
  await page.getByRole('link',{name:'Resources',exact:true}).click();await page.screenshot({path:testInfo.outputPath('resources.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Demo controls'}).click();await page.getByRole('button',{name:'Open populated workspace'}).click();
  await page.getByRole('button',{name:'Dismiss notification'}).click();await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true});
  expect(errors).toEqual([]);
});
