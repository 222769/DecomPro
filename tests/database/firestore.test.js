import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,deleteDoc,writeBatch,serverTimestamp} from 'firebase/firestore';
import {createTeamStore} from '../../src/firebase-db.js';
import {createTrolley} from '../../src/trolleys.js';
import {createHandover,handoverGroups} from '../../src/handover-data.js';
import {equipmentImportPlan} from '../../src/equipment-import.js';
const initialTrolley=createTrolley('Trolley 01');
let env;
const member={displayName:'Test Technician',code:'TT',role:'technician',active:true};
const admin={displayName:'Test Administrator',code:'TA',role:'admin',active:true};
const sample=(id='equipment-1',serial='ABC123')=>({id,serial,model:'Test model',manufacturer:'Test maker',date:'2026-10-09',description:'Monitor',source:'Storage',reason:'EOL',trolley:'Trolley 01',trolleyId:initialTrolley.id,barcode:'N/A',etch:'N/A',asset:'N/A',technician:'TT'});
const context=uid=>env.authenticatedContext(uid).firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-decompro',firestore:{host:'127.0.0.1',port:8085,rules:await readFile('database/firestore.rules','utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'teams/college-it/members/tech'),member);await setDoc(doc(c.firestore(),'teams/college-it/members/admin'),admin);});await createTeamStore(context('tech'),'tech','college-it',member).writeTrolley(initialTrolley);});
test('historical Excel equipment imports preserve dates and attribution with admin permissions and serial protection',async()=>{
 const owner=createTeamStore(context('admin'),'admin','college-it',admin),tech=createTeamStore(context('tech'),'tech','college-it',member);
 const [entry]=equipmentImportPlan([{id:'excel-item',values:{serial:'00001234',model:'Original model',manufacturer:'Original maker',date:'2026-02-16',technician:'OLD',asset:'Legacy-12'}}],[],initialTrolley);
 assert.equal(entry.status,'new');await assert.rejects(tech.write(entry.item,0,{historicalImport:true}),/administrator/);
 await owner.write(entry.item,0,{historicalImport:true});
 const record=await getDoc(doc(context('admin'),'teams/college-it/equipment/excel-item'));
 assert.equal(record.data().historicalImport,true);assert.equal(record.data().payload.technician,'OLD');assert.equal(record.data().payload.date,'2026-02-16');assert.equal(record.data().payload.recognitionConfirmed,false);
 assert.equal((await owner.load()).items[0].serial,'00001234');
 await assert.rejects(owner.write({...entry.item,id:'duplicate-excel'},0,{historicalImport:true}),/already recorded/);
 assert.equal((await getDocs(collection(context('admin'),'teams/college-it/equipment/excel-item/revisions'))).size,1);
});
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
async function readyGroup(client,count) {
 const group=[initialTrolley,...Array.from({length:count-1},(_,i)=>createTrolley(`Pack trolley ${i+2}`))];
 for(const [index,trolley] of group.entries()){
  if(index)await client.writeTrolley(trolley);
  await client.write({...sample(`pack-item-${index}`,`PACK-${index}`),trolleyId:trolley.id,trolley:trolley.name});
  await client.writeTrolley({...trolley,status:'ready',readyAt:new Date().toISOString(),readyBy:'TT'},client.trolleyVersionFor(trolley.id));
 }
 return group;
}
test('six-trolley handover collects atomically, retains linked history and prevents later changes',async()=>{
 const client=createTeamStore(context('tech'),'tech','college-it',member),group=await readyGroup(client,6),ids=group.map(t=>t.id),pack=createHandover(ids,'Supplier',new Date().toISOString()),versions=Object.fromEntries(ids.map(id=>[id,client.trolleyVersionFor(id)]));
 const updated=await client.collectHandover(pack,versions);assert.equal(updated.length,6);
 const records=await client.load(),saved=handoverGroups(records.trolleys);assert.equal(saved.length,1);assert.equal(saved[0].complete,true);assert.equal(saved[0].collectedBy,'TT');
 for(const trolley of updated){assert.equal(trolley.company,'Supplier');assert.equal(trolley.status,'collected');const audits=await getDocs(collection(context('tech'),`teams/college-it/trolleys/${trolley.id}/revisions`));assert.equal(audits.docs.filter(d=>d.data().action==='collect').length,1);}
 await assert.rejects(client.collectHandover(pack,versions),/not ready/);
 await assert.rejects(client.write({...records.items[0],model:'Changed'},client.versionFor(records.items[0].id)),/collected/);
 await assertFails(getDocs(collection(context('outsider'),'teams/college-it/trolleys')));
});
test('handover rejects a concurrent reopen without collecting any other trolley; rules reject incomplete linked groups',async()=>{
 const client=createTeamStore(context('tech'),'tech','college-it',member),group=await readyGroup(client,2),ids=group.map(t=>t.id),pack=createHandover(ids,'Supplier',new Date().toISOString()),versions=Object.fromEntries(ids.map(id=>[id,client.trolleyVersionFor(id)]));
 const db=context('tech'),row=doc(db,`teams/college-it/trolleys/${ids[0]}`),before=(await getDoc(row)).data(),revisionId='incomplete-pack',after={...before,payload:{...before.payload,status:'collected',collectedAt:pack.collectedAt,collectedBy:'TT',company:pack.company,handover:{id:pack.id,trolleyIds:ids}},version:before.version+1,updatedAt:serverTimestamp(),updatedBy:'tech',revisionId};
 const forged=writeBatch(db);forged.set(row,after);forged.set(doc(row,'revisions',revisionId),{actor:'tech',before,after,action:'collect',at:serverTimestamp()});await assertFails(forged.commit());
 const load=client.load.bind(client);client.load=async()=>{const records=await load();const other=createTeamStore(context('admin'),'admin','college-it',admin);await other.writeTrolley({...records.trolleys.find(t=>t.id===ids[1]),status:'open',readyAt:'',readyBy:''},versions[ids[1]]);return records;};
 await assert.rejects(client.collectHandover(pack,versions),/changed after/);
 const fresh=await load();assert.equal(fresh.trolleys.find(t=>t.id===ids[0]).status,'ready');assert.equal(fresh.trolleys.find(t=>t.id===ids[1]).status,'open');assert.equal(handoverGroups(fresh.trolleys).length,0);
});
test('trolley moves preserve disposal attribution, expose immutable actor history and reject stale or locked inventories',async()=>{
 const first=createTeamStore(context('tech'),'tech','college-it',member),second=createTeamStore(context('admin'),'admin','college-it',admin);
 const destination=createTrolley('Bulk destination');await first.writeTrolley(destination);
 const item=sample();await first.write(item);await second.load();
 const moved={...item,trolleyId:destination.id,trolley:destination.name};
 await second.write(moved,second.versionFor(item.id));
 const saved=(await first.load()).items[0];assert.equal(saved.technician,'TT');assert.equal(saved.trolleyId,destination.id);
 const history=await first.moveHistory(item.id);assert.equal(history.length,1);assert.equal(history[0].actor.name,admin.displayName);assert.equal(history[0].actor.code,'admin');assert.equal(history[0].from.name,initialTrolley.name);assert.equal(history[0].to.name,destination.name);
 await assert.rejects(first.write(item,1),/Another technician/);
 await env.withSecurityRulesDisabled(async c=>{
  const ref=doc(c.firestore(),`teams/college-it/trolleys/${destination.id}`),row=(await getDoc(ref)).data();
  await setDoc(ref,{...row,payload:{...row.payload,status:'ready',readyAt:new Date().toISOString(),readyBy:'TT'}});
 });
 await assert.rejects(first.write(item,2),/ready or collected/);
 const other=sample('other','OTHER-SERIAL');await first.write(other);
 await assert.rejects(first.write({...other,trolleyId:destination.id,trolley:destination.name},1),/ready or collected/);
 assert.equal((await first.moveHistory(item.id)).length,1);
 await assertFails(deleteDoc(doc(context('tech'),`teams/college-it/equipment/${item.id}/revisions/${history[0].id}`)));
 await assertFails(getDocs(collection(context('outsider'),`teams/college-it/equipment/${item.id}/revisions`)));
});
test('serial index escaping is collision-free and spreadsheet examples are idempotent',async()=>{
 const client=createTeamStore(context('tech'),'tech','college-it',member);
 await client.write(sample('with-slash','AB/C~D'));await client.write(sample('literal-escape','AB~sC~D'));
 const facts=[{serial:'0001',model:'Test model',manufacturer:'Test maker',description:'Laptop',source:'Excel'}];await client.importExamples(facts);await client.importExamples(facts);
 const loaded=(await client.load()).examples;assert.equal(loaded.length,1);assert.equal(loaded[0].description,'Laptop');
 await assertFails(setDoc(doc(context('tech'),'teams/college-it/references/invalid-type'),{...facts[0],description:42,importedBy:'tech',importedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(context('tech'),'teams/college-it/references/oversized-type'),{...facts[0],description:'x'.repeat(1001),importedBy:'tech',importedAt:serverTimestamp()}));
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

test('two personal technician accounts retrieve and update the same register, retain attribution and lose revoked access',async()=>{
 const jawad={displayName:'Jawad',code:'JA',role:'technician',active:true};
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'teams/college-it/members/jawad'),jawad));
 const first=createTeamStore(context('tech'),'tech','college-it',member),second=createTeamStore(context('jawad'),'jawad','college-it',jawad);
 const update=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Second account did not receive the saved equipment')),10000);
  second.listen(items=>{if(items.some(item=>item.serial==='TEAM-DEVICE-001')){clearTimeout(timer);resolve(items);}},()=>{},error=>{clearTimeout(timer);reject(error);});
 });
 try {
  await first.write(sample('team-one','TEAM-DEVICE-001'));
  assert.equal((await update)[0].technician,'TT');
  const fresh=createTeamStore(context('jawad'),'jawad','college-it',jawad);
  const saved=(await fresh.load()).items[0];assert.equal(saved.serial,'TEAM-DEVICE-001');
  await fresh.write({...saved,model:'Checked on second device',technician:'Impersonation'},fresh.versionFor(saved.id));
  assert.equal((await first.load()).items[0].model,'Checked on second device');assert.equal((await first.load()).items[0].technician,'TT');
  await fresh.write({...sample('team-two','TEAM-DEVICE-002'),technician:'Impersonation'});
  assert.equal((await first.load()).items.find(row=>row.id==='team-two').technician,'JA');
 }finally{second.stop();}
 const owner=createTeamStore(context('admin'),'admin','college-it',admin);
 assert.equal((await owner.listMembers()).find(row=>row.uid==='jawad').code,'JA');
 await assert.rejects(first.listMembers(),/administrator/);
 await assertFails(setDoc(doc(context('admin'),'teams/college-it/members/jawad'),{...jawad,active:false}));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'teams/college-it/members/jawad'),{...jawad,active:false}));
 await assert.rejects(createTeamStore(context('jawad'),'jawad','college-it',jawad).load(),/permission/i);
});

