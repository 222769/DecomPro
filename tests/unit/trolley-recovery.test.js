import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrolley,restoreLocalTrolleys} from '../../src/trolleys.js';
const workspace=trolley=>({trolleys:[trolley],items:[],defaults:{trolley:'TROLLEY   1.1'},activeTrolleyId:trolley.id});
test('reload reuses permanent references despite stale names, spacing and casing',()=>{
 const trolley=createTrolley('Trolley 1.1');let state={...workspace(trolley),items:[{id:'i',trolley:'Old name',trolleyId:trolley.id}]};
 for(let i=0;i<4;i++)state=restoreLocalTrolleys(state);
 assert.equal(state.trolleys.length,1);assert.equal(state.trolleys[0].reference,trolley.reference);assert.equal(state.defaults.trolley,trolley.name);assert.equal(state.items[0].trolley,trolley.name);
});
test('legacy name matching never guesses between duplicates or creates from a typed default',()=>{
 const trolley=createTrolley('Trolley 1.1');let state=restoreLocalTrolleys({...workspace(trolley),activeTrolleyId:'',items:[{id:'i',trolley:' trolley   1.1 '}]});
 assert.equal(state.trolleys.length,1);assert.equal(state.items[0].trolleyId,trolley.id);
 state=restoreLocalTrolleys({...workspace(trolley),activeTrolleyId:'',defaults:{trolley:'Unknown name'}});assert.equal(state.trolleys.length,1);assert.equal(state.activeTrolleyId,'');
 state=restoreLocalTrolleys({...workspace(trolley),activeTrolleyId:'',trolleys:[trolley,createTrolley(trolley.name)],items:[{id:'i',trolley:trolley.name}]});assert.equal(state.trolleys.length,2);assert.equal(state.items[0].trolleyId,undefined);
});
test('orphaned permanent references and an empty shared cache never manufacture trolley identities',()=>{
 const trolley=createTrolley('Trolley 1.1');const state=restoreLocalTrolleys({...workspace(trolley),items:[{id:'i',trolley:'Missing cage',trolleyId:createTrolley('Missing cage').id}]});assert.equal(state.trolleys.length,1);
 assert.equal(restoreLocalTrolleys({trolleys:[],items:[],defaults:{trolley:'Trolley 1.1'},collectionWorkspace:'project/team/uid'}).trolleys.length,0);
});
