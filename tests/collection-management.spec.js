import {test,expect} from '@playwright/test';

const state=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')));
const currentCard=page=>page.locator('.collection-session-card').filter({hasText:'TEST Current collection'});

test('mobile management renames a collection without changing its equipment or trolley assignments',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?workspace=demo#collections');
 await expect(currentCard(page)).toBeVisible();
 const before=await state(page);
 await currentCard(page).getByRole('button',{name:'Manage collection trolleys'}).click();
 const dialog=page.locator('#collection-session-dialog');
 await expect(dialog.getByRole('heading',{name:'Manage collection',exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Delete collection'})).toBeVisible();
 await dialog.getByLabel('Collection name').fill('November collection');
 await dialog.getByRole('button',{name:'Save collection changes'}).click();
 await expect(page.locator('.collection-session-card').filter({hasText:'November collection'})).toBeVisible();
 const after=await state(page);
 expect(after.collectionSessions.find(row=>row.id===before.activeCollectionId).name).toBe('November collection');
 expect(after.items).toEqual(before.items);
 const assignments=rows=>rows.map(row=>`${row.trolleyId}:${row.sessionId}`).sort();
 expect(assignments(after.collectionTrolleys)).toEqual(assignments(before.collectionTrolleys));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('delete in collection management opens the existing typed confirmation',async({page})=>{
 await page.goto('/?workspace=demo#collections');
 await expect(currentCard(page)).toBeVisible();
 const before=await state(page);
 await currentCard(page).getByRole('button',{name:'Manage collection trolleys'}).click();
 await page.locator('#collection-manage-delete').click();
 await expect(page.locator('#confirm-delete-collection')).toBeDisabled();
 await page.getByLabel('Type DELETE to confirm').fill('DELETE');
 await page.locator('#delete-collection-understood').check();
 await page.locator('#confirm-delete-collection').click();
 await expect(currentCard(page)).toHaveCount(0);
 const after=await state(page);
 expect(after.collectionSessions).toHaveLength(before.collectionSessions.length-1);
 expect(after.items).toEqual(before.items);
 expect(after.trolleys).toEqual(before.trolleys);
});

test('management links open this collection inventory and trolley review',async({page})=>{
 await page.goto('/?workspace=demo#collections');
 await currentCard(page).getByRole('button',{name:'Manage collection trolleys'}).click();
 await page.locator('#collection-manage-inventory').click();
 await expect(page.locator('main')).toHaveAttribute('data-view','inventory');
 await expect(page.locator('#inventory tbody tr')).toHaveCount(72);
 await page.locator('aside a[href="#collections"]').click();
 await currentCard(page).getByRole('button',{name:'Manage collection trolleys'}).click();
 await page.locator('#collection-manage-review').click();
 await expect(page.locator('main')).toHaveAttribute('data-view','collection-review');
 await expect(page.locator('#collection-review')).toBeVisible();
});
