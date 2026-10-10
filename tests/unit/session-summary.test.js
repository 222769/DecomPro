import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionSummary,missingEquipmentDetails} from '../../src/session-summary.js';

test('summary counts disposal dates, historical technicians and legacy trolley names without conflating inventory scopes',()=>{
 const trolleys=[{id:'one',name:'One',status:'open'},{id:'two',name:'Two',status:'ready'},{id:'three',name:'Three',status:'collected'}];
 const items=[
  {date:'2026-10-10',technician:'MA',manufacturer:'Lenovo',model:'TI024D',trolleyId:'one',trolley:'old name'},
  {date:'2026-10-10',technician:'JA',manufacturer:'N/A',model:'Monitor',trolley:'Two'},
  {date:'2026-10-09',technician:'OLD',manufacturer:'Dell',model:'  ',trolleyId:'three',trolley:'Three'},
 ];
 const result=sessionSummary(items,trolleys,[{name:'Ali',code:'MA'},{name:'Jawad',code:'JA'}],'2026-10-10');
 assert.equal(result.todayCount,2);assert.equal(result.missingCount,2);
 assert.deepEqual(result.statuses,{open:1,ready:1,collected:1});
 assert.deepEqual(result.trolleys.map(t=>t.count),[1,1,1]);
 assert.deepEqual(result.technicians.find(t=>t.code==='OLD'),{code:'OLD',name:'OLD',today:0,total:1});
 assert.equal(result.technicians.find(t=>t.code==='MA').today,1);
 assert.equal(items[0].trolley,'old name');
});

test('missing details handles absent values and N/A, counting each item only once',()=>{
 assert.deepEqual(missingEquipmentDetails({manufacturer:' n / a ',model:''}),['manufacturer','model']);
 assert.deepEqual(missingEquipmentDetails({manufacturer:'Dell',model:'N/A'}),['model']);
 assert.equal(sessionSummary([{}],[],[],'2026-10-10').missingCount,1);
 assert.equal(sessionSummary([],[],[],'2026-10-10').todayCount,0);
});
