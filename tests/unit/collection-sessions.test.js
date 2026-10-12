import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollection,assignCollection,collectionScope,collectionProgress,switchCollection,validateAssignments} from '../../src/collection-sessions.js';
import {createTrolley} from '../../src/trolleys.js';
const first=createCollection('Summer 2026'),second=createCollection('Autumn 2026'),a=createTrolley('A'),b=createTrolley('B');
test('collections group existing equipment by permanent trolley, preserve facts and reject duplicate ownership',()=>{
 const groups=assignCollection([],[],first,[a.id],[a,b]);const item={id:'one',trolleyId:a.id,trolley:'Old label',serial:'000123',model:'Model',manufacturer:'Maker',asset:'N/A'};
 assert.equal(collectionScope(first.id,groups.collectionTrolleys,[a,b],[item]).items[0],item);
 assert.throws(()=>assignCollection(groups.collectionSessions,groups.collectionTrolleys,second,[a.id],[a,b]),/another collection/);
 assert.throws(()=>assignCollection([],[],first,[a.id,a.id],[a]),/12 existing/);
 assert.throws(()=>validateAssignments([{trolleyId:a.id,sessionId:second.id}],[first]),/assignment/);
});
test('progress counts collected equipment and unresolved physical checks without completing empty groups',()=>{
 const link=[{trolleyId:a.id,sessionId:first.id},{trolleyId:b.id,sessionId:first.id}];const items=[{id:'one',trolleyId:a.id,serial:'ONE',model:'M',manufacturer:'Maker',asset:'N/A'},{id:'two',trolleyId:b.id,serial:'TWO',model:'N/A',manufacturer:'Maker',asset:'N/A'}];
 const p=collectionProgress(first.id,link,[{...a,status:'collected'},b],items);assert.equal(p.collected,1);assert.equal(p.collectedItems,1);assert.equal(p.issues,1);assert.equal(p.complete,false);assert.equal(collectionProgress(first.id,[],[],[]).complete,false);
 assert.equal(collectionProgress(first.id,link,[{...a,status:'collected'},{...b,status:'collected'}],items).complete,true);
});
test('switching collections saves independent checkpoints and restores drafts and trolley defaults',()=>{
 const state={collectionSessions:[first,second],collectionTrolleys:[{trolleyId:a.id,sessionId:first.id},{trolleyId:b.id,sessionId:second.id}],collectionScans:{},activeCollectionId:first.id,collectionPaused:true,trolleys:[a,b],items:[],draft:{serial:'UNFINISHED'},step:1,defaults:{trolley:a.name,date:'2026-10-11'},activeTrolleyId:a.id};
 const next=switchCollection(state,second.id);assert.equal(next.step,0);assert.deepEqual(next.draft,{});assert.equal(next.defaults.trolley,b.name);assert.equal(next.collectionPaused,false);assert.deepEqual(state.collectionScans,{});
 const restored=switchCollection({...next,draft:{serial:'SECOND'},step:1},first.id);assert.equal(restored.draft.serial,'UNFINISHED');assert.equal(restored.activeTrolleyId,a.id);assert.equal(restored.collectionScans[second.id].draft.serial,'SECOND');assert.throws(()=>switchCollection(state,'missing'),/no longer available/);
});

test('deletion restores the general checkpoint, removes only the selected grouping and retains equipment and trolley history',async()=>{
 const {removeCollection}=await import('../../src/collection-sessions.js');const general={draft:{serial:'GENERAL'},step:1,defaults:{trolley:a.name},activeTrolleyId:a.id};
 const state={collectionSessions:[first,second],collectionTrolleys:[{sessionId:first.id,trolleyId:a.id},{sessionId:second.id,trolleyId:b.id}],collectionScans:{unassigned:general,[first.id]:{draft:{serial:'DELETED'}}},activeCollectionId:first.id,collectionPaused:false,trolleys:[a,b],items:[{id:'saved'}],draft:{serial:'DELETE-DRAFT'},step:1,defaults:{trolley:a.name},activeTrolleyId:a.id};
 const result=removeCollection(state,first.id);assert.equal(result.activeCollectionId,'');assert.equal(result.draft.serial,'GENERAL');assert.equal(result.collectionScans[first.id],undefined);assert.deepEqual(result.collectionSessions,[second]);assert.equal(result.items,state.items);assert.equal(result.trolleys,state.trolleys);assert.equal(state.draft.serial,'DELETE-DRAFT');assert.throws(()=>removeCollection(result,first.id),/no longer available/);
});
