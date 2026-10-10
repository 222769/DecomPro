import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,deleteDoc,writeBatch,serverTimestamp} from 'firebase/firestore';
import {createTeamStore} from '../../src/firebase-db.js';
import {createTrolley} from '../../src/trolleys.js';
const initialTrolley=createTrolley('Trolley 01');
let env;
const member={displayName:'Test Technician',code:'TT',role:'technician',active:true};
const admin={displayName:'Test Administrator',code:'TA',role:'admin',active:true};
const sample=(id='equipment-1',serial='ABC123')=>({id,serial,model:'Test model',manufacturer:'Test maker',date:'2026-10-09',description:'Monitor',source:'Storage',reason:'EOL',trolley:'Trolley 01',trolleyId:initialTrolley.id,barcode:'N/A',etch:'N/A',asset:'N/A',technician:'TT'});
const context=uid=>env.authenticatedContext(uid).firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-decompro',firestore:{host:'127.0.0.1',port:8085,rules:await readFile('database/firestore.rules','utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'teams/college-it/members/tech'),member);await setDoc(doc(c.firestore(),'teams/college-it/members/admin'),admin);});await createTeamStore(context('tech'),'tech','college-it',member).writeTrolley(initialTrolley);});
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

test('trolley references, inventory and collection history commit together and reject later equipment changes',async()=>{
 const {createTrolley}=await import('../../src/trolleys.js');
 const db=context('tech'),client=createTeamStore(db,'tech','college-it',member);
 const trolley=createTrolley('Collection 01');await client.writeTrolley(trolley);
 const item={...sample(),trolley:trolley.name,trolleyId:trolley.id};await client.write(item);
 const changed={...trolley,department:'Helpdesk Annex'};await client.writeTrolley(changed,2);
 await assert.rejects(client.writeTrolley({...trolley,department:'Stale department'},1),/Another technician/);
 const legacy={...sample('legacy-item','LEGACY123'),trolley:trolley.name,trolleyId:trolley.id};await client.write(legacy);
 await env.withSecurityRulesDisabled(async c=>{const row=doc(c.firestore(),'teams/college-it/equipment/legacy-item'),data=(await getDoc(row)).data();delete data.payload.trolleyId;await setDoc(row,data);});
 const collected={...changed,status:'collected',company:'Test supplier',collectedAt:new Date().toISOString(),collectedBy:'TT'};
  await assert.rejects(client.writeTrolley({...changed,status:'ready',readyAt:new Date().toISOString(),readyBy:'TT'},client.trolleyVersionFor(trolley.id)),/readiness/);
 await client.write(legacy,1);
 const ready={...changed,status:'ready',readyAt:new Date().toISOString(),readyBy:'TT'};await client.writeTrolley(ready,client.trolleyVersionFor(trolley.id));
 await client.writeTrolley({...collected,readyAt:ready.readyAt,readyBy:ready.readyBy},client.trolleyVersionFor(trolley.id));
 const records=await client.load();assert.equal(records.trolleys.find(t=>t.id===trolley.id).status,'collected');assert.equal(records.items.length,2);assert.equal(records.items.find(i=>i.id==='legacy-item').trolleyId,trolley.id);
 assert.equal(records.trolleys.find(t=>t.id===trolley.id).reference,trolley.reference);
 await assert.rejects(client.write({...item,id:'equipment-after-collection',serial:'LATE123'}),/collected/);
 await assert.rejects(client.write({...item,model:'Changed after collection'},1),/collected/);
 await assert.rejects(client.write(item,1,{deleted:true}),/collected/);
 await assert.rejects(client.writeTrolley(changed,client.trolleyVersionFor(trolley.id)),/history is locked/);
 const equipmentRow=doc(db,'teams/college-it/equipment/equipment-1'),before=(await getDoc(equipmentRow)).data(),revisionId='forged-change';
 const after={...before,payload:{...before.payload,model:'Bypass attempt'},version:2,updatedAt:serverTimestamp(),revisionId};
 const forged=writeBatch(db);forged.set(equipmentRow,after);forged.set(doc(equipmentRow,'revisions',revisionId),{actor:'tech',before,after,action:'edit',at:serverTimestamp()});await assertFails(forged.commit());
 const revisions=await getDocs(collection(db,`teams/college-it/trolleys/${trolley.id}/revisions`));assert.equal(revisions.size,7);
 await assertFails(deleteDoc(revisions.docs[0].ref));await assertFails(deleteDoc(doc(db,`teams/college-it/trolleys/${trolley.id}`)));
 await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'teams/college-it/trolleys')));
});

