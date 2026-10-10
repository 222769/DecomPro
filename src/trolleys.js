import {createId} from './ids.js';

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
  return {...Object.fromEntries(['id','reference','name','department','status','createdAt','collectedAt','collectedBy','company'].map(field=>[field,row[field]])),...(row.readyAt!==undefined||row.readyBy!==undefined||row.status==='ready'?{readyAt,readyBy}:{})};
 });
}
export function trolleyForItem(item,trolley) {
 return item.trolleyId?item.trolleyId===trolley.id:item.trolley===trolley.name;
}
export function findTrolley(value,trolleys) {
 const input=value.trim().toUpperCase();
 return trolleys.find(row=>row.reference===input||row.id.toUpperCase()===input);
}
