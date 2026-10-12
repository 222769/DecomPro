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
