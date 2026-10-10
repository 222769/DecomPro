import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { headers } from '../src/data.js';
import {readFile} from 'node:fs/promises';
async function approveImport(page) {await expect(page.getByRole('heading',{name:'Spreadsheet import preview'})).toBeVisible();await page.getByRole('button',{name:'Import selected references'}).click();}
async function readyTrolley(page,card=page) {
 await card.getByRole('button',{name:'Readiness checks',exact:true}).click();
 await expect(page.locator('.readiness-summary')).toContainText('0 unresolved issues');
 await page.getByLabel('I checked these items and any recorded exceptions').check();
 await page.getByRole('button',{name:'Mark ready for collection',exact:true}).click();
}
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
 await expect(page.locator('#station')).not.toContainText('Serial recognition ready');
 await page.getByRole('button',{name:'Open settings'}).click();await expect(page.locator('#settings-dialog')).toContainText('Serial recognition ready');await expect(page.locator('#settings-dialog')).toContainText('321 built-in spreadsheet references');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await scan(page,'tg22681204');
 await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Known serial: 10ET185A · Edgeio');
 await expect(page.getByLabel('Manufacturer for this item')).toHaveValue('Edgeio');
 await page.reload();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.model)).toBe('10ET185A');
 await page.getByRole('button',{name:'Previous field'}).click();await page.getByRole('button',{name:'Previous field'}).click();
 await scan(page,'TG22681024');
 await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Manufacturer suggestion: Edgeio');await expect(page.getByLabel('Manufacturer for this item')).toHaveValue('Edgeio');
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
  await item(page,serial);if(serial==='ID-BROWSER-002')await page.getByLabel('I checked the suggested model and manufacturer').check();await page.getByRole('button',{name:'Save item & start next'}).click();
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
 const beforeEmptyManifest=await page.evaluate(()=>localStorage.getItem('decompro.v1'));
 const emptyDownload=page.waitForEvent('download');await card.getByRole('button',{name:'PDF manifest',exact:true}).click();
 const empty=await emptyDownload;expect(empty.suggestedFilename()).toBe(`${trolley.reference}-manifest.pdf`);
 const emptyPdf=(await readFile(await empty.path())).toString('latin1');expect(emptyPdf).toContain('No equipment recorded');expect(emptyPdf).not.toContain('TROLLEY-OLD-001');
 expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(beforeEmptyManifest);
 await card.getByRole('button',{name:'Use trolley',exact:true}).click();
 await item(page,'TROLLEY-NEW-001');await page.getByRole('button',{name:'Previous field'}).click();await scan(page,'A0905');await page.getByRole('button',{name:'Save item & start next'}).click();
 await scan(page,'DRAFT-TO-KEEP');
 await scan(page,trolley.reference);
 await expect(page.locator('#inventory-title')).toHaveText('Helpdesk collection 02 inventory');
 await expect(page.locator('tbody')).toContainText('TROLLEY-NEW-001');await expect(page.locator('tbody')).not.toContainText('TROLLEY-OLD-001');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('DRAFT-TO-KEEP');
 const inventoryDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export Excel',exact:true}).click();
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await (await inventoryDownload).path());expect(workbook.getWorksheet('Sheet1').rowCount).toBe(2);
 await page.getByRole('button',{name:'Trolleys',exact:true}).click();
 await readyTrolley(page,card);await card.getByRole('button',{name:'Mark collected',exact:true}).click();
 await page.getByLabel('Decommission company').fill('Collection test company');await page.getByRole('button',{name:'Confirm collection',exact:true}).click();
 await page.getByRole('button',{name:'Trolleys',exact:true}).click();
 const beforeManifest=await page.evaluate(()=>localStorage.getItem('decompro.v1'));
 const manifestDownload=page.waitForEvent('download');await card.getByRole('button',{name:'PDF manifest',exact:true}).click();
 const manifest=await manifestDownload;expect(manifest.suggestedFilename()).toBe(`${trolley.reference}-manifest.pdf`);
 const manifestPdf=(await readFile(await manifest.path())).toString('latin1');
 for(const value of ['TROLLEY-NEW-001','Collection test company','COLLECTED','Collection recorded by: JA','Released by','Received by','Helpdesk','Calderdale College',trolley.reference])expect(manifestPdf).toContain(value);
 expect(manifestPdf).not.toContain('TROLLEY-OLD-001');expect(manifestPdf).not.toContain('DRAFT-TO-KEEP');
 expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(beforeManifest);
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
 await approveImport(page);await expect(page.locator('.alert[role="status"]')).toContainText('Imported 3 reference examples');
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

test('collection history retains supplier, technician and inventory without changing the scan draft',async({page})=>{
 await page.goto('/');await defaults(page);await item(page,'HISTORY-001');await page.getByRole('button',{name:'Save item & start next'}).click();
 await scan(page,'UNSAVED-HISTORY-DRAFT');
 await page.getByRole('button',{name:'Trolleys',exact:true}).click();await readyTrolley(page);await page.getByRole('button',{name:'Mark collected',exact:true}).click();await page.getByLabel('Decommission company').fill('History supplier');await page.getByRole('button',{name:'Confirm collection'}).click();
 await page.getByRole('link',{name:'Collection history',exact:true}).click();
 await expect(page.locator('#collection-history')).toBeVisible();await expect(page.locator('#history-results')).toContainText('History supplier');await expect(page.locator('#history-results')).toContainText('JA');await expect(page.locator('#history-results')).toContainText('1 items');
 await page.getByLabel('Search collected trolleys').fill('unmatched supplier');await expect(page.locator('#history-results')).toContainText('No collected trolleys match');await page.getByLabel('Search collected trolleys').fill('History supplier');
 await page.reload();await expect(page.locator('#history-results')).toContainText('History supplier');
 await page.locator('#history-results').getByRole('button',{name:'View inventory'}).click();await expect(page.locator('tbody')).toContainText('HISTORY-001');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('UNSAVED-HISTORY-DRAFT');
});

test('cached shared workspace shows offline recovery guidance and keeps scanned progress',async({page})=>{
 await page.goto('/');await scan(page,'OFFLINE-DRAFT');
 await page.evaluate(()=>localStorage.setItem('decompro.mode','shared'));
 await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false}));
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:"export async function connectFirebase(){throw Error('Offline test');}"}));
 await page.reload();await expect(page.locator('#connection-status')).toContainText('Offline · team changes paused');await expect(page.locator('#connection-status')).toContainText('captured item stays here');
 await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('OFFLINE-DRAFT');
 await page.getByRole('button',{name:'Change trolley'}).click();await expect(page.getByRole('status')).toContainText('You are offline');
});

