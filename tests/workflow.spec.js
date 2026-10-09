import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { headers } from '../src/data.js';
import {readFile} from 'node:fs/promises';
async function defaults(page) {
 await page.getByLabel('Manufacturer',{exact:true}).fill('Dell');
 await page.getByRole('button',{name:'Apply batch defaults'}).click();
}
async function scan(page,value) {await page.locator('#scan').fill(value);await page.locator('#scan').press('Enter');}
async function item(page,serial='00001234') {
 await scan(page,serial);
 if(await page.getByRole('heading',{name:'Model number',exact:true}).isVisible())await scan(page,'P2419H');
 await page.locator('#scan').press('Enter');await page.locator('#scan').press('Enter');
 await scan(page,'090011');await scan(page,'A0904');
}
test('asset numbers require A and four digits, normalize case, and permit N/A skips',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'ASSET-001');
 await page.getByRole('button',{name:'Previous field'}).click();
 for(const value of ['1234','B1234','A123','A12345']) {
  await scan(page,value);
  await expect(page.getByRole('heading',{name:'Asset number',exact:true})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('A followed by four digits');
 }
 await scan(page,'a0042');await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.locator('tbody')).toContainText('A0042');
 await page.getByRole('button',{name:'Edit item ASSET-001',exact:true}).click();
 await page.getByLabel('Asset number',{exact:true}).fill('B0042');
 await page.getByRole('button',{name:'Save changes'}).click();
 await expect(page.locator('#edit-error')).toContainText('A followed by four digits');
 await page.getByLabel('Asset number',{exact:true}).fill('a1234');await page.getByRole('button',{name:'Save changes'}).click();
 await expect(page.locator('tbody')).toContainText('A1234');
 await item(page,'ASSET-002');await page.getByRole('button',{name:'Previous field'}).click();
 await page.getByRole('button',{name:'Skip · N/A'}).click();
 await page.getByRole('button',{name:'Save item & start next'}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.at(-1).asset)).toBe('N/A');
});

test('built-in Summer reference recognises TG22681204 without import and keeps ambiguous patterns manual',async({page})=>{
 await page.goto('/');
 await expect(page.getByText('Serial recognition ready')).toBeVisible();
 await scan(page,'tg22681204');
 await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Known serial: 10ET185A · Edgeio');
 await expect(page.getByLabel('Manufacturer for this item')).toHaveValue('Edgeio');
 await page.reload();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.model)).toBe('10ET185A');
 await page.getByRole('button',{name:'Previous field'}).click();await page.getByRole('button',{name:'Previous field'}).click();
 await scan(page,'TG22681024');
 await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Reference data disagrees');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.model)).toBeUndefined();
});

test('10LL family fills Lenovo model for a new suffix and needs technician confirmation',async({page})=>{
 await page.goto('/');await scan(page,'10LLNEW123ABC');
 await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Pattern suggestion (prefix 10LL): TIO24D · Lenovo');
 await expect(page.getByLabel('Manufacturer for this item')).toHaveValue('Lenovo');
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A'}).click();
 await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.locator('#save-feedback')).toContainText('tick the confirmation');
 await page.getByLabel('I checked the suggested model and manufacturer').check();
 await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.locator('tbody')).toContainText('10LLNEW123ABC');
});

test('saving works without crypto.randomUUID and produces distinct persistent IDs',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window.crypto,'randomUUID',{value:undefined,configurable:true}));
 await page.goto('/');await defaults(page);
 for(const serial of ['ID-BROWSER-001','ID-BROWSER-002']) {
  await item(page,serial);await page.getByRole('button',{name:'Save item & start next'}).click();
  await expect(page.locator('tbody')).toContainText(serial);
 }
 const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items);
 expect(new Set(records.map(item=>item.id)).size).toBe(2);
 for(const record of records)expect(record.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 await page.reload();await expect(page.locator('tbody')).toContainText('ID-BROWSER-002');
});

