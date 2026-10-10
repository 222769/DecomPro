import {randomBytes,randomUUID} from 'node:crypto';

export class AccountError extends Error {
 constructor(code,message){super(message);this.code=code;}
}
const fail=(code,message)=>{throw new AccountError(code,message);};
function profile(data) {
 const displayName=String(data.displayName||'').trim(),code=String(data.code||'').trim().toUpperCase();
 if(!displayName||displayName.length>60||! /^[A-Z0-9]{1,12}$/.test(code)||!['admin','technician'].includes(data.role)||typeof data.active!=='boolean')fail('invalid-argument','Enter a name, unique initials (1–12 letters or digits), role and access status.');
 return {displayName,code,role:data.role,active:data.active};
}
export function accountService({db,auth,timestamp}) {
 return async function administer(actor,data) {
  if(typeof actor!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(actor))fail('unauthenticated','Sign in to your administrator account.');
  const team=String(data?.teamId||'');
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(team))fail('invalid-argument','Invalid team ID.');
  const root=db.doc(`teams/${team}`),members=root.collection('members');
  const authorize=member=>{if(!member||member.active!==true||member.role!=='admin')fail('permission-denied','An active team administrator is required.');};
  authorize((await members.doc(actor).get()).data());
  const action=data.action;
  if(action==='list') {
   const result=await db.runTransaction(async tx=>{
    const teamDoc=await tx.get(root),snapshot=await tx.get(members);
    authorize(snapshot.docs.find(row=>row.id===actor)?.data());
    return {revision:teamDoc.data()?.adminRevision||0,users:snapshot.docs.map(row=>({uid:row.id,...row.data()}))};
   });
   for(let offset=0;offset<result.users.length;offset+=100){
    const batch=await auth.getUsers(result.users.slice(offset,offset+100).map(user=>({uid:user.uid})));
    for(const user of result.users.slice(offset,offset+100)){const identity=batch.users.find(row=>row.uid===user.uid);user.email=identity?.email||'';user.authMissing=!identity;user.authDisabled=identity?.disabled===true;}
   }
   return result;
  }
  if(!['create','link','update','reset'].includes(action))fail('invalid-argument','Unknown account action.');
  if(!Number.isInteger(data.revision)||data.revision<0)fail('invalid-argument','Refresh the user list before making changes.');
  const expected=data.revision;
  const payload=action==='reset'?null:profile(data);
  let identity=null,created=false;
  if(action==='create'||action==='link') {
   const email=String(data.email||'').trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail('invalid-argument','Enter a valid technician email address.');
   if(!payload.active)fail('invalid-argument','New accounts start with active team access.');
   if(action==='link')identity=await auth.getUserByEmail(email);
   else{identity=await auth.createUser({email,displayName:payload.displayName,password:randomBytes(32).toString('base64url')});created=true;}
  } else {
   if(typeof data.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(data.uid))fail('invalid-argument','Invalid user ID.');
   // Check membership before looking up or resetting a project-wide account.
   if(!(await members.doc(data.uid).get()).exists)fail('not-found','This user is not in this team.');
   if(action==='reset')identity=await auth.getUser(data.uid);
  }
  const uid=identity?.uid||data.uid;
  try {
   await db.runTransaction(async tx=>{
    const teamDoc=await tx.get(root),snapshot=await tx.get(members);
    authorize(snapshot.docs.find(row=>row.id===actor)?.data());
    const revision=teamDoc.data()?.adminRevision||0;
    if(revision!==expected)fail('aborted','Another administrator changed the accounts. Refresh and review the latest users.');
    const before=snapshot.docs.find(row=>row.id===uid)?.data()||null;
    if(['create','link'].includes(action)&&before)fail('already-exists','This account already belongs to the team.');
    if(!['create','link'].includes(action)&&!before)fail('not-found','This user is no longer in the team.');
    if(action==='update') {
     if(payload.code!==before.code)fail('failed-precondition','Disposal initials stay fixed to preserve attribution.');
     if(uid===actor&&(payload.role!=='admin'||!payload.active))fail('failed-precondition','You cannot remove your own administrator access.');
    }
    if(payload&&snapshot.docs.some(row=>row.id!==uid&&String(row.data().code).toUpperCase()===payload.code))fail('already-exists','Those disposal initials already belong to another team member.');
    if(action!=='reset')tx.set(members.doc(uid),payload);
    tx.set(root,{adminRevision:revision+1},{merge:true});
    tx.set(root.collection('memberAudit').doc(randomUUID()),{actor,uid,action,before,after:payload||before,at:timestamp()});
   });
  }catch(error){
   if(created){
    // A transport failure can arrive after Firestore committed. Never delete
    // the Auth identity when the transaction's outcome is uncertain.
    if(!(error instanceof AccountError))fail('internal','Account creation could not be confirmed. Refresh users; if it is not listed, add the existing Firebase account with the same email.');
    try{await auth.deleteUser(uid);}catch(cleanup){if(cleanup.code!=='auth/user-not-found')fail('internal','An account was created without team access and cleanup failed. Check Firebase Authentication before retrying.');}
   }
   throw error;
  }
  if(action==='link')return {uid,message:'Existing account added to the team. The technician can use their current password.'};
  if(action==='update')return {uid,message:'Team access updated. Existing equipment attribution is preserved.'};
  try{return {uid,setupLink:await auth.generatePasswordResetLink(identity.email),message:action==='create'?'Account created. Share the private setup link with the technician.':'Password reset link ready. Share it privately with this technician.'};}
  catch{return {uid,message:'The account is available, but the password link could not be generated. Refresh users and try Password reset link again.'};}
 };
}