test('browser clients cannot bypass account administration or rewrite its audit, even with an admin membership',async()=>{
 const db=context('admin');
 await assertFails(setDoc(doc(db,'teams/college-it/members/new-person'),{displayName:'New person',code:'NP',role:'admin',active:true}));
 await assertFails(setDoc(doc(db,'teams/college-it/members/admin'),{...admin,role:'technician'}));
 await assertFails(deleteDoc(doc(db,'teams/college-it/members/tech')));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'teams/college-it/memberAudit/test-event'),{actor:'admin',uid:'tech',action:'update',at:new Date()}));
 assert.equal((await getDocs(collection(db,'teams/college-it/memberAudit'))).size,1);
 await assertFails(getDocs(collection(context('tech'),'teams/college-it/memberAudit')));
 await assertFails(deleteDoc(doc(db,'teams/college-it/memberAudit/test-event')));
});

test('named collections share trolley ownership without changing equipment and reject stale edits or forged assignments',async()=>{
 const {createCollection}=await import('../../src/collection-sessions.js');const owner=createTeamStore(context('admin'),'admin','college-it',admin),tech=createTeamStore(context('tech'),'tech','college-it',member);
 await owner.write({...sample(),technician:'OLD'},0,{historicalImport:true});const session=createCollection('Summer 2026');await owner.writeSession(session,[initialTrolley.id]);
 const groups=await tech.loadCollections();assert.equal(groups.collectionSessions[0].name,'Summer 2026');assert.equal(groups.collectionTrolleys[0].sessionId,session.id);assert.equal((await tech.load()).items[0].technician,'OLD');
 await tech.write({...sample('next-item','NEXT'),asset:'N/A'},0,{collectionId:session.id});
 await owner.writeSession({...session,name:'Summer updated'},[initialTrolley.id],1);await assert.rejects(tech.writeSession({...session,name:'Stale'},[initialTrolley.id],1),/Another technician/);
 await assertFails(setDoc(doc(context('tech'),'teams/college-it/collectionTrolleys',initialTrolley.id),{trolleyId:initialTrolley.id,sessionId:'',changedInSession:session.id,version:3,updatedBy:'tech',updatedAt:serverTimestamp()}));
 await owner.writeSession({...session,name:'Summer updated'},[],2);await assert.rejects(tech.write(sample('outside','OUTSIDE'),0,{collectionId:session.id}),/no longer assigned/);
 assert.equal((await tech.load()).items.length,2);const revisions=await getDocs(collection(context('tech'),'teams/college-it/collectionSessions',session.id,'revisions'));assert.equal(revisions.size,3);await assertFails(deleteDoc(revisions.docs[0].ref));
 await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'teams/college-it/collectionSessions')));
});

