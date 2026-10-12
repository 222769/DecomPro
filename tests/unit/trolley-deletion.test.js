import test from 'node:test';import assert from 'node:assert/strict';
import {createTrolley,removeTrolley,reconcileTrolleySelection} from '../../src/trolleys.js';
test('deleting an empty trolley clears its device selections while preserving equipment and unfinished scans',()=>{
 const target=createTrolley('Duplicate'),other=createTrolley('Original'),draft={serial:'UNFINISHED'};
 const state={trolleys:[target,other],items:[{id:'i',trolleyId:other.id,trolley:other.name}],defaults:{trolley:target.name},activeTrolleyId:target.id,draft,collectionScans:{unassigned:{draft,activeTrolleyId:target.id,defaults:{trolley:target.name}}},collectionTrolleys:[]};
 const next=removeTrolley(state,target.id);assert.deepEqual(next.items,state.items);assert.deepEqual(next.draft,draft);assert.deepEqual(next.trolleys,[other]);assert.equal(next.activeTrolleyId,'');assert.equal(next.defaults.trolley,'');assert.equal(next.collectionScans.unassigned.activeTrolleyId,'');assert.equal(state.activeTrolleyId,target.id);
 assert.deepEqual(reconcileTrolleySelection(state,[other]),next);
});
test('deletion blocks equipment including legacy names, ready/collected trolleys and collection assignments',()=>{
 const trolley=createTrolley('Cage'),state={trolleys:[trolley],items:[],collectionTrolleys:[],defaults:{trolley:''}};
 assert.throws(()=>removeTrolley({...state,items:[{trolleyId:trolley.id,trolley:'Old name'}]},trolley.id),/contains equipment/);
 assert.throws(()=>removeTrolley({...state,items:[{trolley:trolley.name}]},trolley.id),/contains equipment/);
 for(const status of ['ready','collected'])assert.throws(()=>removeTrolley({...state,trolleys:[{...trolley,status}]},trolley.id),/Only open/);
 assert.throws(()=>removeTrolley({...state,collectionTrolleys:[{trolleyId:trolley.id,sessionId:'group'}]},trolley.id),/Detach/);
});