test('empty register is not exported and unsaved scans remain available',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'UNSAVED-EXPORT-001');
 await expect(page.getByRole('button',{name:'Export Excel',exact:true})).toBeDisabled();
 await page.evaluate(()=>document.querySelector('#export').onclick());
 await expect(page.getByRole('status')).toContainText('There are no saved items to export');
 await expect(page.getByRole('heading',{name:'Review this equipment'})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('UNSAVED-EXPORT-001');
});

test('export errors show the cause and reflect records removed while export was starting',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'EXPORT-REMOVED-001');await page.getByRole('button',{name:'Save item & start next'}).click();
 let release,signal;const started=new Promise(resolve=>signal=resolve);
 await page.route('**/exceljs*',async route=>{signal();await new Promise(resolve=>release=resolve);await route.abort();});
 await page.getByRole('button',{name:'Export Excel',exact:true}).click();await started;
 page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete item EXPORT-REMOVED-001',exact:true}).click();
 release();
 await expect(page.getByRole('status')).toContainText('Excel component could not load');
 await expect(page.getByRole('status')).toContainText('There are no saved items in the current workspace');
 await expect(page.getByRole('button',{name:'Export Excel',exact:true})).toBeDisabled();
});

test('trolley management creates labels, barcode inventory views and retained collection history',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'TROLLEY-OLD-001');await page.getByRole('button',{name:'Save item & start next'}).click();
 await page.getByRole('button',{name:'Trolleys',exact:true}).click();
 await page.getByLabel('New trolley name').fill('Helpdesk collection 02');
 await expect(page.getByLabel('Owning department')).toHaveValue('Helpdesk (Calderdale College)');
 await page.getByRole('button',{name:'Create trolley',exact:true}).click();
 const card=page.locator('.trolley-card').filter({hasText:'Helpdesk collection 02'});
 const rows=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).trolleys);
 expect(new Set(rows.map(t=>t.reference)).size).toBe(2);
 const trolley=rows.find(t=>t.name==='Helpdesk collection 02');
 const labelDownload=page.waitForEvent('download');await card.getByRole('button',{name:'PDF label',exact:true}).click();
 const label=await labelDownload;expect(label.suggestedFilename()).toBe(`${trolley.reference}.pdf`);
 const bytes=await readFile(await label.path());expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
 expect(bytes.toString('latin1')).toContain('PROPERTY OF TSU');expect(bytes.toString('latin1')).toContain(trolley.reference);
 await card.getByRole('button',{name:'Use trolley',exact:true}).click();
 await item(page,'TROLLEY-NEW-001');await page.getByRole('button',{name:'Save item & start next'}).click();
 await scan(page,'DRAFT-TO-KEEP');
 await scan(page,trolley.reference);
 await expect(page.locator('#inventory-title')).toHaveText('Helpdesk collection 02 inventory');
 await expect(page.locator('tbody')).toContainText('TROLLEY-NEW-001');await expect(page.locator('tbody')).not.toContainText('TROLLEY-OLD-001');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('DRAFT-TO-KEEP');
 const inventoryDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export Excel',exact:true}).click();
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await (await inventoryDownload).path());expect(workbook.getWorksheet('Sheet1').rowCount).toBe(2);
 await page.getByRole('button',{name:'Trolleys',exact:true}).click();
 await card.getByRole('button',{name:'Mark collected',exact:true}).click();
 await page.getByLabel('Decommission company').fill('Collection test company');await page.getByRole('button',{name:'Confirm collection',exact:true}).click();
 await page.reload();await expect(page.locator('#trolley-inventory-banner')).toContainText('Collected by Collection test company');
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
 expect(restored.trolleys.find(t=>t.id===trolley.id).status).toBe('collected');expect(restored.items).toHaveLength(2);
 await page.getByLabel('Caged trolley').fill('Helpdesk collection 02');
 await scan(page,'Test model');for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A'}).click();
 await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.locator('#save-feedback')).toContainText('collected');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(2);
});

test('save uses typed batch defaults without requiring a separate Apply click',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Manufacturer',{exact:true}).fill('Dell');
 await item(page,'DIRECT-SAVE-001');
 await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.locator('tbody')).toContainText('DIRECT-SAVE-001');
 await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();
 await page.reload();await expect(page.locator('tbody')).toContainText('DIRECT-SAVE-001');
});