test('connection check reports server results and failures while retaining the scanned item',async({page})=>{
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectFirebase(){return {profile:{name:'Team technician',code:'TT'},role:'admin',email:'team@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,onConnection){onConnection('connected');},async load(){if(window.failConnectionCheck){const error=Error('Database unavailable');error.code='unavailable';throw error;}return {items:[],trolleys:[],examples:[]};}};}
 `}));
 await page.goto('/');await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('team@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();
 await expect(page.locator('#connection-status')).toContainText('confirmed by Firebase');
 await scan(page,'CHECK-CONNECTION-DRAFT');
 await page.getByRole('button',{name:'Shared database'}).click();await page.getByRole('button',{name:'Check connection',exact:true}).click();await expect(page.locator('#connection-check-result')).toContainText('Firebase confirmed 0 equipment records, 0 trolleys');
 await page.evaluate(()=>window.failConnectionCheck=true);await page.getByRole('button',{name:'Check connection',exact:true}).click();await expect(page.locator('#connection-check-result')).toContainText('Connection check failed');await expect(page.locator('#connection-check-result')).toContainText('captured item has been kept');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('CHECK-CONNECTION-DRAFT');
 await page.evaluate(()=>window.failConnectionCheck=false);await page.getByRole('button',{name:'Check connection',exact:true}).click();await expect(page.locator('#connection-check-result')).toContainText('Firebase confirmed');await expect(page.locator('#connection-status')).toContainText('confirmed by Firebase');
});

test('a new serial uses the specific prefix family and conflicting families offer reviewed choices',async({page})=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('References');sheet.addRow(['Serial Number','Model','Manufacturer']);
 for(const serial of ['ZZQQPRO1001','ZZQQPRO1XYZ','ZZQQPRO1777'])sheet.addRow([serial,'Pro display','Example maker']);for(const serial of ['ZZQQLITE001','ZZQQLITEABC'])sheet.addRow([serial,'Lite display','Example maker']);
 await page.goto('/');page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Open settings'}).click();await page.locator('#reference-file').setInputFiles({name:'families.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await book.xlsx.writeBuffer())});await approveImport(page);await expect(page.locator('.alert[role="status"]')).toContainText('Imported 5 reference examples');
 await scan(page,'ZZQQPRO1999');await expect(page.getByRole('status')).toContainText('Pattern suggestion');await expect(page.getByRole('status')).toContainText('Pro display');await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear current item'}).click();await scan(page,'ZZQQNEW9999');await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();await expect(page.locator('.model-candidates')).toContainText('Prefix ZZQQ');
 const option=page.locator('#model-candidate option').filter({hasText:'Lite display'});await page.locator('#model-candidate').selectOption(await option.getAttribute('value'));await page.getByRole('button',{name:'Use selected model'}).click();await expect(page.getByLabel('Manufacturer for this item')).toHaveValue('Example maker');
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A'}).click();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('#save-feedback')).toContainText('tick the confirmation');await page.getByLabel('I checked the suggested model and manufacturer').check();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('tbody')).toContainText('Lite display');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items[0]);expect(saved.serial).toBe('ZZQQNEW9999');expect(saved.manufacturer).toBe('Example maker');await scan(page,'ZZQQNEW9999');await expect(page.getByRole('status')).toContainText('Known serial');
});

test('reference library resolves a conflicting serial, survives reload and can exclude or restore it',async({page})=>{
 await page.goto('/');const open=async()=>{await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('button',{name:'Manage reference library'}).click();};
 await open();await page.getByLabel('Search reference library').fill('MSCF090020L');await expect(page.locator('#library-results')).toContainText('Conflicting facts');await page.getByRole('button',{name:'Review reference'}).click();await page.getByLabel('Checked model').fill('EB-460Wi');await page.getByLabel('Checked manufacturer').fill('Epson');await page.getByLabel('Reason for this review').fill('Verified physical projector label');await page.getByRole('button',{name:'Save reference review'}).click();await expect(page.locator('#library-results')).toContainText('Reviewed correction');await page.locator('#close-library').click();await page.reload();
 await scan(page,'MSCF090020L');await expect(page.getByRole('status')).toContainText('Known serial: EB-460Wi · Epson');await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 await open();await page.getByLabel('Search reference library').fill('MSCF090020L');await page.getByRole('button',{name:'Review reference'}).click();await page.getByLabel('Recognition action').selectOption('excluded');await page.getByLabel('Reason for this review').fill('Exclude disputed projector reference');await page.getByRole('button',{name:'Save reference review'}).click();await expect(page.locator('#library-results')).toContainText('Excluded');await page.locator('#close-library').click();await page.getByRole('button',{name:'Previous field'}).click();await page.getByRole('button',{name:'Previous field'}).click();await scan(page,'MSCF090020L');await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 await open();await page.getByLabel('Search reference library').fill('MSCF090020L');await page.getByRole('button',{name:'Review reference'}).click();await page.getByLabel('Recognition action').selectOption('original');await page.getByLabel('Reason for this review').fill('Restore original evidence');await page.getByRole('button',{name:'Save reference review'}).click();await expect(page.locator('#library-results')).toContainText('Conflicting facts');await page.locator('#close-library').click();await page.getByRole('button',{name:'Previous field'}).click();await scan(page,'MSCF090020L');await expect(page.locator('.model-candidates')).toBeVisible();
});

test('shared technicians receive reviewed models but cannot change the reference library',async({page})=>{
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectFirebase(){return {profile:{name:'Team technician',code:'TT'},role:'technician',email:'team@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,onConnection){onConnection('connected');},async load(){return {items:[],trolleys:[],examples:[],corrections:[{serial:'PRIVATE-REF-0001',mode:'corrected',model:'Checked team model',manufacturer:'Team maker',note:'Verified label'}]};}};}
 `}));
 await page.goto('/');await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('team@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();
 await expect(page.locator('#connection-status')).toContainText('confirmed by Firebase');await scan(page,'PRIVATE-REF-0001');await expect(page.getByRole('status')).toContainText('Known serial: Checked team model · Team maker');
 await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('button',{name:'Manage reference library'}).click();await page.getByLabel('Search reference library').fill('PRIVATE-REF-0001');
 await expect(page.locator('#library-results')).toContainText('Reviewed correction');await expect(page.getByRole('button',{name:'Review reference'})).toBeDisabled();await expect(page.getByRole('button',{name:'Add checked reference'})).toBeDisabled();
});

