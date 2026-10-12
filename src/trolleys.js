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
// Firestore rules recompute this key (database/firestore.rules trolleyNameKey), so it
// uses only the ASCII whitespace that the rules' RE2 patterns recognise.
export async function trolleyClaimKey(name) {
 const normal=name.replace(/[\t\n\f\r ]+/g,' ').replace(/^ | $/g,'').toLowerCase();
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normal)));
 return 'n-'+[...digest].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function duplicateTrolleyError(existing) {
 return Object.assign(Error(`A trolley named "${existing.name}" already exists (${existing.reference}). Select it with Use trolley instead of creating another.`),{code:'duplicate-trolley-name',trolleyId:existing.id});
}
export async function createSharedTrolley(name,department=defaultDepartment,workspace='college-it',generation=0) {
 // A shared name resolves to one ID across devices, without changing existing trolley references.
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`decompro.trolley/${workspace}/${trolleyNameKey(name)}${generation?`/generation/${generation}`:''}`)));
 const bytes=digest.slice(0,16);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join(''),id=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 return {...createTrolley(name,department),id,reference:`TSU-${id.replaceAll('-','').toUpperCase()}`};
}

export function restoreLocalTrolleys(workspace) {
 const trolleys=[...workspace.trolleys],items=workspace.items.map(item=>({...item})),defaults={...workspace.defaults};
 const byId=new Map(trolleys.map(t=>[t.id,t]));
 for(const item of items) {
  if(item.trolleyId){const trolley=byId.get(item.trolleyId);if(trolley)item.trolley=trolley.name;continue;}
  const matches=trolleys.filter(t=>trolleyNameKey(t.name)===trolleyNameKey(item.trolley));
  if(matches.length===1){item.trolleyId=matches[0].id;item.trolley=matches[0].name;}
  // Legacy rows without a reference can establish a trolley; a stale name with
  // an existing permanent reference must never create another one.
  else if(!matches.length&&!workspace.collectionWorkspace){const trolley=createTrolley(item.trolley);trolleys.push(trolley);byId.set(trolley.id,trolley);item.trolleyId=trolley.id;item.trolley=trolley.name;}
 }
 let activeTrolleyId=workspace.activeTrolleyId||'';
 const selected=byId.get(activeTrolleyId);
 if(selected)defaults.trolley=selected.name;
 else {
  const matches=trolleys.filter(t=>trolleyNameKey(t.name)===trolleyNameKey(defaults.trolley));
  if(matches.length===1){activeTrolleyId=matches[0].id;defaults.trolley=matches[0].name;}
  // Only initialise a genuinely new local workspace. A typed default name
  // is not an instruction to create a new trolley during reload or sign-in.
  else if(!trolleys.length&&!items.length&&defaults.trolley&&!workspace.collectionWorkspace){const trolley=createTrolley(defaults.trolley);trolleys.push(trolley);activeTrolleyId=trolley.id;defaults.trolley=trolley.name;}
 }
 return {...workspace,trolleys,items,defaults,activeTrolleyId};
}

export function reconcileTrolleySelection(workspace,trolleys) {
 const ids=new Set(trolleys.map(t=>t.id)),collectionScans=structuredClone(workspace.collectionScans||{});
 for(const scan of Object.values(collectionScans))if(scan.activeTrolleyId&&!ids.has(scan.activeTrolleyId)){scan.activeTrolleyId='';scan.defaults.trolley='';}
 const removed=workspace.activeTrolleyId&&!ids.has(workspace.activeTrolleyId);
 return {...workspace,trolleys,collectionScans,collectionTrolleys:(workspace.collectionTrolleys||[]).filter(row=>ids.has(row.trolleyId)),...(removed?{activeTrolleyId:'',defaults:{...workspace.defaults,trolley:''}}:{})};
}
export function removeTrolley(workspace,id) {
 const trolley=workspace.trolleys.find(t=>t.id===id);
 if(!trolley)throw Error('This trolley is no longer available.');
 if(trolley.status!=='open')throw Error('Only open trolleys can be deleted. Reopen a ready trolley first; collected history is retained.');
 if(workspace.items.some(item=>trolleyForItem(item,trolley)))throw Error('This trolley contains equipment. Move its items to another trolley before deleting it.');
 if(workspace.collectionTrolleys?.some(row=>row.trolleyId===id&&row.sessionId))throw Error('Detach this trolley through Manage collection trolleys before deleting it.');
 return reconcileTrolleySelection(workspace,workspace.trolleys.filter(t=>t.id!==id));
}