test('concurrent collection creation cannot assign one trolley to two collections',async()=>{
 const {createCollection}=await import('../../src/collection-sessions.js');const owner=createTeamStore(context('admin'),'admin','college-it',admin),tech=createTeamStore(context('tech'),'tech','college-it',member);
 const outcomes=await Promise.allSettled([owner.writeSession(createCollection('First'),[initialTrolley.id]),tech.writeSession(createCollection('Second'),[initialTrolley.id])]);assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);assert.equal(outcomes.filter(row=>row.status==='rejected').length,1);
 const groups=await owner.loadCollections();assert.equal(groups.collectionSessions.length,1);assert.equal(groups.collectionTrolleys.length,1);
});

test('a twelve-trolley collection commits within Firestore access limits and preserves ready and collected statuses',async()=>{
 const {createCollection}=await import('../../src/collection-sessions.js');const owner=createTeamStore(context('admin'),'admin','college-it',admin);const cages=[initialTrolley];for(let n=1;n<12;n++){const trolley=createTrolley(`Session trolley ${n}`);await owner.writeTrolley(trolley);cages.push(trolley);}
 // Grouping is metadata; physical status changes are retained independently.
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'teams/college-it/trolleys',initialTrolley.id),{payload:{...initialTrolley,status:'collected',company:'Supplier',collectedAt:new Date().toISOString(),collectedBy:'OLD'},version:1,createdBy:'admin',updatedBy:'admin',createdAt:new Date(),updatedAt:new Date(),revisionId:'seed'}));
 await owner.writeSession(createCollection('Twelve trolleys'),cages.map(t=>t.id));assert.equal((await owner.loadCollections()).collectionTrolleys.length,12);assert.equal((await owner.load()).trolleys.find(t=>t.id===initialTrolley.id).status,'collected');
});

