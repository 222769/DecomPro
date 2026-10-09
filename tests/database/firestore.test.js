import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,deleteDoc} from 'firebase/firestore';
import {createTeamStore} from '../../src/firebase-db.js';
let env;
const member={displayName:'Test Technician',code:'TT',role:'technician',active:true};
const admin={displayName:'Test Administrator',code:'TA',role:'admin',active:true};
const sample=(id='equipment-1',serial='ABC123')=>({id,serial,model:'Test model',manufacturer:'Test maker',date:'2026-10-09',description:'Monitor',source:'Storage',reason:'EOL',trolley:'Trolley 01',barcode:'N/A',etch:'N/A',asset:'N/A',technician:'TT'});
const context=uid=>env.authenticatedContext(uid).firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-decompro',firestore:{host:'127.0.0.1',port:8085,rules:await readFile('database/firestore.rules','utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'teams/college-it/members/tech'),member);await setDoc(doc(c.firestore(),'teams/college-it/members/admin'),admin);});});
test('unauthenticated and non-member access is denied; a member cannot promote themselves',async()=>{
 await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'teams/college-it/equipment')));
 await assertFails(getDocs(collection(context('outsider'),'teams/college-it/references')));
 await assertFails(setDoc(doc(context('tech'),'teams/college-it/members/tech'),{...member,role:'admin'}));
});
test('records and immutable revisions commit together; ordinary duplicate serials are rejected',async()=>{
 const db=context('tech'),client=createTeamStore(db,'tech','college-it',member);
 await client.write(sample());
 const row=await getDoc(doc(db,'teams/college-it/equipment/equipment-1'));assert.equal(row.data().createdBy,'tech');assert.equal(row.data().version,1);
 const audit=await getDocs(collection(db,'teams/college-it/equipment/equipment-1/revisions'));assert.equal(audit.size,1);
 await assertFails(deleteDoc(audit.docs[0].ref));
 await assert.rejects(client.write(sample('equipment-2')),/already recorded/);
 assert.equal((await getDoc(doc(db,'teams/college-it/equipment/equipment-2'))).exists(),false);
 await assertFails(setDoc(doc(db,'teams/college-it/equipment/forged'),{...row.data(),payload:{...sample('forged'),technician:'Someone else'}}));
});
test('conflicting edits are rejected and removal retains audit history',async()=>{
 const db=context('tech'),first=createTeamStore(db,'tech','college-it',member),second=createTeamStore(context('admin'),'admin','college-it',admin);
 await first.write(sample());await first.write({...sample(),model:'Corrected model'},1);
 await assert.rejects(second.write({...sample(),model:'Stale model'},1),/Another technician/);
 await first.write({...sample(),model:'Corrected model'},2,{deleted:true});
 assert.equal((await first.load()).items.length,0);assert.equal((await getDocs(collection(db,'teams/college-it/equipment/equipment-1/revisions'))).size,3);
 await assertFails(deleteDoc(doc(db,'teams/college-it/equipment/equipment-1')));
});
test('serial index escaping is collision-free and spreadsheet examples are idempotent',async()=>{
 const client=createTeamStore(context('tech'),'tech','college-it',member);
 await client.write(sample('with-slash','AB/C~D'));await client.write(sample('literal-escape','AB~sC~D'));
 const facts=[{serial:'0001',model:'Test model',manufacturer:'Test maker',source:'Excel'}];await client.importExamples(facts);await client.importExamples(facts);
 assert.equal((await client.load()).examples.length,1);
});
