import {trolleyForItem} from './trolleys.js';

export function missingEquipmentDetails(item) {
 return ['manufacturer','model'].filter(field=>!String(item[field]??'').trim()||/^N\s*\/\s*A$/i.test(String(item[field]).trim()));
}

// The existing records have a disposal date, not a reliable scan timestamp.
export function sessionSummary(items,trolleys,profiles,date) {
 const todayItems=items.filter(item=>item.date===date);
 const codes=[...new Set([...profiles.map(p=>p.code),...items.map(item=>item.technician)])];
 return {
  todayCount:todayItems.length,
  missingCount:items.filter(item=>missingEquipmentDetails(item).length).length,
  technicians:codes.map(code=>({code,name:profiles.find(p=>p.code===code)?.name||code,today:todayItems.filter(item=>item.technician===code).length,total:items.filter(item=>item.technician===code).length})).sort((a,b)=>b.today-a.today||b.total-a.total||a.name.localeCompare(b.name)),
  statuses:Object.fromEntries(['open','ready','collected'].map(status=>[status,trolleys.filter(t=>t.status===status).length])),
  trolleys:trolleys.map(trolley=>({...trolley,count:items.filter(item=>trolleyForItem(item,trolley)).length})),
 };
}