test('missing batch defaults are explained beside Save and the draft is kept',async({page})=>{
 await page.goto('/');await item(page,'MISSING-DEFAULT-001');
 await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.locator('#save-feedback')).toContainText('Enter manufacturer before saving');
 await expect(page.getByLabel('Manufacturer',{exact:true})).toBeFocused();
 await expect(page.getByRole('heading',{name:'Review this equipment'})).toBeVisible();
 await page.getByLabel('Manufacturer',{exact:true}).fill('Dell');
 await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.locator('tbody')).toContainText('MISSING-DEFAULT-001');
});

test('failed local storage write keeps the scanned draft for retry or backup',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'RETAIN-DRAFT-001');
 await page.evaluate(()=>{const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='decompro.v1')throw new DOMException('Full','QuotaExceededError');return setItem.call(this,key,value);};});
 await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.getByRole('heading',{name:'Review this equipment'})).toBeVisible();
 await expect(page.locator('tbody')).not.toContainText('RETAIN-DRAFT-001');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('RETAIN-DRAFT-001');
});

test('scanner, spoken prompts, profiles, persistence and exact Excel mapping',async({page})=>{
 await page.addInitScript(()=>{
  window.prompts=[];
  Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(u){window.prompts.push(u.text)}}});
 });
 await page.goto('/');await defaults(page);
 await page.getByRole('button',{name:'Add technician'}).click();
 await page.getByLabel('Name',{exact:true}).fill('Alex');await page.getByLabel('Disposal initials').fill('AL');
 await page.getByRole('button',{name:'Save profile'}).click();
 await page.getByRole('button',{name:'Start scanning'}).click();
 await item(page);
 await expect(page.getByRole('heading',{name:'Review this equipment'})).toBeVisible();
 expect(await page.evaluate(()=>window.prompts)).toContain('Next, Serial number');
 expect(await page.evaluate(()=>window.prompts)).toContain('Next, Security etch');
 await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.locator('tbody')).toContainText('00001234');
 await page.reload();await expect(page.locator('tbody')).toContainText('00001234');
 await expect(page.locator('#profile')).toHaveValue('AL');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export Excel'}).click();
 const download=await downloaded;const book=new ExcelJS.Workbook();await book.xlsx.readFile(await download.path());
 const sheet=book.getWorksheet('Sheet1');expect(sheet.getRow(1).values.slice(1)).toEqual(headers);
 expect(sheet.columnCount).toBe(11);expect(sheet.autoFilter).toBe('A1:K1');
 expect(sheet.getRow(1).values.filter(value=>value==='Asset Number')).toHaveLength(1);
 expect(sheet.getRow(1).values).not.toContain('Amt To Dispose');
 const row=sheet.getRow(2);expect(row.getCell(3).value).toBe('P2419H');expect(row.getCell(6).value).toBe('00001234');
 expect(row.getCell(7).value).toBe('N/A');expect(row.getCell(8).value).toBe('090011');expect(row.getCell(9).value).toBe('A0904');
 expect(row.getCell(11).value).toBe('AL');expect(row.getCell(1).value).toBeInstanceOf(Date);
 await item(page);await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.getByRole('status')).toContainText('already in the register');expect(await page.locator('tbody tr').count()).toBe(1);
});
test('single empty Enter does not skip; serial survives refresh and can be corrected',async({page})=>{
 await page.goto('/');await page.locator('#scan').press('Enter');
 await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();
 await scan(page,'SERIAL-old');await page.reload();
 await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Previous field'}).click();await expect(page.locator('#scan')).toHaveValue('SERIAL-old');
 await scan(page,'SERIAL-new');await page.getByRole('button',{name:'Skip · N/A'}).click();
 await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft)).toMatchObject({serial:'SERIAL-new',model:'N/A'});
});
test('existing model-first drafts migrate without losing records or captured values',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'EXISTING-001');await page.getByRole('button',{name:'Save item & start next'}).click();
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));delete state.captureOrder;state.settings.serialFirst=false;state.draft={model:'Legacy model'};state.step=1;localStorage.setItem('decompro.v1',JSON.stringify(state));});
 await page.reload();await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();
 await expect(page.locator('tbody')).toContainText('EXISTING-001');
 await scan(page,'LEGACY-001');await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.model)).toBe('Legacy model');
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));delete state.captureOrder;state.draft={serial:'OLD-SERIAL-FIRST'};state.step=0;localStorage.setItem('decompro.v1',JSON.stringify(state));});
 await page.reload();await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 await scan(page,'Manual model');await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
});

