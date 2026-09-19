import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({page}) => {
  page.on('pageerror', error => { throw error; });
});

async function choose(page:Page,label:string,value:string|{label:string}) {
  const control=page.getByRole('combobox',{name:label,exact:true});
  await control.click();
  const menu=page.getByRole('listbox',{name:label,exact:true});
  if(typeof value==='string') await menu.locator(`[data-value="${value}"]`).click();
  else await menu.getByRole('option',{name:value.label,exact:true}).click();
  await expect(control).toHaveAttribute('aria-expanded','false');
}

test('rubric weight visualization exposes all ten rules without changing the comparison',async({page},info)=>{
  await page.goto('/');await nav(page,'Company & role');
  const overview=page.getByRole('region',{name:'One shared standard, ten reviewable judgments'});
  const track=overview.getByRole('navigation',{name:'Ten equal-weight assessment standards'});
  await expect(track.getByRole('button')).toHaveCount(10);
  const widths=await track.getByRole('button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().width));
  expect(Math.max(...widths)-Math.min(...widths)).toBeLessThan(1);
  const cards=overview.locator('.r5-skill-card');await expect(cards).toHaveCount(3);
  await expect(cards.locator('.r5-skill-weight')).toHaveText(['30%','30%','40%']);
  const heights=await cards.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));expect(Math.max(...heights)-Math.min(...heights)).toBeLessThan(1);
  await cards.nth(1).hover();await expect(track.locator('[data-active=true]')).toHaveCount(3);
  const b3=track.getByRole('button',{name:/^B3/});await b3.focus();const rubricScroll=await page.evaluate(()=>scrollY);await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog',{name:'Ten public assessment standards'});await expect(dialog).toBeVisible();
  await expect(dialog.locator('details[open]')).toHaveCount(1);await expect(dialog.locator('details[open]')).toContainText('Discriminating evidence plan');
  await expect(dialog.locator('details[open]')).toContainText('Specific data request, comparison and a discriminating result.');
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(rubricScroll);
  await page.keyboard.press('Escape');await expect(b3).toBeFocused();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(rubricScroll);
  await overview.scrollIntoViewIfNeeded();await page.evaluate(async()=>{window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});await page.screenshot({path:info.outputPath('standards-cards-dark.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('switch',{name:'Night mode'}).uncheck();await page.evaluate(async()=>{window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});await page.screenshot({path:info.outputPath('standards-cards-light.png'),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await expect(page.locator('[data-eb-content]')).toHaveCSS('margin-left','0px');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await track.getByRole('button',{name:/^B4/}).click();await expect(page.getByRole('dialog').locator('details[open]')).toContainText('Priorities, actions & validation');await page.keyboard.press('Escape');
  await page.evaluate(async()=>{window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});await page.screenshot({path:info.outputPath('standards-cards-mobile.png'),fullPage:true,animations:'disabled'});
  await overview.getByRole('button',{name:'Compare four candidates'}).click();await expect(page.locator('.r5-compare-table tbody tr')).toHaveCount(4);
});

test('evidence navigation sits above independent source and judgment cards at every width',async({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:'Open Alex Chen'}).click();
  const rail=page.getByRole('navigation',{name:'Evidence criteria'}), source=page.locator('.r5-original-pane'), judgment=page.locator('.r5-assessment-grid>section');
  await expect(rail.getByRole('button')).toHaveCount(10);
  const stage=page.getByRole('combobox',{name:'Assessment stage',exact:true});
  await stage.click();const stageMenu=page.getByRole('listbox',{name:'Assessment stage',exact:true});
  await expect(stageMenu).toBeVisible();await expect(stageMenu.getByRole('option')).toHaveCount(1);
  await page.screenshot({path:info.outputPath('material-stage-dark.png'),animations:'disabled'});
  await page.keyboard.press('Escape');await expect(stage).toBeFocused();
  const hoverCard=rail.getByRole('button',{name:/^S1/});
  const resting=await hoverCard.evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(resting).not.toBe(await rail.evaluate(el=>getComputedStyle(el).backgroundColor));
  const cardBox=await hoverCard.boundingBox();await hoverCard.hover();
  await expect.poll(()=>hoverCard.evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe(resting);
  expect(await hoverCard.boundingBox()).toEqual(cardBox);
  expect(await hoverCard.evaluate(el=>getComputedStyle(el,'::before').pointerEvents)).toBe('none');
  for(const width of [1536,1100]) {
    await page.setViewportSize({width,height:1050});
    const r=(await rail.boundingBox())!,s=(await source.boundingBox())!,j=(await judgment.boundingBox())!;
    expect(r.y+r.height).toBeLessThanOrEqual(s.y);expect(Math.abs(s.y-j.y)).toBeLessThan(1);expect(s.x+s.width).toBeLessThan(j.x);
    await expect(page.locator('.r5-assessment-grid')).toHaveCSS('align-items','start');
  }
  await page.setViewportSize({width:1536,height:1050});
  await rail.scrollIntoViewIfNeeded();const reviewScroll=await page.evaluate(()=>scrollY);
  await rail.getByRole('button',{name:/^S1/}).click();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(reviewScroll);
  await expect(judgment.getByRole('heading',{name:'Query grain, aggregation & joins'})).toBeVisible();await expect(source.locator('mark')).toContainText('join');
  await rail.getByRole('button',{name:/^B3/}).click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(reviewScroll);
  await expect(source.locator('mark')).toContainText('Evidence request');
  await page.emulateMedia({reducedMotion:'reduce'});await expect(hoverCard).toHaveCSS('transition-duration','0s');await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(async()=>{window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});await page.screenshot({path:info.outputPath('evidence-two-card-dark.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('switch',{name:'Night mode'}).uncheck();await page.evaluate(async()=>{window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});await page.screenshot({path:info.outputPath('evidence-two-card-light.png'),fullPage:true,animations:'disabled'});
  await stage.click();await expect(stageMenu).toBeVisible();await page.screenshot({path:info.outputPath('material-stage-light.png'),animations:'disabled'});await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});await expect(page.locator('[data-eb-content]')).toHaveCSS('margin-left','0px');await rail.getByRole('button',{name:/^B3/}).click();
  await expect(judgment.getByRole('heading',{name:'Discriminating evidence plan'})).toBeVisible();
  const s=(await source.boundingBox())!,j=(await judgment.boundingBox())!;expect(j.y).toBeGreaterThan(s.y);expect(Math.abs(s.x-j.x)).toBeLessThan(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(async()=>{window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});await page.screenshot({path:info.outputPath('evidence-two-card-mobile.png'),fullPage:true,animations:'disabled'});
});

test('empty-state task entries keep metallic gold in both themes and route correctly',async({page},info)=>{
  await page.goto('http://127.0.0.1:5673');
  await expect(page.locator('.eb-gold-atmosphere')).toHaveCSS('pointer-events','none');
  await expect(page.locator('.r5-two>.eb-panel').first()).toHaveCSS('backdrop-filter','blur(14px)');
  for(const dark of [true,false]) {
    await page.getByRole('switch',{name:'Night mode'}).setChecked(dark);
    for(const [route,label] of [['Investigation','View task and work'],['Work & feedback','View task status']]) {
      await nav(page,route);
      const button=page.getByRole('button',{name:label,exact:true});
      await expect(button).toHaveClass(/primary/);
      const bounds=await button.boundingBox();await button.hover();
      expect(await button.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
      expect(await button.boundingBox()).toEqual(bounds);
      await page.screenshot({path:info.outputPath(`${route==='Investigation'?'investigation':'history'}-${dark?'dark':'light'}-glass.png`),fullPage:true,animations:'disabled'});
      await button.click();await expect(page.getByRole('heading',{name:'Your targeted task',exact:true})).toBeVisible();
    }
  }
});

test('gold card effects preserve actions, respect theme and stop for reduced motion',async({page},info)=>{
  await page.goto('/');
  const coverage=page.getByRole('region',{name:'Evidence coverage overview'});
  await coverage.hover({position:{x:100,y:65}});
  await expect(coverage).toHaveAttribute('data-spot-active','true');
  expect(await coverage.evaluate(el=>getComputedStyle(el,'::before').pointerEvents)).toBe('none');
  const darkGlow=await coverage.evaluate(el=>getComputedStyle(el).getPropertyValue('--interaction-glow'));
  const queue=page.getByRole('region',{name:'Review action queue'}), trail=queue.locator('.eb-star-trail');
  await expect(trail).toHaveAttribute('aria-hidden','true');await expect(trail).toHaveCSS('pointer-events','none');
  expect(await trail.evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('eb-gold-perimeter');
  const before=await queue.boundingBox();await queue.hover({position:{x:1,y:20}});expect(await queue.boundingBox()).toEqual(before);
  await coverage.hover({position:{x:100,y:65}});await page.screenshot({path:info.outputPath('gold-interactions-hr-dark.png'),fullPage:true});
  await page.getByRole('switch',{name:'Night mode'}).uncheck();
  expect(await coverage.evaluate(el=>getComputedStyle(el).getPropertyValue('--interaction-glow'))).not.toBe(darkGlow);
  await coverage.hover({position:{x:100,y:65}});await page.screenshot({path:info.outputPath('gold-interactions-hr-light.png'),fullPage:true});
  await page.getByRole('button',{name:'Inspect coverage for Alex Chen'}).click();
  await expect(page.getByRole('navigation',{name:'Evidence criteria'})).toBeVisible();
  await nav(page,'Compare candidates');await page.getByRole('button',{name:'Review queue: Maya Patel'}).click();
  await expect(page.getByRole('navigation',{name:'Evidence criteria'})).toBeVisible();
  await page.goto('http://127.0.0.1:5673');
  const materials=page.locator('.r5-two>.eb-spotlight');await materials.hover();
  await materials.getByRole('button').first().click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.mouse.move(0,0);await page.emulateMedia({reducedMotion:'reduce'});await materials.hover();
  expect(await materials.evaluate(el=>getComputedStyle(el,'::before').display)).toBe('none');
  expect(await page.locator('.eb-star-trail').evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('none');
  expect(await materials.evaluate(el=>el.style.getPropertyValue('--spot-x'))).toBe('');
  await page.screenshot({path:info.outputPath('gold-interactions-candidate-reduced.png'),fullPage:true});
  await page.getByRole('button',{name:'View task status'}).click();await expect(page.getByRole('heading',{name:'Your targeted task'})).toBeVisible();
  await expect(page.locator('.eb-click-spark,.eb-spark-burst')).toHaveCount(0);
});

test('GlideSelect supports keyboard, drag, escape and outside dismissal without reopening',async({page})=>{
  await page.goto('/');
  const select=page.getByRole('combobox',{name:'Compare sort',exact:true});
  await select.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('End');await page.keyboard.press('Enter');
  await expect(select).toHaveText('Business Problem Solving · complete skill only');
  await expect(select).toHaveAttribute('aria-expanded','false');await expect(select).toBeFocused();
  await select.click();await page.keyboard.press('Home');await page.keyboard.press('Escape');
  await expect(select).toHaveAttribute('aria-expanded','false');await expect(select).toHaveText('Business Problem Solving · complete skill only');
  await select.click();const menu=page.getByRole('listbox',{name:'Compare sort',exact:true});
  const first=await menu.locator('[data-value="default"]').boundingBox();
  const sql=await menu.locator('[data-value="SQL"]').boundingBox();
  await page.mouse.move(first!.x+20,first!.y+20);await page.mouse.down();await page.mouse.move(sql!.x+20,sql!.y+20,{steps:5});await page.mouse.up();
  await expect(select).toHaveText('SQL · complete skill only');await expect(select).toHaveAttribute('aria-expanded','false');
  await select.click();await page.getByRole('heading',{name:'Application evidence comparison',exact:true}).click();await expect(select).toHaveAttribute('aria-expanded','false');
  await select.click();await page.keyboard.press('Tab');await expect(select).toHaveAttribute('aria-expanded','false');
});

test('metallic button has a stable hover hit area; background never intercepts clicks',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Open Alex Chen'}).click();
  const button=page.getByRole('button',{name:'Edit human assessment draft',exact:true});
  await button.scrollIntoViewIfNeeded();const before=await button.boundingBox();
  await expect(page.locator('.eb-gold-backdrop')).toHaveCSS('pointer-events','none');
  // Hold one pixel inside the edge: moving/scale-on-hover buttons otherwise oscillate here.
  await page.mouse.move(before!.x+1,before!.y+before!.height/2);
  const samples=await button.evaluate(async el=>{
    const values=[];
    for(let i=0;i<20;i++){await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect(),s=getComputedStyle(el);values.push({x:r.x,y:r.y,w:r.width,h:r.height,hover:el.matches(':hover'),background:s.backgroundImage,animation:s.animationName});}
    return values;
  });
  for(const sample of samples){expect(sample.hover).toBe(true);expect(sample.background).toContain('linear-gradient');expect(sample.animation).toBe('none');expect(sample.x).toBe(before!.x);expect(sample.y).toBe(before!.y);expect(sample.w).toBe(before!.width);expect(sample.h).toBe(before!.height);}
  expect(new Set(samples.map(s=>s.background)).size).toBe(1);
  await page.mouse.click(before!.x+1,before!.y+before!.height/2);await expect(page.getByRole('dialog')).toBeVisible();
});

test('touch select fits the viewport, reduced motion and queue hiding preserve evidence',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto('http://127.0.0.1:5686');
  await page.getByRole('button',{name:'Hide reminder for Alex Chen'}).tap();
  await expect(page.getByRole('button',{name:'Review queue: Alex Chen'})).toHaveCount(0);
  await expect(page.locator('tr[data-candidate="preview-alex"]')).toHaveCount(1);
  await page.getByRole('button',{name:'Restore hidden reminders'}).tap();await expect(page.getByRole('button',{name:'Review queue: Alex Chen'})).toBeVisible();
  const control=page.getByRole('combobox',{name:'Preview role',exact:true});await control.tap();
  const menu=page.getByRole('listbox',{name:'Preview role',exact:true});const box=await menu.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);expect(box!.y+box!.height).toBeLessThanOrEqual(844);
  await expect(menu.locator('.eb-glide-pill')).toHaveCSS('transition-duration','0s');
  await menu.getByRole('option',{name:'Candidate',exact:true}).tap();await expect(control).toHaveText('Candidate');await expect(control).toHaveAttribute('aria-expanded','false');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await context.close();
});

async function nav(page:Page,label:string){await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:label,exact:true}).click();}
async function role(page:Page,value:'hr'|'candidate'){await choose(page,'Preview role',value);}
async function task(page:Page,name:string,skill='BPS'){
  await nav(page,'Targeted tasks');await choose(page,'Current candidate',{label:name});
  await choose(page,'Target skill',skill);await page.getByRole('button',{name:'Send task in preview',exact:true}).click();
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
  await choose(page,'Compare sort','overall');await expect(page.locator('tbody tr').first()).toContainText('Leo Nguyen');
  await choose(page,'Compare sort','SQL');await expect(page.locator('tbody tr').first()).toContainText('Sam Rivera');await expect(page.getByText('Tied on selected skill',{exact:true})).toHaveCount(2);
  await choose(page,'Compare sort','default');await page.getByRole('button',{name:'Preview three-row view'}).click();await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.getByText('Showing 3 / 4 · everyone remains available',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'View all four',exact:true}).click();await expect(page.getByRole('button',{name:'Open Sam Rivera',exact:true})).toBeVisible();expect(calls).toEqual([]);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:info.outputPath('hr-comparison-dark-gold.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('switch',{name:'Night mode'}).uncheck();await page.screenshot({path:info.outputPath('hr-comparison-light-gold.png'),fullPage:true,animations:'disabled'});
});
test('anchored B3, exact emoji quotation and isolated source when switching candidate',async({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:'Open Alex Chen'}).click();
  await expect(page.getByText('2 ÷ 4 × 10 = 5/10 contribution',{exact:true})).toBeVisible();
  await page.locator('.eb-citation').click();await expect(page.locator('.r5-inline-source mark')).toHaveText('😀 Evidence request\nRequest campaign × device and checkout-step data.');await expect(page.locator('.r5-inline-source mark')).toBeInViewport();
  await choose(page,'Current candidate',{label:'Maya Patel'});
  await page.locator('.eb-citation').click();await expect(page.getByRole('region',{name:'Original source text'})).toContainText('Maya Patel');await expect(page.locator('.r5-inline-source mark')).not.toContainText('😀 Evidence request');
  await page.getByRole('button',{name:'View ten assessment standards'}).click();await expect(page.getByRole('dialog').locator('details')).toHaveCount(10);await expect(page.getByRole('dialog')).toContainText('One NE means no overall percentage');await page.keyboard.press('Escape');
  await page.getByRole('switch',{name:'Night mode'}).check();await page.screenshot({path:info.outputPath('hr-evidence-dark.png'),fullPage:true,animations:'disabled'});
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
    await nav(page,'Evidence & marks');await choose(page,'Assessment stage','task_v2');await expect(page.getByRole('navigation',{name:'Evidence criteria'}).getByText(/^Not assessed ·/)).toHaveCount(skill==='BPS'?4:3);await expect(page.getByText(/V2 has no inherited score/)).toBeVisible();
    await role(page,'candidate');await expect(page.getByText(`${name}: bounded task evidence confirmed.`,{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Start V3|Start V2|Copy V1/})).toHaveCount(0);
    await nav(page,'Work & feedback');await page.getByLabel('Submission version').selectOption('1');await expect(page.getByText(`${name}: explain one discriminating comparison.`,{exact:true})).toBeVisible();
    if(name==='Maya Patel')await page.screenshot({path:info.outputPath('maya-sql-history.png'),fullPage:true,animations:'disabled'});
  });
}
test('in-flight send stays with its candidate; drafts isolate by identity and survive reload',async({page})=>{
  await page.goto('/');await nav(page,'Targeted tasks');await page.getByRole('button',{name:'Send task in preview'}).click();await choose(page,'Current candidate',{label:'Maya Patel'});await expect(page.getByRole('button',{name:'Send task in preview'})).toBeEnabled();await page.getByRole('button',{name:'Send task in preview'}).click();await expect(page.getByRole('heading',{name:'Waiting for Maya Patel’s work'})).toBeVisible();
  await role(page,'candidate');await page.getByRole('button',{name:'Start V1 draft'}).click();await page.getByLabel('Executive summary').fill('MAYA DRAFT ONLY');await choose(page,'Current candidate',{label:'Alex Chen'});await expect(page.getByText('MAYA DRAFT ONLY',{exact:true})).toHaveCount(0);await nav(page,'My task');await page.getByRole('button',{name:'Start V1 draft'}).click();await expect(page.getByLabel('Executive summary')).toHaveValue('');
  await page.reload();await role(page,'candidate');await choose(page,'Current candidate',{label:'Maya Patel'});await page.getByRole('button',{name:'Continue V1 draft'}).click();await expect(page.getByLabel('Executive summary')).toHaveValue('MAYA DRAFT ONLY');
});
test('storage failure does not claim a saved shortlist and keeps the entered reason',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Retain Sam Rivera'}).click();await page.getByLabel('Human shortlist reason').fill('KEEP THIS UNSAVED REASON');
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Test storage denied');};});
  await page.getByRole('button',{name:'Save local shortlist decision'}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Test storage denied');await expect(page.getByLabel('Human shortlist reason')).toHaveValue('KEEP THIS UNSAVED REASON');
});
test('candidate entry, company standards, dark sidebar and mobile comparison remain usable',async({page},info)=>{
  await page.goto('http://127.0.0.1:5673');await expect(page.getByRole('heading',{name:'Your application materials'})).toBeVisible();await expect(page.getByRole('combobox',{name:'Preview role',exact:true})).toHaveText('Candidate');await role(page,'hr');await nav(page,'Company & role');await expect(page.getByRole('heading',{name:'HarbourCart Pty Ltd'})).toBeVisible();await expect(page.getByText(/Approximately 25 people/)).toBeVisible();
  await page.getByRole('switch',{name:'Night mode'}).check();await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await expect(page.locator('[data-eb-content]')).toHaveCSS('margin-left','64px');await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();
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
  await page.getByRole('switch',{name:'Night mode'}).uncheck();await page.screenshot({path:info.outputPath('candidate-workspace-light-gold.png'),fullPage:true,animations:'disabled'});await page.getByRole('switch',{name:'Night mode'}).check();
  await page.setViewportSize({width:390,height:844});await expect(page.locator('[data-eb-content]')).toHaveCSS('margin-left','0px');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('candidate-workspace-mobile.png'),fullPage:true,animations:'disabled'});await page.setViewportSize({width:1536,height:1050});
  await page.getByRole('tab',{name:'Private notebook'}).click();await page.getByLabel('Private notes').fill('DO NOT SHARE ROW NOTES');
  await submit(page,1,'A limited observation from the supplied data.');await role(page,'hr');await nav(page,'Targeted tasks');
  await expect(page.locator('.eb-review-grid')).toContainText(`Source row ${row}`);await expect(page.locator('body')).not.toContainText('DO NOT SHARE ROW NOTES');
});
