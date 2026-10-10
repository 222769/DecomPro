import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localImportPlan,sameRecord} from '../../src/local-import.js';
import {createTrolley} from '../../src/trolleys.js';
const trolley=createTrolley('Import cage');
const item=(id,serial)=>({id,serial,model:'Display',trolleyId:trolley.id,trolley:trolley.name});
test('local import distinguishes exact retries from conflicting IDs and serials without overwriting',()=>{
 const source=[item('one','ABC001'),item('two','ABC002'),item('three','ABC003'),item('four','ABC004')];
 const remote={items:[source[0],{...source[1],model:'Changed by team'},item('other','abc003')],trolleys:[trolley]};
 const before=JSON.stringify(source);
 const rows=localImportPlan({items:source,trolleys:[trolley]},remote);
 assert.deepEqual(rows.map(row=>row.status),['saved','blocked','blocked','new']);
 assert.match(rows[1].reason,/different shared details/);assert.match(rows[2].reason,/already in the shared/);
 assert.equal(JSON.stringify(source),before);
});
test('import rejects repeated local serials, ambiguous assignments and locked shared trolleys',()=>{
 const duplicate=[item('one','ABC001'),item('two',' abc001 ')];
 assert.ok(localImportPlan({items:duplicate,trolleys:[trolley]},{items:[],trolleys:[]}).every(row=>row.status==='blocked'));
 const legacy={...item('legacy','LEGACY001')};delete legacy.trolleyId;
 const other=createTrolley(trolley.name);
 assert.equal(localImportPlan({items:[legacy],trolleys:[trolley,other]},{items:[],trolleys:[]})[0].status,'blocked');
 const linked=localImportPlan({items:[legacy],trolleys:[trolley]},{items:[],trolleys:[]})[0];assert.equal(linked.item.trolleyId,trolley.id);assert.equal(legacy.trolleyId,undefined);
 assert.equal(localImportPlan({items:[item('new','NEW001')],trolleys:[trolley]},{items:[],trolleys:[{...trolley,status:'ready'}]})[0].status,'blocked');
});
test('retry comparison ignores field order but detects changed equipment and review notes',()=>{
 assert.ok(sameRecord({id:'one',readinessNotes:{serial:'Checked',model:'Missing'}},{readinessNotes:{model:'Missing',serial:'Checked'},id:'one'}));
 assert.equal(sameRecord({id:'one',model:'Original'},{id:'one',model:'Changed'}),false);
});
