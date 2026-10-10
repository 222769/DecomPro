import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from '../../functions/node_modules/firebase-admin/lib/app/index.js';
import {getFirestore,FieldValue} from '../../functions/node_modules/firebase-admin/lib/firestore/index.js';
import {getAuth} from '../../functions/node_modules/firebase-admin/lib/auth/index.js';
import {accountService} from '../../functions/accounts.js';
let app,db,auth,run;
const admin={displayName:'Administrator',code:'AD',role:'admin',active:true};
const tech={displayName:'Technician',code:'TT',role:'technician',active:true};
const request=(action,values={})=>({action,teamId:'college-it',...values});
before(()=>{app=initializeApp({projectId:'demo-decompro'},'admin-accounts-tests');db=getFirestore(app);auth=getAuth(app);run=accountService({db,auth,timestamp:()=>FieldValue.serverTimestamp()});});
after(async()=>{await db.terminate();await deleteApp(app);});
beforeEach(async()=>{
 await db.recursiveDelete(db.doc('teams/college-it'));
 const existing=await auth.listUsers();if(existing.users.length)await auth.deleteUsers(existing.users.map(user=>user.uid));
 await auth.createUser({uid:'owner',email:'owner@example.invalid',password:'Owner-test-password-42!'});await auth.createUser({uid:'tech',email:'tech@example.invalid',password:'Technician-test-password-42!'});
 await db.doc('teams/college-it/members/owner').set(admin);await db.doc('teams/college-it/members/tech').set(tech);
});
test('account operations require an authenticated active administrator in the requested team',async()=>{
 for(const actor of [null,'outsider','tech'])await assert.rejects(run(actor,request('list')),/administrator|Sign in/);
 await db.doc('teams/college-it/members/owner').update({active:false});await assert.rejects(run('owner',request('list')),/administrator/);
 await assert.rejects(run('tech',{action:'list',teamId:'other-team'}),/administrator/);
});
test('creation produces an Authentication user, membership and audit, without exposing passwords or storing setup links',async()=>{
 const result=await run('owner',request('create',{email:'jawad@example.invalid',displayName:'Jawad',code:'JA',role:'technician',active:true,revision:0}));
 assert.equal(typeof result.setupLink,'string');assert.equal((await auth.getUser(result.uid)).email,'jawad@example.invalid');
 const member=(await db.doc(`teams/college-it/members/${result.uid}`).get()).data();assert.deepEqual(member,{displayName:'Jawad',code:'JA',role:'technician',active:true});
 const events=await db.collection('teams/college-it/memberAudit').get();assert.equal(events.size,1);const audit=events.docs[0].data();assert.equal(audit.actor,'owner');assert.equal(audit.action,'create');assert.equal('setupLink' in audit,false);assert.equal('password' in audit,false);
 const list=await run('owner',request('list'));assert.equal(list.revision,1);assert.equal(list.users.find(user=>user.uid===result.uid).email,'jawad@example.invalid');
});
test('duplicate initials and stale changes roll back newly created Authentication users',async()=>{
 await assert.rejects(run('owner',request('create',{email:'duplicate@example.invalid',displayName:'Duplicate',code:'TT',role:'technician',active:true,revision:0})),/initials/);
 await assert.rejects(auth.getUserByEmail('duplicate@example.invalid'),error=>error.code==='auth/user-not-found');
 await assert.rejects(run('owner',request('create',{email:'stale@example.invalid',displayName:'Stale',code:'ST',role:'technician',active:true,revision:9})),/Another administrator/);
 await assert.rejects(auth.getUserByEmail('stale@example.invalid'),error=>error.code==='auth/user-not-found');
 assert.equal((await db.collection('teams/college-it/members').get()).size,2);
});
test('updates preserve initials and history, prevent self lockout and revoke team access',async()=>{
 await db.doc('teams/college-it/equipment/history').set({payload:{technician:'TT',serial:'ORIGINAL001'}});
 await assert.rejects(run('owner',request('update',{uid:'owner',...admin,role:'technician',revision:0})),/own administrator/);
 await assert.rejects(run('owner',request('update',{uid:'tech',...tech,code:'XX',revision:0})),/stay fixed/);
 await run('owner',request('update',{uid:'tech',...tech,displayName:'Updated technician',active:false,revision:0}));
 assert.equal((await db.doc('teams/college-it/members/tech').get()).data().active,false);
 assert.equal((await db.doc('teams/college-it/equipment/history').get()).data().payload.technician,'TT');
 await assert.rejects(run('tech',request('list')),/administrator/);
 const result=await run('owner',request('reset',{uid:'tech',revision:1}));assert.equal(typeof result.setupLink,'string');
 assert.equal((await db.doc('teams/college-it/members/tech').get()).data().active,false);
 await assert.rejects(run('owner',request('reset',{uid:'other-user',revision:2})),/not in this team/);
});
test('concurrent admin account creation commits once and safely cleans up the losing account',async()=>{
 const make=email=>run('owner',request('create',{email,displayName:'New technician',code:email.startsWith('first')?'ONE':'TWO',role:'technician',active:true,revision:0}));
 const results=await Promise.allSettled([make('first@example.invalid'),make('second@example.invalid')]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal((await auth.listUsers()).users.length,3);assert.equal((await db.collection('teams/college-it/members').get()).size,3);
});

test('a created technician can set a password, sign in and retrieve membership, then loses data access when deactivated',async()=>{
 const {initializeApp:clientApp,deleteApp:deleteClientApp}=await import('firebase/app');
 const {getAuth:clientAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut}=await import('firebase/auth');
 const {getFirestore:clientDb,connectFirestoreEmulator,getDocFromServer,doc,terminate}=await import('firebase/firestore');
 const result=await run('owner',request('create',{email:'new-tech@example.invalid',displayName:'New technician',code:'NT',role:'technician',active:true,revision:0}));
 const password='Account-test-password-42!';
 const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:new URL(result.setupLink).searchParams.get('oobCode'),newPassword:password})});
 assert.equal(response.status,200);
 const client=clientApp({projectId:'demo-decompro',apiKey:'demo-key'},'new-technician-login');
 const login=clientAuth(client);connectAuthEmulator(login,'http://127.0.0.1:9099',{disableWarnings:true});
 const store=clientDb(client);connectFirestoreEmulator(store,'127.0.0.1',8085);
 try {
  const signedIn=await signInWithEmailAndPassword(login,'new-tech@example.invalid',password);assert.equal(signedIn.user.uid,result.uid);
  const member=await getDocFromServer(doc(store,`teams/college-it/members/${result.uid}`));assert.equal(member.data().code,'NT');
  await run('owner',request('update',{uid:result.uid,displayName:'New technician',code:'NT',role:'technician',active:false,revision:1}));
  await assert.rejects(getDocFromServer(doc(store,`teams/college-it/members/${result.uid}`)),/permission/i);
 }finally{await signOut(login);await terminate(store);await deleteClientApp(client);}
});

