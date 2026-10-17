import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createTrolley} from '../src/trolleys.js';
import {collectionReportPdf} from '../src/collection-report.js';
import {defaultSettings} from '../src/workspace.js';

test('a large collection PDF keeps the complete inventory in a continuous list',async()=>{
 const trolley=createTrolley('PDF trolley');
 const items=Array.from({length:60},(_,index)=>({
  id:`pdf-item-${index}`,date:'2026-10-13',description:'Laptop',manufacturer:'Lenovo',model:'ThinkPad T14',
  serial:`LIST-SERIAL-${String(index+1).padStart(3,'0')}`,barcode:`LIST-BARCODE-${index}`,etch:`LIST-ETCH-${index}`,
  asset:`A${index}`,source:index===36?'Storage room with a longer location to verify wrapping':'Storage',
  reason:'EOL',trolley:trolley.name,trolleyId:trolley.id,technician:'JA'
 }));
 const pdf=Buffer.from(await collectionReportPdf({title:'October collection',reference:'COL-2026-10',items,trolleys:[trolley],includeSustainability:false})).toString('latin1');
 expect((pdf.match(/\/Type \/Page\b/g)||[]).length).toBeLessThanOrEqual(10);
 for(const item of items)expect(pdf).toContain(item.serial);
 expect(pdf.includes('Storage room with a longer')).toBe(true);
 expect(pdf.includes('location to verify wrapping')).toBe(true);
});

test('collection PDF includes every item detail in the trolley scope and the requested credits',async({page})=>{
 const first=createTrolley('PDF trolley'),second=createTrolley('Other trolley');
 const items=[1,2,3].map(number=>({id:`pdf-item-${number}`,date:'2026-10-13',description:'Laptop',manufacturer:'Lenovo',model:'ThinkPad T14',serial:`PDF-SERIAL-${number}`,barcode:`PDF-BARCODE-${number}`,etch:`PDF-ETCH-${number}`,asset:`A123${number}`,source:'Storage',reason:'EOL',trolley:first.name,trolleyId:first.id,technician:'JA'}));
 items.push({...items[0],id:'other-item',serial:'OTHER-SERIAL',trolley:second.name,trolleyId:second.id});
 const state={captureOrder:'serial-first',activeTrolleyId:first.id,trolleys:[first,second],profiles:[{name:'Jawad',code:'JA'}],active:'JA',defaults:{date:'2026-10-13',description:'',manufacturer:'',source:'Storage',reason:'EOL',trolley:first.name},items,draft:{},step:0,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]};
 await page.addInitScript(data=>localStorage.setItem('decompro.v1',JSON.stringify(data)),state);
 await page.goto('/');await page.locator('aside a[href="#inventory"]').click();
 await page.locator('#trolley-register-filter').selectOption(first.id);
 await page.getByLabel('Search collection register').fill('no matching result');
 const download=page.waitForEvent('download');await page.locator('#export-pdf').click();const file=await download;
 const pdf=(await readFile(await file.path())).toString('latin1');
 expect(pdf.startsWith('%PDF')).toBe(true);
 for(const detail of ['PDF-SERIAL-1','PDF-SERIAL-2','PDF-SERIAL-3','PDF-BARCODE-2','PDF-ETCH-2','A1232','ThinkPad T14','Storage','EOL','Environmental record','Carbon impact: awaiting verified evidence','Developed by Muhammad Ali & Jawad Ahmed','Designed for the people who keep IT running.','https://hxali.co.uk/'])expect(pdf).toContain(detail);
 expect(pdf).not.toContain('OTHER-SERIAL');
 expect((pdf.match(/\/Type \/Page\b/g)||[]).length).toBeLessThanOrEqual(4);
 await page.locator('aside a[href="#overview"]').click();
 await page.locator('#dashboard-sustainability-toggle').uncheck();
 await page.locator('aside a[href="#inventory"]').click();
 const secondDownload=page.waitForEvent('download');await page.locator('#export-pdf').click();const withoutSummary=(await readFile(await (await secondDownload).path())).toString('latin1');
 expect(withoutSummary).not.toContain('Environmental record');
 expect(withoutSummary).toContain('PDF-SERIAL-1');
});

test('PDF logo can be uploaded in Settings and survives reload',async({page})=>{
 await page.goto('/');await page.locator('#settings').click();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nxXcAAAAASUVORK5CYII=','base64');
 await page.locator('#pdf-logo-file').setInputFiles({name:'company.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('#pdf-logo-status')).toContainText('Logo saved');
 await expect(page.locator('#pdf-logo-preview')).toBeVisible();
 await page.reload();await page.locator('#settings').click();
 await expect(page.locator('#pdf-logo-preview')).toBeVisible();
 await page.locator('#remove-pdf-logo').click();await expect(page.locator('#pdf-logo-empty')).toBeVisible();
});
