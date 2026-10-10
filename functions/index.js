import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {accountService,AccountError} from './accounts.js';

initializeApp();
const administer=accountService({db:getFirestore(),auth:getAuth(),timestamp:()=>FieldValue.serverTimestamp()});
export const decomproAdmin=onCall({region:'europe-west2',invoker:'public',maxInstances:2,timeoutSeconds:60,memory:'256MiB',
 cors:process.env.FUNCTIONS_EMULATOR==='true'?true:[/^https:\/\/decompro\.hxali\.com$/,/^https:\/\/222769\.github\.io$/]},async request=>{
 try{return await administer(request.auth?.uid,request.data);}
 catch(error){
  if(error instanceof AccountError)throw new HttpsError(error.code,error.message);
  if(error.code==='auth/email-already-exists')throw new HttpsError('already-exists','This email already has a Firebase account. No new team access was granted.');
  if(error.code==='auth/user-not-found')throw new HttpsError('not-found','No Firebase account was found for this email. Choose Create account to register a new user.');
  if(error.code==='auth/invalid-email')throw new HttpsError('invalid-argument','Enter a valid email address.');
  throw new HttpsError('internal','Account action failed or could not be confirmed. Refresh users before retrying.');
 }
});
