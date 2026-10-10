import {test} from 'node:test';import assert from 'node:assert/strict';
import {lookupReference,effectiveReferences,libraryRows,validateCorrections,correctionKey} from '../../src/reference-library.js';import {recognizeSerial} from '../../src/recognition.js';
const facts=[{serial:'ABCD1001',model:'Wrong',manufacturer:'Maker',source:'Excel'},{serial:'ABCD1001',model:'Other',manufacturer:'Maker',source:'Record'},{serial:'ABCD1002',model:'Right',manufacturer:'Maker',source:'Excel'}];
const correction={serial:'ABCD1001',mode:'corrected',model:'Right',manufacturer:'Maker',note:'Checked physical label'};
test('reviewed corrections resolve conflicts, exclusions remove training evidence, restoration retains original facts',()=>{
 assert.equal(libraryRows(facts)[0].status,'conflict');assert.equal(recognizeSerial('ABCD1001',facts).method,'conflict');
 const active=effectiveReferences(facts,[correction]);assert.equal(recognizeSerial('ABCD1001',active).model,'Right');assert.equal(recognizeSerial('ABCD1099',active).model,'Right');assert.equal(facts[0].model,'Wrong');
 const excluded={...correction,mode:'excluded',model:'',manufacturer:''};assert.equal(recognizeSerial('ABCD1001',effectiveReferences(facts,[excluded])),null);assert.equal(libraryRows(facts,[excluded])[0].status,'excluded');
 assert.equal(recognizeSerial('ABCD1001',effectiveReferences(facts,[{...excluded,mode:'original'}])).method,'conflict');
 assert.equal(libraryRows(facts,[correction])[0].originals.length,2);
});
test('corrections are validated and serial key escaping is unambiguous',()=>{
 assert.equal(validateCorrections([{...correction,serial:' abcd1001 '}])[0].serial,'ABCD1001');
 assert.throws(()=>validateCorrections([correction,correction]),/Duplicate/);assert.throws(()=>validateCorrections([{...correction,model:'N/A'}]),/model/);assert.throws(()=>validateCorrections([{...correction,note:''}]),/details/);
 assert.notEqual(correctionKey('AB/C~D'),correctionKey('AB~sC~D'));
});

test('excluded serials cannot receive suggestions from other members of the family',()=>{
 const family=[{serial:'ABCD1002',model:'Right',manufacturer:'Maker'},{serial:'ABCD1003',model:'Right',manufacturer:'Maker'}],excluded={...correction,mode:'excluded',model:'',manufacturer:''};
 assert.equal(lookupReference('ABCD1001',family,[excluded]),null);assert.equal(lookupReference('ABCD1099',family,[excluded]).model,'Right');
});
