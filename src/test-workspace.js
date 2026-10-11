import {createId} from './ids.js';
import {createTrolley} from './trolleys.js';
import {createCollection} from './collection-sessions.js';
import {createHandover} from './handover-data.js';
import {defaultSettings,validateWorkspace} from './workspace.js';

export function createTestWorkspace(date) {
 const now=new Date().toISOString(),profiles=[{name:'Test technician One',code:'T1'},{name:'Test technician Two',code:'T2'},{name:'Test technician Three',code:'T3'}];
 const catalogue=[['Dell','OptiPlex 7050','Desktop','DL7050'],['Lenovo','ThinkCentre M710q','Desktop','LNM710'],['HP','EliteDesk 800 G3','Desktop','HP800'],['Lenovo','ThinkVision T24i','Monitor','LNT24'],['Dell','P2419H','Monitor','DLP24'],['Toshiba','Satellite Pro','Laptop','TOSAT'],['Cisco','Catalyst 2960','Network switch','CIS2960'],['Seagate','Barracuda','Hard drive','SGHDD']];
 const trolleys=catalogue.map((row,i)=>({...createTrolley(`TEST Trolley ${String(i+1).padStart(2,'0')} · ${row[2]}`),...(i>=4?{status:i>=6?'collected':'ready',readyAt:now,readyBy:'T2'}:{}),...(i>=6?{collectedAt:now,collectedBy:'T2',company:'TEST Example collector'}:{})}));
 const pack=createHandover(trolleys.slice(6).map(t=>t.id),'TEST Example collector',now);for(const trolley of trolleys.slice(6))trolley.handover={id:pack.id,trolleyIds:pack.trolleyIds};
 const previous=new Date(date+'T12:00:00Z');previous.setUTCDate(previous.getUTCDate()-7);const historicalDate=previous.toISOString().slice(0,10);
 const items=catalogue.flatMap(([manufacturer,model,description,family],group)=>Array.from({length:12},(_,index)=>{const number=group*12+index;return {id:createId(),date:group>=6?historicalDate:date,description:`TEST ${description}`,model,manufacturer,source:'TEST Basement',serial:`TEST-${family}-${String(index+1).padStart(5,'0')}`,barcode:`000${String(number+1).padStart(6,'0')}`,etch:number%4===0?'N/A':`TEST-ETCH-${number+1}`,asset:`A${String(number+1).padStart(4,'0')}`,reason:'TEST EOL',technician:profiles[number%3].code,trolley:trolleys[group].name,trolleyId:trolleys[group].id,recognitionNeedsReview:false,recognitionConfirmed:false};}));
 // Deliberate review cases live on open trolleys, keeping ready/collected cages valid.
 items[1].manufacturer='N/A';items[2].serial=items[0].serial;items[3].asset=items[4].asset;items[5].model='N/A';items[6].recognitionNeedsReview=true;items[7].serial='N/A';items[8].manufacturer='N/A';items[8].readinessNotes={manufacturer:'TEST: original label unavailable; exception recorded for review.'};
 const active=createCollection('TEST Current collection'),history=createCollection('TEST Previous collection');
 return validateWorkspace({captureOrder:'serial-first',activeTrolleyId:trolleys[0].id,trolleys,profiles,active:'T1',defaults:{date,description:'TEST Desktop',manufacturer:'Dell',source:'TEST Basement',reason:'TEST EOL',trolley:trolleys[0].name},items,draft:{},step:0,voice:false,settings:{...defaultSettings},referenceExamples:[],referenceCorrections:[],collectionSessions:[active,history],collectionTrolleys:trolleys.map((t,i)=>({trolleyId:t.id,sessionId:i<6?active.id:history.id})),collectionScans:{},activeCollectionId:active.id,collectionPaused:false,collectionWorkspace:''});
}
