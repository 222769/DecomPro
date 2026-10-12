import {test,expect} from '@playwright/test';
const rows=page=>page.locator('#inventory tbody tr:not(:has(.empty))');
test('every register heading toggles directions, retains scan numbers, filters and selected items',async({page})=>{
 await page.goto('/?workspace=demo#inventory');await page.locator('#collection-register-filter').selectOption('');const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')));
 const originalNumbers=await page.locator('#inventory tbody .scan-order-cell').allTextContents();expect(originalNumbers[0]).toBe('96');await page.locator('[data-select-item]').first().check();const selected=await page.locator('[data-select-item]:checked').getAttribute('data-select-item');
 for(const key of ['serial','asset','equipment','trolley','technician','date']){
  await page.locator(`[data-sort="${key}"]`).click();await expect(page.locator(`[data-sort-column="${key}"]`)).toHaveAttribute('aria-sort','ascending');await page.locator(`[data-sort="${key}"]`).click();await expect(page.locator(`[data-sort-column="${key}"]`)).toHaveAttribute('aria-sort','descending');await expect(page.locator(`[data-select-item="${selected}"]`)).toBeChecked();
 }
 await page.locator('[data-sort="scan"]').click();await expect(page.locator('#inventory tbody .scan-order-cell').first()).toHaveText('1');await page.locator('[data-sort="scan"]').click();await expect(page.locator('#inventory tbody .scan-order-cell').first()).toHaveText('96');
 await page.getByLabel('Search collection register').fill(before.items[10].serial);await expect(rows(page)).toHaveCount(1);await expect(page.locator('#inventory tbody .scan-order-cell')).toHaveText('11');await page.locator('[data-sort="serial"]').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-sort-column="serial"]')).toHaveAttribute('aria-sort','ascending');
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')));expect(after.items).toEqual(before.items);expect(after.draft).toEqual(before.draft);
});
test('serial and disposal-date rows follow actual natural and chronological order on mobile',async({page})=>{
 await page.goto('/?workspace=demo#inventory');await page.locator('#collection-register-filter').selectOption('');await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.demo.v1'));state.items=state.items.slice(0,3).map((item,index)=>({...item,serial:['S10','S2','S1'][index],date:['2026-01-02','2025-12-31','2026-02-01'][index]}));localStorage.setItem('decompro.demo.v1',JSON.stringify(state));});await page.reload();await page.locator('#collection-register-filter').selectOption('');await page.setViewportSize({width:390,height:844});
 await page.locator('[data-sort="serial"]').click();await expect(rows(page).locator('td:nth-child(4)')).toHaveText(['S1','S2','S10']);await page.locator('[data-sort="serial"]').click();await expect(rows(page).locator('td:nth-child(4)')).toHaveText(['S10','S2','S1']);
 await page.locator('[data-sort="date"]').click();await expect(rows(page).locator('td:nth-child(4)')).toHaveText(['S2','S10','S1']);await expect(rows(page).locator('.scan-order-cell')).toHaveText(['2','1','3']);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
