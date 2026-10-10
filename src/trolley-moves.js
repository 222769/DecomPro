import {trolleyForItem} from './trolleys.js';
import {createId} from './ids.js';

export function movePlan(items,trolleys,ids,destinationId) {
 const destination=trolleys.find(t=>t.id===destinationId);
 if(!destination||destination.status!=='open')throw Error('Choose an open destination trolley. Ready or collected trolleys cannot receive equipment.');
 const unique=[...new Set(ids)];
 if(!unique.length)throw Error('Select equipment to move.');
 return unique.map(id=>{
  const item=items.find(row=>row.id===id);
  if(!item)throw Error('Selected equipment is no longer in the register. Refresh and select it again.');
  const sources=trolleys.filter(t=>trolleyForItem(item,t));
  if(sources.length!==1||sources[0].status!=='open')throw Error(`Item ${item.serial} belongs to an unavailable, ready or collected trolley. Reopen a ready trolley before moving equipment.`);
  return {before:{...item},source:{...sources[0]},destination:{...destination},skip:sources[0].id===destination.id,after:{...item,trolleyId:destination.id,trolley:destination.name}};
 });
}
export function localMoveEvent(row,profile,at=new Date().toISOString()) {
 const snapshot=t=>({id:t.id,reference:t.reference,name:t.name});
 return {id:createId(),itemId:row.before.id,serial:row.before.serial,from:snapshot(row.source),to:snapshot(row.destination),actor:{name:profile.name,code:profile.code},at};
}
export function validateMoveHistory(value=[]) {
 if(!Array.isArray(value))throw Error('Invalid trolley move history.');
 const ids=new Set(),text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=1000;
 return value.map(row=>{
  if(!row||!text(row.id)||ids.has(row.id)||!text(row.itemId)||!text(row.serial)||typeof row.at!=='string'||!Number.isFinite(Date.parse(row.at))||!text(row.actor?.name)||!text(row.actor?.code)||![row.from,row.to].every(t=>t&&['id','reference','name'].every(key=>text(t[key]))))throw Error('Invalid trolley move history.');
  ids.add(row.id);
  const cleanTrolley=t=>({id:t.id,reference:t.reference,name:t.name});
  return {id:row.id,itemId:row.itemId,serial:row.serial,at:row.at,actor:{name:row.actor.name,code:row.actor.code},from:cleanTrolley(row.from),to:cleanTrolley(row.to)};
 });
}
