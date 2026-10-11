import {collectionScope} from './collection-sessions.js';
import {checkReadiness} from './readiness.js';

// Check against the whole register: duplicate labels can cross collection boundaries.
export function collectionDashboard(state,{collectionId='',shared=false}={}) {
 const scope=collectionId?collectionScope(collectionId,state.collectionTrolleys,state.trolleys,state.items):{trolleys:state.trolleys,items:state.items};
 const rows=scope.trolleys.map(trolley=>{
  const review=checkReadiness(trolley,state.items,{shared});
  const issues=trolley.status==='collected'?[]:review.unresolved;
  const status=trolley.status==='collected'?'collected':!review.items.length?'empty':issues.length?'review':trolley.status==='ready'?'ready':'physical';
  return {trolley,items:review.items,issues,status,checked:review.items.filter(item=>!issues.some(issue=>issue.itemId===item.id)).length};
 });
 const counts=Object.fromEntries(['empty','review','physical','ready','collected'].map(status=>[status,rows.filter(row=>row.status===status).length]));
 return {rows,counts,equipment:scope.items.length,trolleys:rows.length,issues:rows.reduce((sum,row)=>sum+row.issues.length,0),collectedEquipment:rows.filter(row=>row.status==='collected').reduce((sum,row)=>sum+row.items.length,0),readyEquipment:rows.filter(row=>row.status==='ready').reduce((sum,row)=>sum+row.items.length,0)};
}
export const dashboardStatuses={empty:'Empty trolley',review:'Needs review',physical:'Awaiting physical check',ready:'Ready for pickup',collected:'Collected'};
