import {snapshotEvidence} from '../../src/recognition-evidence.js';
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

test('suffix families suggest only a unanimous manufacturer across varied production prefixes',()=>{
 const facts=['7F020669H','8E154818H','9E180986H'].map((serial,i)=>({serial,manufacturer:'Toshiba',model:i?'Protege':'Satellite Pro'}));
 const result=recognizeSerial('8F020669H',facts);
 assert.equal(result.manufacturer,'Toshiba');assert.equal(result.method,'conflict');assert.equal(result.model,undefined);assert.equal(result.suffix,'H');assert.equal(result.format,'9A999999A');
 assert.equal(recognizeSerial('8F020669H',[...facts,{serial:'5E014556H',manufacturer:'Other maker',model:'Other'}]),null);
 assert.equal(recognizeSerial('8F020669H',facts.slice(0,2)),null);
 assert.equal(recognizeSerial('8F020669H',[facts[0],facts[0],facts[0]]),null);
 assert.equal(recognizeSerial('8F020669H',facts.map(f=>({...f,serial:f.serial.replace(/^.../,'7F0')}))),null);
 assert.equal(recognizeSerial('7F020669H',facts).method,'exact');
});

test('shared numeric or alphanumeric endings recognize models across changing production prefixes',()=>{
 const facts=['ABX987654','CDY987654','EFZ987654'].map(serial=>({serial,model:'Panel 24',manufacturer:'Example maker'}));
 const result=recognizeSerial('NEW987654',facts);assert.equal(result.model,'Panel 24');assert.equal(result.manufacturer,'Example maker');assert.equal(result.suffix,'987654');assert.equal(result.method,'pattern');
 const letters=facts.map(f=>({...f,serial:f.serial.replace('987654','TYPE24')}));assert.equal(recognizeSerial('NEWTYPE24',letters).suffix,'TYPE24');
 const separated=facts.map(f=>({...f,serial:f.serial.replace('987654','TYPE-24')}));assert.equal(snapshotEvidence(recognizeSerial('NEWTYPE-24',separated)).suffix,'TYPE-24');
 const mixed=facts.map((f,i)=>({...f,model:i?'Panel 27':'Panel 24'}));const uncertain=recognizeSerial('NEW987654',mixed);assert.equal(uncertain.method,'conflict');assert.equal(uncertain.manufacturer,'Example maker');assert.equal(uncertain.model,undefined);
 assert.equal(recognizeSerial('NEW987654',facts.slice(0,2)),null);
 const conflicting=recognizeSerial('NEW987654',[...facts,{serial:'GHW987654',manufacturer:'Other maker',model:'Other panel'}]);assert.equal(conflicting.method,'conflict');assert.equal(conflicting.manufacturer,undefined);
});

test('short maker prefixes span changing layouts without asserting a model or overruling conflicting brands',()=>{
 const facts=['6VDFPRNW','6VDFT3RQ','6VDDQE3R','6VDFBBP3','6VDFT506'].map(serial=>({serial,manufacturer:'Seagate',model:'Recorded drive model'}));
 const result=recognizeSerial('6VMXQA12',facts);assert.equal(result.manufacturer,'Seagate');assert.equal(result.model,undefined);assert.equal(result.prefix,'6V');
 assert.equal(recognizeSerial('6VMXQA12',[...facts,{serial:'6VXXQ123',manufacturer:'Other maker',model:'Other drive'}]),null);
});
test('anchored terminal families tolerate changing middle formats and preserve uncertainty',()=>{
 const serials=['I7C554880RSSKC902300JENB','I8C409506RSSKDH00G004ENB','IZB029552KSSC1M01700KENB','IXD096674SSSCG702G041ENB'];
 const facts=serials.map(serial=>({serial,manufacturer:'Toshiba',model:'Satellite Pro'}));
 const result=recognizeSerial('I0X123456ABCDEFGH12345ENB',facts);assert.equal(result,null); // length mismatch
 const candidate='I0X554880RSSKC902300JENB';assert.equal(candidate.length,24);
 const match=recognizeSerial(candidate,facts);assert.equal(match.model,'Satellite Pro');assert.equal(match.suffix,'ENB');assert.equal(snapshotEvidence(match).format,'Starts I; 24 characters');
 const mixed=recognizeSerial(candidate,[...facts,{serial:'I9C554880RSSKC902300JENB',manufacturer:'Toshiba',model:'Other model'}]);assert.equal(mixed.method,'conflict');assert.equal(mixed.manufacturer,'Toshiba');
});

test('manufacturer-only four-character families do not hide mixed manufacturers in their parent family',()=>{
 const facts=[{serial:'ST348671',manufacturer:'Zoostorm',model:'A'},{serial:'ST348759',manufacturer:'Zoostorm',model:'A'},{serial:'ST349764',manufacturer:'Zoostorm',model:'B'},{serial:'ST390573',manufacturer:'Stone',model:'C'}];
 const result=recognizeSerial('ST348721',facts);assert.equal(result.method,'conflict');assert.equal(result.manufacturer,undefined);assert.equal(result.prefix,'ST3');
});

test('small suffix families suggest a maker using a fixed format or anchored changing middle',()=>{
 const facts=['59FACYWKTCN3','59F2C08LTCN3'].map(serial=>({serial,manufacturer:'Toshiba',model:'MK1652GSX'}));
 const match=recognizeSerial('59F9Z77QTCN3',facts);
 assert.equal(match.manufacturer,'Toshiba');assert.equal(match.model,undefined);assert.equal(match.support,2);assert.equal(match.suffix,'TCN3');assert.equal(match.format,'Starts 59; 12 characters');
 assert.equal(match.candidates[0].model,'MK1652GSX');assert.equal(snapshotEvidence(match).suffix,'TCN3');
 assert.equal(recognizeSerial('59F9Z77QTCN3',[facts[0],facts[0]]),null);
 assert.equal(recognizeSerial('89F9Z77QTCN3',facts),null);
 assert.equal(recognizeSerial('59F9Z777QTCN3',facts),null);
 assert.equal(recognizeSerial('59F9Z77QTCN3',[...facts,{serial:'89F9Z77QTCN3',manufacturer:'Other maker',model:'Other'}]).manufacturer,undefined);
 const formatted=['AX100TYPE','BZ200TYPE'].map(serial=>({serial,manufacturer:'Example maker',model:'Panel'}));
 const result=recognizeSerial('CW300TYPE',formatted);assert.equal(result.manufacturer,'Example maker');assert.equal(result.model,undefined);assert.equal(result.format,'AA999AAAA');
 assert.equal(recognizeSerial('CW300TYPE',[...formatted,{serial:'DZ400TYPE',manufacturer:'Other maker',model:'Other'}]).manufacturer,undefined);
});

test('two independent short-prefix references suggest only a maker and check other layouts for conflicts',()=>{
 const facts=['DRV100AA','DRV200BB'].map(serial=>({serial,manufacturer:'Maker',model:'Drive'}));
 const result=recognizeSerial('DRV300CC',facts);assert.equal(result.manufacturer,'Maker');assert.equal(result.model,undefined);assert.equal(result.prefix,'DRV');assert.equal(result.support,2);
 assert.equal(recognizeSerial('DRV300CC',[facts[0],facts[0]]),null);
 assert.equal(recognizeSerial('DRV300CC',[...facts,{serial:'DRVAB123',manufacturer:'Other maker',model:'Other'}]),null);
});
