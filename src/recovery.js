import {usableIdentifier} from './historical-equipment.js';
import {normalizeSerial} from './recognition.js';
export function archiveDeleted(state,items){
 const rows=[...(state.deletedItems||[]).filter(row=>!items.some(item=>item.id===row.id)),...items];
 if(rows.length>20000)throw Error('Deleted equipment storage is full. Export a backup before continuing.');
 return {...state,deletedItems:rows};
}
export function restorePlan(item,items,trolleys,targetId){
 if(items.some(row=>row.id===item.id))throw Error('This item has already been restored.');
 const target=trolleys.find(row=>row.id===targetId);if(!target||target.status!=='open')throw Error('Choose an available open trolley.');
 for(const key of ['serial','asset'])if(usableIdentifier(item[key])&&items.some(row=>normalizeSerial(row[key])===normalizeSerial(item[key])))throw Error(`Another item already uses this ${key==='asset'?'asset number':'serial number'}. Review it before restoring.`);
 return {...item,trolleyId:target.id,trolley:target.name};
}
