import {test,expect} from '@playwright/test';

for(const width of [320,375,402,430]) {
 test(`phone navigation and register fit a ${width}px viewport`,async({page})=>{
  await page.setViewportSize({width,height:874});
  await page.goto('/?workspace=demo#station');
  await expect(page.locator('#station')).toBeVisible();
  await expect(page.locator('.app-nav > a[href="#station"]')).toBeVisible();
  await expect(page.locator('#mobile-nav-toggle')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.locator('#scan').fill('MOBILE-UNSAVED');
  await page.locator('#mobile-nav-toggle').click();
  await expect(page.locator('#mobile-nav-toggle')).toHaveAttribute('aria-expanded','true');
  await page.locator('#manage-trolleys').click();
  await expect(page.locator('#trolley-manager')).toBeVisible();
  expect(await page.locator('#trolley-manager').evaluate(el=>el.getBoundingClientRect().width)).toBeLessThanOrEqual(width-20);
  await page.locator('#trolley-manager').press('Escape');
  await page.locator('.app-nav > a[href="#inventory"]').click();
  await expect(page.locator('#inventory')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.locator('.app-nav > a[href="#station"]').click();
  await expect(page.locator('#scan')).toHaveValue('MOBILE-UNSAVED');
 });
}

test('More menu exposes secondary sections and closes after navigation',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.goto('/?workspace=demo#station');
 await expect(page.locator('.mobile-nav-extra')).toBeHidden();
 await page.locator('#mobile-nav-toggle').click();
 await expect(page.locator('#manage-trolleys')).toBeVisible();
 await expect(page.locator('#settings')).toBeVisible();
 await page.locator('aside a[href="#collection-history"]').click();
 await expect(page.locator('main')).toHaveAttribute('data-view','collection-history');
 await expect(page.locator('.mobile-nav-extra')).toBeHidden();
 await expect(page.locator('#mobile-nav-toggle')).toHaveAttribute('aria-expanded','false');
});
