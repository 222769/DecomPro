import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import ExcelJS from 'exceljs';
import {recognizeSerial,referenceRowsFromWorkbook} from '../../src/recognition.js';
const facts=JSON.parse(await readFile(new URL('../../src/reference-catalogue.json',import.meta.url)));

test('expanded catalogue includes all six reviewed sources and only recognition facts',()=>{
 assert.equal(facts.length,1527);for(const fact of facts)assert.deepEqual(Object.keys(fact).filter(k=>k!=='description').sort(),['manufacturer','model','serial','source']);
 for(const source of ['February-26','May-25','June-25','July-25','May-26','Summer-Macs'])assert.ok(facts.some(f=>f.source.includes(source)),source);
 const may=recognizeSerial('483474-004',facts),june=recognizeSerial('ST390580',facts);assert.equal(may.manufacturer,'Stone');assert.equal(may.model,'213');assert.equal(june.manufacturer,'Zoostorm');assert.equal(june.model,'9870');
});

test('new Apple family predicts a novel serial while known conflicts retain choices and previous families work',()=>{
 const apple=recognizeSerial('C17K3999DNCR',facts);assert.equal(apple.manufacturer,'Apple');assert.equal(apple.model,'A1418');assert.equal(apple.method,'pattern');
 for(const serial of ['MSCF090020L','1710005111','3ICT2DSC0002SN0851']){const match=recognizeSerial(serial,facts);assert.equal(match.method,'conflict');assert.ok(match.candidates.length>=2);}
 assert.equal(recognizeSerial('001917BD354B',facts).manufacturer,'posiflex');assert.equal(recognizeSerial('8F020669H',facts).manufacturer,'Toshiba');
});

test('reference import ignores a formatting-only tail at the final Excel row',async()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('References');sheet.addRow(['Serial Number','Manufacturer','Model']);sheet.addRow(['000123','Example maker','Example model']);sheet.getRow(1048576).height=20;
 const rows=await referenceRowsFromWorkbook(await book.xlsx.writeBuffer());assert.equal(rows.length,1);assert.equal(rows[0].serial,'000123');assert.equal(rows[0].row,2);
});

test('generic numeric counters do not block manual or batch models, while known Lenovo labels agree',()=>{
 for(const serial of ['LEGACY-001','SECOND-001','UNSEEN-001'])assert.equal(recognizeSerial(serial,facts),null);
 assert.equal(recognizeSerial('10LLNEW123ABC',facts).model,'TIO24D');
 const examples=['AAA-001','BBB-001','CCC-001'].map(serial=>({serial,model:'Model',manufacturer:'Maker'}));assert.equal(recognizeSerial('NEW-001',examples),null);
});