test('nearby Posiflex serial prefills from the spreadsheet and requires label confirmation before learning',async({page})=>{
 await page.goto('/');await scan(page,'001917BD324B');await expect(page.getByRole('status')).toContainText('Serial family suggestion (prefix 001917BD3; reference 001917BD323B): XTE30722 · posiflex');await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();await expect(page.getByLabel('Manufacturer for this item')).toHaveValue('posiflex');
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A'}).click();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('#save-feedback')).toContainText('tick the confirmation');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(0);
 await page.getByLabel('I checked the suggested model and manufacturer').check();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('tbody')).toContainText('001917BD324B');await expect(page.locator('tbody')).toContainText('XTE30722');await page.reload();await scan(page,'001917BD324B');await expect(page.getByRole('status')).toContainText('Known serial');
});

test('manufacturer-only recognition keeps model entry open, survives refresh and learns checked details',async({page})=>{
 page.on('dialog',dialog=>dialog.accept());
 await page.addInitScript(()=>{window.prompts=[];Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(u){window.prompts.push(u.text)}}});});
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Previous decom');sheet.addRow(['Serial Number','Model','Manufacturer']);sheet.addRow(['BRND1001','Display 24','Example maker']);sheet.addRow(['BRND1002','Display 27','Example maker']);
 await page.goto('/');await page.getByRole('button',{name:'Open settings'}).click();await page.locator('#reference-file').setInputFiles({name:'brands.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await book.xlsx.writeBuffer())});await approveImport(page);await expect(page.locator('.alert[role="status"]')).toContainText('Imported 2 reference examples');
 await scan(page,'BRND1999');await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();await expect(page.getByLabel('Manufacturer for this item')).toHaveValue('Example maker');await expect(page.locator('#scan')).toHaveValue('');await expect(page.getByRole('status')).toContainText('Manufacturer suggestion: Example maker');await expect(page.getByRole('status')).toContainText('2 distinct supporting examples');await expect(page.locator('.model-candidates')).toContainText('Prefix BRND');expect(await page.evaluate(()=>window.prompts.at(-1))).toBe('Suggested manufacturer, Example maker. Model is uncertain. Next, model number.');
 await page.reload();await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();await expect(page.getByLabel('Manufacturer for this item')).toHaveValue('Example maker');
 await scan(page,'Label-verified display');await page.getByLabel('Manufacturer for this item').fill('Verified maker');for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A'}).click();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('#save-feedback')).toContainText('tick the confirmation');
 await page.getByLabel('I checked the suggested model and manufacturer').check();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('tbody')).toContainText('Verified maker · Label-verified display');await scan(page,'BRND1999');await expect(page.getByRole('status')).toContainText('Known serial: Label-verified display · Verified maker');
});