test('unavailable data is not silently overwritten',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('decompro.v1','broken'));
 await page.goto('/');await expect(page.getByRole('alert')).toContainText('Storage has been paused');
 await scan(page,'TEST');expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe('broken');
});
test('mobile workflow remains usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await defaults(page);
 await item(page,'MOBILE-001');await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.locator('tbody')).toContainText('MOBILE-001');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('trolley switching and adjustable scanning settings preserve existing records',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'FIRST-001');
 await page.getByRole('button',{name:'Save item & start next'}).click();
 await page.getByRole('button',{name:'Change trolley'}).click();
 await page.getByLabel('Trolley name').fill('Trolley 02');await page.getByRole('button',{name:'Use trolley'}).click();
 await expect(page.locator('tbody')).toContainText('Trolley 01');
 await page.getByRole('button',{name:'Open settings'}).click();
 await page.getByLabel('Use one model for this batch').check();await page.getByLabel('Batch model number').fill('BATCH-MODEL');
 await page.getByLabel('Double-trigger window').selectOption('1500');
 await page.getByRole('button',{name:'Save settings'}).click();
 await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();
 await scan(page,'SECOND-001');await page.locator('#scan').press('Enter');await page.waitForTimeout(800);await page.locator('#scan').press('Enter');
 await expect(page.getByRole('heading',{name:'Security etch',exact:true})).toBeVisible();
 await scan(page,'N/A');await scan(page,'N/A');await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
 expect(state.items.map(i=>i.trolley)).toEqual(['Trolley 01','Trolley 02']);expect(state.items[1].model).toBe('BATCH-MODEL');expect(state.settings.skipWindow).toBe(1500);
 await page.reload();await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Open settings'}).click();await expect(page.getByLabel('Batch model number')).toHaveValue('BATCH-MODEL');
 await page.getByLabel('Use one model for this batch').uncheck();await page.getByRole('button',{name:'Save settings'}).click();
 page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Clear current item'}).click();
 await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();
});

test('search and saved-item editing do not change other records; export includes all items',async({page})=>{
 await page.goto('/');await defaults(page);
 await item(page,'EDIT-001');await page.getByRole('button',{name:'Save item & start next'}).click();
 await item(page,'EDIT-002');await page.getByRole('button',{name:'Save item & start next'}).click();
 await page.getByRole('button',{name:'Edit item EDIT-002',exact:true}).click();
 await page.locator('#edit-serial').fill('EDIT-001');await page.getByRole('button',{name:'Save changes'}).click();
 await expect(page.locator('#edit-error')).toContainText('another item');
 await page.locator('#edit-serial').fill('EDIT-003');await page.locator('#edit-trolley').fill('Cage B');await page.getByRole('button',{name:'Save changes'}).click();
 await page.getByLabel('Search collection register').fill('EDIT-003 Cage');
 await expect(page.locator('#search-count')).toHaveText('Showing 1 of 2 items');await expect(page.locator('tbody')).toContainText('Cage B');await expect(page.locator('tbody')).not.toContainText('EDIT-001');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export Excel'}).click();
 const book=new ExcelJS.Workbook();await book.xlsx.readFile(await (await downloaded).path());
 expect(book.getWorksheet('Sheet1').rowCount).toBe(3);expect(book.getWorksheet('Sheet1').getRow(3).getCell(6).value).toBe('EDIT-003');
 await page.getByLabel('Search collection register').fill('no such equipment');await expect(page.locator('tbody')).toContainText('No equipment matches');
 await page.reload();const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(state.items[0].serial).toBe('EDIT-001');expect(state.items[1].trolley).toBe('Cage B');
});

