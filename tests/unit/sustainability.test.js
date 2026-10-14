import test from 'node:test';
import assert from 'node:assert/strict';
import {sustainabilitySummary} from '../../src/sustainability.js';

test('sustainability summary counts tracked items and only confirmed pickups',()=>{
 const items=[{description:'iPad',trolleyId:'a'},{description:'Tablet',trolleyId:'b'},{description:'Laptop',trolleyId:'b'},{description:'N/A',trolleyId:'missing'}];
 const trolleys=[{id:'a',status:'collected'},{id:'b',status:'ready'}];
 assert.deepEqual(sustainabilitySummary(items,trolleys),{total:4,collected:1,pendingPickup:3,types:[{name:'Tablet',count:2},{name:'Laptop',count:1},{name:'Unclassified',count:1}]});
});
