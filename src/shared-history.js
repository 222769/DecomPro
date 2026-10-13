import {collection,doc,getDocFromServer,getDocsFromServer,query,where,limit,writeBatch,runTransaction,serverTimestamp} from 'firebase/firestore';
import {validateHistoricalEquipment,usableIdentifier} from './historical-equipment.js';
import {normalizeSerial} from './recognition.js';
import {createId} from './ids.js';
export function sharedHistory(db,root,uid,role){
 const files=collection(root,'historicalFiles');
 return {
  async publishHistorical(rows,file){
   if(role!=='admin')throw Error('Only an administrator can share historical spreadsheets.');
   rows=validateHistoricalEquipment(rows);
   if(!rows.length||rows.length>5000||rows.some(row=>row.file!==file))throw Error('Share one complete spreadsheet of 1 to 5,000 rows.');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(file)))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const ref=doc(files,hash),before=await getDocFromServer(ref),version=before.exists()?before.data().version:0,generation=createId();
   for(let start=0;start<rows.length;start+=200){
    const batch=writeBatch(db);
    for(const row of rows.slice(start,start+200)){
     const payload={...row,id:createId()};
     const identifiers=[...new Set(['serial','barcode','etch','asset'].map(key=>normalizeSerial(row.values[key])).filter(usableIdentifier))];
     batch.set(doc(ref,'versions',generation,'rows',payload.id),{payload,identifiers,uploadedBy:uid,uploadedAt:serverTimestamp()});
    }
    await batch.commit();
   }
   // Readers only see a generation once every row has been uploaded.
   await runTransaction(db,async tx=>{const current=await tx.get(ref);if((current.exists()?current.data().version:0)!==version)throw Error('Another administrator replaced this file. Reload and review before sharing again.');tx.set(ref,{name:file,generation,rows:rows.length,version:version+1,updatedBy:uid,updatedAt:serverTimestamp()});});
  },
  async findHistorical(identifier){
   const value=normalizeSerial(identifier);if(!usableIdentifier(value))return [];
   const manifest=await getDocsFromServer(query(files,limit(101)));
   if(manifest.size>100)throw Error('The team archive has more than 100 spreadsheets. Ask an administrator to consolidate it.');
   const groups=await Promise.all(manifest.docs.map(async file=>{
    const data=file.data(),rows=await getDocsFromServer(query(collection(file.ref,'versions',data.generation,'rows'),where('identifiers','array-contains',value),limit(101)));
    return validateHistoricalEquipment(rows.docs.map(row=>row.data().payload));
   }));
   return groups.flat();
  }
 };
}
