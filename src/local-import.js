import {normalizeSerial} from './recognition.js';

export function sameRecord(a,b) {
 const stable=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,stable(value[key])])):value;
 return Boolean(a&&b)&&JSON.stringify(stable(a))===JSON.stringify(stable(b));
}
export function localImportPlan(local,remote) {
 const ids=new Map(remote.items.map(item=>[item.id,item]));
 const serials=new Map(remote.items.filter(item=>normalizeSerial(item.serial)!=='N/A').map(item=>[normalizeSerial(item.serial),item]));
 const counts=new Map();
 for(const item of local.items){const serial=normalizeSerial(item.serial);if(serial!=='N/A')counts.set(serial,(counts.get(serial)||0)+1);}
 return local.items.map(original=>{
  const choices=local.trolleys.filter(t=>original.trolleyId?t.id===original.trolleyId:t.name===original.trolley);
  const trolley=choices.length===1?choices[0]:null;
  const item={...original,...(trolley?{trolleyId:trolley.id}:{})};
  const existing=ids.get(item.id),serial=normalizeSerial(item.serial),sharedTrolley=remote.trolleys.find(t=>t.id===item.trolleyId);
  let status='new',reason='Ready to import';
  if(existing){status=sameRecord(item,existing)?'saved':'blocked';reason=status==='saved'?'Already saved to Firebase':'This item ID has different shared details';}
  else if(!trolley){status='blocked';reason='Assign this item to one local trolley before importing';}
  else if(trolley.name!==item.trolley){status='blocked';reason='The item and trolley names do not match';}
  else if(counts.get(serial)>1){status='blocked';reason='This serial is repeated in the local register';}
  else if(serials.has(serial)){status='blocked';reason='This serial is already in the shared register';}
  else if(sharedTrolley&&(sharedTrolley.status!=='open'||sharedTrolley.name!==item.trolley)){status='blocked';reason='The shared trolley is locked or has a different name';}
  return {item,trolley,status,reason};
 });
}
export function importSignature(plan) {return JSON.stringify(plan.map(row=>[row.item.id,row.status,row.status==='blocked'?row.reason:'']));}