test('conflicting manufacturers do not override the item brand or reuse the batch model',async({page})=>{
 page.on('dialog',dialog=>dialog.accept());
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Mixed manufacturers');sheet.addRow(['Serial Number','Model','Manufacturer']);sheet.addRow(['MIXD1001','Model A','Maker A']);sheet.addRow(['MIXD1002','Model B','Maker B']);
 await page.goto('/');await page.getByRole('button',{name:'Open settings'}).click();await page.locator('#reference-file').setInputFiles({name:'mixed-brands.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await book.xlsx.writeBuffer())});await approveImport(page);await expect(page.locator('.alert[role="status"]')).toContainText('Imported 2 reference examples');await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('Use one model for this batch').check();await page.getByLabel('Batch model number').fill('Batch model');await page.getByRole('button',{name:'Save settings'}).click();
 await scan(page,'TG22681204');await expect(page.getByLabel('Manufacturer for this item')).toHaveValue('Edgeio');await page.getByRole('button',{name:'Previous field'}).click();await page.getByRole('button',{name:'Previous field'}).click();await scan(page,'MIXD1999');await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();await expect(page.getByLabel('Manufacturer for this item')).toHaveCount(0);await expect(page.locator('#scan')).toHaveValue('');await expect(page.locator('.model-candidates')).toContainText('conflicting reference models');
});

async function previewWorkbook(page,book,name='preview.xlsx') {
 await page.getByRole('button',{name:'Open settings'}).click();await page.locator('#reference-file').setInputFiles({name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await book.xlsx.writeBuffer())});await expect(page.getByRole('heading',{name:'Spreadsheet import preview'})).toBeVisible();
}
test('import preview classifies rows, cancels safely and imports only deliberately reviewed selections',async({page})=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Historic collection');sheet.addRow(['Serial Number','Model','Manufacturer']);for(const row of [['TG22681204','10ET185A','Edgeio'],['PREVIEW001','New model','New maker'],['PREVIEW001','New model','New maker'],['TG22681204','Different model','Other maker'],['INFILE001','Model A','Maker'],['INFILE001','Model B','Maker'],['BROKEN001','N/A','Maker']])sheet.addRow(row);
 await page.goto('/');await scan(page,'UNFINISHED-PREVIEW-ITEM');const before=await page.evaluate(()=>localStorage.getItem('decompro.v1'));await previewWorkbook(page,book);await expect(page.locator('.import-counts')).toHaveText(/1 new2 duplicates3 conflicts1 incomplete/);await expect(page.getByRole('checkbox',{name:'Import TG22681204 · 10ET185A · Edgeio',exact:true})).toBeDisabled();await expect(page.getByRole('checkbox',{name:'Import BROKEN001 · N/A · Maker',exact:true})).toBeDisabled();await expect(page.getByRole('checkbox',{name:'Import TG22681204 · Different model · Other maker',exact:true})).not.toBeChecked();await page.getByRole('button',{name:'Cancel import'}).click();expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(before);
 await previewWorkbook(page,book);await page.getByRole('checkbox',{name:'Import PREVIEW001 · New model · New maker',exact:true}).first().uncheck();await page.getByRole('checkbox',{name:'Import TG22681204 · Different model · Other maker',exact:true}).check();await page.getByRole('button',{name:'Import selected references'}).click();await expect(page.locator('#import-preview-error')).toContainText('tick the confirmation');await page.getByLabel('I checked the selected conflicting details').check();await page.getByRole('button',{name:'Import selected references'}).click();await expect(page.locator('.alert[role="status"]')).toContainText('Imported 1 reference examples');
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(state.items).toHaveLength(0);expect(state.draft.serial).toBe('UNFINISHED-PREVIEW-ITEM');expect(state.referenceExamples).toHaveLength(1);expect(state.referenceExamples[0].model).toBe('Different model');
 await previewWorkbook(page,book);await expect(page.getByRole('checkbox',{name:'Import TG22681204 · Different model · Other maker',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Cancel import'}).click();
});

test('local import failure leaves references and captured progress intact for retry',async({page})=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Retry');sheet.addRow(['Serial Number','Model','Manufacturer']);sheet.addRow(['STORAGEIMPORT001','Checked model','Checked maker']);await page.goto('/');await scan(page,'IMPORT-DRAFT');await previewWorkbook(page,book);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.blockImport&&key==='decompro.v1')throw new DOMException('Storage full','QuotaExceededError');return original.call(this,key,value);};window.blockImport=true;});await page.getByRole('button',{name:'Import selected references'}).click();await expect(page.locator('#import-preview-error')).toContainText('Reference import failed');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(saved.referenceExamples).toHaveLength(0);expect(saved.draft.serial).toBe('IMPORT-DRAFT');await page.evaluate(()=>window.blockImport=false);await page.getByRole('button',{name:'Import selected references'}).click();await expect(page.locator('.alert[role="status"]')).toContainText('Imported 1 reference examples');
});

test('shared preview rechecks Firebase evidence before importing and requires review of newly found conflicts',async({page})=>{
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectFirebase(){let loads=0;window.referenceImportCalls=[];return {profile:{name:'Team technician',code:'TT'},role:'technician',email:'team@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,onConnection){onConnection('connected');},async load(){loads++;return {items:[],trolleys:[],corrections:[],examples:loads>1?[{serial:'TEAMIMPORT001',model:'Other device model',manufacturer:'Team maker',source:'Team reference'}]:[]};},async importExamples(rows){window.referenceImportCalls.push(rows);}};}
 `}));const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Shared import');sheet.addRow(['Serial Number','Model','Manufacturer']);sheet.addRow(['TEAMIMPORT001','Spreadsheet model','Team maker']);await page.goto('/');await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('team@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#connection-status')).toContainText('confirmed by Firebase');await previewWorkbook(page,book);await page.getByRole('button',{name:'Import selected references'}).click();await expect(page.locator('#import-preview-error')).toContainText('library changed');expect(await page.evaluate(()=>window.referenceImportCalls.length)).toBe(0);await expect(page.locator('#import-selection-count')).toContainText('0 references selected');await page.getByRole('checkbox',{name:'Import TEAMIMPORT001 · Spreadsheet model · Team maker',exact:true}).check();await page.getByLabel('I checked the selected conflicting details').check();await page.getByRole('button',{name:'Import selected references'}).click();await expect(page.locator('.alert[role="status"]')).toContainText('Imported 1 reference examples');expect(await page.evaluate(()=>window.referenceImportCalls[0][0].model)).toBe('Spreadsheet model');
});

test('scan evidence persists and a reviewed correction preserves other scans and teaches the corrected serial',async({page})=>{
 await page.goto('/');await scan(page,'001917BD324B');await expect(page.getByRole('region',{name:'Recognition evidence'})).toContainText('Built-in Excel');await expect(page.locator('.recognition-evidence')).toContainText('1 distinct serial');await expect(page.locator('.recognition-evidence')).toContainText('001917BD323B');await scan(page,'BARCODE-KEEP');const before=await page.evaluate(()=>localStorage.getItem('decompro.v1'));await page.getByRole('button',{name:'This suggestion is wrong'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(before);await page.reload();await expect(page.locator('.recognition-evidence')).toContainText('001917BD323B');
 await page.getByRole('button',{name:'This suggestion is wrong'}).click();await page.getByLabel('Checked model',{exact:true}).fill('Verified terminal model');await page.getByLabel('Checked manufacturer',{exact:true}).fill('Verified maker');await page.getByLabel('Reason for correction').fill('Read actual equipment label');await page.getByRole('button',{name:'Apply checked correction'}).click();await expect(page.getByRole('heading',{name:'Correct this suggestion'})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(before);await page.getByLabel('I checked these corrected details').check();await page.getByRole('button',{name:'Apply checked correction'}).click();await expect(page.locator('.recognition-evidence')).toContainText('Corrected after a label check');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(saved.draft.barcode).toBe('BARCODE-KEEP');expect(saved.draft.model).toBe('Verified terminal model');expect(saved.referenceCorrections[0].serial).toBe('001917BD324B');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Backup',exact:true}).click();const backupPath=await (await download).path();const backup=JSON.parse(await readFile(backupPath,'utf8'));expect(backup.state.draft.recognitionEvidence.referenceSerials).toEqual(['001917BD323B']);await page.getByRole('button',{name:'Clear current item'}).click();await page.locator('#backup-file').setInputFiles(backupPath);await page.getByRole('button',{name:'Replace workspace & restore'}).click();await expect(page.locator('.recognition-evidence')).toContainText('Corrected after a label check');
 for(let i=0;i<2;i++)await page.getByRole('button',{name:'Skip · N/A'}).click();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('tbody')).toContainText('Verified terminal model');await scan(page,'001917BD324B');await expect(page.getByRole('status')).toContainText('Known serial: Verified terminal model · Verified maker');await expect(page.locator('.recognition-evidence')).toContainText('Reviewed correction');
});

test('ordinary shared technician corrects the current item without writing administrator references',async({page})=>{
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`export async function connectFirebase(){window.correctedReferenceWrites=0;return {profile:{name:'Team technician',code:'TT'},role:'technician',email:'team@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,onConnection){onConnection('connected');},async load(){return {items:[],trolleys:[],examples:[],corrections:[]};},async writeCorrection(){window.correctedReferenceWrites++;throw Error('Administrator required');}};}`}));await page.goto('/');await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('team@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#connection-status')).toContainText('confirmed by Firebase');await scan(page,'001917BD324B');await page.getByRole('button',{name:'This suggestion is wrong'}).click();await expect(page.getByLabel('Save a reviewed reference for future scans')).toBeDisabled();await page.getByLabel('Checked model',{exact:true}).fill('Tech checked model');await page.getByLabel('Checked manufacturer',{exact:true}).fill('posiflex');await page.getByLabel('I checked these corrected details').check();await page.getByRole('button',{name:'Apply checked correction'}).click();await expect(page.getByRole('status')).toContainText('Save the equipment to teach future scans');expect(await page.evaluate(()=>window.correctedReferenceWrites)).toBe(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.model)).toBe('Tech checked model');
});

test('evidence distinguishes manufacturer-only uncertainty and manual edits require another check',async({page})=>{
 await page.goto('/');await scan(page,'TG22681024');await expect(page.locator('.recognition-evidence')).toContainText('Manufacturer inferred; model uncertain.');await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();await page.getByRole('button',{name:'This suggestion is wrong'}).click();await page.getByLabel('Checked model',{exact:true}).fill('Checked display');await page.getByLabel('Checked manufacturer',{exact:true}).fill('Edgeio');await page.getByLabel('Save a reviewed reference for future scans').uncheck();await page.getByLabel('I checked these corrected details').check();await page.getByRole('button',{name:'Apply checked correction'}).click();await page.getByRole('button',{name:'Previous field'}).click();await scan(page,'Edited again');for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A'}).click();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('#save-feedback')).toContainText('tick the confirmation');await expect(page.locator('.recognition-evidence')).toContainText('Edited details need a fresh label check');
});

test('shared administrator correction failures preserve the scan and retry with the reviewed version',async({page})=>{
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`export async function connectFirebase(){window.failReview=true;window.reviewWrites=[];return {profile:{name:'Administrator',code:'MA'},role:'admin',email:'admin@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,onConnection){onConnection('connected');},correctionVersionFor(){return 2;},async load(){return {items:[],trolleys:[],examples:[],corrections:[]};},async writeCorrection(payload,version){if(window.failReview)throw Error('Another administrator changed this reference. Reopen it and review the latest correction.');window.reviewWrites.push({payload,version});}};}`}));await page.goto('/');await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('admin@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#connection-status')).toContainText('confirmed by Firebase');await scan(page,'001917BD324B');await scan(page,'KEEP-BARCODE');const original=await page.evaluate(()=>localStorage.getItem('decompro.v1'));await page.getByRole('button',{name:'This suggestion is wrong'}).click();await page.getByLabel('Checked model',{exact:true}).fill('Admin checked model');await page.getByLabel('Checked manufacturer',{exact:true}).fill('posiflex');await page.getByLabel('Reason for correction').fill('Checked terminal label');await page.getByLabel('I checked these corrected details').check();await page.getByRole('button',{name:'Apply checked correction'}).click();await expect(page.locator('#scan-correction-error')).toContainText('Another administrator');expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(original);await page.evaluate(()=>window.failReview=false);await page.getByRole('button',{name:'Apply checked correction'}).click();await expect(page.getByRole('status')).toContainText('saved to the reference library');const write=await page.evaluate(()=>window.reviewWrites[0]);expect(write.version).toBe(2);expect(write.payload.model).toBe('Admin checked model');const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft);expect(draft.barcode).toBe('KEEP-BARCODE');expect(draft.model).toBe('Admin checked model');
});


test('manifest paginates long fields with repeated headings, QR link and complete trolley scope',async({page})=>{
 await page.goto('/');
 const encoded=await page.evaluate(async()=>{
  const {trolleyManifest}=await import('/src/trolley-manifest.js');
  const {createTrolley}=await import('/src/trolleys.js');
  const trolley=createTrolley('Manifest stress trolley');
  const items=Array.from({length:32},(_,index)=>({trolleyId:trolley.id,serial:`MANIFEST-SERIAL-${index}`,asset:'A0042',model:`Model-${index} `+'long equipment model '.repeat(70)+`ENDMODEL-${index}`,manufacturer:'Maker '+index,technician:'MA'}));
  items.push({trolley:'Manifest stress trolley',serial:'LEGACY-TROLLEY-ITEM',model:'Legacy model'});
  items.push({trolleyId:'other-trolley',trolley:trolley.name,serial:'WRONG-TROLLEY-ITEM'});
  const data=await trolleyManifest(trolley,items,'https://decompro.hxali.com/#trolley/'+trolley.id,{cached:true,printedAt:'2026-10-10T10:00:00Z'});
  return {pdf:btoa(Array.from(new Uint8Array(data),byte=>String.fromCharCode(byte)).join('')),reference:trolley.reference,id:trolley.id};
 });
 const pdf=Buffer.from(encoded.pdf,'base64').toString('latin1');expect(pdf.startsWith('%PDF-')).toBe(true);
 const pages=pdf.match(/\/Type \/Page\b/g).length;expect(pages).toBeGreaterThan(3);
 expect(pdf.match(/\(Serial number\)/g)).toHaveLength(pages-1);expect(pdf.match(/Page \d+ of/g)).toHaveLength(pages);
 for(let index=0;index<32;index++){expect(pdf).toContain(`MANIFEST-SERIAL-${index}`);expect(pdf).toContain(`ENDMODEL-${index}`);}
 for(const value of ['33 items','LEGACY-TROLLEY-ITEM','CACHED WORKSPACE SNAPSHOT','Handover confirmation','Received by',encoded.reference,'https://decompro.hxali.com/#trolley/'+encoded.id])expect(pdf).toContain(value);
 expect(pdf).not.toContain('WRONG-TROLLEY-ITEM');expect(pdf.match(/\/Subtype \/Image/g).length).toBeGreaterThanOrEqual(2);
});


test('readiness reviews missing details and guesses, requires duplicate fixes, preserves the draft and prints exceptions',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');await defaults(page);await item(page,'READINESS-ONE');await page.getByRole('button',{name:'Save item & start next'}).click();await scan(page,'KEEP-READINESS-DRAFT');
 await page.evaluate(async()=>{
  const {createTrolley}=await import('/src/trolleys.js'),state=JSON.parse(localStorage.getItem('decompro.v1'));
  const original=state.items[0],other=createTrolley('Other cage');state.trolleys.push(other);
  state.items.push({...original,id:crypto.randomUUID(),trolleyId:other.id,trolley:other.name,serial:'OTHER-READINESS',model:'Other model',manufacturer:'Dell'});
  Object.assign(original,{serial:'N/A',model:'N/A',manufacturer:'N/A',recognitionNeedsReview:true,recognitionConfirmed:false});
  localStorage.setItem('decompro.v1',JSON.stringify(state));
 });await page.reload();await page.getByRole('button',{name:'Trolleys',exact:true}).click();
 const card=page.locator('.trolley-card').filter({hasText:'Trolley 01'});await card.getByRole('button',{name:'Readiness checks',exact:true}).click();
 await expect(page.locator('.readiness-summary')).toContainText('5 unresolved issues');await expect(page.getByRole('button',{name:'Mark ready for collection'})).toBeDisabled();await expect(page.locator('.readiness-card')).toContainText('Other cage');
 await page.getByLabel('Why is the serial number unavailable?').fill('Serial label worn off; checked the base');await page.getByLabel('Why is model unavailable?').fill('Model label missing');await page.getByLabel('Why is manufacturer unavailable?').fill('Unbranded housing');
 await page.getByLabel('I checked the model and manufacturer against this equipment.').check();await page.getByRole('button',{name:'Save review notes'}).click();
 await expect(page.locator('.readiness-summary')).toContainText('1 unresolved issue');await expect(page.getByRole('button',{name:'Mark ready for collection'})).toBeDisabled();
 await page.getByRole('button',{name:'Edit equipment record'}).click();await page.getByLabel('Asset number',{exact:true}).fill('A0007');await page.getByRole('button',{name:'Save changes'}).click();
 await page.getByRole('button',{name:'Trolleys',exact:true}).click();await readyTrolley(page,card);
 await expect(card).toContainText('Ready for collection');
 let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(state.draft.serial).toBe('KEEP-READINESS-DRAFT');expect(state.items[0].readinessNotes.model).toBe('Model label missing');expect(state.trolleys[0].readyBy).toBe('JA');
 const download=page.waitForEvent('download');await card.getByRole('button',{name:'PDF manifest'}).click();const pdf=(await readFile(await (await download).path())).toString('latin1');for(const value of ['READY FOR COLLECTION','Recorded exceptions','Model label missing','Unbranded housing','Readiness checked:'])expect(pdf).toContain(value);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 const backupDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Backup',exact:true}).click();const backupPath=await (await backupDownload).path();
 await page.getByRole('button',{name:'Trolleys',exact:true}).click();await card.getByRole('button',{name:'Reopen trolley'}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('#backup-file').setInputFiles(backupPath);await page.getByRole('button',{name:'Replace workspace & restore'}).click();
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(restored.trolleys[0].status).toBe('ready');expect(restored.items[0].recognitionConfirmed).toBe(true);expect(restored.items[0].readinessNotes.serial).toContain('Serial label worn off');
 await scan(page,'Draft model');for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A'}).click();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('#save-feedback')).toContainText('ready or collected');
 await page.reload();await page.getByRole('button',{name:'Trolleys',exact:true}).click();await expect(card).toContainText('Ready for collection');await card.getByRole('button',{name:'Reopen trolley'}).click();await expect(card).toContainText('Open');
 state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(state.trolleys[0].readyAt).toBe('');expect(state.draft.serial).toBe('KEEP-READINESS-DRAFT');
});

test('empty trolley cannot be ready and failed local review writes leave the inventory unchanged',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Trolleys',exact:true}).click();await page.getByRole('button',{name:'Readiness checks',exact:true}).click();await expect(page.locator('.readiness-summary')).toContainText('Add equipment');await expect(page.getByRole('button',{name:'Mark ready for collection'})).toBeDisabled();await page.getByRole('button',{name:'Back to trolleys'}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
 await defaults(page);await item(page,'REVIEW-FAIL');await page.getByRole('button',{name:'Save item & start next'}).click();await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));state.items[0].model='N/A';localStorage.setItem('decompro.v1',JSON.stringify(state));});await page.reload();await page.getByRole('button',{name:'Trolleys',exact:true}).click();await page.getByRole('button',{name:'Readiness checks',exact:true}).click();const original=await page.evaluate(()=>localStorage.getItem('decompro.v1'));await page.getByLabel('Why is model unavailable?').fill('Checked; label missing');
 await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreReviewStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='decompro.v1')throw new DOMException('Storage full','QuotaExceededError');return original.call(this,key,value);};});
 await page.getByRole('button',{name:'Save review notes'}).click();await expect(page.locator('.review-error')).toContainText('Storage full');expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(original);await expect(page.getByRole('button',{name:'Mark ready for collection'})).toBeDisabled();await page.evaluate(()=>window.restoreReviewStorage());
});

