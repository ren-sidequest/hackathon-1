import { expect, test } from '@playwright/test';

for (const role of ['candidate', 'hr'] as const) {
  const url = role === 'candidate' ? 'http://127.0.0.1:5573' : 'http://127.0.0.1:5586';
  test(`${role}: keyboard theme toggle, collapse, refresh and business-state isolation`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    if (role === 'candidate') {
      await page.getByRole('button', { name: 'Load Demo Application' }).click();
    } else {
      await page.getByRole('button', { name: 'Tasks', exact: true }).click();
      await page.locator('#task-instructions').fill('Preserve this task draft through appearance changes.');
    }
    const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('evidencebridge.ui.'))));
    const toggle = page.getByRole('switch', { name: 'Night mode' });
    await expect(page.locator('.eb-sidebar').getByRole('switch', { name: 'Night mode' })).toHaveCount(1);
    await expect(page.locator('.topbar').getByRole('switch')).toHaveCount(0);
    await expect(toggle).toBeChecked();
    await expect(page.locator('.eb-sidebar')).toHaveCSS('background-color', 'rgb(6, 6, 6)');
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).not.toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.eb-sidebar')).toHaveCSS('background-color', 'rgb(255, 253, 247)');
    await page.keyboard.press('Space');
    await expect(toggle).toBeChecked();
    await expect(page.locator('.eb-sidebar')).toHaveCSS('background-color', 'rgb(6, 6, 6)');
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    await expect(page.locator('[data-eb-content]')).toHaveCSS('margin-left', '64px');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(page.locator('.eb-sidebar')).toHaveCSS('background-color', 'rgb(255, 253, 247)');
    await toggle.click();
    const nav = page.getByRole('navigation', { name: 'Main navigation' }).locator('a,button').first();
    await nav.focus();
    await expect(nav.locator('.eb-nav-tooltip')).toBeVisible();
    await page.reload();
    await expect(toggle).toBeChecked();
    await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible();
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('evidencebridge.ui.'))))).toEqual(before);
    await page.screenshot({ path: info.outputPath(`${role}-dark-collapsed.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    await expect(page.locator('[data-eb-content]')).toHaveCSS('margin-left', '232px');
    await toggle.click();
    await page.screenshot({ path: info.outputPath(`${role}-light.png`), fullPage: true, animations: 'disabled' });
    expect(errors).toEqual([]);
  });

  test(`${role}: mobile drawer focus trap, Escape, navigation and resize`, async ({ page }) => {
    await page.goto(url);
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-eb-content]')).toHaveCSS('margin-left', '0px');
    const menu = page.getByRole('button', { name: 'Open navigation' });
    await menu.click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: role === 'hr' ? 'Demo guide' : 'Help & support', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await drawer.getByRole('switch', { name: 'Night mode' }).uncheck();
    await expect(drawer).toHaveCSS('background-color', 'rgb(255, 253, 247)');
    await drawer.getByRole('switch', { name: 'Night mode' }).check();
    await expect(drawer.getByRole('switch', { name: 'Night mode' })).toBeChecked();
    await expect(drawer).toHaveCSS('background-color', 'rgb(6, 6, 6)');
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();
    await menu.click();
    if (role === 'candidate') await page.getByRole('link', { name: 'My Tasks', exact: true }).click();
    else await page.getByRole('button', { name: 'Tasks', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await menu.click();
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(page.locator('[data-eb-content]')).not.toHaveAttribute('inert');
    await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible();
  });

  test(`${role}: defaults dark irrespective of OS, persists light and syncs same-origin tabs`, async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(url);
    await expect(page.getByRole('switch', { name: 'Night mode' })).toBeChecked();
    const second = await context.newPage();
    await second.goto(url);
    await page.getByRole('switch', { name: 'Night mode' }).uncheck();
    await expect(second.getByRole('switch', { name: 'Night mode' })).not.toBeChecked();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Night mode' })).not.toBeChecked();
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.getByRole('switch', { name: 'Night mode' })).not.toBeChecked();
    await second.getByRole('switch', { name: 'Night mode' }).check();
    await expect(page.getByRole('switch', { name: 'Night mode' })).toBeChecked();
  });

  test(`${role}: appearance stays usable with blocked storage and reduced motion`, async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('storage blocked'); };
      Storage.prototype.setItem = () => { throw new Error('storage blocked'); };
    });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await page.goto(url);
    await page.getByRole('switch', { name: 'Night mode' }).click();
    await expect(page.getByRole('switch', { name: 'Night mode' })).not.toBeChecked();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.getByRole('switch', { name: 'Night mode' })).not.toBeChecked();
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    await expect(page.locator('.eb-theme-thumb')).toHaveCSS('transition-duration', '0s');
    await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible();
  });
}

test('Candidate dark workbench, charts, dialogs and all routes', async ({ page }, info) => {
  await page.goto('http://127.0.0.1:5573');
  await page.getByRole('switch', { name: 'Night mode' }).check();
  await page.getByRole('button', { name: 'Demo controls' }).click();
  await page.getByRole('button', { name: 'Open populated workspace' }).click();
  await expect(page.locator('.recharts-bar-rectangle path')).toHaveCount(15);
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.screenshot({ path: info.outputPath('candidate-dark-workspace.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Edit Paid Search has the sharpest conversion decline' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(43, 45, 47)');
  await page.keyboard.press('Escape');
  for (const route of ['home', 'tasks', 'resources', 'sample', 'status']) {
    await page.goto(`http://127.0.0.1:5573/#${route}`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Night mode' })).toBeChecked();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5573/#workspace');
  await page.screenshot({ path: info.outputPath('candidate-dark-mobile.png'), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('HR dark task → submission → human confirmation preserves the existing workflow', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5586');
  await page.getByRole('switch', { name: 'Night mode' }).check();
  await page.getByRole('button', { name: 'Review targeted task' }).click();
  await page.getByRole('button', { name: 'Confirm & Send to Candidate' }).click();
  await page.getByRole('button', { name: 'Load demo submission' }).click();
  await page.screenshot({ path: info.outputPath('hr-dark-review.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm evidence', exact: true }).click();
  await expect(page.getByText('Verified through targeted task', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Verified through targeted task', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('slider')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const role of ['candidate','hr'] as const) {
  test(`${role}: gold theme text contrast and first-frame default`, async ({page}) => {
    await page.emulateMedia({colorScheme:'light'});
    await page.goto(role==='candidate'?'http://127.0.0.1:5573':'http://127.0.0.1:5586');
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    for (const dark of [true,false]) {
      await page.getByRole('switch',{name:'Night mode'}).setChecked(dark);
      const palette=await page.evaluate(()=>{
        const style=getComputedStyle(document.documentElement);
        return Object.fromEntries(['text-primary','text-secondary','text-muted','text-link','surface','surface-soft','glass-fallback','glass-fill','page-bg','sidebar-bg','accent-soft','accent-fill','on-accent'].map(key=>[key,style.getPropertyValue(`--${key}`).trim()]));
      });
      const luminance=(hex:string)=>{
        const channels=hex.slice(1).match(/../g)!.map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
        return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
      };
      const ratio=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      if(dark) {
        // Separate sidebar / page / content by brightness even without decorative glow.
        expect(luminance(palette['sidebar-bg'])).toBeLessThan(luminance(palette['page-bg']));
        expect(luminance(palette['page-bg'])).toBeLessThan(luminance(palette.surface));
        expect(ratio(palette['sidebar-bg'],palette['page-bg'])).toBeGreaterThan(1.15);
        expect(ratio(palette['page-bg'],palette.surface)).toBeGreaterThan(1.2);
      }
      // Bound glass contrast even over pure white (dark mode) / pure black (light mode).
      const glassStops=[...palette['glass-fill'].matchAll(/rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/g)].map(match=>{
        const alpha=Number(match[4]), backdrop=dark?255:0;
        return '#'+match.slice(1,4).map(value=>Math.round(Number(value)*alpha+backdrop*(1-alpha)).toString(16).padStart(2,'0')).join('');
      });
      expect(glassStops).toHaveLength(2);
      for(const background of [palette.surface,palette['surface-soft'],palette['glass-fallback'],...glassStops])
        for(const foreground of ['text-primary','text-secondary','text-muted','text-link'])expect(ratio(palette[foreground],background),`${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(palette['text-link'],palette['accent-soft'])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(palette['on-accent'],palette['accent-fill'])).toBeGreaterThanOrEqual(4.5);
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content',dark?'#060606':'#fffdf7');
    }
  });
}
