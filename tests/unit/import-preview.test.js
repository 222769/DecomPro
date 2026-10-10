import {test} from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {referenceRowsFromWorkbook} from '../../src/recognition.js';import {buildImportPreview,importCounts} from '../../src/import-preview.js';
const fact=(serial,model='M1',manufacturer='Maker')=>({serial,model,manufacturer,source:'Excel',sheet:'Equipment',row:2});
test('preview identifies new facts, known and within-file duplicates, conflicts and incomplete rows',()=>{
 const rows=[fact(' new1 '),fact('NEW1'),fact('KNOWN1'),fact('KNOWN1','Other'),fact('INFILE','A'),fact('INFILE','B'),fact('INFILE','A'),fact('INVALID','N/A')];
 const preview=buildImportPreview(rows,[fact('KNOWN1')]);assert.deepEqual(preview.map(r=>r.status),['new','duplicate','duplicate','conflict','conflict','conflict','duplicate','incomplete']);assert.deepEqual(importCounts(preview),{new:1,duplicate:3,conflict:3,incomplete:1});assert.equal(preview[0].fact.serial,'NEW1');assert.equal(preview[3].existingFacts[0].model,'M1');assert.deepEqual(preview[7].missing,['model']);
 assert.equal(buildImportPreview([fact('KNOWN1','m1','MAKER')],[fact('KNOWN1')])[0].status,'duplicate');
});
test('reviewed exclusions/corrections are flagged without rewriting reviews; new evidence changes the preview',()=>{
 const rows=[fact('CHECK1')],review={serial:'CHECK1',mode:'excluded',model:'',manufacturer:'',note:'Unreliable label'};
 assert.equal(buildImportPreview(rows,[])[0].status,'new');const excluded=buildImportPreview(rows,[],[review])[0];assert.equal(excluded.status,'conflict');assert.equal(excluded.review.note,'Unreliable label');
 const corrected=buildImportPreview(rows,[],[{...review,mode:'corrected',model:'Checked',manufacturer:'Maker'}])[0];assert.equal(corrected.status,'conflict');assert.equal(corrected.existingFacts[0].model,'Checked');assert.notEqual(corrected.evidence,excluded.evidence);assert.equal(review.mode,'excluded');
});
test('spreadsheet reader retains incomplete rows and source coordinates, skips blanks and preserves leading zeroes',async()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Historic decom');sheet.addRow(['Report title']);sheet.addRow(['Manufacturer','Serial Number','Model','Cost']);sheet.addRow(['Maker','000123','M1',99]);sheet.addRow([]);sheet.addRow(['Maker','000124','N/A',55]);const notes=book.addWorksheet('Notes');notes.addRow(['Unrelated notes']);
 const rows=await referenceRowsFromWorkbook(await book.xlsx.writeBuffer());assert.equal(rows.length,2);assert.equal(rows[0].serial,'000123');assert.equal(rows[0].row,3);assert.equal(rows[1].row,5);assert.equal(rows[0].sheet,'Historic decom');assert.equal('cost' in rows[0],false);assert.equal(buildImportPreview(rows,[])[1].status,'incomplete');
});
