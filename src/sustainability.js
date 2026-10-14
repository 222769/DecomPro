import {normalizeEquipmentDescription} from './equipment-types.js';
import {trolleyForItem} from './trolleys.js';

// Inventory and pickup are evidenced by DecomPro. Treatment and carbon savings
// need separate evidence from the collection company, so neither is inferred here.
export function sustainabilitySummary(items=[],trolleys=[]) {
 const types=new Map();
 for(const item of items){
  const raw=String(item.description||'').trim();
  const type=normalizeEquipmentDescription(raw)||(raw&&!/^n\/?a$/i.test(raw)?raw.slice(0,80):'Unclassified');
  types.set(type,(types.get(type)||0)+1);
 }
 const collected=items.filter(item=>trolleys.some(trolley=>trolley.status==='collected'&&trolleyForItem(item,trolley))).length;
 return {total:items.length,collected,pendingPickup:items.length-collected,types:[...types].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([name,count])=>({name,count}))};
}