test('security: direct malicious writes cannot store unexpected payload fields or oversized equipment and references',async()=>{
 const db=context('tech'),client=createTeamStore(db,'tech','college-it',member);
 for(const changes of [{admin:true},{manufacturer:'x'.repeat(1001)},{model:'x'.repeat(1001)},{serial:'x'.repeat(1001)},{recognitionConfirmed:'true'}]) {
  await assert.rejects(client.write({...sample(),...changes}),error=>error.code==='permission-denied');
  assert.equal((await getDoc(doc(db,'teams/college-it/equipment/equipment-1'))).exists(),false);
 }
 await assertFails(setDoc(doc(db,'teams/college-it/references/malicious'),{serial:'S',model:'x'.repeat(1001),manufacturer:'M',source:'Excel',importedBy:'tech',importedAt:serverTimestamp()}));
 await client.write(sample());assert.equal((await client.load()).items.length,1);
});
test('security: technicians can resolve audit names but cannot enumerate membership documents or read another team',async()=>{
 const db=context('tech');await getDoc(doc(db,'teams/college-it/members/admin'));
 await assertFails(getDocs(collection(db,'teams/college-it/members')));
 assert.equal((await getDocs(collection(context('admin'),'teams/college-it/members'))).size,2);
 for(const path of ['equipment','trolleys','references','collectionSessions','members','memberAudit'])await assertFails(getDocs(collection(db,`teams/other-team/${path}`)));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'teams/college-it/members/tech'),{...member,active:false}));
 await assertFails(getDoc(doc(db,'teams/college-it/members/admin')));
 await assert.rejects(createTeamStore(db,'tech','college-it',member).write(sample()),error=>error.code==='permission-denied');
});

