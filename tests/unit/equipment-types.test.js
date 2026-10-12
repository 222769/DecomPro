import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {suggestEquipmentDescription as suggest} from '../../src/equipment-types.js';
import {cleanExamples,referenceRowsFromWorkbook} from '../../src/recognition.js';
import {buildImportPreview} from '../../src/import-preview.js';
import {readFile} from 'node:fs/promises';
const facts=JSON.parse(await readFile(new URL('../../src/reference-catalogue.json',import.meta.url)));
test('model families override legacy monitor defaults without assuming a type from maker alone',()=>{
 for(const model of ['G15','ThinkPad T450','IdeaPad 3'])assert.equal(suggest(model,'Lenovo',[{model,manufacturer:'Lenovo',description:'Monitor',source:'Saved equipment'}]),'Laptop');
 assert.equal(suggest('Satellite Pro','Toshiba',facts),'Laptop');assert.equal(suggest('TIO24D','Lenovo',facts),'Monitor');assert.equal(suggest('OptiPlex 7050','Dell',facts),'Desktop');assert.equal(suggest('A1418','Apple',facts),'All-in-one computer');
 assert.equal(suggest('Unknown','Lenovo',facts),null);assert.equal(suggest('Pavilion','HP',[]),null);
});
test('spreadsheet categories are retained through preview and deduplication; conflicting types stay uncertain',async()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Equipment');sheet.addRow(['Serial Number','Model','Manufacturer','Description']);sheet.addRow(['QA1001','Other model','Other maker','Laptop']);
 const rows=await referenceRowsFromWorkbook(await book.xlsx.writeBuffer()),preview=buildImportPreview(rows,[]);assert.equal(cleanExamples(preview.map(r=>r.fact))[0].description,'Laptop');
 assert.equal(suggest('Other model','Other maker',rows),'Laptop');assert.equal(suggest('Other model','Other maker',[...rows,{...rows[0],description:'Monitor'}]),null);
 assert.equal(cleanExamples([...rows,{...rows[0],description:'Monitor'}])[0].description,undefined);
 assert.equal(suggest('Other model','Other maker',[...rows,{...rows[0],description:'Monitor',source:'Saved equipment'}]),'Laptop');
});
test('bundled facts provide different hardware categories without changing serial/model labels',()=>{
 assert.ok(facts.filter(f=>f.description).length>1400);
 for(const type of ['Laptop','Monitor','Desktop','Printer','Tablet','Switch'])assert.ok(facts.some(f=>f.description===type),type);
 for(const fact of facts.filter(f=>f.description==='Laptop').slice(0,20))assert.equal(suggest(fact.model,fact.manufacturer,facts),'Laptop');
});

test('existing-record repair plans change only descriptions and preserve ambiguous and locked inventory',async()=>{
 const {equipmentDescriptionPlan}=await import('../../src/equipment-types.js');
 const trolley={id:'t1',name:'Cage',status:'open'},item={id:'i1',trolleyId:'t1',trolley:'Cage',serial:'OLD1',model:'G15',manufacturer:'Lenovo',description:'Monitor',asset:'A1234',barcode:'B1',technician:'JA',date:'2026-10-12'};
 const plan=equipmentDescriptionPlan([item,{...item,id:'i2',model:'Unknown'},{...item,id:'i3',description:'Laptop'}],[trolley]);
 assert.equal(plan.changes.length,1);assert.deepEqual(plan.changes[0].after,{...item,description:'Laptop'});assert.equal(plan.changes[0].selected,true);assert.equal(item.description,'Monitor');assert.deepEqual(plan.skipped,{locked:0,unknown:1,unchanged:1});
 for(const status of ['ready','collected'])assert.equal(equipmentDescriptionPlan([item],[{...trolley,status}]).changes.length,0);
 assert.equal(equipmentDescriptionPlan([{...item,trolleyId:undefined}],[trolley,{...trolley,id:'t2'}]).changes.length,0);
 assert.equal(equipmentDescriptionPlan([{...item,description:'Custom laptop kit'}],[trolley]).changes[0].selected,false);
});
