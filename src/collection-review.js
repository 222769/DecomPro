import {checkReadiness,missingDetail} from './readiness.js';

// Keep the same collection gate as the existing readiness workflow.
// Asset N/A is an allowed value, but is useful to surface before export.
export function collectionReview(trolleys,items,{shared=false}={}) {
 return trolleys.filter(t=>t.status!=='collected').map(trolley=>{
  const readiness=checkReadiness(trolley,items,{shared});
  const rows=readiness.items.map(item=>{
   const issues=readiness.issues.filter(issue=>issue.itemId===item.id);
   if(missingDetail(item.asset))issues.push({itemId:item.id,kind:'asset',field:'asset',message:'Asset number is N/A or unavailable',resolved:true});
   return {item,issues,needsAction:issues.some(issue=>!issue.resolved)};
  });
  return {trolley,...readiness,rows,checkedCount:rows.filter(row=>!row.needsAction).length};
 });
}
