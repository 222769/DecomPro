import {createId} from './ids.js';
import {validateHandoverLink} from './handover-data.js';

export const defaultDepartment='Helpdesk (Calderdale College)';
export function createTrolley(name,department=defaultDepartment) {
 if(typeof name!=='string'||!name.trim()||name.trim().length>1000||typeof department!=='string'||!department.trim()||department.trim().length>100)throw Error('Enter a trolley name (up to 1000 characters) and department (up to 100 characters).');
 const id=createId();
 return {id,reference:`TSU-${id.replaceAll('-','').toUpperCase()}`,name:name.trim(),department:department.trim(),status:'open',createdAt:new Date().toISOString(),collectedAt:'',collectedBy:'',company:''};
}
export function validateTrolleys(records=[]) {
 if(!Array.isArray(records))throw Error('Invalid trolley register.');
 const ids=new Set(),references=new Set();
 return records.map(row=>{
  if(!row||typeof row.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.id)||ids.has(row.id)||row.reference!==`TSU-${row.id.replaceAll('-','').toUpperCase()}`||references.has(row.reference)||!['open','ready','collected'].includes(row.status))throw Error('Invalid or repeated trolley reference.');
  for(const field of ['name','department','createdAt','collectedAt','collectedBy','company'])if(typeof row[field]!=='string')throw Error('Invalid trolley details.');
  if(!row.name.trim()||row.name.length>1000||!row.department.trim()||row.department.length>100||!Number.isFinite(Date.parse(row.createdAt))||(row.status==='collected'&&(!Number.isFinite(Date.parse(row.collectedAt))||!row.collectedBy.trim()||!row.company.trim()||row.company.length>100))||(row.status!=='collected'&&(row.collectedAt||row.collectedBy||row.company)))throw Error('Invalid trolley status or collection details.');
  const readyAt=row.readyAt??'',readyBy=row.readyBy??'';
  if(typeof readyAt!=='string'||typeof readyBy!=='string'||(row.status==='ready'&&(!Number.isFinite(Date.parse(readyAt))||!readyBy.trim()))||(row.status==='open'&&(readyAt||readyBy))||Boolean(readyAt)!==Boolean(readyBy)||(readyAt&&!Number.isFinite(Date.parse(readyAt))))throw Error('Invalid trolley readiness details.');
  ids.add(row.id);references.add(row.reference);
  const handover=row.handover===undefined?null:validateHandoverLink(row.handover);
  if(handover&&(row.status!=='collected'||!handover.trolleyIds.includes(row.id)))throw Error('Invalid trolley handover assignment.');
  return {...Object.fromEntries(['id','reference','name','department','status','createdAt','collectedAt','collectedBy','company'].map(field=>[field,row[field]])),...(row.readyAt!==undefined||row.readyBy!==undefined||row.status==='ready'?{readyAt,readyBy}:{}),...(handover?{handover}:{})};
 });
}
export function trolleyForItem(item,trolley) {
 return item.trolleyId?item.trolleyId===trolley.id:item.trolley===trolley.name;
}
export function findTrolley(value,trolleys) {
 const input=value.trim().toUpperCase();
 return trolleys.find(row=>row.reference===input||row.id.toUpperCase()===input);
}

export const trolleyNameKey=name=>name.trim().replace(/\s+/g,' ').toLowerCase();
export async function createSharedTrolley(name,department=defaultDepartment,workspace='college-it') {
 // A shared name resolves to one ID across devices, without changing existing trolley references.
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`decompro.trolley/${workspace}/${trolleyNameKey(name)}`)));
 const bytes=digest.slice(0,16);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join(''),id=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 return {...createTrolley(name,department),id,reference:`TSU-${id.replaceAll('-','').toUpperCase()}`};
}
