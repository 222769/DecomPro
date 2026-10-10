import {test} from 'node:test';import assert from 'node:assert/strict';
import {recognizeSerial,cleanExamples} from '../../src/recognition.js';import {snapshotEvidence,validateEvidence,sourceKinds} from '../../src/recognition-evidence.js';
test('evidence preserves independent sources without inflating distinct serial support',()=>{
 const facts=[{serial:'KNOWN0001',model:'Display',manufacturer:'Maker',source:'Excel · Collection, Summer'},{serial:'KNOWN0001',model:'Display',manufacturer:'Maker',source:'Saved equipment'}];
 const match=recognizeSerial('KNOWN0001',facts),evidence=snapshotEvidence(match);assert.equal(evidence.support,1);assert.deepEqual(evidence.sources,['Excel · Collection, Summer','Saved equipment']);assert.deepEqual(sourceKinds(evidence.sources),['Imported Excel','Saved equipment']);assert.equal(cleanExamples(cleanExamples(facts))[0].source,cleanExamples(facts)[0].source);assert.deepEqual(validateEvidence(JSON.parse(JSON.stringify(evidence))),evidence);
});
test('evidence identifies near-serial references and rejects invalid backup metadata',()=>{
 const match=recognizeSerial('001917BD324B',[{serial:'001917BD323B',model:'XTE30722',manufacturer:'posiflex',source:'Summer 2026 reference'}]),evidence=snapshotEvidence(match);assert.equal(evidence.basis,'similar');assert.deepEqual(evidence.referenceSerials,['001917BD323B']);assert.deepEqual(sourceKinds(evidence.sources),['Built-in Excel']);assert.throws(()=>validateEvidence({...evidence,support:-1}),/Invalid/);assert.throws(()=>validateEvidence({...evidence,sources:[42]}),/Invalid/);assert.deepEqual(sourceKinds(['Reviewed reference correction']),['Reviewed correction']);
});