test('two independent team clients receive live equipment, reference reviews and collection changes',async()=>{
 const first=createTeamStore(context('tech'),'tech','college-it',member),second=createTeamStore(context('admin'),'admin','college-it',admin);
 const events={items:[],trolleys:[],examples:[],corrections:[],phase:''},failures=[];
 const waitFor=async predicate=>{const start=Date.now();while(!predicate()){if(failures.length)throw failures[0];if(Date.now()-start>10000)throw Error('Realtime team update was not received');await new Promise(resolve=>setTimeout(resolve,25));}};
 second.listen(rows=>events.items=rows,rows=>events.examples=rows,error=>failures.push(error),rows=>events.trolleys=rows,phase=>events.phase=phase);
 first.listen(()=>{},()=>{},error=>failures.push(error),()=>{},()=>{},rows=>events.corrections=rows);
 try {
  await waitFor(()=>events.phase==='connected');
  await first.write(sample('shared-live-item','LIVE0001'));await waitFor(()=>events.items.some(row=>row.id==='shared-live-item'));
  assert.equal(events.items[0].technician,'TT');
  await assert.rejects(second.write(sample('duplicate-other-device','LIVE0001')),/already recorded/);
  await second.write({...events.items[0],model:'Correction from second device'},second.versionFor('shared-live-item'));
  assert.equal((await first.load()).items[0].model,'Correction from second device');
  await first.importExamples([{serial:'TEAMREF1',model:'Shared model',manufacturer:'Shared maker',source:'Excel'}]);await waitFor(()=>events.examples.some(row=>row.serial==='TEAMREF1'));
  await second.writeCorrection({serial:'TEAMREF1',mode:'corrected',model:'Verified shared model',manufacturer:'Shared maker',note:'Checked label on second device'});await waitFor(()=>events.corrections.some(row=>row.model==='Verified shared model'));
  assert.equal((await first.load()).corrections[0].model,'Verified shared model');
  const ready={...initialTrolley,status:'ready',readyAt:new Date().toISOString(),readyBy:'TT'};await first.load();await first.writeTrolley(ready,first.trolleyVersionFor(initialTrolley.id));
  await first.writeTrolley({...ready,status:'collected',company:'Shared supplier',collectedAt:new Date().toISOString(),collectedBy:'TT'},first.trolleyVersionFor(initialTrolley.id));
  await waitFor(()=>events.trolleys.some(row=>row.id===initialTrolley.id&&row.status==='collected'));
  await assert.rejects(second.write({...sample('late-second-device','LATE0002')}),/collected/);
  assert.equal(failures.length,0);
 }finally{first.stop();second.stop();}
});

test('server-confirmed loading rejects offline cached data and recovers after reconnect',async()=>{
 const {disableNetwork,enableNetwork}=await import('firebase/firestore');
 const db=context('tech'),client=createTeamStore(db,'tech','college-it',member);await client.write(sample());await client.load();
 await disableNetwork(db);
 try{await assert.rejects(client.load(),/offline|server|unavailable/i);}finally{await enableNetwork(db);}
 assert.equal((await client.load()).items.length,1);
});

test('administrators curate shared references with immutable history and conflict checks; technicians only read',async()=>{
 const {correctionKey,effectiveReferences}=await import('../../src/reference-library.js');const {recognizeSerial}=await import('../../src/recognition.js');
 const db=context('admin'),first=createTeamStore(db,'admin','college-it',admin),second=createTeamStore(context('admin'),'admin','college-it',admin),tech=createTeamStore(context('tech'),'tech','college-it',member);
 const correction={serial:'ABCD1001',mode:'corrected',model:'Reviewed model',manufacturer:'Maker',note:'Checked equipment label'};
 await assert.rejects(tech.writeCorrection(correction),/administrator/);await first.writeCorrection(correction);
 const records=await tech.load();assert.equal(records.corrections[0].model,'Reviewed model');assert.equal(recognizeSerial('ABCD1001',effectiveReferences([{serial:'ABCD1001',model:'Wrong',manufacturer:'Maker'}],records.corrections)).model,'Reviewed model');
 const row=doc(db,`teams/college-it/referenceCorrections/${correctionKey(correction.serial)}`),stored=(await getDoc(row)).data();await assertFails(setDoc(doc(context('tech'),row.path),stored));await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),row.path)));
 const excluded={...correction,mode:'excluded',model:'',manufacturer:''};await first.writeCorrection(excluded,1);await assert.rejects(second.writeCorrection(correction,1),/Another administrator/);await first.writeCorrection({...excluded,mode:'original'},2);
 const revisions=await getDocs(collection(row,'revisions'));assert.equal(revisions.size,3);await assertFails(deleteDoc(revisions.docs[0].ref));await assertFails(deleteDoc(row));
 const forged={...stored,version:4,payload:{...correction,model:'Forged'},updatedAt:serverTimestamp()};await assertFails(setDoc(row,forged));
});