test('collection deletion is audited, administrator-only, revision-checked and preserves saved equipment',async()=>{
 const {createCollection}=await import('../../src/collection-sessions.js');const owner=createTeamStore(context('admin'),'admin','college-it',admin),tech=createTeamStore(context('tech'),'tech','college-it',member);
 await tech.write(sample());const session=createCollection('Delete me');await owner.writeSession(session,[initialTrolley.id]);await assert.rejects(tech.deleteSession(session.id,1),/administrator/);
 const forged=createTeamStore(context('tech'),'tech','college-it',{...member,role:'admin'});await assert.rejects(forged.deleteSession(session.id,1),/permission/i);
 await owner.writeSession({...session,name:'Changed'},[initialTrolley.id],1);await assert.rejects(owner.deleteSession(session.id,1),/changed this collection/);assert.equal((await owner.loadCollections()).collectionSessions.length,1);
 await owner.deleteSession(session.id,2);const groups=await owner.loadCollections();assert.equal(groups.collectionSessions.length,0);assert.equal(groups.collectionTrolleys.length,0);assert.equal((await owner.load()).items.length,1);assert.equal((await owner.load()).trolleys.length,1);
 const row=await getDoc(doc(context('admin'),'teams/college-it/collectionSessions',session.id));assert.equal(row.data().deleted,true);assert.equal(row.data().version,3);assert.equal((await getDocs(collection(context('admin'),'teams/college-it/collectionSessions',session.id,'revisions'))).size,3);
 await assert.rejects(owner.writeSession(session,[initialTrolley.id],3),/deleted/);await assertFails(deleteDoc(row.ref));
 const fresh=createCollection('Reuse released trolley');await tech.writeSession(fresh,[initialTrolley.id]);assert.equal((await tech.loadCollections()).collectionTrolleys[0].sessionId,fresh.id);
});

test('deleting a twelve-trolley collection is atomic and stays within Firestore access limits',async()=>{
 const {createCollection}=await import('../../src/collection-sessions.js');const owner=createTeamStore(context('admin'),'admin','college-it',admin);const ids=[initialTrolley.id];for(let n=1;n<12;n++){const t=createTrolley(`Delete trolley ${n}`);await owner.writeTrolley(t);ids.push(t.id);}
 const session=createCollection('Delete twelve');await owner.writeSession(session,ids);await owner.deleteSession(session.id,1);const groups=await owner.loadCollections();assert.equal(groups.collectionSessions.length,0);assert.equal(groups.collectionTrolleys.length,0);assert.equal((await owner.load()).trolleys.length,12);
});

