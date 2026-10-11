import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionDashboard} from '../../src/collection-dashboard.js';

test('dashboard catches duplicates outside its collection and does not treat a stale ready status as pickup ready',()=>{
 const a={id:'a',name:'A',status:'ready'},b={id:'b',name:'B',status:'open'};
 const item=(id,trolleyId)=>({id,trolleyId,serial:'SAME-SERIAL',model:'M',manufacturer:'Maker',asset:'N/A'});
 const state={trolleys:[a,b],items:[item('first','a'),item('second','b')],collectionTrolleys:[{trolleyId:'a',sessionId:'summer'}]};
 const snapshot=JSON.stringify(state),result=collectionDashboard(state,{collectionId:'summer'});
 assert.equal(result.equipment,1);assert.equal(result.issues,1);assert.equal(result.counts.ready,0);assert.equal(result.rows[0].status,'review');assert.equal(JSON.stringify(state),snapshot);
});
test('empty ready trolleys cannot count as ready; collected exceptions are historical and shared assignment checks remain visible',()=>{
 const trolleys=[{id:'a',name:'Empty',status:'ready'},{id:'b',name:'History',status:'collected'},{id:'c',name:'Legacy',status:'open'}];
 const state={trolleys,collectionTrolleys:[],items:[{id:'old',trolleyId:'b',serial:'N/A',model:'N/A',manufacturer:'N/A',asset:'N/A'},{id:'legacy',trolley:'Legacy',serial:'SERIAL',model:'MODEL',manufacturer:'Maker',asset:'N/A'}]};
 const result=collectionDashboard(state,{shared:true});assert.equal(result.counts.ready,0);assert.equal(result.counts.empty,1);assert.equal(result.collectedEquipment,1);assert.equal(result.issues,1);assert.equal(result.rows[2].issues[0].kind,'assignment');
});
