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

test('specific consistent prefixes can resolve a mixed four-character family',()=>{
 const family=[{serial:'ABCDPRO1001',model:'Pro display',manufacturer:'Example'},{serial:'ABCDPRO1XYZ',model:'Pro display',manufacturer:'Example'},{serial:'ABCDPRO1777',model:'Pro display',manufacturer:'Example'},{serial:'ABCDLITE001',model:'Lite display',manufacturer:'Example'},{serial:'ABCDLITEABC',model:'Lite display',manufacturer:'Example'}];
 const result=recognizeSerial('ABCDPRO1999',family);assert.equal(result.method,'pattern');assert.equal(result.model,'Pro display');assert.equal(result.support,3);assert.equal(result.prefix,'ABCDPRO1');
 const conflict=recognizeSerial('ABCDNEW9999',family);assert.equal(conflict.method,'conflict');assert.equal(conflict.prefix,'ABCD');assert.equal(conflict.candidates.length,2);
 assert.equal(recognizeSerial('ABCDPRO1999',[...family,{serial:'ABCDPRO1666',model:'Different Pro',manufacturer:'Example'}]).method,'conflict');
 assert.equal(recognizeSerial('ABCDPRO1999',[family[0],family[0],family[3]]).method,'conflict');
});

test('a long near-identical serial suggests a model with explicit single-reference evidence',()=>{
 const facts=[{serial:'001917BD323B',model:'XTE30722',manufacturer:'posiflex'}];
 const result=recognizeSerial('001917BD324B',facts);assert.equal(result.method,'similar');assert.equal(result.model,'XTE30722');assert.equal(result.support,1);assert.deepEqual(result.referenceSerials,['001917BD323B']);
 assert.equal(recognizeSerial('001917BD323B',facts).method,'exact');
 assert.equal(recognizeSerial('001917BD999B',facts),null);assert.equal(recognizeSerial('991917BD323B',facts),null);assert.equal(recognizeSerial('001917BD32AB',facts),null);
 assert.equal(recognizeSerial('ABC12345',[{serial:'ABC12344',model:'Short',manufacturer:'Maker'}]),null);
 const conflict=recognizeSerial('001917BD324B',[...facts,{serial:'001917BD325B',model:'Different',manufacturer:'posiflex'}]);assert.equal(conflict.method,'conflict');
});

test('mixed-model serial families suggest only a unanimous manufacturer with distinct evidence',()=>{
 const examples=[{serial:'BRND1001',model:'Display 24',manufacturer:'Example maker',source:'Workbook A'},{serial:'BRND1002',model:'Display 27',manufacturer:'EXAMPLE MAKER',source:'Workbook B'}];
 const result=recognizeSerial('BRND1999',examples);assert.equal(result.method,'conflict');assert.equal(result.manufacturer,'Example maker');assert.equal(result.model,undefined);assert.equal(result.support,2);assert.equal(result.prefix,'BRND');assert.equal(result.candidates.length,2);assert.equal(result.source,'Workbook A, Workbook B');
 assert.equal(recognizeSerial('BRND1999',[examples[0],examples[0]]),null);
 const mixed=recognizeSerial('BRND1999',[...examples,{serial:'BRND1003',model:'Display 32',manufacturer:'Other maker'}]);assert.equal(mixed.method,'conflict');assert.equal(mixed.manufacturer,undefined);
 assert.equal(recognizeSerial('BRND1001',[...examples,{...examples[0],model:'Different model'}]).manufacturer,'Example maker');
 assert.equal(recognizeSerial('BRND1001',[...examples,{...examples[0],manufacturer:'Other maker'}]).manufacturer,undefined);
 assert.equal(recognizeSerial('UNRELATED1999',examples),null);
});

test('long serial families support changing suffix counters across manufacturers without hardcoded serials',()=>{
 const posiflex=[{serial:'001917BD323B',model:'XTE30722',manufacturer:'posiflex'}];
 for(const serial of ['001917BD354B','001917BD365B','001917BD399B']) {
  const match=recognizeSerial(serial,posiflex);assert.equal(match.method,'similar');assert.equal(match.prefix,'001917BD3');assert.equal(match.model,'XTE30722');assert.equal(match.manufacturer,'posiflex');assert.equal(match.support,1);assert.deepEqual(match.referenceSerials,['001917BD323B']);
 }
 const other=[{serial:'ABCD12345001',model:'Dock X',manufacturer:'Other maker'}];
 const match=recognizeSerial('ABCD12345987',other);assert.equal(match.method,'similar');assert.equal(match.model,'Dock X');assert.equal(match.manufacturer,'Other maker');assert.equal(match.prefix,'ABCD12345');
 assert.equal(recognizeSerial('ABCD99945987',other),null);assert.equal(recognizeSerial('ABCD12345ABC',other),null);assert.equal(recognizeSerial('OTHER12345987',other),null);
 assert.equal(recognizeSerial('001917BD999B',posiflex),null);
});

test('sparse suffix matches never override an established conflicting model or manufacturer family',()=>{
 const sameBrand=[{serial:'ABCD12345001',model:'Dock X',manufacturer:'Other maker'},{serial:'ABCD99999001',model:'Dock Y',manufacturer:'Other maker'}];
 const match=recognizeSerial('ABCD12345987',sameBrand);assert.equal(match.method,'conflict');assert.equal(match.model,undefined);assert.equal(match.manufacturer,'Other maker');assert.equal(match.candidates.length,2);
 const mixed=recognizeSerial('ABCD12345987',[sameBrand[0],{...sameBrand[1],manufacturer:'Different maker'}]);assert.equal(mixed.model,undefined);assert.equal(mixed.manufacturer,undefined);
 const shortPrefix=[['ABC012345678','Dock X'],['ABC912345678','Dock Y'],['ABC812345678','Dock Z']].map(([serial,model])=>({serial,model,manufacturer:'Maker'}));
 assert.equal(recognizeSerial('ABC012345999',shortPrefix).method,'conflict');
 const contradictory=recognizeSerial('001917BD354B',[{serial:'001917BD323B',model:'XTE30722',manufacturer:'posiflex'},{serial:'001917BD323B',model:'Other model',manufacturer:'posiflex'}]);assert.equal(contradictory.method,'conflict');assert.equal(contradictory.model,undefined);assert.equal(contradictory.manufacturer,'posiflex');
});
