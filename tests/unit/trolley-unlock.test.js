import test from 'node:test';import assert from 'node:assert/strict';import {createTrolley} from '../../src/trolleys.js';import {trolleyUnlockPlan,unlockReason,validateUnlockHistory} from '../../src/trolley-unlock.js';
test('unlock preserves permanent identity and original collection metadata for audit',()=>{
 const trolley={...createTrolley('Cage'),status:'collected',company:'Collector',collectedAt:new Date().toISOString(),collectedBy:'JA',readyAt:new Date().toISOString(),readyBy:'JA'};
 const plan=trolleyUnlockPlan([trolley],trolley.id);assert.equal(plan.before[0].company,'Collector');assert.equal(trolley.status,'collected');assert.deepEqual(plan.after[0],{...trolley,status:'open',readyAt:'',readyBy:'',company:'',collectedAt:'',collectedBy:''});
 assert.equal(validateUnlockHistory([{before:plan.before,reason:'Correct pickup status',by:'MA',at:new Date().toISOString()}])[0].before[0].collectedBy,'JA');assert.throws(()=>unlockReason(' '));assert.throws(()=>unlockReason('x'.repeat(501)));
});
test('linked handovers unlock every trolley together and reject incomplete or stale groups',()=>{
 const trolleys=[createTrolley('One'),createTrolley('Two')],handover={id:trolleys[0].id,trolleyIds:trolleys.map(t=>t.id)};
 const collected=trolleys.map(t=>({...t,status:'collected',company:'Collector',collectedAt:new Date().toISOString(),collectedBy:'MA',handover}));
 const plan=trolleyUnlockPlan(collected,trolleys[1].id);assert.equal(plan.after.length,2);assert.ok(plan.after.every(t=>t.status==='open'&&!t.handover));assert.throws(()=>trolleyUnlockPlan(collected.slice(0,1),trolleys[0].id));assert.throws(()=>trolleyUnlockPlan(trolleys,trolleys[0].id));
});
