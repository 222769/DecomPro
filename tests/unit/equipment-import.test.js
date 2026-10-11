import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {cleanExamples} from '../../src/recognition.js';
import {equipmentRowsFromWorkbook,equipmentImportPlan,equipmentDate} from '../../src/equipment-import.js';
const trolley={id:'trolley-id',name:'Previous collection',status:'open'};
const row=(serial='00001234',overrides={})=>({id:serial,sheet:'Equipment',row:2,values:{date:'2026-02-16',serial,model:'Panel',manufacturer:'Example',asset:'N/A',technician:'JA',...overrides}});
test('equipment importer reads supplier headings, first asset column, all sheets and formatted identifiers',async()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Equipment');sheet.addRow(['Notes']);sheet.addRow(['Date of disposal','Serial Number','Model','Manufacturer','Who disposed of it?','Asset Number','Asset Number','Barcode']);
 sheet.addRow([new Date('2026-02-16T00:00:00Z'),123,'Panel','Example','JA','A1234','Accounting field',42]);sheet.getCell('B3').numFmt='00000000';sheet.getCell('H3').numFmt='000000';sheet.addRow([]);
 const second=book.addWorksheet('More');second.addRow(['Serial Number','Model']);second.addRow(['00000999','Other']);
 const rows=await equipmentRowsFromWorkbook(await book.xlsx.writeBuffer());assert.equal(rows.length,2);assert.equal(rows[0].values.serial,'00000123');assert.equal(rows[0].values.barcode,'000042');assert.equal(rows[0].values.date,'2026-02-16');assert.equal(rows[0].values.asset,'A1234');assert.equal(rows[1].values.serial,'00000999');assert.notEqual(rows[0].id,rows[1].id);
});
test('equipment dates preserve UK dates and reject invalid dates rather than applying defaults',()=>{
 assert.equal(equipmentDate('16/02/2026'),'2026-02-16');assert.equal(equipmentDate(46069),'2026-02-16');assert.equal(equipmentDate(1,true),'1904-01-02');assert.equal(equipmentDate(0),'0');
 const plan=equipmentImportPlan([row('ONE',{date:'2026-02-31'}),row('TWO',{date:'',technician:''})],[],trolley,{date:'2026-02-16',technician:'MA'});
 assert.equal(plan[0].status,'blocked');assert.equal(plan[1].status,'new');assert.equal(plan[1].item.technician,'MA');assert.equal(plan[1].item.barcode,'N/A');
});
test('preview blocks duplicates and locked destinations, preserves attribution and excludes imports from recognition until checked',()=>{
 const rows=[row('ONE',{asset:'A1234'}),row('TWO',{asset:'a1234'})];assert.ok(equipmentImportPlan(rows,[],trolley).every(r=>r.status==='blocked'));
 assert.equal(equipmentImportPlan([rows[0]],[],trolley)[0].status,'new');
 assert.equal(equipmentImportPlan([row(' one ')],[{serial:'ONE',asset:'N/A'}],trolley)[0].status,'blocked');
 assert.equal(equipmentImportPlan([row()],[{serial:'OTHER',asset:'A1234'}],{...trolley,status:'collected'})[0].status,'blocked');
 const entry=equipmentImportPlan([row('HISTORY',{asset:'Legacy-12'})],[],trolley)[0];assert.equal(entry.status,'new');assert.equal(entry.item.technician,'JA');assert.equal(entry.item.asset,'LEGACY-12');assert.equal(entry.item.recognitionConfirmed,false);assert.equal(entry.item.recognitionNeedsReview,true);assert.equal(cleanExamples([entry.item]).length,0);assert.equal(cleanExamples([{...entry.item,recognitionConfirmed:true}]).length,1);assert.ok(entry.warnings.some(w=>w.includes('Historical asset')));
 assert.equal(equipmentImportPlan([row('HISTORY',{asset:'Legacy-12'})],[entry.item],trolley)[0].status,'saved');assert.equal(equipmentImportPlan([row('HISTORY',{asset:'Legacy-12'})],[{...entry.item,model:'Edited'}],trolley)[0].status,'blocked');
});
