import test from 'node:test';
import assert from 'node:assert/strict';
import {movePlan,localMoveEvent,validateMoveHistory} from '../../src/trolley-moves.js';
import {createTrolley} from '../../src/trolleys.js';

test('move preview handles multiple sources, preserves attribution and skips items already at the destination',()=>{
 const source=createTrolley('Source'),destination=createTrolley('Destination');
 const items=[{id:'one',serial:'ABC',technician:'JA',trolleyId:source.id,trolley:'Old display name'},{id:'two',serial:'DEF',technician:'MA',trolley:destination.name}];
 const plan=movePlan(items,[source,destination],['one','one','two'],destination.id);
 assert.equal(plan.length,2);assert.equal(plan[1].skip,true);
 assert.equal(plan[0].after.technician,'JA');assert.equal(plan[0].after.trolley,destination.name);
 assert.equal(items[0].trolley,'Old display name');
 const event=localMoveEvent(plan[0],{name:'Ali',code:'MA'});
 assert.equal(event.actor.code,'MA');assert.equal(event.from.reference,source.reference);
 assert.deepEqual(validateMoveHistory([event]),[event]);
 assert.throws(()=>validateMoveHistory([event,event]),/Invalid trolley move/);
 assert.throws(()=>validateMoveHistory([{...event,actor:{name:'Ali'}}]),/Invalid trolley move/);
});
test('missing, ambiguous and locked sources or destinations reject the complete preview',()=>{
 const source=createTrolley('Source'),destination=createTrolley('Destination'),item={id:'one',serial:'ABC',trolleyId:source.id,trolley:source.name};
 for(const status of ['ready','collected']){
  assert.throws(()=>movePlan([item],[{...source,status},destination],['one'],destination.id),/ready or collected/);
  assert.throws(()=>movePlan([item],[source,{...destination,status}],['one'],destination.id),/open destination/);
 }
 assert.throws(()=>movePlan([item],[source,destination],['missing'],destination.id),/no longer/);
 assert.throws(()=>movePlan([item],[source,destination],[],destination.id),/Select equipment/);
 assert.throws(()=>movePlan([{...item,trolleyId:undefined}],[source,{...createTrolley('Source')},destination],['one'],destination.id),/unavailable/);
});
