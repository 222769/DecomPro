import {trolleyForItem} from './trolleys.js';
import {sameRecord} from './local-import.js';
export function equipmentDeletionPlan(items,trolleys,originals){
 if(!originals.length)throw Error('Select equipment before deleting.');
 return originals.map(original=>{
  const current=items.find(item=>item.id===original.id);
  if(!sameRecord(current,original))throw Error('Selected equipment changed. Close this preview and review the register before deleting.');
  const matches=trolleys.filter(t=>trolleyForItem(current,t));
  if(matches.length!==1)throw Error('Assign each selected item to its permanent trolley reference before deleting.');
  if(matches[0].status!=='open')throw Error('Selected equipment is on a locked trolley. Reopen or unlock its trolley before deleting.');
  return {...current,trolleyId:matches[0].id,trolley:matches[0].name};
 });
}
