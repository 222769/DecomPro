import {createId} from './ids.js';
import {trolleyForItem} from './trolleys.js';
import {checkReadiness} from './readiness.js';
export const sessionIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function createCollection(name){return validateCollections([{id:createId(),name:name.trim(),createdAt:new Date().toISOString()}])[0];}
export function validateCollections(value=[]) {
 if(!Array.isArray(value)||value.length>200)throw Error('Invalid collection sessions.');const ids=new Set();
 return value.map(row=>{if(!row||!sessionIdPattern.test(row.id)||ids.has(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>80||typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt)))throw Error('Invalid collection details.');ids.add(row.id);return {id:row.id,name:row.name.trim(),createdAt:row.createdAt};});
}
export function validateAssignments(value=[],sessions=[]) {
 if(!Array.isArray(value))throw Error('Invalid collection trolley assignments.');const ids=new Set(),known=new Set(sessions.map(row=>row.id));
 return value.map(row=>{if(!row||!sessionIdPattern.test(row.trolleyId)||ids.has(row.trolleyId)||!known.has(row.sessionId))throw Error('Invalid or repeated collection trolley assignment.');ids.add(row.trolleyId);return {trolleyId:row.trolleyId,sessionId:row.sessionId};});
}
export function assignCollection(sessions,assignments,session,trolleyIds,trolleys) {
 validateCollections([session]);if(!Array.isArray(trolleyIds)||trolleyIds.length>12||new Set(trolleyIds).size!==trolleyIds.length||trolleyIds.some(id=>!trolleys.some(row=>row.id===id)))throw Error('Choose up to 12 existing trolleys for this collection.');
 if(trolleyIds.some(id=>assignments.some(row=>row.trolleyId===id&&row.sessionId!==session.id)))throw Error('A trolley already belongs to another collection. Remove its assignment there before moving it.');
 return {collectionSessions:validateCollections([...sessions.filter(row=>row.id!==session.id),session]),collectionTrolleys:validateAssignments([...assignments.filter(row=>row.sessionId!==session.id),...trolleyIds.map(trolleyId=>({trolleyId,sessionId:session.id}))],[...sessions.filter(row=>row.id!==session.id),session])};
}
export function collectionScope(sessionId,assignments,trolleys,items) {
 const ids=new Set(assignments.filter(row=>row.sessionId===sessionId).map(row=>row.trolleyId)),cages=trolleys.filter(t=>ids.has(t.id));
 return {trolleys:cages,items:items.filter(item=>cages.some(t=>trolleyForItem(item,t)))};
}
export function collectionProgress(id,assignments,trolleys,items,{shared=false}={}) {
 const scope=collectionScope(id,assignments,trolleys,items),checks=scope.trolleys.filter(t=>t.status!=='collected').map(t=>checkReadiness(t,items,{shared}));
 return {...scope,open:scope.trolleys.filter(t=>t.status==='open').length,ready:scope.trolleys.filter(t=>t.status==='ready').length,collected:scope.trolleys.filter(t=>t.status==='collected').length,collectedItems:scope.items.filter(item=>scope.trolleys.some(t=>t.status==='collected'&&trolleyForItem(item,t))).length,issues:checks.reduce((total,row)=>total+row.unresolved.length,0),complete:scope.trolleys.length>0&&scope.trolleys.every(t=>t.status==='collected')};
}
export function scanCheckpoint(state){return {draft:structuredClone(state.draft),step:state.step,defaults:{...state.defaults},activeTrolleyId:state.activeTrolleyId};}
export function switchCollection(state,id) {
 if(id&&!state.collectionSessions.some(row=>row.id===id))throw Error('This collection is no longer available.');
 const checkpoints={...(state.collectionScans||{}),[state.activeCollectionId||'unassigned']:scanCheckpoint(state)};
 if(id===state.activeCollectionId)return {...state,collectionScans:checkpoints,collectionPaused:false};
 const target=checkpoints[id||'unassigned'];
 const trolley=collectionScope(id,state.collectionTrolleys||[],state.trolleys,state.items).trolleys.find(t=>t.status==='open');
 return {...state,collectionScans:checkpoints,activeCollectionId:id,collectionPaused:false,...(target||{draft:{},step:0,defaults:{...state.defaults,trolley:trolley?.name||''},activeTrolleyId:trolley?.id||''})};
}

export function removeCollection(state,id) {
 if(!state.collectionSessions.some(row=>row.id===id))throw Error('This collection is no longer available.');
 const next=state.activeCollectionId===id?switchCollection(state,''):state;
 const collectionScans={...next.collectionScans};delete collectionScans[id];
 return {...next,collectionScans,collectionSessions:next.collectionSessions.filter(row=>row.id!==id),collectionTrolleys:next.collectionTrolleys.filter(row=>row.sessionId!==id)};
}
