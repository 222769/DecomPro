import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrolley,validateTrolleys,findTrolley,trolleyForItem,defaultDepartment} from '../../src/trolleys.js';

test('trolley references stay unique and survive serialization, with exact barcode lookup',()=>{
 const a=createTrolley('Trolley 01'),b=createTrolley('Trolley 02');
 assert.notEqual(a.reference,b.reference);assert.equal(a.department,defaultDepartment);
 const restored=validateTrolleys(JSON.parse(JSON.stringify([a,b])));
 assert.equal(findTrolley(a.reference.toLowerCase(),restored).id,a.id);
 assert.equal(trolleyForItem({trolleyId:b.id,trolley:a.name},a),false);
 assert.equal(trolleyForItem({trolley:a.name},a),true);
 assert.throws(()=>validateTrolleys([a,a]),/repeated/);
 assert.throws(()=>validateTrolleys([{...a,reference:b.reference}]),/reference/);
});

test('collection details must be complete and legacy long trolley names remain valid',()=>{
 const trolley=createTrolley('Legacy '.repeat(20));assert.equal(validateTrolleys([trolley])[0].name,trolley.name);
 assert.throws(()=>validateTrolleys([{...trolley,status:'collected'}]),/collection/);
 const collected={...trolley,status:'collected',collectedAt:new Date().toISOString(),collectedBy:'JA',company:'Supplier'};
 assert.equal(validateTrolleys([collected])[0].status,'collected');
 assert.throws(()=>validateTrolleys([{...collected,status:'open'}]),/status/);
});

test('shared trolley creation uses one case-and-spacing-normalized permanent reference per workspace name',async()=>{
 const {createSharedTrolley}=await import('../../src/trolleys.js');const a=await createSharedTrolley('Trolley 1.1',undefined,'project/team'),b=await createSharedTrolley('  trolley   1.1  ',undefined,'project/team'),c=await createSharedTrolley('Trolley 1.1',undefined,'project/other');assert.equal(a.id,b.id);assert.equal(a.reference,b.reference);assert.notEqual(a.id,c.id);assert.equal(validateTrolleys([a]).length,1);
});
test('trolley name claim keys fold case and ASCII spacing the same way as the Firestore rules',async()=>{
 const {trolleyClaimKey}=await import('../../src/trolleys.js');
 const key=await trolleyClaimKey('Trolley 1.1');
 assert.match(key,/^n-[0-9a-f]{64}$/);
 for(const name of [' trolley 1.1','TROLLEY  1.1 ','Trolley\t1.1'])assert.equal(await trolleyClaimKey(name),key);
 assert.notEqual(await trolleyClaimKey('Trolley 1.2'),key);
});
