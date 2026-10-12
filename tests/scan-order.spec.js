import {test,expect} from '@playwright/test';

test('saved items show their recording order with newest first and retain numbers through search and reload',async({page})=>{
 await page.goto('/#station');await page.getByLabel('Manufacturer',{exact:true}).fill('Manual maker');
 for(let i=1;i<=3;i++){
  for(const value of [`ORDER-${i}`,'N/A','N/A','N/A',`A000${i}`]){await page.locator('#scan').fill(value);await page.locator('#scan').press('Enter');}
  await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(i);
 }
 await page.getByRole('link',{name:/Collection register/}).click();await expect(page.getByRole('columnheader',{name:'No.',exact:true})).toBeVisible();await expect(page.locator('#inventory tbody .scan-order-cell')).toHaveText(['3','2','1']);
 await page.getByLabel('Search collection register').fill('ORDER-2');await expect(page.locator('#inventory tbody .scan-order-cell')).toHaveText(['2']);await expect(page.locator('#inventory tbody')).toContainText('ORDER-2');
 await page.reload();await expect(page.locator('#inventory tbody .scan-order-cell')).toHaveText(['3','2','1']);await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.getByLabel('Search collection register').fill('NO-MATCH');await expect(page.locator('#inventory tbody .empty')).toHaveAttribute('colspan','9');
});

test('collection and trolley filters preserve workspace scan order numbers',async({page})=>{
 await page.goto('/?workspace=demo#inventory');await expect(page.locator('.test-workspace-banner')).toBeVisible();const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')));
 await expect(page.locator('#inventory tbody .scan-order-cell').first()).toHaveText('72');await page.locator('#collection-register-filter').selectOption('');await expect(page.locator('#inventory tbody .scan-order-cell').first()).toHaveText('96');
 await page.evaluate(id=>location.hash='trolley/'+id,state.trolleys[1].id);await expect(page.locator('#inventory tbody .scan-order-cell')).toHaveText(Array.from({length:12},(_,i)=>String(24-i)));
});
