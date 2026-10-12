import {validateTrolleys} from './trolleys.js';
export function trolleyUnlockPlan(trolleys,id){
 const target=trolleys.find(t=>t.id===id);if(!target||target.status==='open')throw Error('This trolley is missing or already open. Refresh trolley management.');
 const ids=target.handover?.trolleyIds||[id];
 const before=ids.map(key=>{const row=trolleys.find(t=>t.id===key);if(!row||row.status!==target.status||JSON.stringify(row.handover)!==JSON.stringify(target.handover))throw Error('The linked handover changed. Refresh trolley management.');return structuredClone(row);});
 const after=before.map(row=>{const next={...row,status:'open',readyAt:'',readyBy:'',collectedAt:'',collectedBy:'',company:''};delete next.handover;return next;});
 return {before,after:validateTrolleys(after)};
}
export function unlockReason(value){if(typeof value!=='string'||!value.trim()||value.trim().length>500)throw Error('Enter an unlock reason (up to 500 characters).');return value.trim();}
export function validateUnlockHistory(rows=[]){
 if(!Array.isArray(rows))throw Error('Invalid trolley unlock history.');
 return rows.map(row=>{if(!row||typeof row.at!=='string'||!Number.isFinite(Date.parse(row.at))||typeof row.by!=='string'||!row.by.trim()||row.by.length>1000||!Array.isArray(row.before)||!row.before.length||row.before.length>6)throw Error('Invalid trolley unlock history.');return {at:row.at,by:row.by,reason:unlockReason(row.reason),before:validateTrolleys(row.before)};});
}
