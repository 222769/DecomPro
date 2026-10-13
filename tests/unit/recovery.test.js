import {test} from 'node:test';import assert from 'node:assert/strict';import {archiveDeleted,restorePlan} from '../../src/recovery.js';
const item={id:'removed',serial:'ABC',asset:'A0001',model:'Original',technician:'JA',trolleyId:'old',trolley:'Old'};
test('recovery preserves equipment facts and prevents repeated, duplicate or locked placement',()=>{
 const archived=archiveDeleted({deletedItems:[]},[item]);assert.deepEqual(archived.deletedItems,[item]);
 const trolleys=[{id:'new',name:'New',status:'open'},{id:'locked',status:'ready'}];
 assert.deepEqual(restorePlan(item,[],trolleys,'new'),{...item,trolleyId:'new',trolley:'New'});
 assert.throws(()=>restorePlan(item,[item],trolleys,'new'),/already been restored/);
 assert.throws(()=>restorePlan(item,[{id:'another',serial:'abc'}],trolleys,'new'),/serial/);
 assert.throws(()=>restorePlan(item,[{id:'another',asset:'a0001'}],trolleys,'new'),/asset/);
 assert.throws(()=>restorePlan(item,[],trolleys,'locked'),/open trolley/);
});
