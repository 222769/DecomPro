import test from 'node:test';
import assert from 'node:assert/strict';
import {recognizeSerial,cleanExamples,examplesFromWorkbook} from '../../src/recognition.js';
import ExcelJS from 'exceljs';
const examples=[101,102,103].map(n=>({serial:`ABC${n}`,model:'Desk 400',manufacturer:'Example manufacturer'}));
test('exact serial normalization and conservative pattern inference',()=>{
 assert.equal(recognizeSerial(' abc101 ',examples).method,'exact');
 const guess=recognizeSerial('ABC104',examples);assert.equal(guess.method,'pattern');assert.equal(guess.model,'Desk 400');assert.equal(guess.support,3);
 assert.equal(recognizeSerial('ABC104',examples.slice(0,2)).prefix,'ABC1');
 assert.equal(recognizeSerial('ABC104',examples.slice(0,1)),null);
 assert.equal(recognizeSerial('ABC0104',examples),null);
 assert.equal(recognizeSerial('OTHER104',examples),null);
});
test('four-character prefixes recognise varying suffix shapes, with independent evidence and conflicts checked',()=>{
 const family=['10LLPAR6WLV9038VC0','10LLPAR6WLV90372NY'].map(serial=>({serial,model:'TIO24D',manufacturer:'Lenovo'}));
 const match=recognizeSerial('10LLNEW123ABC',family);
 assert.equal(match.method,'pattern');assert.equal(match.prefix,'10LL');assert.equal(match.model,'TIO24D');assert.equal(match.manufacturer,'Lenovo');assert.equal(match.support,2);
 assert.equal(recognizeSerial('10LLNEW123ABC',[family[0],family[0]]),null);
 assert.equal(recognizeSerial('10LLNEW123ABC',[...family,{serial:'10LLOTHER123',model:'Other model',manufacturer:'Lenovo'}]).method,'conflict');
 assert.equal(recognizeSerial(family[0].serial,[...family,{serial:'10LLOTHER123',model:'Other model',manufacturer:'Lenovo'}]).method,'exact');
 assert.equal(recognizeSerial('20LLNEW123ABC',family),null);
});
test('duplicates do not inflate evidence and contradictory labels block guessing',()=>{
 assert.equal(cleanExamples([...examples,examples[0]]).length,3);
 assert.equal(recognizeSerial('ABC104',[examples[0],examples[0],examples[0]]),null);
 const contradictory={...examples[0],model:'Different model'};
 assert.equal(recognizeSerial('ABC101',[...examples,contradictory]).method,'conflict');
 assert.equal(recognizeSerial('ABC104',[...examples,contradictory]).method,'conflict');
 assert.equal(recognizeSerial('N/A',examples),null);
 assert.equal(cleanExamples([{serial:'0001',model:'N/A',manufacturer:'Example'}]).length,0);
});
test('spreadsheet importer maps headers across sheets and preserves string identifiers',async()=>{
 const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Inventory');sheet.addRow(['Manufacturer','Serial Number','Model']);sheet.addRow(['Example','000123','Example model']);sheet.addRow(['Example','N/A','Example model']);
 const second=workbook.addWorksheet('Notes');second.addRow(['Notes']);
 const rows=await examplesFromWorkbook(await workbook.xlsx.writeBuffer());assert.equal(rows.length,1);assert.equal(rows[0].serial,'000123');assert.equal(rows[0].model,'Example model');
});
