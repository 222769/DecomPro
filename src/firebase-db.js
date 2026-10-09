import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, getDocsFromServer, query, where, onSnapshot, runTransaction, writeBatch, serverTimestamp } from 'firebase/firestore';
import { normalizeSerial, cleanExamples } from './recognition.js';
import { createId } from './ids.js';
import {validateTrolleys} from './trolleys.js';

export function validateFirebaseConfig(value) {
 if(!value||typeof value!=='object'||'private_key' in value||'client_email' in value)throw Error('Use the public Firebase web app configuration, never a service-account key.');
 const allowed=['apiKey','authDomain','projectId','appId','storageBucket','messagingSenderId','measurementId','databaseURL'];
 if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error('Only public Firebase web app configuration fields are accepted.');
 const result={};
 for(const key of ['apiKey','authDomain','projectId','appId']) {
  if(typeof value[key]!=='string'||!value[key].trim())throw Error(`Firebase web configuration needs ${key}.`);
  result[key]=value[key].trim();
 }
 if(!/^[a-z0-9-]+$/.test(result.projectId)||!/^([a-z0-9-]+\.)+[a-z]+$/i.test(result.authDomain))throw Error('Invalid project ID or authentication domain.');
 return result;
}
async function hash(value) {
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function connectFirebase(config,teamId,email,password) {
 config=validateFirebaseConfig(config);
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(teamId))throw Error('Use a team ID containing only letters, numbers, underscores or hyphens.');
 const name=`decompro-${config.projectId}`;
 const app=getApps().find(app=>app.name===name)||initializeApp(config,name),auth=getAuth(app),db=getFirestore(app);
 if(email)await signInWithEmailAndPassword(auth,email,password);
 else await new Promise(resolve=>{const unsubscribe=onAuthStateChanged(auth,()=>{unsubscribe();resolve();});});
 if(!auth.currentUser)throw Error('Sign in with your Firebase team account.');
 const uid=auth.currentUser.uid;
 const membership=await getDoc(doc(db,'teams',teamId,'members',uid));
 if(!membership.exists()||!['admin','technician'].includes(membership.data().role)||membership.data().active!==true)throw Error('This account is not an active member of the configured team.');
 return createTeamStore(db,uid,teamId,membership.data(),auth);
}
export function createTeamStore(db,uid,teamId,member,auth=null) {
 const root=doc(db,'teams',teamId),equipment=collection(root,'equipment'),references=collection(root,'references'),serials=collection(root,'serials'),trolleys=collection(root,'trolleys');
 const versions=new Map(),stops=[];
 const trolleyVersions=new Map();
 const decodeTrolleys=snapshot=>validateTrolleys(snapshot.docs.map(row=>{trolleyVersions.set(row.id,row.data().version);return row.data().payload;}));
 const decode=snapshot=>snapshot.docs.sort((a,b)=>(a.data().createdAt?.toMillis?.()||0)-(b.data().createdAt?.toMillis?.()||0)).map(d=>{versions.set(d.id,d.data().version);return {...d.data().payload,id:d.id};});
 const memberProfile={name:member.displayName,code:member.code};
 const client={
  profile:memberProfile,role:member.role,email:auth?.currentUser?.email||'',teamId,
  versionFor(id){return versions.get(id)||0;},
  async load(){const [items,examples,cages]=await Promise.all([getDocsFromServer(query(equipment,where('deleted','==',false))),getDocsFromServer(references),getDocsFromServer(trolleys)]);return {items:decode(items),examples:cleanExamples(examples.docs.map(d=>d.data())),trolleys:decodeTrolleys(cages)};},
  listen(onItems,onExamples,onError,onTrolleys=()=>{},onConnection=()=>{}) {
   const confirmed=new Set();
   const receive=(key,callback)=>snapshot=>{
    try{callback(snapshot);if(!snapshot.metadata.fromCache&&!snapshot.metadata.hasPendingWrites)confirmed.add(key);else confirmed.delete(key);onConnection(confirmed.size===3?'connected':'syncing');}
    catch(error){onError(error);}
   };
   stops.push(onSnapshot(query(equipment,where('deleted','==',false)),{includeMetadataChanges:true},receive('items',s=>onItems(decode(s))),onError),
    onSnapshot(references,{includeMetadataChanges:true},receive('references',s=>onExamples(cleanExamples(s.docs.map(d=>d.data())))),onError),
    onSnapshot(trolleys,{includeMetadataChanges:true},receive('trolleys',s=>onTrolleys(decodeTrolleys(s))),onError));
  },
  trolleyVersionFor(id){return trolleyVersions.get(id)||0;},
  async writeTrolley(trolley,expectedVersion=0,{historicalImport=false}={}) {
   if(historicalImport&&member.role!=='admin')throw Error('Only an administrator can import historical collection details.');
   trolley=validateTrolleys([trolley])[0];
   if(trolley.status==='collected') {
    const snapshot=await getDocs(query(equipment,where('deleted','==',false)));
    const legacy=snapshot.docs.filter(row=>!row.data().payload.trolleyId&&row.data().payload.trolley===trolley.name);
    if(legacy.length) {
     const names=await getDocs(query(trolleys,where('payload.name','==',trolley.name)));
     if(names.size!==1)throw Error('Legacy equipment uses an ambiguous trolley name. Assign those items to the correct reference before collection.');
     for(const row of legacy)await client.write({...row.data().payload,trolleyId:trolley.id},row.data().version);
    }
   }
   const row=doc(trolleys,trolley.id),revisionId=createId();
   await runTransaction(db,async tx=>{
    const snapshot=await tx.get(row),before=snapshot.exists()?snapshot.data():null;
    if((before?.version||0)!==expectedVersion)throw Error('Another technician changed this trolley. Reopen trolley management and review the latest details.');
    if(before?.payload.status==='collected')throw Error('This trolley has already been collected. Its history is locked.');
    const payload={...trolley,collectedBy:trolley.status==='collected'?(historicalImport?trolley.collectedBy:member.code):''};
    const after={payload,version:expectedVersion+1,createdBy:before?.createdBy||uid,updatedBy:uid,createdAt:before?.createdAt||serverTimestamp(),updatedAt:serverTimestamp(),revisionId};
    tx.set(row,after);tx.set(doc(row,'revisions',revisionId),{actor:uid,before,after,action:payload.status==='collected'?'collect':before?'update':'create',at:serverTimestamp()});
   });
   trolleyVersions.set(trolley.id,expectedVersion+1);
  },
  stop(){stops.splice(0).forEach(stop=>stop());},
  async logout(){client.stop();if(auth)await signOut(auth);},
  async write(item,expectedVersion=0,{deleted=false,historicalImport=false}={}) {
   if(historicalImport&&member.role!=='admin')throw Error('Only an administrator can import historical local records.');
   const serial=normalizeSerial(item.serial),newKey=deleted||serial==='N/A'?'':'s-'+serial.replaceAll('~','~~').replaceAll('/','~s'),row=doc(equipment,item.id),revisionId=createId();
   await runTransaction(db,async tx=>{
    const current=await tx.get(row),before=current.exists()?current.data():null;
    if((before?.version||0)!==expectedVersion)throw Error('Another technician changed this record. Refresh the register and review their changes before retrying.');
    if(before?.deleted&&!deleted)throw Error('This item was removed. Create a new record rather than overwriting its history.');
    const oldKey=before?.serialKey||'';
    const claim=newKey?await tx.get(doc(serials,newKey)):null;
    if(claim?.exists()&&claim.data().itemId!==item.id)throw Error('This serial number is already recorded by the team.');
    for(const trolleyId of new Set([item.trolleyId,before?.payload.trolleyId].filter(Boolean))) {
     const trolley=await tx.get(doc(trolleys,trolleyId));
     if(!trolley.exists()||trolley.data().payload.status!=='open')throw Error('This trolley is unavailable or collected. Select an open trolley.');
     if(trolleyId===item.trolleyId&&trolley.data().payload.name!==item.trolley)throw Error('Trolley details changed. Select the trolley again before saving.');
    }
    const payload={...item,technician:before?before.payload.technician:historicalImport?item.technician:member.code};
    const after={payload,serialKey:newKey,version:expectedVersion+1,createdBy:before?.createdBy||uid,updatedBy:uid,createdAt:before?.createdAt||serverTimestamp(),updatedAt:serverTimestamp(),revisionId,deleted,historicalImport:before?.historicalImport||historicalImport};
    tx.set(row,after);
    tx.set(doc(row,'revisions',revisionId),{actor:uid,before,after,action:deleted?'remove':before?'edit':'create',at:serverTimestamp()});
    if(newKey)tx.set(doc(serials,newKey),{itemId:item.id,serial});
    if(oldKey&&oldKey!==newKey)tx.delete(doc(serials,oldKey));
   });
   versions.set(item.id,expectedVersion+1);
  },
  async importExamples(examples) {
   examples=cleanExamples(examples);
   for(let start=0;start<examples.length;start+=200){const batch=writeBatch(db);for(const fact of examples.slice(start,start+200)){const id=await hash(`${fact.serial}\u0000${fact.model.toLowerCase()}\u0000${fact.manufacturer.toLowerCase()}`);batch.set(doc(references,id),{...fact,importedBy:uid,importedAt:serverTimestamp()});}await batch.commit();}
  }
 };
 return client;
}

export async function disconnectFirebaseAuth(config) {
 const app=getApps().find(app=>app.name===`decompro-${config.projectId}`);
 if(app)await signOut(getAuth(app));
}
