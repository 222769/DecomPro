import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, onSnapshot, runTransaction, writeBatch, serverTimestamp } from 'firebase/firestore';
import { normalizeSerial, cleanExamples } from './recognition.js';

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
 const root=doc(db,'teams',teamId),equipment=collection(root,'equipment'),references=collection(root,'references'),serials=collection(root,'serials');
 const versions=new Map(),stops=[];
 const decode=snapshot=>snapshot.docs.sort((a,b)=>(a.data().createdAt?.toMillis?.()||0)-(b.data().createdAt?.toMillis?.()||0)).map(d=>{versions.set(d.id,d.data().version);return {...d.data().payload,id:d.id};});
 const memberProfile={name:member.displayName,code:member.code};
 const client={
  profile:memberProfile,role:member.role,email:auth?.currentUser?.email||'',teamId,
  versionFor(id){return versions.get(id)||0;},
  async load(){const [items,examples]=await Promise.all([getDocs(query(equipment,where('deleted','==',false))),getDocs(references)]);return {items:decode(items),examples:cleanExamples(examples.docs.map(d=>d.data()))};},
  listen(onItems,onExamples,onError){stops.push(onSnapshot(query(equipment,where('deleted','==',false)),s=>onItems(decode(s)),onError),onSnapshot(references,s=>onExamples(cleanExamples(s.docs.map(d=>d.data()))),onError));},
  stop(){stops.splice(0).forEach(stop=>stop());},
  async logout(){client.stop();if(auth)await signOut(auth);},
  async write(item,expectedVersion=0,{deleted=false,historicalImport=false}={}) {
   if(historicalImport&&member.role!=='admin')throw Error('Only an administrator can import historical local records.');
   const serial=normalizeSerial(item.serial),newKey=deleted||serial==='N/A'?'':'s-'+serial.replaceAll('~','~~').replaceAll('/','~s'),row=doc(equipment,item.id),revisionId=crypto.randomUUID();
   await runTransaction(db,async tx=>{
    const current=await tx.get(row),before=current.exists()?current.data():null;
    if((before?.version||0)!==expectedVersion)throw Error('Another technician changed this record. Refresh the register and review their changes before retrying.');
    if(before?.deleted&&!deleted)throw Error('This item was removed. Create a new record rather than overwriting its history.');
    const oldKey=before?.serialKey||'';
    const claim=newKey?await tx.get(doc(serials,newKey)):null;
    if(claim?.exists()&&claim.data().itemId!==item.id)throw Error('This serial number is already recorded by the team.');
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