test('shared readiness preserves failed review notes, rejects stale approval and succeeds after a fresh server review',async({page})=>{
 const trolley={id:'12345678-1234-4234-8234-123456789abc',reference:'TSU-12345678123442348234123456789ABC',name:'Shared readiness cage',department:'Helpdesk (Calderdale College)',status:'open',createdAt:'2026-10-10T10:00:00Z',collectedAt:'',collectedBy:'',company:''};
 const record={id:'shared-readiness-item',trolleyId:trolley.id,trolley:trolley.name,serial:'SHARED-READINESS',model:'N/A',manufacturer:'Dell',date:'2026-10-10',description:'Monitor',source:'Storage',reason:'EOL',barcode:'N/A',etch:'N/A',asset:'A0003',technician:'TT'};
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectFirebase(){window.readinessTrolley=${JSON.stringify(trolley)};window.readinessRecord=${JSON.stringify(record)};window.trolleyVersion=1;window.itemVersion=1;window.failNotes=true;window.failReady=true;window.readyAttempts=[];
 return {profile:{name:'Team technician',code:'TT'},role:'technician',email:'team@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,onConnection){onConnection('connected');},versionFor(){return window.itemVersion;},trolleyVersionFor(){return window.trolleyVersion;},
 async load(){return {items:[window.readinessRecord],trolleys:[window.readinessTrolley],examples:[],corrections:[]};},
 async readinessSnapshot(){return {trolley:window.readinessTrolley,items:[window.readinessRecord],version:window.trolleyVersion};},
 async write(item,version){if(window.failNotes)throw Error('Review save denied by server');if(version!==window.itemVersion)throw Error('Record changed');window.readinessRecord=item;window.itemVersion++;window.trolleyVersion++;},
 async writeTrolley(trolley,version){window.readyAttempts.push(version);if(window.failReady){window.failReady=false;window.trolleyVersion++;throw Error('The trolley inventory changed. Reopen the readiness checks.');}if(version!==window.trolleyVersion)throw Error('Stale version');window.readinessTrolley=trolley;window.trolleyVersion++;}};
 }`}));
 await page.goto('/');await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('team@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#connection-status')).toContainText('confirmed by Firebase');await scan(page,'KEEP-SHARED-READINESS');
 await page.getByRole('button',{name:'Trolleys',exact:true}).click();await page.getByRole('button',{name:'Readiness checks',exact:true}).click();await page.getByLabel('Why is model unavailable?').fill('Checked; model label missing');const original=await page.evaluate(()=>localStorage.getItem('decompro.v1'));
 await page.context().setOffline(true);await page.getByRole('button',{name:'Save review notes'}).click();await expect(page.locator('.review-error')).toContainText('Reconnect to Firebase');await expect(page.getByLabel('Why is model unavailable?')).toHaveValue('Checked; model label missing');expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(original);await page.context().setOffline(false);
 await page.getByRole('button',{name:'Save review notes'}).click();await expect(page.locator('.review-error')).toContainText('Review save denied');await expect(page.getByLabel('Why is model unavailable?')).toHaveValue('Checked; model label missing');expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(original);
 await page.evaluate(()=>window.failNotes=false);await page.getByRole('button',{name:'Save review notes'}).click();await expect(page.locator('.readiness-summary')).toContainText('0 unresolved issues');await page.getByLabel('I checked these items and any recorded exceptions').check();await page.getByRole('button',{name:'Mark ready for collection'}).click();await expect(page.locator('#readiness-error')).toContainText('inventory changed');expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')))).trolleys[0].status).toBe('open');
 await page.getByRole('button',{name:'Back to trolleys'}).click();await readyTrolley(page);await expect(page.locator('.trolley-card')).toContainText('Ready for collection');const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(state.trolleys[0].readyBy).toBe('TT');expect(state.draft.serial).toBe('KEEP-SHARED-READINESS');expect(await page.evaluate(()=>window.readyAttempts)).toEqual([2,3]);
});

test('new Posiflex suffixes infer from built-in Excel, retain evidence and require checking before becoming learned exact matches',async({page})=>{
 await page.goto('/');
 for(const serial of ['001917BD365B','001917BD354B']) {
  await scan(page,serial);await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();await expect(page.getByLabel('Manufacturer for this item')).toHaveValue('posiflex');
  await expect(page.getByRole('status')).toContainText('Serial family suggestion (prefix 001917BD3; reference 001917BD323B): XTE30722 · posiflex');
  await expect(page.getByRole('region',{name:'Recognition evidence'})).toContainText('1 distinct serial');await expect(page.locator('.recognition-evidence')).toContainText('Built-in Excel');await expect(page.locator('.recognition-evidence')).toContainText('label check required');
  if(serial==='001917BD365B'){page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Clear current item'}).click();await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();}
 }
 await page.reload();await expect(page.locator('.recognition-evidence')).toContainText('001917BD323B');
 const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft);expect(draft.serial).toBe('001917BD354B');expect(draft.model).toBe('XTE30722');expect(draft.recognitionNeedsReview).toBe(true);expect(draft.recognitionConfirmed).toBe(false);
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A'}).click();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('#save-feedback')).toContainText('tick the confirmation');
 await page.getByLabel('I checked the suggested model and manufacturer').check();await page.getByRole('button',{name:'Save item & start next'}).click();await expect(page.locator('tbody')).toContainText('001917BD354B');await expect(page.locator('tbody')).toContainText('XTE30722');
 await page.reload();await scan(page,'001917BD354B');await expect(page.getByRole('status')).toContainText('Known serial');await expect(page.locator('.recognition-evidence')).toContainText('Saved equipment');
});

test('local import previews duplicates, preserves originals and safely retries a partial Firebase failure',async({page})=>{
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectFirebase(){return {profile:{name:'Administrator',code:'AD'},role:'admin',email:'admin@example.invalid',teamId:'college-it',stop(){},async logout(){},listen(){},trolleyVersionFor(){return 1;},async load(){return structuredClone(window.teamFixture);},async write(item){window.importWrites.push(item.id);if(item.serial==='LOCALTEAM002'&&!window.failedOnce){window.failedOnce=true;throw Error('Temporary connection failure');}window.teamFixture.items.push(structuredClone(item));},async writeTrolley(){throw Error('Unexpected trolley replacement');}};}
 `}));
 await page.goto('/');await defaults(page);
 for(const serial of ['LOCALTEAM001','LOCALTEAM002','LOCALTEAM003']){await item(page,serial);if(await page.getByLabel('I checked the suggested model and manufacturer').count())await page.getByLabel('I checked the suggested model and manufacturer').check();await page.getByRole('button',{name:'Save item & start next'}).click();}
 const local=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
 await page.evaluate(local=>{window.teamFixture={items:[{...local.items[2],id:'existing-team-serial'}],trolleys:local.trolleys,examples:[],corrections:[]};window.importWrites=[];},local);
 await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('admin@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();
 await scan(page,'PRESERVED-SHARED-DRAFT');
 const open=async()=>{await page.getByRole('button',{name:'Shared database'}).click();await page.getByRole('button',{name:'Import local equipment (admin)'}).click();};
 await open();await expect(page.locator('#local-import-dialog')).toContainText('2 ready to import');await expect(page.locator('#local-import-dialog')).toContainText('already in the shared register');
 await page.locator('#close-local-import').click();expect(await page.evaluate(()=>window.importWrites)).toEqual([]);
 await page.locator('#close-database').click();await open();await page.getByRole('button',{name:'Import ready items',exact:true}).click();
 await expect(page.locator('#local-import-result')).toContainText('1 item saved to Firebase');await expect(page.locator('#local-import-dialog')).toContainText('Not imported: Temporary connection failure');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.localWorkspace')))).toEqual(local);
 await page.getByRole('button',{name:'Retry remaining items'}).click();await expect(page.locator('#local-import-result')).toContainText('1 item saved to Firebase');
 expect(await page.evaluate(()=>window.importWrites)).toEqual([local.items[0].id,local.items[1].id,local.items[1].id]);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('PRESERVED-SHARED-DRAFT');
 await page.locator('#close-local-import').click();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Sign out & return to local workspace'}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items)).toEqual(local.items);
});