test('an existing Authentication account can join the team without changing its password or duplicating membership',async()=>{
 const user=await auth.createUser({email:'existing@example.invalid',password:'Existing-test-password-42!'});
 const result=await run('owner',request('link',{email:'existing@example.invalid',displayName:'Existing technician',code:'ET',role:'technician',active:true,revision:0}));
 assert.equal(result.uid,user.uid);assert.equal(result.setupLink,undefined);
 assert.equal((await auth.listUsers()).users.length,3);
 await assert.rejects(run('owner',request('link',{email:'existing@example.invalid',displayName:'Existing technician',code:'ET',role:'technician',active:true,revision:1})),/already belongs/);
 assert.equal((await auth.getUser(user.uid)).email,'existing@example.invalid');
});

test('the callable HTTP endpoint trusts authenticated identity rather than an actor supplied in its body',async()=>{
 const url='http://127.0.0.1:5001/demo-decompro/europe-west2/decomproAdmin';
 const body=JSON.stringify({data:request('list',{actor:'owner'})});
 const visitor=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(visitor.status,401);
 const {initializeApp:clientApp,deleteApp:deleteClientApp}=await import('firebase/app');
 const {getAuth:clientAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut}=await import('firebase/auth');
 const client=clientApp({projectId:'demo-decompro',apiKey:'demo-key'},'callable-admin-identity'),login=clientAuth(client);connectAuthEmulator(login,'http://127.0.0.1:9099',{disableWarnings:true});
 try {
  await signInWithEmailAndPassword(login,'tech@example.invalid','Technician-test-password-42!');
  const denied=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await login.currentUser.getIdToken()},body});assert.equal(denied.status,403);
  await signInWithEmailAndPassword(login,'owner@example.invalid','Owner-test-password-42!');
  const allowed=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await login.currentUser.getIdToken()},body});assert.equal(allowed.status,200);assert.equal((await allowed.json()).result.users.length,2);
 }finally{await signOut(login);await deleteClientApp(client);}
});

test('an ambiguous transaction response never deletes an Authentication identity whose membership committed',async()=>{
 const uncertain=accountService({db:{doc:path=>db.doc(path),async runTransaction(callback){await db.runTransaction(callback);throw Error('Response lost after commit');}},auth,timestamp:()=>FieldValue.serverTimestamp()});
 await assert.rejects(uncertain('owner',request('create',{email:'uncertain@example.invalid',displayName:'Uncertain outcome',code:'UC',role:'technician',active:true,revision:0})),/could not be confirmed/);
 const user=await auth.getUserByEmail('uncertain@example.invalid');assert.equal((await db.doc(`teams/college-it/members/${user.uid}`).get()).data().code,'UC');
 assert.equal((await run('owner',request('list'))).users.find(row=>row.uid===user.uid).authMissing,false);
});
