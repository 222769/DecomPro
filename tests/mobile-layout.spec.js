import {test,expect} from '@playwright/test';
import {openMobileMore,openMobileSection} from './helpers/mobile-nav.js';

for(const width of [320,375,402,430]) {
 test(`phone navigation and register fit a ${width}px viewport`,async({page})=>{
  await page.setViewportSize({width,height:874});
  await page.goto('/?workspace=demo#station');
  await expect(page.locator('#station')).toBeVisible();
  await expect(page.locator('.app-nav > a[href="#station"]')).toBeVisible();
  await expect(page.locator('#mobile-nav-toggle')).toBeVisible();
  const date=page.locator('#default-date');
  const dateBounds=await date.evaluate(input=>{const field=input.getBoundingClientRect(),card=input.closest('.defaults').getBoundingClientRect(),next=document.querySelector('#default-description').getBoundingClientRect();return {fieldLeft:field.left,fieldRight:field.right,cardLeft:card.left,cardRight:card.right,nextRight:next.right,textAlign:getComputedStyle(input).textAlign};});
  expect(dateBounds.fieldLeft).toBeGreaterThan(dateBounds.cardLeft);
  expect(dateBounds.fieldRight).toBeLessThan(dateBounds.cardRight);
  expect(Math.abs(dateBounds.fieldRight-dateBounds.nextRight)).toBeLessThan(1);
  expect(dateBounds.textAlign).toBe('left');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.locator('#scan').fill('MOBILE-UNSAVED');
  await openMobileMore(page);
  await expect(page.locator('#mobile-nav-toggle')).toHaveAttribute('aria-expanded','true');
  await page.locator('#manage-trolleys').click();
  await expect(page.locator('#trolley-manager')).toBeVisible();
  expect(await page.locator('#trolley-manager').evaluate(el=>el.getBoundingClientRect().width)).toBeLessThanOrEqual(width-20);
  await page.locator('#trolley-manager').press('Escape');
  await openMobileSection(page,'#inventory');
  await expect(page.locator('#inventory')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await openMobileSection(page,'#station');
  await expect(page.locator('#scan')).toHaveValue('MOBILE-UNSAVED');
 });
}

test('More menu exposes secondary sections and closes after navigation',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.goto('/?workspace=demo#station');
 await expect(page.locator('#mobile-nav-toggle')).toBeVisible();
 const scan=page.locator('.app-nav > a[href="#station"]');
 const more=page.locator('#mobile-nav-toggle');
 const background=locator=>locator.evaluate(element=>getComputedStyle(element).backgroundImage);
 const color=locator=>locator.evaluate(element=>getComputedStyle(element).backgroundColor);
 await page.evaluate(()=>document.documentElement.dataset.theme='light');
 await expect.poll(()=>color(scan)).toBe('rgb(43, 65, 102)');
 await more.click();
 await expect.poll(()=>color(more)).toBe('rgb(43, 65, 102)');
 await expect.poll(()=>color(scan)).toBe('rgba(0, 0, 0, 0)');
 await more.click();
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await expect(page.locator('.mobile-nav-extra')).toBeHidden();
 await expect.poll(()=>background(scan)).toContain('gradient');
 await expect.poll(()=>background(more)).toBe('none');
 await more.click();
 await expect.poll(()=>background(more)).toContain('gradient');
 await expect.poll(()=>background(scan)).toBe('none');
 await expect(page.locator('#manage-trolleys')).toBeVisible();
 await expect(page.locator('#settings')).toBeVisible();
 await more.click();
 await expect.poll(()=>background(scan)).toContain('gradient');
 await expect.poll(()=>background(more)).toBe('none');
 await more.click();
 await page.locator('aside a[href="#collection-history"]').click();
 await expect(page.locator('main')).toHaveAttribute('data-view','collection-history');
 await expect(page.locator('.mobile-nav-extra')).toBeHidden();
 await expect(more).toHaveAttribute('aria-expanded','false');
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

test('mobile bottom dock stays available while scrolling and navigating, then yields at the page top',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.goto('/?workspace=demo#inventory');
 await page.locator('#inventory').waitFor();
 await page.mouse.wheel(0,650);
 await expect(page.locator('body')).toHaveClass(/nav-condensed/);
 await expect(page.locator('aside')).toBeHidden();
 await expect(page.locator('#scroll-dock')).toBeVisible();
 await expect(page.locator('#scroll-dock a[href="#inventory"]')).toHaveAttribute('aria-current','page');
 const dockBounds=await page.locator('#scroll-dock').boundingBox();
 expect(dockBounds.y).toBeGreaterThan(740);
 expect(dockBounds.y+dockBounds.height).toBeLessThan(874);
 await expect(page.locator('body')).toHaveClass(/nav-dock-minimized/,{timeout:5000});
 await expect.poll(async()=>(await page.locator('#scroll-dock').boundingBox()).width).toBeLessThan(80);
 await expect(page.locator('#scroll-dock a[href="#inventory"]')).toBeHidden();
 await page.locator('#scroll-dock-more').click();
 await expect(page.locator('body')).not.toHaveClass(/nav-dock-minimized/);
 await expect(page.locator('#scroll-dock a[href="#inventory"]')).toBeVisible();
 await page.locator('#scroll-dock a[href="#station"]').click();
 await expect(page.locator('main')).toHaveAttribute('data-view','station');
 await page.waitForTimeout(1400);
 await expect(page.locator('aside')).toBeHidden();
 await expect(page.locator('#scroll-dock')).toBeVisible();
 await expect(page.locator('body')).toHaveClass(/nav-dock-minimized/,{timeout:5000});
 await page.locator('#scroll-dock-more').click();
 await page.locator('#scroll-dock a[href="#overview"]').click();
 await expect(page.locator('main')).toHaveAttribute('data-view','overview');
 await expect(page.locator('aside')).toBeHidden();
 await page.locator('#scroll-dock a[href="#inventory"]').click();
 await expect(page.locator('main')).toHaveAttribute('data-view','inventory');
 await expect(page.locator('aside')).toBeHidden();
 await expect(page.locator('body')).toHaveClass(/nav-dock-minimized/,{timeout:5000});
 await page.mouse.wheel(0,-180);
 await expect(page.locator('body')).toHaveClass(/nav-condensed/);
 await expect(page.locator('body')).toHaveClass(/nav-dock-minimized/);
 await expect(page.locator('#scroll-dock')).toBeVisible();
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await expect(page.locator('body')).not.toHaveClass(/nav-condensed/);
 await expect(page.locator('aside')).toBeVisible();
 await page.mouse.wheel(0,300);
 await expect(page.locator('#scroll-dock')).toBeVisible();
 await page.locator('#scroll-dock-more').click();
 await expect(page.locator('.mobile-nav-extra')).toBeVisible();
 await expect(page.locator('#mobile-nav-toggle')).toHaveAttribute('aria-expanded','true');
 await page.locator('aside a[href="#station"]').click();
 await expect(page.locator('#station')).toBeVisible();
});
