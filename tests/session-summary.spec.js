import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';
import {defaultSettings} from '../src/workspace.js';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';

async function seed(page) {
 const open=createTrolley('Working trolley'),ready={...createTrolley('Ready trolley'),status:'ready',readyAt:new Date().toISOString(),readyBy:'MA'},collected={...createTrolley('Collected trolley'),status:'collected',collectedAt:new Date().toISOString(),collectedBy:'JA',company:'Collector'};
 await page.addInitScript(({trolleys,settings})=>{
  const d=new Date(),date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const defaults={date,description:'Monitor',manufacturer:'Dell',source:'Storage',reason:'EOL',trolley:trolleys[0].name};
  const items=[
   {...defaults,id:'first',serial:'SUMMARY-001',model:'N/A',manufacturer:'N/A',technician:'MA',trolleyId:trolleys[0].id},
   {...defaults,id:'second',serial:'SUMMARY-002',model:'P2419H',technician:'JA',trolley:trolleys[1].name,trolleyId:trolleys[1].id},
   {...defaults,id:'third',serial:'SUMMARY-003',date:'2020-01-01',model:'P2419H',technician:'OLD',trolley:trolleys[2].name,trolleyId:trolleys[2].id},
  ].map(item=>({...item,barcode:'N/A',etch:'N/A',asset:'A1234'}));
  localStorage.setItem('decompro.v1',JSON.stringify({captureOrder:'serial-first',activeTrolleyId:trolleys[0].id,trolleys,profiles:[{name:'Muhammad Ali',code:'MA'},{name:'Jawad',code:'JA'}],active:'MA',defaults,items,draft:{serial:'UNFINISHED-SCAN'},step:1,voice:false,settings,referenceExamples:[],referenceCorrections:[]}));
 },{trolleys:[open,ready,collected],settings:defaultSettings});
 await page.goto('/');return {open,ready,collected};
}

test('summary reviews missing details across trolleys and refreshes after correcting a record without clearing the scan',async({page})=>{
 await seed(page);
 const summary=page.getByRole('region',{name:'Session summary'});
 await expect(summary.locator('.session-metrics strong')).toHaveText(['2','1','1','1','1']);
 await expect(summary).toContainText('saved disposal date');
 await summary.locator('summary').click();await expect(summary.locator('.technician-progress')).toContainText('OLD');
 await page.getByLabel('Search collection register').fill('SUMMARY-002');
 await summary.getByRole('button',{name:'Review missing details'}).click();
 await expect(page.locator('#inventory tbody tr')).toHaveCount(1);await expect(page.locator('#inventory tbody')).toContainText('SUMMARY-001');
 await expect(page.getByLabel('Search collection register')).toHaveValue('');
 const exportDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export Excel',exact:true}).click();
 const exported=await exportDownload,workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await exported.path());
 expect(workbook.worksheets[0].rowCount).toBe(4);
 expect([2,3,4].map(row=>workbook.worksheets[0].getRow(row).getCell(6).value)).toEqual(['SUMMARY-001','SUMMARY-002','SUMMARY-003']);
 await page.getByRole('button',{name:'Edit item SUMMARY-001',exact:true}).click();
 await page.getByLabel('Manufacturer',{exact:true}).last().fill('Dell');
 await page.getByLabel('Model number',{exact:true}).last().fill('P2419H');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(summary.locator('.session-metrics strong')).toHaveText(['2','0','1','1','1']);
 await expect(page.locator('#inventory tbody')).toContainText('No items need missing details');
 await page.getByRole('button',{name:'Clear review filter'}).click();await expect(page.locator('#inventory tbody tr')).toHaveCount(3);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('UNFINISHED-SCAN');
});

test('phone summary opens trolley inventory and downloads its PDF label',async({page})=>{
 await page.setViewportSize({width:390,height:844});const {ready}=await seed(page);
 const summary=page.getByRole('region',{name:'Session summary'});await summary.locator('summary').click();
 const card=summary.locator('article').filter({hasText:'Ready trolley'});
 const download=page.waitForEvent('download');await card.getByRole('button',{name:'Print label',exact:true}).click();
 const file=await download;expect(file.suggestedFilename()).toBe(`${ready.reference}.pdf`);
 const bytes=await readFile(await file.path());expect(bytes.subarray(0,4).toString()).toBe('%PDF');
 await card.getByRole('button',{name:'View inventory',exact:true}).click();
 await expect(page.locator('#inventory tbody tr')).toHaveCount(1);await expect(page.locator('#inventory tbody')).toContainText('SUMMARY-002');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
