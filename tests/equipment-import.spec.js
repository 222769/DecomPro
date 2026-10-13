import {ensureTrolley} from './helpers/batch.js';
import {test,expect} from '@playwright/test';
import ExcelJS from 'exceljs';
import {headers} from '../src/data.js';
async function workbook(rows){const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Previous decom');sheet.addRow([...headers,'Asset Number']);rows.forEach(row=>sheet.addRow(row));return {name:'Previous decom.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await book.xlsx.writeBuffer())};}
const equipment=(serial,asset='N/A')=>['16/02/2026','Monitor','Historical model','Example maker','Storage',serial,'000007','009090',asset,'EOL','OLD'];
async function open(page,rows){await ensureTrolley(page);await page.getByRole('button',{name:'Import equipment Excel'}).click();await expect(page.getByRole('heading',{name:'Import equipment into register'})).toBeVisible();await page.getByLabel('Equipment spreadsheet (.xlsx)').setInputFiles(await workbook(rows));await expect(page.locator('#equipment-import-message')).toContainText('equipment rows loaded');}
test('register Excel importer appends historical records, preserves draft and references, exports and continues scanning',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('#scan').fill('UNFINISHED-001');await page.locator('#scan').press('Enter');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
 await open(page,[equipment('00001234','A1234')]);const bounds=await page.locator('#equipment-import-dialog').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);await page.getByRole('button',{name:'Import selected equipment'}).click();await expect(page.locator('#equipment-import-message')).toContainText('1 equipment records imported');
 await expect(page.getByRole('button',{name:'Import selected equipment'})).toBeDisabled();
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('#inventory tbody')).toContainText('00001234');
 await page.reload();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(saved.items).toHaveLength(1);expect(saved.items[0]).toMatchObject({date:'2026-02-16',technician:'OLD',serial:'00001234',barcode:'000007',etch:'009090',asset:'A1234',recognitionConfirmed:false});expect(saved.draft).toEqual(before.draft);expect(saved.referenceExamples).toEqual(before.referenceExamples);expect(saved.profiles).toEqual(before.profiles);
 const download=page.waitForEvent('download');await page.locator('#export').click();expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
 await open(page,[equipment('00001234','A1234')]);await expect(page.locator('#equipment-import-dialog')).toContainText('Serial already in the register');await expect(page.getByRole('button',{name:'Import selected equipment'})).toBeDisabled();await page.getByRole('button',{name:'Close',exact:true}).click();
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Clear current item',exact:true}).click();await page.locator('#scan').fill('00001234');await page.locator('#scan').press('Enter');await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
});
test('duplicate selections can be excluded and blank attribution explicitly filled before import',async({page})=>{
 await page.goto('/');const first=equipment('DUP-001'),second=equipment('DUP-001');first[0]='';first[10]='';await open(page,[first,second]);await expect(page.getByRole('button',{name:'Import selected equipment'})).toBeDisabled();
 await page.getByLabel('Include Previous decom row 3').uncheck();await page.getByText('Fill missing dates or disposal initials',{exact:true}).click();await page.getByLabel('Date for rows with no disposal date').fill('2026-02-16');await page.getByLabel('Date for rows with no disposal date').press('Tab');
 await page.getByLabel('Disposal initials for rows with no technician').fill('JA');await page.getByLabel('Disposal initials for rows with no technician').press('Tab');
 await expect(page.getByRole('button',{name:'Import selected equipment'})).toBeEnabled();await page.getByRole('button',{name:'Import selected equipment'}).click();await expect(page.locator('#equipment-import-message')).toContainText('1 equipment records imported');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items[0].technician)).toBe('JA');
});
test('storage failure keeps register, scanned draft and import preview intact for retry',async({page})=>{
 await page.goto('/');await page.locator('#scan').fill('UNFINISHED');await page.locator('#scan').press('Enter');await open(page,[equipment('HISTORY-001')]);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='decompro.v1')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
 await page.getByRole('button',{name:'Import selected equipment'}).click();await expect(page.locator('#equipment-import-message')).toContainText('0 records saved');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(saved.items).toHaveLength(0);expect(saved.draft.serial).toBe('UNFINISHED');await expect(page.getByRole('button',{name:'Import selected equipment'})).toBeEnabled();
});
test('shared importer retries only unsaved rows and retains historical technician attribution',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Import equipment Excel'})).toBeVisible();await page.evaluate(async()=>{
  const {openEquipmentImport}=await import('/src/equipment-import-ui.js');const trolley={id:'test-trolley',name:'Shared trolley',status:'open'};const remote={items:[],trolleys:[trolley]};let failed=false;window.importCalls=[];
  const client={async write(item,version,options){window.importCalls.push({serial:item.serial,technician:item.technician,version,options});if(item.serial==='SECOND'&&!failed){failed=true;throw Error('Temporary save failure');}if(remote.items.some(row=>row.id===item.id))throw Error('Duplicate write');remote.items.push(item);}};
  await openEquipmentImport({dialog:document.querySelector('#equipment-import-dialog'),client,current:()=>true,load:async()=>structuredClone(remote),commit:()=>{},close:()=>{}});
 });
 await page.getByLabel('Equipment spreadsheet (.xlsx)').setInputFiles(await workbook([equipment('FIRST'),equipment('SECOND')]));await expect(page.locator('#equipment-import-message')).toContainText('equipment rows loaded');await page.getByRole('button',{name:'Import selected equipment'}).click();await expect(page.locator('#equipment-import-message')).toContainText('1 selected records remain');await expect(page.locator('#equipment-import-dialog')).toContainText('Temporary save failure');await page.getByRole('button',{name:'Import selected equipment'}).click();await expect(page.locator('#equipment-import-message')).toContainText('0 selected records remain');
 const calls=await page.evaluate(()=>window.importCalls);expect(calls.map(row=>row.serial)).toEqual(['FIRST','SECOND','SECOND']);expect(calls.every(row=>row.options.historicalImport===true&&row.version===0&&row.technician==='OLD')).toBe(true);
});