test('backup restore requires confirmation and retains trolley, settings and captured progress',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'BACKUP-001');await page.getByRole('button',{name:'Save item & start next'}).click();
 await scan(page,'IN-PROGRESS-SERIAL');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Backup',exact:true}).click();const path=await (await downloaded).path();
 await scan(page,'UNBACKED-MODEL');
 await page.locator('#backup-file').setInputFiles(path);
 await expect(page.getByRole('heading',{name:'Restore this backup?'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.model)).toBe('UNBACKED-MODEL');
 await page.locator('#backup-file').setInputFiles(path);await page.getByRole('button',{name:'Replace workspace & restore'}).click();
 await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
 expect(state.draft).toEqual({serial:'IN-PROGRESS-SERIAL'});expect(state.items[0].trolley).toBe('Trolley 01');expect(state.settings.skipWindow).toBe(700);
 const before=await page.evaluate(()=>localStorage.getItem('decompro.v1'));
 await page.locator('#backup-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"app":"DecomPro","version":1,"state":{"items":[]}}')});
 await expect(page.getByRole('status')).toContainText('Backup was not restored');expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(before);
});

test('speech settings affect prompts and can be tested without applying changes',async({page})=>{
 await page.addInitScript(()=>{window.prompts=[];Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(u){window.prompts.push({text:u.text,rate:u.rate,volume:u.volume});}}});});
 await page.goto('/');await page.getByRole('button',{name:'Open settings'}).click();
 await page.getByLabel('Speech speed').fill('1.2');await page.getByLabel('Volume').fill('0.5');
 await page.getByRole('button',{name:'Test voice'}).click();const trial=await page.evaluate(()=>window.prompts.at(-1));expect(trial.text).toBe('Next, serial number.');expect(trial.rate).toBeCloseTo(1.2);expect(trial.volume).toBe(.5);
 await page.getByRole('button',{name:'Save settings'}).click();await page.getByRole('button',{name:'Start scanning'}).click();
 const saved=await page.evaluate(()=>window.prompts.at(-1));expect(saved.text).toBe('Next, Serial number');expect(saved.rate).toBeCloseTo(1.2);expect(saved.volume).toBe(.5);
});

test('browser voice choice persists and falls back when unavailable; late voices preserve settings',async({page})=>{
 await page.addInitScript(()=>{
  window.prompts=[];window.voices=[];window.voiceListeners={};
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class {constructor(text){this.text=text;}}});
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices(){return window.voices;},addEventListener(type,callback){window.voiceListeners[type]=callback;},cancel(){},speak(u){window.prompts.push({text:u.text,voiceURI:u.voice?.voiceURI,lang:u.lang});}}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Open settings'}).click();
 await page.getByLabel('Speech speed').fill('1.3');
 await page.evaluate(()=>{window.voices=[{name:'Google UK English Female',lang:'en-GB',voiceURI:'google-uk',localService:false},{name:'Device English',lang:'en-US',voiceURI:'device-en',localService:true}];window.voiceListeners.voiceschanged();});
 await expect(page.getByLabel('Speech speed')).toHaveValue('1.3');
 await expect(page.locator('#voice-info')).toContainText('Google-labelled voices are available');
 await page.getByLabel('Prompt voice').selectOption('google-uk');await page.getByRole('button',{name:'Test voice'}).click();
 expect(await page.evaluate(()=>window.prompts.at(-1))).toMatchObject({voiceURI:'google-uk',lang:'en-GB'});
 await page.getByRole('button',{name:'Save settings'}).click();await page.reload();
 await page.getByRole('button',{name:'Open settings'}).click();await expect(page.getByLabel('Prompt voice')).toHaveValue('google-uk');
 await expect(page.locator('#voice-info')).toContainText('saved voice is unavailable');
 await page.evaluate(()=>{window.voices=[{name:'Device English',lang:'en-US',voiceURI:'device-en',localService:true}];window.voiceListeners.voiceschanged();});
 await page.getByRole('button',{name:'Test voice'}).click();expect(await page.evaluate(()=>window.prompts.at(-1))).toMatchObject({voiceURI:'device-en',lang:'en-US'});
});

