import {test,expect} from '@playwright/test';

for (const failure of ['entry download','download','initialization']) {
  test(`startup recovery preserves browser records after ${failure} failure`,async({page})=>{
    await page.addInitScript(()=>{if(!localStorage.getItem('decompro.recovery-test'))localStorage.setItem('decompro.recovery-test','preserved equipment');});
    const asset=failure==='entry download'?'**/src/bootstrap.js':'**/src/main.js';
    await page.route(asset,route=>failure!=='initialization'
      ?route.abort()
      :route.fulfill({contentType:'application/javascript',body:'throw new Error("Workspace initialization test failure");'}));
    await page.goto('/#trolley/test-trolley');
    await expect(page.getByRole('heading',{name:'Your workspace could not open'})).toBeVisible();
    await expect(page.locator('#startup-message')).toContainText('saved records have not been cleared');
    expect(await page.evaluate(()=>localStorage.getItem('decompro.recovery-test'))).toBe('preserved equipment');
    await page.unroute(asset);
    await page.getByRole('button',{name:'Refresh app',exact:true}).click();
    await expect(page.locator('#station')).toBeVisible();
    await expect(page.locator('#startup')).toBeHidden();
    expect(new URL(page.url()).searchParams.has('app-refresh')).toBe(true);
    expect(new URL(page.url()).hash).toBe('#trolley/test-trolley');
    expect(await page.evaluate(()=>localStorage.getItem('decompro.recovery-test'))).toBe('preserved equipment');
  });
}
