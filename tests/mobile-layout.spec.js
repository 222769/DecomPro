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

test('iPhone-width collection cards keep actions aligned without overflow in dark mode',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.goto('/?workspace=demo#collections');
 await page.locator('.collection-session-card').first().waitFor();
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 const headerButton=page.getByRole('button',{name:'Create collection',exact:true});
 expect(await headerButton.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(65);
 const card=page.locator('.collection-session-card').first();
 const bounds=await card.evaluate(el=>{const card=el.getBoundingClientRect();return [...el.querySelectorAll('button')].map(button=>{const box=button.getBoundingClientRect();return {left:box.left,right:box.right,cardLeft:card.left,cardRight:card.right};});});
 for(const box of bounds){expect(box.left).toBeGreaterThanOrEqual(box.cardLeft);expect(box.right).toBeLessThanOrEqual(box.cardRight);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(402);
 await page.locator('.app-nav > a[href="#overview"]').click();
 await expect(page.locator('.stats > div')).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(402);
});

test('connected database indicator glows without an outer green panel in dark mode',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.goto('/#station');
 await page.locator('#connection-status').waitFor();
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';const status=document.querySelector('#connection-status');status.classList.add('connected','compact-connection');status.innerHTML='<span class="connection-chip">Database connected<i></i></span>';});
 const status=page.locator('#connection-status');
 await expect.poll(()=>status.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 const shadow=await status.locator('.connection-chip').evaluate(node=>getComputedStyle(node).boxShadow);
 expect(shadow).toContain('rgba(78, 228, 187');
});