test('a shared save shows pending confirmation and retains the scan until Firebase accepts it',async({page})=>{
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectFirebase(){return {profile:{name:'Jawad',code:'JA'},role:'technician',email:'jawad@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,connection){connection('connected');},async load(){return {items:[],trolleys:[],examples:[],corrections:[]};},async writeTrolley(){},async write(){await new Promise(resolve=>window.confirmTeamSave=resolve);}};}
 `}));
 await page.goto('/');await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('jawad@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();
 await defaults(page);await item(page,'CONFIRMEDTEAM001');await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.locator('#connection-status')).toContainText('Saving equipment to Firebase');await expect(page.locator('#save')).toBeDisabled();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('CONFIRMEDTEAM001');
 await page.evaluate(()=>window.confirmTeamSave());await expect(page.getByRole('status').filter({hasText:'Item saved to Firebase'})).toBeVisible();
 await expect(page.locator('tbody')).toContainText('CONFIRMEDTEAM001');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items[0].technician)).toBe('JA');
 await page.getByRole('button',{name:'Shared database'}).click();await expect(page.getByRole('button',{name:'Team access checklist'})).toHaveCount(0);
});

test('an administrator can check active memberships and find the personal account setup steps',async({page})=>{
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectFirebase(){return {profile:{name:'Administrator',code:'AD'},role:'admin',email:'admin@example.invalid',teamId:'college-it',stop(){},listen(){},async load(){return {items:[],trolleys:[],examples:[],corrections:[]};},async listMembers(){return [{displayName:'Jawad',code:'JA',role:'technician',active:true},{displayName:'Former technician',code:'FT',role:'technician',active:false}];}};}
 `}));
 await page.goto('/');await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('admin@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();
 await page.getByRole('button',{name:'Shared database'}).click();await page.getByRole('button',{name:'Team access checklist'}).click();
 await expect(page.locator('#team-access-list')).toContainText('Jawad · JA');await expect(page.locator('#team-access-list')).toContainText('Inactive');await expect(page.locator('#team-access-dialog')).toContainText('teams/college-it/members/UID');
});

