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