test('readiness detects concurrent inventory changes, records exceptions, locks ready equipment and audits reopening',async()=>{
 const first=createTeamStore(context('tech'),'tech','college-it',member),second=createTeamStore(context('admin'),'admin','college-it',admin);
 await first.write({...sample(),model:'N/A',manufacturer:'N/A',asset:'A0042',recognitionNeedsReview:true,recognitionConfirmed:false});
 const ready={...initialTrolley,status:'ready',readyAt:new Date().toISOString(),readyBy:'TT'};
 await assert.rejects(first.writeTrolley(ready,first.trolleyVersionFor(initialTrolley.id)),/readiness issues/);
 await first.write({...sample(),model:'N/A',manufacturer:'N/A',asset:'A0042',recognitionNeedsReview:true,recognitionConfirmed:true,readinessNotes:{model:'Label missing',manufacturer:'Unbranded'}},1);
 const review=await first.readinessSnapshot(initialTrolley.id);
 await second.write({...sample('concurrent','CONCURRENT'),asset:'A0099'});
 await assert.rejects(first.writeTrolley(ready,review.version),/inventory changed/);
 await first.load();await first.writeTrolley(ready,first.trolleyVersionFor(initialTrolley.id));
 const record=(await first.load()).items.find(item=>item.id==='equipment-1');assert.equal(record.readinessNotes.model,'Label missing');assert.equal(record.recognitionConfirmed,true);
 await assert.rejects(second.write({...sample('late','LATE')}),/ready/);await assert.rejects(first.write(record,2,{deleted:true}),/ready/);
 await first.writeTrolley({...ready,status:'open',readyAt:'',readyBy:''},first.trolleyVersionFor(initialTrolley.id));
 await first.write({...record,model:'Checked replacement model'},2);
 await first.load();const version=first.trolleyVersionFor(initialTrolley.id);
 await assert.rejects(first.write({...record,readinessNotes:{asset:'Not allowed'}},3),/readiness review/);
 await first.writeTrolley(ready,version);
 await first.writeTrolley({...ready,status:'collected',company:'Checked supplier',collectedAt:new Date().toISOString(),collectedBy:'TT'},first.trolleyVersionFor(initialTrolley.id));
 assert.equal((await first.load()).trolleys[0].readyBy,'TT');
});


test('equipment writes must advance the trolley version with immutable audit and cannot bypass a ready lock',async()=>{
 const db=context('tech'),client=createTeamStore(db,'tech','college-it',member);await client.write(sample());
 const row=doc(db,'teams/college-it/equipment/equipment-1'),before=(await getDoc(row)).data(),revisionId='without-trolley-touch';
 const after={...before,payload:{...before.payload,model:'Unaudited trolley change'},version:2,updatedAt:serverTimestamp(),revisionId};
 const forged=writeBatch(db);forged.set(row,after);forged.set(doc(row,'revisions',revisionId),{actor:'tech',before,after,action:'edit',at:serverTimestamp()});await assertFails(forged.commit());
 await client.writeTrolley({...initialTrolley,status:'ready',readyAt:new Date().toISOString(),readyBy:'TT'},client.trolleyVersionFor(initialTrolley.id));
 const trolleyRow=doc(db,`teams/college-it/trolleys/${initialTrolley.id}`),old=(await getDoc(trolleyRow)).data(),touchId='mutate-ready';
 const changed={...old,payload:{...old.payload,status:'open',readyAt:'',readyBy:'',department:'Bypass department'},version:old.version+1,updatedAt:serverTimestamp(),revisionId:touchId};
 const bypass=writeBatch(db);bypass.set(trolleyRow,changed);bypass.set(doc(trolleyRow,'revisions',touchId),{actor:'tech',before:old,after:changed,action:'update',at:serverTimestamp()});await assertFails(bypass.commit());
 assert.equal((await getDoc(trolleyRow)).data().payload.status,'ready');assert.equal((await getDoc(row)).data().payload.model,'Test model');
});