test('a downloaded backup restores equipment, trolley references, training data and an unfinished scan in another browser',async({page,browser})=>{
 await page.goto('/');await defaults(page);await item(page,'RECOVERTEAM001');await page.getByRole('button',{name:'Save item & start next'}).click();
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Recovery references');sheet.addRow(['Serial Number','Model','Manufacturer']);sheet.addRow(['RESTOREEXCEL001','Recovery model','Recovery maker']);
 await previewWorkbook(page,book);await approveImport(page);
 await scan(page,'UNFINISHED-RECOVERY');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1'))),download=page.waitForEvent('download');await page.getByRole('button',{name:'Backup',exact:true}).click();const file=await download;
 const context=await browser.newContext();const other=await context.newPage();
 try {
  await other.goto('/');await other.getByRole('button',{name:'Restore backup',exact:true}).click();await other.locator('#backup-file').setInputFiles(await file.path());
  await other.getByRole('button',{name:'Replace workspace & restore'}).click();await other.reload();
  const restored=await other.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
  expect(restored.items).toEqual(before.items);expect(restored.trolleys).toEqual(before.trolleys);expect(restored.referenceExamples).toEqual(before.referenceExamples);expect(restored.draft.serial).toBe('UNFINISHED-RECOVERY');
  await expect(other.locator('tbody')).toContainText('RECOVERTEAM001');
 }finally{await context.close();}
});

