import {test,expect} from '@playwright/test';
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')));
test('register dropdown shows one trolley, retains scan order and selection through reload, and returns to all',async({page})=>{
 await page.goto('/?workspace=demo#inventory');await page.locator('#collection-register-filter').selectOption('');const before=await stored(page),trolley=before.trolleys[1],expected=before.items.filter(item=>item.trolleyId===trolley.id);
 await page.getByLabel('Trolley inventory',{exact:true}).selectOption(trolley.id);await expect(page.locator('#inventory tbody [data-select-item]')).toHaveCount(expected.length);await expect(page.locator('#inventory-title')).toHaveText(`${trolley.name} inventory`);await expect(page.locator('#search-count')).toHaveText(`Showing ${expected.length} of ${expected.length} items`);
 await expect(page.locator('#inventory tbody .scan-order-cell')).toHaveText(expected.map(item=>String(before.items.findIndex(row=>row.id===item.id)+1)).reverse());await page.locator('[data-sort="serial"]').click();await expect(page.locator('#inventory tbody [data-select-item]')).toHaveCount(expected.length);expect((await stored(page)).items).toEqual(before.items);expect((await stored(page)).activeTrolleyId).toBe(before.activeTrolleyId);expect((await stored(page)).defaults).toEqual(before.defaults);
 await page.reload();await expect(page.getByLabel('Trolley inventory',{exact:true})).toHaveValue(trolley.id);await expect(page.locator('#inventory tbody [data-select-item]')).toHaveCount(expected.length);
 await page.getByLabel('Trolley inventory',{exact:true}).selectOption('');await page.locator('#collection-register-filter').selectOption('');await expect(page.locator('#inventory tbody [data-select-item]')).toHaveCount(before.items.length);
});
test('trolley filter works with search and mobile layout, and clears selections when changing trolley',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?workspace=demo#inventory');await page.locator('#collection-register-filter').selectOption('');const before=await stored(page),trolley=before.trolleys[1];await page.locator('[data-select-item]').first().check();await page.getByLabel('Trolley inventory',{exact:true}).selectOption(trolley.id);await expect(page.locator('[data-select-item]:checked')).toHaveCount(0);
 const item=before.items.find(row=>row.trolleyId===trolley.id);await page.getByLabel('Search collection register').fill(item.serial);await expect(page.locator('#inventory tbody [data-select-item]')).toHaveCount(1);await expect(page.locator('#inventory tbody')).toContainText(item.serial);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('duplicate trolley names remain separately selectable by permanent reference',async({page})=>{
 await page.goto('/?workspace=demo#inventory');await expect.poll(async()=>Boolean(await stored(page))).toBe(true);await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.demo.v1'));state.trolleys[1].name=state.trolleys[0].name;localStorage.setItem('decompro.demo.v1',JSON.stringify(state));});await page.reload();const before=await stored(page);for(const trolley of before.trolleys.slice(0,2)){await page.getByLabel('Trolley inventory',{exact:true}).selectOption(trolley.id);const expected=before.items.filter(row=>row.trolleyId===trolley.id);await expect(page.locator('#inventory tbody [data-select-item]')).toHaveCount(expected.length);await expect(page.locator('#trolley-inventory-banner')).toContainText(trolley.reference);}
});
test('filtering trolleys from the scan station keeps scanning visible and preserves the draft through reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?workspace=demo#station');
 await expect(page.locator('#station')).toBeVisible();await page.locator('#scan').fill('UNSAVED-FILTER-001');await page.locator('#scan').press('Enter');
 const before=await stored(page),trolley=before.trolleys[1],expected=before.items.filter(item=>item.trolleyId===trolley.id);
 await page.getByLabel('Search collection register').fill('no matching record');
 await page.getByLabel('Trolley inventory',{exact:true}).selectOption(trolley.id);
 await expect(page.locator('#station')).toBeVisible();await expect(page.locator('#inventory-title')).toHaveText(`${trolley.name} inventory`);
 await expect(page.locator('#register-filter-help')).toContainText(`New scans still save to ${before.trolleys.find(row=>row.id===before.activeTrolleyId)?.name||'the selected scan trolley'}`);
 await expect(page.locator('#inventory tbody [data-select-item]')).toHaveCount(expected.length);
 await expect(page.getByLabel('Search collection register')).toHaveValue('');
 expect(new URL(page.url()).hash).toBe(`#station/trolley/${trolley.id}`);
 expect((await stored(page)).draft.serial).toBe('UNSAVED-FILTER-001');expect((await stored(page)).activeTrolleyId).toBe(before.activeTrolleyId);
 await page.reload();await expect(page.locator('#station')).toBeVisible();await expect(page.getByLabel('Trolley inventory',{exact:true})).toHaveValue(trolley.id);
 await expect(page.locator('#inventory tbody [data-select-item]')).toHaveCount(expected.length);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.getByLabel('Trolley inventory',{exact:true}).selectOption('');await expect(page.locator('#station')).toBeVisible();
 await expect(page.locator('#register-filter-help')).toBeHidden();expect(new URL(page.url()).hash).toBe('#station');expect((await stored(page)).draft.serial).toBe('UNSAVED-FILTER-001');
});
test('trolley filtering does not interrupt a pending rescan lookup',async({page})=>{
 await page.goto('/?workspace=demo#station');await page.getByLabel('Trolley rescan mode').check();
 await page.locator('#rescan-serial').fill('PENDING-LOOKUP-001');const before=await stored(page),trolley=before.trolleys[1];
 await page.getByLabel('Trolley inventory',{exact:true}).selectOption(trolley.id);
 await expect(page.locator('#station')).toBeVisible();await expect(page.locator('#rescan-serial')).toHaveValue('PENDING-LOOKUP-001');
 await expect(page.getByLabel('Trolley rescan mode')).toBeChecked();
 expect((await stored(page)).activeTrolleyId).toBe(before.activeTrolleyId);
 await page.getByLabel('Trolley inventory',{exact:true}).selectOption('');
 await expect(page.locator('#rescan-serial')).toHaveValue('PENDING-LOOKUP-001');
});
