import {configureBatch} from './helpers/batch.js';
import {test,expect} from '@playwright/test';
async function scan(page,value){await page.locator('#scan').fill(value);await page.locator('#scan').press('Enter');}
async function complete(page,serial='QA-PENDING-001'){await page.goto('/');await configureBatch(page);for(const value of [serial,'Model One','0000123','N/A','A0001'])await scan(page,value);}
async function slowDatabase(page){const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'application/javascript',body:`export async function connectFirebase(){return {uid:'stress',profile:{name:'Jawad',code:'JA'},role:'technician',email:'qa@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,phase){phase('connected')},async load(){return {items:[],trolleys:${JSON.stringify(state.trolleys)},examples:[],corrections:[]}},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]}},async write(item){window.qaWrites=(window.qaWrites||0)+1;window.qaSent=item;await new Promise((resolve,reject)=>{window.qaResolve=resolve;window.qaReject=()=>reject(Error('QA connection interrupted'))})},async logout(){}}}` }));await page.getByRole('button',{name:'Shared database',exact:true}).click();await page.getByLabel('Team account email').fill('qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('qa-only');await page.getByRole('button',{name:'Sign in & connect'}).click();}

test('editing a field during a pending save cannot discard the newer scan values',async({page})=>{
 await complete(page);await slowDatabase(page);await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>window.qaWrites)).toBe(1);
 await page.locator('#back').click();await scan(page,'A0002');await page.evaluate(()=>window.qaResolve());
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(1);
 const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(result.items[0].asset).toBe('A0001');expect(result.draft.asset).toBe('A0002');expect(result.step).toBe(5);await expect(page.locator('#save-feedback')).toContainText('newer scan changes');
});

test('oversized serial input is rejected before it can corrupt the persisted draft',async({page})=>{
 await page.goto('/');await scan(page,'X'.repeat(1001));
 await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')||'{}').draft?.serial)).toBeUndefined();
 await scan(page,'QA-LENGTH-RECOVERY');await page.reload();await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
});

test('back and forth corrections, leading zeroes, text symbols, repeated clicks and N/A serials preserve exact records',async({page})=>{
 await page.goto('/');await configureBatch(page);
 const expected=[];
 for(let i=0;i<6;i++){
  const serial=i<4?`QA-STRESS-${i}`:'N/A',model=`Model <>& ${i}`,barcode=`00000${i}`,asset=`A000${i}`;
  await scan(page,serial);await page.locator('[data-step="1"]').click();for(const value of [model,barcode,'N/A',asset])await scan(page,value);
  await page.locator('#back').click();await scan(page,'BAD-ASSET');await expect(page.getByRole('heading',{name:'Asset number',exact:true})).toBeVisible();await scan(page,asset.toLowerCase());
  await page.locator('[data-step="1"]').click();for(const value of [model+' revised',barcode,'N/A',asset])await scan(page,value);
  const confirmation=page.getByLabel('I checked the suggested model and manufacturer');if(await confirmation.count())await confirmation.check();
  await page.locator('#save').evaluate(button=>{button.click();button.click();});await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(i+1);
  expected.push({serial,model:model+' revised',barcode,asset});
 }
 await page.reload();const actual=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.map(({serial,model,barcode,asset})=>({serial,model,barcode,asset})));expect(actual).toEqual(expected);expect(await page.locator('#station img').count()).toBe(0);
});

test('server rejection preserves the review and a retry submits exactly once and saves one record',async({page})=>{
 await complete(page,'QA-RETRY-001');await slowDatabase(page);await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>window.qaWrites)).toBe(1);await page.evaluate(()=>window.qaReject());await expect(page.locator('#save-feedback')).toContainText('connection interrupted');await expect(page.locator('#save')).toBeEnabled();
 await page.locator('#save').evaluate(button=>{button.click();button.click();});await expect.poll(()=>page.evaluate(()=>window.qaWrites)).toBe(2);await page.evaluate(()=>window.qaResolve());await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(1);
});

test('clearing a required disposal date and refreshing preserves the review so a corrected leap-day date can save',async({page})=>{
 await complete(page,'QA-DATE-001');await page.getByLabel('Disposal date',{exact:true}).fill('');await page.locator('#save').click();await expect(page.locator('#save-feedback')).toContainText('disposal date');
 await page.reload();await expect(page.getByRole('heading',{name:'Review this equipment',exact:true})).toBeVisible();await page.getByLabel('Disposal date',{exact:true}).fill('2024-02-29');await page.locator('#save').click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items[0].date)).toBe('2024-02-29');
});

test('changing batch defaults during confirmation preserves the next batch without rewriting the saved item',async({page})=>{
 await complete(page,'QA-DEFAULTS-001');await slowDatabase(page);await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>window.qaWrites)).toBe(1);await page.getByLabel('Manufacturer',{exact:true}).fill('Lenovo');await page.evaluate(()=>window.qaResolve());await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(state.items[0].manufacturer).toBe('Dell');expect(state.defaults.manufacturer).toBe('Lenovo');await expect(page.getByLabel('Manufacturer',{exact:true})).toHaveValue('Lenovo');
});

test('phone navigation can move between overview, scan and register repeatedly without losing scan values',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await scan(page,'QA-PHONE-UNFINISHED');
 for(let i=0;i<3;i++){
  await page.getByRole('link',{name:'Overview',exact:true}).click();await expect(page.locator('#station')).toBeHidden();await page.getByRole('link',{name:'Scan station',exact:true}).click();await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();await page.getByRole('link',{name:/Collection register/}).click();
 }
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('QA-PHONE-UNFINISHED');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