for(const extra of [false,true])test(`historical collection import retries without reimporting saved items and ${extra?'rejects extra inventory':'restores collection history'}`,async({page})=>{
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectFirebase(){return {profile:{name:'Administrator',code:'AD'},role:'admin',email:'admin@example.invalid',teamId:'college-it',stop(){},listen(){},trolleyVersionFor(){return 2;},async readinessSnapshot(){return {items:structuredClone(window.historyFixture.items),trolley:structuredClone(window.historyFixture.trolleys[0]),version:2};},async load(){return structuredClone(window.historyFixture);},async write(item){window.historyWrites++;window.historyFixture.items.push(structuredClone(item));},async writeTrolley(trolley){if(trolley.status==='collected'){window.historyAttempts++;if(window.historyAttempts===1)throw Error('History temporarily unavailable');}window.historyFixture.trolleys=[structuredClone(trolley)];}};}
 `}));
 await page.goto('/');await defaults(page);await item(page,'IMPORT-HISTORY-ONE');await page.getByRole('button',{name:'Save item & start next'}).click();
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));Object.assign(state.trolleys[0],{status:'collected',company:'Previous supplier',collectedAt:'2026-09-01T10:00:00.000Z',collectedBy:'JA'});localStorage.setItem('decompro.v1',JSON.stringify(state));});await page.reload();
 const original=await page.evaluate(()=>localStorage.getItem('decompro.v1'));
 await page.evaluate(()=>{window.historyFixture={items:[],trolleys:[],examples:[],corrections:[]};window.historyWrites=0;window.historyAttempts=0;});
 await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('admin@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();
 await page.getByRole('button',{name:'Shared database'}).click();await page.getByRole('button',{name:'Import local equipment (admin)'}).click();await page.getByRole('button',{name:'Import ready items'}).click();
 await expect(page.locator('#local-import-result')).toContainText('collection history not restored: History temporarily unavailable');
 if(extra)await page.evaluate(()=>window.historyFixture.items.push({...window.historyFixture.items[0],id:'unrelated-team-item',serial:'UNRELATED-TEAM-SERIAL'}));
 await page.getByRole('button',{name:'Retry remaining items'}).click();
 await expect(page.locator('#local-import-result')).toContainText(extra?'full inventory does not match':'0 items saved to Firebase');
 expect(await page.evaluate(()=>window.historyWrites)).toBe(1);expect(await page.evaluate(()=>window.historyAttempts)).toBe(extra?1:2);
 expect(await page.evaluate(()=>window.historyFixture.trolleys[0].status)).toBe(extra?'open':'collected');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.localWorkspace')))).toEqual(JSON.parse(original));
});
