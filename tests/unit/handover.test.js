import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandover,handoverGroups,handoverReference,validateHandoverLink} from '../../src/handover-data.js';
import {createTrolley,validateTrolleys} from '../../src/trolleys.js';

test('handover links are unique to their first trolley, bounded and preserved with collection attribution',()=>{
 const trolleys=[createTrolley('One'),createTrolley('Two')],ids=trolleys.map(t=>t.id),pack=createHandover(ids,' Supplier ','2026-10-10T10:00:00Z');
 assert.equal(pack.company,'Supplier');assert.equal(pack.id,ids[0]);assert.match(handoverReference(pack.id),/^COL-[A-F0-9]{32}$/);
 const collected=validateTrolleys(trolleys.map(t=>({...t,status:'collected',company:pack.company,collectedAt:pack.collectedAt,collectedBy:'MA',handover:{id:pack.id,trolleyIds:ids}})));
 const group=handoverGroups(JSON.parse(JSON.stringify(collected)))[0];assert.equal(group.complete,true);assert.equal(group.trolleys.length,2);assert.equal(group.collectedBy,'MA');
 assert.equal(handoverGroups(collected.slice(0,1))[0].complete,false);
 assert.throws(()=>validateHandoverLink({id:ids[0],trolleyIds:[ids[0],ids[0]]}),/Invalid/);
 assert.throws(()=>validateHandoverLink({id:ids[1],trolleyIds:ids}),/Invalid/);
 assert.throws(()=>createHandover([], 'Supplier','2026-10-10'),/Invalid/);
 assert.throws(()=>createHandover(Array.from({length:7},()=>createTrolley('Extra').id),'Supplier','2026-10-10'),/Invalid/);
 assert.throws(()=>validateTrolleys([{...trolleys[0],handover:collected[0].handover}]),/Invalid trolley handover/);
});
