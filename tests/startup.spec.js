import {test,expect} from '@playwright/test';

for (const failure of ['entry download','download','initialization']) {
  test(`startup recovery preserves browser records after ${failure} failure`,async({page})=>{
    await page.addInitScript(()=>{if(!localStorage.getItem('decompro.recovery-test'))localStorage.setItem('decompro.recovery-test','preserved equipment');});
    const asset=failure==='entry download'?'**/src/bootstrap.js*':'**/src/main.js*';
    await page.route(asset,route=>failure!=='initialization'
      ?route.abort()
      :route.fulfill({contentType:'application/javascript',body:'throw new Error("Workspace initialization test failure");'}));
    await page.goto('/#trolley/test-trolley');
    await expect(page.getByRole('heading',{name:'Your workspace could not open'})).toBeVisible();
    await expect(page.locator('#startup-message')).toContainText('saved records have not been cleared');
    expect(await page.evaluate(()=>localStorage.getItem('decompro.recovery-test'))).toBe('preserved equipment');
    await page.unroute(asset);
    await page.getByRole('button',{name:'Refresh app',exact:true}).click();
    await expect(page.locator('#inventory')).toBeVisible();
    await expect(page.locator('#startup')).toBeHidden();
    expect(new URL(page.url()).searchParams.has('app-refresh')).toBe(true);
    expect(new URL(page.url()).hash).toBe('#trolley/test-trolley');
    expect(await page.evaluate(()=>localStorage.getItem('decompro.recovery-test'))).toBe('preserved equipment');
  });
}

test('startup no longer requires separately downloaded recovery or preference scripts',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/startup-recovery.js*',route=>route.abort());await page.route('**/startup-preference.js*',route=>route.abort());
 await page.goto('/');await expect(page.locator('#station')).toBeVisible();await expect(page.locator('#startup')).toBeHidden();expect(errors).toEqual([]);
});

test('a stalled component download exposes recovery without clearing equipment',async({page})=>{
 await page.clock.install();await page.addInitScript(()=>localStorage.setItem('decompro.recovery-test','preserved equipment'));
 let release;await page.route('**/src/main.js*',async route=>{await new Promise(resolve=>{release=resolve;});await route.continue();});
 await page.goto('/');await expect(page.locator('#startup-refresh-link')).toBeVisible();await page.clock.fastForward('00:16');await expect(page.getByRole('button',{name:'Refresh app',exact:true})).toBeVisible();await expect(page.locator('#startup-message')).toContainText('taking longer');expect(await page.evaluate(()=>localStorage.getItem('decompro.recovery-test'))).toBe('preserved equipment');release();await expect(page.locator('#startup')).toBeHidden();
});
