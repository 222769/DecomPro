import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';

for(const [device,width,height] of [['desktop',1440,900],['phone',390,844]]){
 test(`${device}: scan through collection handover, exports and recovery`,async({page,browser})=>{
  await page.setViewportSize({width,height});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?workspace=demo#station');
  await expect(page.locator('.test-workspace-banner')).toBeVisible();
  await expect(page.locator('#scan')).toBeVisible();

  const trolleyButton=page.getByRole('button',{name:'Trolleys',exact:true});
  if(!(await trolleyButton.isVisible()))await page.locator('#mobile-nav-toggle').click();
  await trolleyButton.click();
  await page.getByLabel('New trolley name').fill('TEST Walkthrough trolley');
  await page.getByRole('button',{name:'Create trolley',exact:true}).click();
  await expect(page.locator('.trolley-card').filter({hasText:'TEST Walkthrough trolley'})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();

  await page.evaluate(()=>location.hash='collections');
  await page.getByRole('button',{name:'Create collection',exact:true}).click();
  await page.getByLabel('Collection name').fill('TEST Walkthrough collection');
  await page.locator('.collection-trolley-option').filter({hasText:'TEST Walkthrough trolley'}).getByRole('checkbox').check();
  await page.getByRole('button',{name:'Save collection',exact:true}).click();
  await expect(page.locator('#collection-preparation-station')).toContainText('Step 3 of 4');

  await page.locator('#default-description').fill('Monitor');
  await page.locator('#default-manufacturer').fill('Dell');
  await page.locator('#default-source').fill('Storage');
  await page.locator('#default-reason').fill('EOL');
  for(const value of ['QA-WALK-001','P2419H','123456789','QA-ETCH-001','A9001']){
   await page.locator('#scan').fill(value);
   await page.locator('#scan').press('Enter');
  }
  await expect(page.getByRole('heading',{name:'Review this equipment'})).toBeVisible();
  await page.getByRole('button',{name:'Save item & start next'}).click();
  await expect(page.locator('#inventory tbody')).toContainText('QA-WALK-001');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')));
  const trolley=saved.trolleys.find(row=>row.name==='TEST Walkthrough trolley');
  const item=saved.items.find(row=>row.serial==='QA-WALK-001');
  expect(item).toMatchObject({description:'Monitor',manufacturer:'Dell',model:'P2419H',barcode:'123456789',etch:'QA-ETCH-001',asset:'A9001',trolleyId:trolley.id});

  await page.locator(width<=700?'#register-prepare-collection':'#station-prepare-collection').click();
  const guide=page.locator('#collection-preparation-station');
  await expect(guide).toContainText('Step 3 of 4');
  await guide.getByRole('button',{name:/^Check TEST Walkthrough trolley/}).click();
  await expect(page.locator('.readiness-summary')).toContainText('0 unresolved issues');
  await page.getByLabel('I checked these items and any recorded exceptions before collection.').check();
  await page.getByRole('button',{name:'Mark ready for collection',exact:true}).click();
  await expect(guide).toContainText('Step 4 of 4');
  await guide.getByRole('button',{name:'Prepare handover pack'}).click();
  await page.getByLabel('Collection company',{exact:true}).fill('TEST Collector');
  await page.locator(`[name=handover-trolley][value="${trolley.id}"]`).check();

  const excelPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download equipment Excel'}).click();
  const excel=await excelPromise,book=new ExcelJS.Workbook();
  await book.xlsx.readFile(await excel.path());
  expect(book.worksheets[0].rowCount).toBe(2);
  expect(book.worksheets[0].getCell('F2').value).toBe('QA-WALK-001');

  const pdfPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download handover PDF'}).click();
  const pdf=await pdfPromise,pdfText=(await readFile(await pdf.path())).toString('latin1');
  expect(pdfText).toContain('%PDF');
  expect(pdfText).toContain('QA-WALK-001');
  await page.getByLabel('I checked the pack and these trolleys have been collected').check();
  await page.getByRole('button',{name:'Mark selected collected'}).click();
  const handoverCard=page.locator('.handover-history-card').filter({hasText:'TEST Walkthrough trolley'});
  await expect(handoverCard).toContainText('TEST Collector');

  const supplierPromise=page.waitForEvent('download');
  await handoverCard.getByRole('button',{name:'Download supplier Excel'}).click();
  const supplier=await supplierPromise,supplierBook=new ExcelJS.Workbook();
  await supplierBook.xlsx.readFile(await supplier.path());
  expect(supplierBook.worksheets[0].rowCount).toBe(2);
  expect(supplierBook.worksheets[0].getCell('F2').value).toBe('QA-WALK-001');

  const collectionCard=page.locator('.completed-collection-export').filter({hasText:'TEST Walkthrough collection'});
  await expect(collectionCard).toContainText('1 equipment item');
  const collegePromise=page.waitForEvent('download');
  await collectionCard.getByRole('button',{name:'Download collection Excel'}).click();
  const college=await collegePromise,collegeBook=new ExcelJS.Workbook();
  await collegeBook.xlsx.readFile(await college.path());
  expect(collegeBook.worksheets[0].rowCount).toBe(2);
  expect(collegeBook.worksheets[0].getCell('F2').value).toBe('QA-WALK-001');

  const final=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')));
  expect(final.trolleys.find(row=>row.id===trolley.id).status).toBe('collected');
  await page.evaluate(()=>location.hash='inventory');
  const backupPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Backup',exact:true}).click();
  const backup=await backupPromise;
  const recoveredContext=await browser.newContext(),recovered=await recoveredContext.newPage();
  await recovered.goto('/?workspace=demo#inventory');
  await recovered.locator('#backup-file').setInputFiles(await backup.path());
  await recovered.getByRole('button',{name:'Replace workspace & restore'}).click();
  await expect(recovered.locator('#inventory tbody')).toContainText('QA-WALK-001');
  const restored=await recovered.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')));
  expect(restored.trolleys.find(row=>row.id===trolley.id).handover).toEqual(final.trolleys.find(row=>row.id===trolley.id).handover);
  await recoveredContext.close();
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 });
}