test('two devices creating the same shared trolley name commit only one permanent reference',async()=>{
 const {createSharedTrolley}=await import('../../src/trolleys.js');const owner=createTeamStore(context('admin'),'admin','college-it',admin),tech=createTeamStore(context('tech'),'tech','college-it',member);const a=await createSharedTrolley('Trolley 1.1',undefined,'demo-decompro/college-it'),b=await createSharedTrolley('trolley 1.1',undefined,'demo-decompro/college-it');
 const results=await Promise.allSettled([owner.writeTrolley(a,0),tech.writeTrolley(b,0)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const rows=(await owner.load()).trolleys.filter(t=>t.id===a.id);assert.equal(rows.length,1);assert.equal(rows[0].reference,a.reference);
});

test('renaming an open trolley preserves its reference and allows old-name records to be edited and removed',async()=>{
 const owner=createTeamStore(context('tech'),'tech','college-it',member);
 await owner.write(sample(),0);
 const version=owner.trolleyVersionFor(initialTrolley.id);
 await owner.writeTrolley({...initialTrolley,name:'Renamed cage'},version);
 await assert.rejects(owner.writeTrolley({...initialTrolley,name:'Stale rename'},version),/Another technician/);
 await owner.write({...sample(),model:'Updated model'},1);
 let stored=(await getDoc(doc(context('tech'),'teams/college-it/equipment/equipment-1'))).data();
 assert.equal(stored.payload.trolley,'Renamed cage');assert.equal(stored.payload.trolleyId,initialTrolley.id);
 await owner.write(stored.payload,2,{deleted:true});
 assert.equal((await owner.load()).items.length,0);
 assert.equal((await owner.load()).trolleys[0].reference,initialTrolley.reference);
 const audits=await getDocs(collection(context('tech'),'teams/college-it/equipment/equipment-1/revisions'));assert.equal(audits.size,3);
});

test('empty trolley deletion is administrator-only, audited, hidden and cannot be restored or reused',async()=>{
 const owner=createTeamStore(context('admin'),'admin','college-it',admin),tech=createTeamStore(context('tech'),'tech','college-it',member);
 await owner.load();await assert.rejects(tech.deleteTrolley(initialTrolley.id,1),/administrator/);
 await owner.deleteTrolley(initialTrolley.id,1);assert.equal((await owner.load()).trolleys.length,0);
 const row=doc(context('admin'),`teams/college-it/trolleys/${initialTrolley.id}`),deleted=(await getDoc(row)).data();assert.equal(deleted.deleted,true);assert.equal(deleted.payload.reference,initialTrolley.reference);
 const revisions=await getDocs(collection(row,'revisions'));assert.equal(revisions.docs.find(r=>r.id===deleted.revisionId).data().action,'remove');
 await assertFails(deleteDoc(row));await assert.rejects(owner.writeTrolley(initialTrolley,2),/deleted/);await assert.rejects(tech.write(sample(),0),/unavailable/);
 const replacement=await owner.allocateTrolley(initialTrolley.name,initialTrolley.department);assert.notEqual(replacement.id,initialTrolley.id);await owner.writeTrolley(replacement,0);assert.equal((await owner.load()).trolleys.length,1);
 const after={...deleted,deleted:false,version:deleted.version+1,updatedAt:serverTimestamp(),revisionId:'forged-restore'},batch=writeBatch(row.firestore);batch.set(row,after);batch.set(doc(row,'revisions','forged-restore'),{actor:'admin',before:deleted,after,action:'update',at:serverTimestamp()});await assertFails(batch.commit());
});
test('trolley deletion rejects nonempty, assigned, stale and ready trolleys',async()=>{
 const owner=createTeamStore(context('admin'),'admin','college-it',admin);await owner.load();
 await owner.write(sample(),0);await assert.rejects(owner.deleteTrolley(initialTrolley.id,2),/contains equipment/);await owner.write(sample(),1,{deleted:true});
 const group={id:createTrolley('group').id,name:'Active group',createdAt:new Date().toISOString()};await owner.writeSession(group,[initialTrolley.id],0);await assert.rejects(owner.deleteTrolley(initialTrolley.id,3),/Detach/);await owner.writeSession(group,[],1);
 await assert.rejects(owner.deleteTrolley(initialTrolley.id,1),/changed/);
 await owner.writeTrolley({...initialTrolley,department:'Changed department'},3);await assert.rejects(owner.deleteTrolley(initialTrolley.id,3),/changed/);
 await owner.write(sample('ready-item','READY-SERIAL'),0);
 await owner.writeTrolley({...initialTrolley,status:'ready',readyAt:new Date().toISOString(),readyBy:'TA'},5);await assert.rejects(owner.deleteTrolley(initialTrolley.id,6),/Only open/);
 const ready=(await owner.load()).trolleys.find(t=>t.id===initialTrolley.id);await owner.writeTrolley({...ready,status:'collected',collectedAt:new Date().toISOString(),collectedBy:'TA',company:'Collector'},6);await assert.rejects(owner.deleteTrolley(initialTrolley.id,7),/Only open/);
});
test('deletion races cannot accept new equipment or collection assignments on a deleted trolley',async()=>{
 const owner=createTeamStore(context('admin'),'admin','college-it',admin),tech=createTeamStore(context('tech'),'tech','college-it',member);await owner.load();
 const results=await Promise.allSettled([owner.deleteTrolley(initialTrolley.id,1),tech.write(sample(),0)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const snapshot=await owner.load();if(snapshot.trolleys.length)assert.equal(snapshot.items.length,1);else assert.equal(snapshot.items.length,0);
 const fresh=createTrolley('Assignment race');await owner.writeTrolley(fresh,0);const group={id:createTrolley('group').id,name:'Race group',createdAt:new Date().toISOString()};
 const raced=await Promise.allSettled([owner.deleteTrolley(fresh.id,1),tech.writeSession(group,[fresh.id],0)]);assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);
 const records=await owner.load(),groups=await owner.loadCollections();if(!records.trolleys.some(t=>t.id===fresh.id))assert.equal(groups.collectionTrolleys.some(t=>t.trolleyId===fresh.id),false);
});

test('allocating names never skips an existing normalised name to create a duplicate reference',async()=>{
 const owner=createTeamStore(context('admin'),'admin','college-it',admin),fresh=await owner.allocateTrolley('Allocation cage','Helpdesk');await owner.writeTrolley(fresh,0);
 await assert.rejects(owner.allocateTrolley(' ALLOCATION   CAGE ','Helpdesk'),/already uses/);
 await owner.deleteTrolley(fresh.id,1);const replacement=await owner.allocateTrolley('Allocation cage','Helpdesk');await owner.writeTrolley(replacement,0);
 assert.notEqual(replacement.id,fresh.id);await assert.rejects(owner.allocateTrolley('allocation cage','Helpdesk'),/already uses/);
});

test('administrator unlock reverses collected status with immutable reason history and restores item removal',async()=>{
 const owner=createTeamStore(context('admin'),'admin','college-it',admin),tech=createTeamStore(context('tech'),'tech','college-it',member),item=sample();await tech.write(item);
 await env.withSecurityRulesDisabled(async c=>{const ref=doc(c.firestore(),`teams/college-it/trolleys/${initialTrolley.id}`),row=(await getDoc(ref)).data();await setDoc(ref,{...row,payload:{...row.payload,status:'collected',company:'Collector',collectedAt:new Date().toISOString(),collectedBy:'TT'}});});
 await owner.load();await tech.load();const versions={[initialTrolley.id]:owner.trolleyVersionFor(initialTrolley.id)};
 const rowRef=doc(context('admin'),`teams/college-it/trolleys/${initialTrolley.id}`),original=(await getDoc(rowRef)).data();
 for(const [uid,changedName] of [['tech',false],['admin',true]]){
  const db=context(uid),ref=doc(db,`teams/college-it/trolleys/${initialTrolley.id}`),revisionId='forged-'+uid,payload={...initialTrolley,readyAt:'',readyBy:'',...(changedName?{name:'Changed during unlock'}:{})},after={...original,payload,version:original.version+1,updatedBy:uid,updatedAt:serverTimestamp(),revisionId};
  const batch=writeBatch(db);batch.set(ref,after);batch.set(doc(ref,'revisions',revisionId),{actor:uid,before:original,after,action:'unlock',reason:'Forged unlock',at:serverTimestamp()});await assertFails(batch.commit());
 }
 await assert.rejects(tech.unlockTrolleys(initialTrolley.id,versions,'Wrong status'),/administrator/);await assert.rejects(owner.unlockTrolleys(initialTrolley.id,versions,' '),/reason/);
 const unlocked=await owner.unlockTrolleys(initialTrolley.id,versions,'Pickup status entered by mistake');assert.equal(unlocked[0].status,'open');
 const audits=await getDocs(collection(context('admin'),`teams/college-it/trolleys/${initialTrolley.id}/revisions`)),unlock=audits.docs.map(d=>d.data()).find(r=>r.action==='unlock');assert.equal(unlock.before.payload.company,'Collector');assert.equal(unlock.reason,'Pickup status entered by mistake');assert.equal(unlock.actor,'admin');
 await assert.rejects(owner.unlockTrolleys(initialTrolley.id,versions,'Repeat'),/changed/);
 await tech.load();await tech.write(item,tech.versionFor(item.id),{deleted:true});assert.equal((await tech.load()).items.length,0);
});
test('six linked collected trolleys unlock atomically within rules access limits and reject partial direct writes',async()=>{
 const owner=createTeamStore(context('admin'),'admin','college-it',admin),trolleys=[initialTrolley,...Array.from({length:5},(_,i)=>createTrolley(`Linked ${i}`))],link={id:initialTrolley.id,trolleyIds:trolleys.map(t=>t.id)};
 await env.withSecurityRulesDisabled(async c=>{for(const t of trolleys)await setDoc(doc(c.firestore(),`teams/college-it/trolleys/${t.id}`),{payload:{...t,status:'collected',handover:link,company:'Collector',collectedAt:new Date().toISOString(),collectedBy:'TA'},version:1,createdBy:'admin',updatedBy:'admin',createdAt:new Date(),updatedAt:new Date(),revisionId:'seed'});});
 await owner.load();const versions=Object.fromEntries(trolleys.map(t=>[t.id,owner.trolleyVersionFor(t.id)]));
 const db=context('admin'),ref=doc(db,`teams/college-it/trolleys/${initialTrolley.id}`),before=(await getDoc(ref)).data(),payload={...initialTrolley,readyAt:'',readyBy:''},after={...before,payload,version:2,updatedBy:'admin',updatedAt:serverTimestamp(),revisionId:'partial'};
 const batch=writeBatch(db);batch.set(ref,after);batch.set(doc(ref,'revisions','partial'),{actor:'admin',before,after,action:'unlock',reason:'Partial group',at:serverTimestamp()});await assertFails(batch.commit());
 const unlocked=await owner.unlockTrolleys(trolleys[3].id,versions,'Correct linked pickup');assert.equal(unlocked.length,6);assert.ok((await owner.load()).trolleys.every(t=>t.status==='open'&&!t.handover));
});

test('atomic name reservations prevent concurrent creation and rename collisions across different trolley IDs',async()=>{
 const jawad=createTeamStore(context('tech'),'tech','college-it',member),owner=createTeamStore(context('admin'),'admin','college-it',admin);
 const first=createTrolley('Trolley 1.1'),second=createTrolley(' trolley   1.1 ');
 const results=await Promise.allSettled([jawad.writeTrolley(first),owner.writeTrolley(second)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/already uses/);
 assert.equal((await jawad.load()).trolleys.filter(t=>t.name.toLowerCase().includes('1.1')).length,1);
 await assert.rejects(owner.writeTrolley({...initialTrolley,name:'TROLLEY 1.1'},owner.trolleyVersionFor(initialTrolley.id)),/already uses/);
 const claim=(await getDocs(collection(context('admin'),'teams/college-it/trolleyNames'))).docs.map(d=>d.data()).find(r=>r.name.toLowerCase().includes('1.1'));assert.ok(claim);
});
test('legacy trolley names block new references and a renamed or deleted name can be reused safely',async()=>{
 const owner=createTeamStore(context('admin'),'admin','college-it',admin),legacy=createTrolley('Legacy 1.1');
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),`teams/college-it/trolleys/${legacy.id}`),{payload:legacy,version:1,createdBy:'admin',updatedBy:'admin',createdAt:new Date(),updatedAt:new Date(),revisionId:'seed'});});
 await assert.rejects(owner.writeTrolley(createTrolley(' legacy   1.1 ')),/already uses/);
 await owner.load();await owner.writeTrolley({...legacy,name:'Renamed legacy'},1);const replacement=createTrolley('Legacy 1.1');await owner.writeTrolley(replacement);
 await owner.load();await owner.deleteTrolley(replacement.id,owner.trolleyVersionFor(replacement.id));const reused=createTrolley('Legacy 1.1');await owner.writeTrolley(reused);assert.notEqual(reused.id,replacement.id);
});
