import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { headers } from '../src/data.js';
async function defaults(page) {
 await page.getByLabel('Manufacturer',{exact:true}).fill('Dell');
 await page.getByRole('button',{name:'Apply batch defaults'}).click();
}
async function scan(page,value) {await page.locator('#scan').fill(value);await page.locator('#scan').press('Enter');}
async function item(page,serial='00001234') {
 await scan(page,'P2419H');await scan(page,serial);
 await page.locator('#scan').press('Enter');await page.locator('#scan').press('Enter');
 await scan(page,'090011');await scan(page,'A0904');
}
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
 const row=sheet.getRow(2);expect(row.getCell(3).value).toBe('P2419H');expect(row.getCell(6).value).toBe('00001234');
 expect(row.getCell(7).value).toBe('N/A');expect(row.getCell(8).value).toBe('090011');expect(row.getCell(9).value).toBe('A0904');
 expect(row.getCell(11).value).toBe('AL');expect(row.getCell(12).value).toBeNull();expect(row.getCell(1).value).toBeInstanceOf(Date);
 await item(page);await page.getByRole('button',{name:'Save item & start next'}).click();
 await expect(page.getByRole('status')).toContainText('already in the register');expect(await page.locator('tbody tr').count()).toBe(1);
});
test('single empty Enter does not skip; progress survives refresh and previous field can be corrected',async({page})=>{
 await page.goto('/');await page.locator('#scan').press('Enter');
 await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 await scan(page,'Model-old');await page.reload();
 await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Previous field'}).click();await expect(page.locator('#scan')).toHaveValue('Model-old');
 await scan(page,'Model-new');await page.getByRole('button',{name:'Skip · N/A'}).click();
 await expect(page.getByRole('heading',{name:'Barcode',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft)).toMatchObject({model:'Model-new',serial:'N/A'});
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
 await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
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
 await scan(page,'IN-PROGRESS-MODEL');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Backup',exact:true}).click();const path=await (await downloaded).path();
 await scan(page,'UNBACKED-SERIAL');
 await page.locator('#backup-file').setInputFiles(path);
 await expect(page.getByRole('heading',{name:'Restore this backup?'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('UNBACKED-SERIAL');
 await page.locator('#backup-file').setInputFiles(path);await page.getByRole('button',{name:'Replace workspace & restore'}).click();
 await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
 expect(state.draft).toEqual({model:'IN-PROGRESS-MODEL'});expect(state.items[0].trolley).toBe('Trolley 01');expect(state.settings.skipWindow).toBe(700);
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
 const saved=await page.evaluate(()=>window.prompts.at(-1));expect(saved.text).toBe('Next, Model number');expect(saved.rate).toBeCloseTo(1.2);expect(saved.volume).toBe(.5);
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
