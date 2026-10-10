import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkReadiness,validateReadinessNotes} from '../../src/readiness.js';
import {createTrolley,validateTrolleys} from '../../src/trolleys.js';
const trolley=createTrolley('Cage 01');
const item=(id='one')=>({id,trolleyId:trolley.id,trolley:trolley.name,serial:'SERIAL-'+id,asset:'A0001',model:'Model',manufacturer:'Maker'});

test('readiness checks scope by permanent trolley reference and detect normalized identifiers across the register',()=>{
 const first=item(),other={...item('two'),trolleyId:'other',trolley:'Cage 02',serial:' serial-ONE ',asset:'a0001'};
 const result=checkReadiness(trolley,[first,other]);assert.equal(result.items.length,1);assert.equal(result.canReady,false);
 assert.deepEqual(result.unresolved.map(issue=>issue.field),['serial','asset']);assert.deepEqual(result.unresolved[0].otherIds,['two']);
 assert.equal(checkReadiness(trolley,[{...first,asset:'N/A'},{...other,serial:'different',asset:'N/A'}]).canReady,true);
});
test('missing details need recorded explanations; a reason cannot waive a duplicate or an unchecked suggestion',()=>{
 const first={...item(),serial:'N/A',model:'unknown',manufacturer:' - ',asset:'N/A',recognitionNeedsReview:true,recognitionConfirmed:false};
 assert.equal(checkReadiness(trolley,[first]).unresolved.length,4);
 const noted={...first,readinessNotes:{serial:'Label worn off',model:'No model label',manufacturer:'Unbranded housing'}};
 assert.equal(checkReadiness(trolley,[noted]).unresolved.length,1);
 assert.equal(checkReadiness(trolley,[{...noted,recognitionConfirmed:true}]).canReady,true);
 const duplicate={...item(),readinessNotes:{serial:'Ignore duplicate'}};
 assert.equal(checkReadiness(trolley,[duplicate,{...duplicate,id:'another'}]).canReady,false);
});
test('empty trolleys cannot become ready; shared legacy records need an explicit reference assignment',()=>{
 assert.equal(checkReadiness(trolley,[]).canReady,false);
 const legacy={...item(),trolleyId:undefined};assert.equal(checkReadiness(trolley,[legacy]).canReady,true);
 assert.equal(checkReadiness(trolley,[legacy],{shared:true}).unresolved[0].kind,'assignment');
});
test('notes are bounded, normalized and restricted to unavailable equipment details',()=>{
 assert.deepEqual(validateReadinessNotes({serial:' Checked base ',model:' '}),{serial:'Checked base'});
 for(const value of [null,[],{asset:'skip'},{serial:4},{model:'x'.repeat(501)}])assert.throws(()=>validateReadinessNotes(value),/readiness|Readiness/);
});
test('readiness attribution survives backups and is cleared when reopening, while old collected trolleys remain valid',()=>{
 const ready={...trolley,status:'ready',readyAt:'2026-10-10T12:00:00Z',readyBy:'MA'};
 assert.deepEqual(validateTrolleys(JSON.parse(JSON.stringify([ready])))[0],ready);
 assert.throws(()=>validateTrolleys([{...ready,readyBy:''}]),/readiness/);
 assert.throws(()=>validateTrolleys([{...ready,status:'open'}]),/readiness/);
 assert.equal(validateTrolleys([{...ready,status:'open',readyAt:'',readyBy:''}])[0].status,'open');
 assert.equal(validateTrolleys([{...trolley,status:'collected',collectedAt:'2026-10-10T12:00:00Z',collectedBy:'MA',company:'Supplier'}])[0].status,'collected');
});