test('spreadsheet training recognises the first serial and keeps manufacturer per item',async({page})=>{
 const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Reference');sheet.addRow(['Serial Number','Model','Manufacturer']);
 for(const serial of ['REF101','REF102','REF103'])sheet.addRow([serial,'Learned model','Learned maker']);
 const buffer=await book.xlsx.writeBuffer();
 await page.goto('/');page.on('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Open settings'}).click();await page.locator('#reference-file').setInputFiles({name:'training.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(buffer)});
 await expect(page.locator('.alert[role="status"]')).toContainText('Imported 3 reference examples');
 await expect(page.locator('#search-count')).toHaveText('Showing 0 of 0 items');
 await scan(page,'REF101');await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Known serial');
 await scan(page,'N/A');await scan(page,'N/A');await scan(page,'N/A');await page.getByRole('button',{name:'Save item & start next'}).click();
 const first=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items[0]);expect(first.model).toBe('Learned model');expect(first.manufacturer).toBe('Learned maker');expect(first.serial).toBe('REF101');
 await scan(page,'REF104');await expect(page.getByRole('status')).toContainText('Pattern suggestion');await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.manufacturer)).toBe('Learned maker');
 await scan(page,'N/A');await scan(page,'N/A');await scan(page,'N/A');await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.getByRole('status')).toContainText('tick the confirmation');
 await page.getByLabel('Manufacturer for this item').fill('Corrected maker');await page.getByLabel('I checked the suggested model and manufacturer').check();await page.getByRole('button',{name:'Save item & start next'}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items[1].manufacturer)).toBe('Corrected maker');
});

test('serial-first mode captures unknown serials and confirmed records teach exact matches',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'KNOWN-001');await page.getByRole('button',{name:'Save item & start next'}).click();
 await scan(page,'KNOWN-001');await expect(page.getByRole('status')).toContainText('Known serial');await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Clear current item'}).click();
 await page.getByRole('button',{name:'Open settings'}).click();await expect(page.getByText('Each item starts with a serial lookup.')).toBeVisible();await page.getByRole('button',{name:'Save settings'}).click();
 await scan(page,'UNSEEN-001');await expect(page.getByRole('status')).toContainText('No reliable match');await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 await scan(page,'Manual model');await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft)).toMatchObject({serial:'UNSEEN-001',model:'Manual model'});
});

test('blocked browser storage shows the app and an error instead of a blank screen',async({page})=>{
 const failures=[];page.on('pageerror',error=>failures.push(error.message));
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError');}}));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Make room for what’s next.'})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('Saved data could not be loaded');
 expect(failures).toEqual([]);
});

test('database setup keeps local records intact before connection',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'LOCAL-001');await page.getByRole('button',{name:'Save item & start next'}).click();
 await page.getByRole('button',{name:'Shared database'}).click();await expect(page.getByRole('heading',{name:'Connect your Firebase database'})).toBeVisible();
 await expect(page.getByLabel('Team account email')).toBeVisible();
 await expect(page.getByLabel('Firebase public web app config (JSON)')).toBeHidden();
 await page.getByText('Connection settings',{exact:true}).click();
 const config=JSON.parse(await page.getByLabel('Firebase public web app config (JSON)').inputValue());
 expect(config.projectId).toBe('decompro-236e9');
 expect(config.authDomain).toBe('decompro-236e9.firebaseapp.com');
 await page.getByLabel('Firebase public web app config (JSON)').fill('{"private_key":"not-an-actual-key"}');await page.getByLabel('Team account email').fill('test@example.invalid');await page.getByLabel('Password',{exact:true}).fill('not-a-real-password');
 await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#database-error')).toContainText('never a service-account key');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(1);
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('tbody')).toContainText('LOCAL-001');
});
