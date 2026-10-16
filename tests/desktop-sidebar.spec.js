import {test,expect} from '@playwright/test';

for(const width of [1100,1440,1800]) {
 test(`desktop side panel closes and restores working space at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:850});
  await page.goto('/?workspace=demo#station');
  const toggle=page.locator('#desktop-sidebar-toggle');
  const sidebar=page.locator('#workspace-sidebar');
  const main=page.locator('main#overview');
  await expect(toggle).toHaveAttribute('aria-label','Close side panel');
  const initialLeft=await main.evaluate(node=>node.getBoundingClientRect().left);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-label','Open side panel');
  await expect(sidebar).toBeHidden();
  await expect.poll(()=>main.evaluate(node=>node.getBoundingClientRect().left)).toBe(0);
  expect(initialLeft).toBeGreaterThan(0);
  await expect(page.locator('#station')).toBeVisible();
  await expect(toggle).toBeVisible();
  await page.locator('#voice').click();
  await expect(page.locator('#desktop-sidebar-toggle')).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#workspace-sidebar')).toBeHidden();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(sidebar).toBeHidden();
  await toggle.click();
  await expect(sidebar).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await sidebar.locator('a[href="#inventory"]').click();
  await expect(main).toHaveAttribute('data-view','inventory');
 });
}

test('phone navigation stays available after collapsing the desktop panel',async({page})=>{
 await page.setViewportSize({width:1100,height:850});
 await page.goto('/?workspace=demo#station');
 await page.locator('#desktop-sidebar-toggle').click();
 await page.setViewportSize({width:402,height:874});
 await expect(page.locator('#desktop-sidebar-toggle')).toBeHidden();
 await expect(page.locator('#workspace-sidebar')).toBeVisible();
 await expect(page.locator('#workspace-sidebar .app-nav > a[href="#station"]')).toBeVisible();
 await page.locator('#mobile-nav-toggle').click();
 await expect(page.locator('#manage-trolleys')).toBeVisible();
});
