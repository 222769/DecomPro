import {trolleyForItem} from './trolleys.js';

export const missingDetail=value=>!String(value??'').trim()||/^(n\/?a|unknown|none|-|not known)$/i.test(String(value).trim());
const normalize=value=>String(value??'').trim().toUpperCase();
export const readinessFields=['serial','model','manufacturer'];
export function validateReadinessNotes(value={}) {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!readinessFields.includes(key)))throw Error('Invalid readiness review notes.');
 const notes={};
 for(const [key,note] of Object.entries(value)) {
  if(typeof note!=='string'||note.trim().length>500)throw Error('Readiness notes must be text up to 500 characters.');
  if(note.trim())notes[key]=note.trim();
 }
 return notes;
}
export function checkReadiness(trolley,register,{shared=false}={}) {
 const items=register.filter(item=>trolleyForItem(item,trolley)),issues=[];
 const indexes={serial:new Map(),asset:new Map()};
 for(const row of register)for(const field of ['serial','asset'])if(!missingDetail(row[field])){const key=normalize(row[field]);if(!indexes[field].has(key))indexes[field].set(key,[]);indexes[field].get(key).push(row);}
 for(const item of items) {
  for(const field of readinessFields)if(missingDetail(item[field]))issues.push({itemId:item.id,kind:'missing',field,message:`${field==='serial'?'Serial number':field==='model'?'Model':'Manufacturer'} is unavailable`,note:item.readinessNotes?.[field]||'',resolved:Boolean(item.readinessNotes?.[field]?.trim())});
  for(const field of ['serial','asset']) {
   if(missingDetail(item[field]))continue;
   const other=(indexes[field].get(normalize(item[field]))||[]).filter(row=>row.id!==item.id);
   if(other.length)issues.push({itemId:item.id,kind:'duplicate',field,message:`Duplicate ${field==='serial'?'serial number':'asset number'}: ${normalize(item[field])}`,otherIds:other.map(row=>row.id),resolved:false});
  }
  if(item.recognitionNeedsReview===true&&item.recognitionConfirmed!==true)issues.push({itemId:item.id,kind:'recognition',message:'Model suggestion needs a physical label check',resolved:false});
  if(shared&&!item.trolleyId)issues.push({itemId:item.id,kind:'assignment',message:'Save this equipment record to assign its permanent trolley reference',resolved:false});
 }
 return {items,issues,unresolved:issues.filter(issue=>!issue.resolved),canReady:items.length>0&&issues.every(issue=>issue.resolved)};
}
