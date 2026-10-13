import {archiveDeleted} from './recovery.js';
import {historicalFields,historicalWorkbookRows,mergeHistoricalEquipment,historicalMatches,assertHistoricalAddition} from './historical-equipment.js';
import {retentionFields,retentionSettings,nextBatchDefaults} from './batch-retention.js';
import {buildInfo,versionLabel,buildTime} from './build-info.js';
import {equipmentDeletionPlan} from './equipment-deletion.js';
import {registerColumns,sortRegister} from './register-sort.js';
import {trolleyUnlockPlan,unlockReason} from './trolley-unlock.js';
import { suggestEquipmentDescription, equipmentDescriptionPlan } from './equipment-types.js';
import {findRescanItem} from './trolley-rescan.js';
import {createTestWorkspace} from './test-workspace.js';
import {readDevicePreferences,saveDevicePreferences,idleExpired} from './device-preferences.js';
import {collectionDashboard,dashboardStatuses} from './collection-dashboard.js';
import {createCollection,assignCollection,collectionScope,collectionProgress,switchCollection,scanCheckpoint,removeCollection} from './collection-sessions.js';
import {themePreference,previewTheme,saveTheme} from './theme.js';
import {collectionReview} from './collection-review.js';
import {handoverGroups,handoverReference} from './handover-data.js';
import {movePlan,localMoveEvent} from './trolley-moves.js';
import {sessionSummary,missingEquipmentDetails} from './session-summary.js';
import {localImportPlan,importSignature,sameRecord} from './local-import.js';
import {checkReadiness,readinessFields,validateReadinessNotes} from './readiness.js';
import { fields, duplicateSerial, normalizeAssetNumber, validAssetNumber } from './data';
import './style.css';
import './theme.css';
import { cleanExamples, referenceRowsFromWorkbook, normalizeSerial } from './recognition';
import {buildImportPreview,importCounts} from './import-preview.js';
import {snapshotEvidence,sourceKinds} from './recognition-evidence.js';
import builtInReferences from './reference-catalogue.json';
import {lookupReference,libraryRows,validateCorrections} from './reference-library';
import { availableVoices, utteranceFor } from './speech';
import { defaultFirebaseConfig } from './firebase-config';
import { firebaseErrorMessage } from './firebase-errors';
import { createId } from './ids';
import {createTrolley,createSharedTrolley,restoreLocalTrolleys,reconcileTrolleySelection,removeTrolley,trolleyNameKey,defaultDepartment,findTrolley,trolleyForItem} from './trolleys';
import { defaultFields, validateEquipmentRecord, validateWorkspace, parseBackup, filteredItems, validDate, defaultSettings, newBatchDefaults } from './workspace';
const icons = {
 barcode:'<path d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M7 8v8m3-8v8m4-8v8m3-8v8"/>',
 dashboard:'<rect x="3" y="3" width="7" height="10" rx="2"/><rect x="14" y="3" width="7" height="6" rx="2"/><rect x="3" y="17" width="7" height="4" rx="1"/><rect x="14" y="13" width="7" height="8" rx="2"/>',
 database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
 trolley:'<path d="M3 3h3l2 14h12M7 7h13l-2 7H8"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
 review:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 13l2 2 4-4"/>',
 history:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2"/>',
 lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
 shield:'<path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
 grid:'<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
 box:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V8M12 13v10M7.5 5.5l9 5"/>',
 list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
 voice:'<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 play:'<path d="m8 5 11 7-11 7V5Z"/>',
 back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 settings:'<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
 skip:'<path d="m5 5 10 7-10 7V5Zm14 0v14"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.box}</svg>`;
const testWorkspace=new URLSearchParams(location.search).get('workspace')==='demo';
const key = testWorkspace?'decompro.demo.v1':'decompro.v1';
// One editor per local workspace prevents whole-register writes from stale tabs.
let localTabBlocked=false,releaseLocalTab,localTabReason='';
async function acquireLocalTab() {
 if(releaseLocalTab)return;
 if(!navigator.locks){localTabBlocked=true;localTabReason='This browser cannot safely coordinate local workspace tabs. Use a current browser.';return;}
 await new Promise((resolve,reject)=>navigator.locks.request(`decompro.editor:${key}`,{ifAvailable:true},lock=>{
  if(!lock){localTabBlocked=true;localTabReason='This workspace is already open in another tab. Close that tab, then retry here to load its latest saved records.';resolve();return;}
  localTabBlocked=false;
  return new Promise(release=>{releaseLocalTab=()=>{releaseLocalTab=undefined;release();};resolve();});
 }).catch(reject));
}
let startsShared=false;try{startsShared=!testWorkspace&&localStorage.getItem('decompro.mode')==='shared';}catch{}
if(!startsShared)await acquireLocalTab();
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
let pendingScan=null;
const rescan={upload:null,sharedRow:false,enabled:false,busy:false,serial:'',item:null,reference:null,historical:null,matches:[],addition:null,version:0,message:'',request:0};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
let state = { captureOrder:'serial-first', activeCollectionId:'',collectionPaused:false,collectionSessions:[],collectionTrolleys:[],collectionScans:{},collectionWorkspace:'',activeTrolleyId:'', trolleys:[], profiles:[{name:'Jawad',code:'JA'}], active:'JA', defaults:newBatchDefaults(), items:[], draft:{}, step:0, voice:true, settings:{...defaultSettings}, historicalEquipment:[], deletedItems:[], referenceExamples:[], referenceCorrections:[] };
let storageError = '', notice = '', scanning = false, lastEmpty = 0;
let sharedClient = null;
let devicePreferences=readDevicePreferences(),lockInProgress=false,lockCompletion=null,lockedAccountEmail='',workspaceManuallyLocked=false,lastActivity=Date.now(),dailyProgressExpanded=false,dashboardTrolleysExpanded=false;
try{workspaceManuallyLocked=localStorage.getItem('decompro.workspaceLocked')==='true';lastActivity=Number(sessionStorage.getItem('decompro.lastActivity'))||Date.now();}catch{}
let readinessSession=0;
let dashboardCollectionId='',dashboardStatus='all';
let collectionReviewTrolley="all",collectionReviewKind="all";
let connectionPhase='syncing',lastConfirmedAt='',historySearch='';
let sharedLocked = false;
let saving=false, exporting=false, equipmentImportOpening=false;
const localWorkspaceKey=testWorkspace?'decompro.demo.localWorkspace':'decompro.localWorkspace';
let librarySearch='',libraryFilter='all',libraryLimit=40;
let pendingImport=null,importBusy=false,importLimit=60,importFilter='all';
let summaryExpanded=false,missingDetailsOnly=false;
const selectedEquipment=new Set();
let registerSort={key:'scan',direction:'descending'};
let search = '', pendingRestore = null,collectionViewId='',collectionError='',collectionBusy=false;
try { sharedLocked=!testWorkspace&&localStorage.getItem('decompro.mode')==='shared'; const saved=localStorage.getItem(key); if(saved) state=validateWorkspace(JSON.parse(saved));else if(testWorkspace){state=createTestWorkspace(today());if(!localTabBlocked)localStorage.setItem(key,JSON.stringify(state));} } catch { storageError='Saved data could not be loaded. Export any visible records before continuing. Storage has been paused to protect the saved data.'; }
if(!sharedLocked)state=restoreLocalTrolleys(state);

let trolleyViewId=readTrolleyHash();collectionViewId=state.activeCollectionId||'';
function workspaceUrl(demo){const url=new URL(location.href);url.searchParams.delete('app-refresh');if(demo)url.searchParams.set('workspace','demo');else url.searchParams.delete('workspace');url.hash='overview';return url.href;}
function readTrolleyHash(){return location.hash.match(/^#(?:trolley|station\/trolley)\/([A-Za-z0-9-]+)$/)?.[1]||'';}
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function persist() { if(localTabBlocked)return false; if(storageError) return false; try { localStorage.setItem(key,JSON.stringify(state)); return true; } catch { storageError='Browser storage is unavailable or full. Export your records now; changes may be lost on refresh.'; render(); return false; } }
function speak(text) { if(!state.voice || !('speechSynthesis' in window)) return; speechSynthesis.cancel(); const u=utteranceFor(text,state.settings); speechSynthesis.speak(u); }
function rescanPrompt() {
 const details=record=>[record.manufacturer,record.model].filter(value=>value&&value!=='N/A').join(' ');
 if(rescan.busy)return 'Checking the equipment identifier. Please wait.';
 if(rescan.item)return `Saved item found. ${details(rescan.item)}. Check the details, then press Enter to confirm trolley placement.`;
 if(rescan.historical)return `Spreadsheet item found. ${details(rescan.historical.values)}. Check the details, then press Enter to add to the current trolley.`;
 if(rescan.matches.length)return 'Multiple records found. Please select the correct spreadsheet record.';
 if(rescan.reference)return `Equipment recognised. ${details(rescan.reference)}. Load the previous decom Excel to retrieve the full equipment details.`;
 return rescan.message||'Trolley rescan mode. Scan a serial number, barcode, security etch or asset number.';
}
function prompt() { if(rescan.enabled){speak(rescanPrompt());return;}if(state.collectionPaused)return;speak(state.step<fields.length ? `Next, ${fields[state.step][1]}` : 'Review equipment. Press Enter to save and place it in the trolley.'); }
function focus() { if(scanning) document.querySelector('#scan')?.focus(); }
function render() {
 syncTrolleyNames();
 if(localTabBlocked){
  const secureUrl=new URL(location.href);secureUrl.protocol='https:';
  document.querySelector('#app').innerHTML=`<main class="workspace-lock"><section class="card"><img src="./decompro-icon.svg" width="52" height="52" alt="DecomPro"><h1>${navigator.locks?'Workspace open in another tab':'Local workspace needs a current browser'}</h1><p>${escape(localTabReason)}</p>${!navigator.locks?'<p>Open this website directly in an up-to-date Safari, Chrome or Edge. Local editing stays paused to protect saved records.</p>':''}${!window.isSecureContext?`<p>Browser coordination requires a secure connection.</p><a class="primary" href="${escape(secureUrl.href)}">Open with HTTPS</a>`:!navigator.locks&&!testWorkspace?'<button class="primary" id="open-shared-from-local">Sign in to shared workspace</button>':''}<button class="secondary" id="retry-local-tab">Retry workspace</button><p class="app-version">${escape(versionLabel)}</p></section></main>`;
  document.querySelector('#open-shared-from-local')?.addEventListener('click',()=>{
   try{localStorage.setItem(localWorkspaceKey,localStorage.getItem(key)||JSON.stringify(state));}
   catch{localTabReason='Your local workspace could not be preserved. Open this site in a current browser before continuing.';render();return;}
   localTabBlocked=false;sharedLocked=true;notice='Sign in to Firebase to open the shared workspace. Local editing remains unavailable until browser coordination is supported.';render();openDatabase();
  });
  document.querySelector('#retry-local-tab').onclick=()=>location.reload();return;
 }
 if(sharedLocked&&!sharedClient) {
  document.querySelector('#app').innerHTML=`<main class="workspace-lock"><section class="card"><img src="./decompro-icon.svg" width="52" height="52" alt="DecomPro"><div class="eyebrow">PRIVATE TEAM WORKSPACE</div><h1>Sign in to your team workspace.</h1><p>Confirm your team access before viewing saved equipment. Your cached records and unfinished scan are preserved.</p><p class="session-note">${navigator.onLine===false?'You are offline. Connect to the internet to verify your team membership.':escape(notice||'Checking your sign-in with Firebase…')}</p><button class="primary" id="unlock-workspace">Sign in to DecomPro</button><p class="app-version">${escape(versionLabel)}</p></section></main><dialog id="database-dialog"></dialog>`;
  document.querySelector('#unlock-workspace').onclick=openDatabase;
  return;
 }
 const current=fields[state.step]; const profile=state.profiles.find(p=>p.code===state.active);
 const modelMatch=state.step===1&&state.draft.serial?lookupSerial(state.draft.serial):null;
 const modelCandidates=modelMatch?.method==='conflict'?modelMatch.candidates||[]:[];
 document.querySelector('#app').innerHTML=`
 <aside><a class="brand" href="#"><img class="brand-mark" src="./decompro-icon.svg" alt="" width="39" height="39"><span>Decom<span class="brand-light">Pro</span></span></a><div class="workspace">IT OPERATIONS</div><a class="nav" href="#overview">${icon('dashboard')} Overview</a><a class="nav active" href="#station">${icon('barcode')} Scan station <span class="nav-active-dot"></span></a><a class="nav" href="#inventory">${icon('list')} Collection register <span>${state.items.length}</span></a><a class="nav" href="#collections">${icon('grid')} Collections</a><a class="nav" href="#collection-review">${icon('review')} Collection review</a><a class="nav" href="#collection-history">${icon('history')} Collection history</a><button class="nav settings-nav" id="settings" aria-label="Open settings">${icon('settings')}<span class="settings-nav-label">Settings</span></button><button class="nav settings-nav" id="manage-trolleys" aria-label="Trolleys">${icon('trolley')}<span class="settings-nav-label">Trolleys</span></button><button class="nav settings-nav" id="database" aria-label="Shared database">${icon('database')}<span class="settings-nav-label">Database</span></button>${sharedClient?.role==='admin'?`<button class="nav settings-nav" id="admin" aria-label="Administration">${icon('shield')}<span class="settings-nav-label">Admin</span></button>`:''}<div class="aside-bottom"><span class="dot"></span> ${sharedClient?'Shared Firebase workspace':sharedLocked?'Shared workspace · reconnect':'Local workspace'}<p>${sharedClient?escape(sharedClient.email):'Export or back up after each session.'}</p></div></aside>
 <main id="overview">${testWorkspace?`<div class="test-workspace-banner"><div><strong>TEST WORKSPACE</strong><span>Synthetic equipment · saved separately in this browser · Firebase uploads disabled</span></div><a class="secondary" href="${escape(workspaceUrl(false))}">Return to real workspace</a></div>`:''}<div class="workspace-toolbar"><div id="connection-status" class="connection-status" aria-live="polite"></div><div class="workspace-toolbar-actions">${sharedClient?`<button class="secondary" id="lock-workspace">${icon('lock')} Lock workspace</button>`:''}<button class="text-button" id="show-daily-progress">${icon('history')} Today’s progress</button></div></div><div class="breadcrumb">Workspace <span>/</span> Decommissioning</div><header><div><div class="eyebrow">IT EQUIPMENT DECOMMISSIONING</div><h1>Your DecomPro workspace<span>.</span></h1><p>Scan, review and prepare equipment for collection.</p></div><div class="profile"><label for="profile">Technician profile</label><select id="profile" ${sharedLocked?'disabled':''}>${state.profiles.map(p=>`<option value="${escape(p.code)}" ${p.code===state.active?'selected':''}>${escape(p.name)} · ${escape(p.code)}</option>`).join('')}</select><button class="text-button" id="add-profile" ${sharedLocked?'disabled':''}>${icon('plus')} Add technician</button></div></header>
 ${storageError?`<div class="alert error" role="alert">${escape(storageError)}</div>`:''}${notice?`<div class="alert" role="status">${escape(notice)}</div>`:''}
 <div class="stats"><div><div class="stat-icon mint">${icon('box')}</div><div class="stat-content"><span>ITEMS IN REGISTER</span><strong>${state.items.length}<small> items recorded</small></strong></div></div><div><div class="stat-icon blue">${icon('trolley')}</div><div class="stat-content"><span>CURRENT TROLLEY</span><strong>${escape(state.defaults.trolley)}</strong><button class="text-button trolley-switch" id="change-trolley">Change trolley ${icon('arrow')}</button></div></div><div><div class="stat-icon peach">${icon('user')}</div><div class="stat-content"><span>DISPOSAL RECORDED BY</span><strong>${escape(profile?.name||'Select technician')}<small>${escape(profile?.code||'')}</small></strong></div></div></div>
 <section id="collection-dashboard" class="card collection-dashboard" aria-label="Collection dashboard"></section>
 <section id="collections" class="card named-collections" aria-label="Collection sessions"></section>
 <section id="session-summary" class="card session-summary" aria-label="Session summary"></section>
 <div id="station-session" class="station-session"></div><div class="station-layout">${rescan.enabled?renderRescanStation():`<section id="station" class="card station"><div class="section-top"><span class="eyebrow"><span class="station-dot"></span> SCAN STATION</span><label class="rescan-toggle"><input id="rescan-mode" type="checkbox" aria-label="Trolley rescan mode" ${saving?'disabled':''}><span class="rescan-button-content">${icon('barcode')}<span>Trolley rescan</span><strong>Off</strong></span></label><button id="voice" class="pill">${icon('voice')} ${state.voice?'Voice on':'Voice off'}</button></div><div class="steps">${fields.map((f,i)=>`<button class="step ${i===state.step?'current':''} ${i<state.step?'complete':''}" data-step="${i}" ${i>state.step?'disabled':''}><span>${i<state.step?icon('check'):i+1}</span>${escape(f[1].replace(' number',''))}</button>`).join('')}</div>
 ${state.settings.reuseModel?`<div class="batch-model-chip">Batch model <strong>${escape(state.settings.batchModel)}</strong></div>`:''}<div class="scan-icon">${icon(current?'barcode':'check')}</div><div class="scan-label">${current?`FIELD ${state.step+1} OF ${fields.length}`:'READY TO RECORD'}</div><h2>${current?escape(current[1]):'Review this equipment'}</h2><p>${current?'Scan the label or type its value, then press Enter.':'Check the values below, then save this item to the collection register.'}</p>
 ${current?`<form id="scan-form"><label class="sr-only" for="scan">${escape(current[1])}</label><input id="scan" ${state.collectionPaused?'disabled':''} autocomplete="off" spellcheck="false" placeholder="${current[0]==='asset'?'Asset number: A1234 or N/A':'Waiting for a scan…'}" value="${escape(pendingScan?.step===state.step&&pendingScan.collectionId===state.activeCollectionId?pendingScan.value:state.draft[current[0]]||'')}"><button class="primary" type="submit">Capture value ${icon('arrow')}</button></form><div class="scan-actions"><button id="start" class="text-button">${icon(scanning?'voice':'play')} ${scanning?'Repeat spoken prompt':'Start scanning'}</button><button id="skip" class="secondary">${icon('skip')} Skip · N/A</button></div><div class="hint">${current[0]==='asset'?'Format: A followed by four digits (A1234). ':''}Press Enter twice in an empty field to skip.</div>`:` ${state.draft.recognitionNeedsReview?`<label class="recognition-review"><input id="confirm-recognition" type="checkbox" ${state.draft.recognitionConfirmed?'checked':''}> I checked the suggested model and manufacturer against this equipment.</label>`:''}<button id="save" class="primary wide" ${saving?'disabled':''}>${saving?'Saving…':'Save item & start next'} ${icon('arrow')}</button><p id="save-feedback" aria-live="polite">${escape(notice||storageError)}</p>`}
 ${recognitionEvidenceCard()}
 ${state.draft.description!==undefined?`<p class="note">Equipment description: <strong>${escape(state.draft.description)}</strong>. Check or edit it in the defaults panel.</p>`:''}
 ${modelCandidates.length?`<div class="model-candidates"><strong>Choose a matching model</strong><p>${modelMatch.suffix?`Serial ending ${escape(modelMatch.suffix)}${modelMatch.format?` · format ${escape(modelMatch.format)}`:''}`:modelMatch.prefix?`Prefix ${escape(modelMatch.prefix)}`:'This serial'} has ${modelCandidates.length>1?'conflicting reference models':'reference models'} to check. Confirm the equipment label before choosing.</p><label for="model-candidate">Reference model and manufacturer</label><select id="model-candidate"><option value="">Choose a suggestion…</option>${modelCandidates.map((candidate,index)=>`<option value="${index}">${escape(candidate.model)} · ${escape(candidate.manufacturer)} (${candidate.support} example${candidate.support===1?'':'s'})</option>`).join('')}</select><button type="button" class="secondary" id="use-model-candidate">Use selected model</button><p>You can also scan or type the model above.</p></div>`:''}
 ${state.draft.manufacturer!==undefined?`<div class="recognized-manufacturer"><label for="recognized-maker">Manufacturer</label><input id="recognized-maker" aria-label="Manufacturer for this item" value="${escape(state.draft.manufacturer)}" maxlength="1000"><span>Check these details before saving.</span></div>`:''}<div class="captured">${fields.filter(f=>state.draft[f[0]]).map(([k,label])=>`<div><span>${escape(label)}</span><strong>${escape(state.draft[k])}</strong></div>`).join('')||`<span class="capture-empty">${icon('list')} Your captured values will appear here.</span>`}</div><div class="station-footer"><button id="back" class="text-button" ${state.step===0?'disabled':''}>${icon('back')} Previous field</button><button id="reset" class="text-button">Clear current item</button></div></section>`}
 <section class="card defaults"><div class="defaults-heading"><span class="defaults-icon">${icon('list')}</span><div class="eyebrow">BATCH DEFAULTS</div></div><h2>Details for this item.</h2><p>Enter the details before saving. Caged trolley follows your selected trolley.</p><button id="batch-config" type="button" class="secondary" ${saving?'disabled':''}>${icon('settings')} Config</button><p class="note" id="batch-config-summary">${escape(batchRetentionSummary())}</p><form id="defaults">${defaultFields.map(([k,label,type])=>`<label for="default-${k}">${label}</label><input id="default-${k}" name="${k}" type="${type}" ${k==='trolley'?'readonly aria-readonly="true" title="Use Change trolley to select the trolley for new items."':''} value="${escape(k==='description'?state.draft.description??state.defaults[k]:k==='manufacturer'?state.draft.manufacturer??state.defaults[k]:k==='trolley'?state.trolleys.find(t=>t.id===state.activeTrolleyId)?.name??state.defaults[k]:state.defaults[k])}" maxlength="1000" required>`).join('')}${state.draft.description!==undefined?'<p class="note">Recognised equipment description applies to this item. Check it before saving; your Config choice controls whether it is kept for the next item.</p>':''}<button class="secondary wide" type="submit">Apply batch defaults</button></form><div class="note">Technician initials automatically fill <strong>Who disposed of it?</strong> in your Excel export.</div></section></div>
 <section id="inventory" class="card register"><div class="section-top"><div><div class="eyebrow">COLLECTION REGISTER</div><h2><span id="inventory-title">Ready for the next collection</span> <span class="count">${state.items.length}</span></h2></div><button id="export" class="primary" ${!state.items.length||exporting?'disabled':''}>${icon('download')} ${exporting?'Preparing Excel…':'Export Excel'}</button></div><div id="trolley-inventory-banner"></div><div class="register-tools"><div class="register-filters"><div class="search-field">${icon('list')}<label class="sr-only" for="register-search">Search collection register</label><input id="register-search" type="search" placeholder="Search equipment, serial, trolley or technician…" value="${escape(search)}"></div><div class="register-scope-filters"><div class="collection-filter-field"><label for="collection-register-filter">Collection inventory</label><select id="collection-register-filter"></select></div><div class="collection-filter-field"><label for="trolley-register-filter">Trolley inventory</label><select id="trolley-register-filter"></select></div></div><p id="register-filter-help" class="register-filter-help" hidden></p></div><div class="backup-actions"><button class="secondary" id="equipment-import">Import equipment Excel</button><button class="secondary" id="backup">${icon('download')} Backup</button><button class="secondary" id="restore">Restore backup</button>${!sharedLocked||sharedClient?.role==='admin'?'<button class="secondary" id="deleted-equipment">Deleted equipment</button>':''}<input class="sr-only" id="backup-file" type="file" accept=".json,application/json" tabindex="-1" aria-label="Choose backup file"></div></div><div id="bulk-move-tools"></div><div id="review-filter"></div><div id="search-count" class="search-count" aria-live="polite"></div><div class="table-wrap"><table><thead><tr><th class="selection-cell"><input type="checkbox" id="select-visible" aria-label="Select visible equipment"></th>${registerColumns.map(([key,label])=>`<th scope="col" data-sort-column="${key}" ${key==='scan'?'class="scan-order-cell"':''}><button type="button" class="register-sort" data-sort="${key}">${label} <span aria-hidden="true"></span></button></th>`).join('')}<th>Actions</th></tr></thead><tbody></tbody></table></div><div class="register-footer">Excel exports the selected trolley, or all inventory when no trolley is selected. The collection filter applies when no trolley is selected. Search does not change the export. Backups also keep trolley details, profiles and captured progress.</div></section>
 <section id="collection-review" class="card collection-review" aria-label="Collection review" hidden></section>
 <section id="collection-history" class="card collection-history" hidden><div class="section-top"><div><div class="eyebrow">COMPLETED COLLECTIONS</div><h2>Collection history</h2><p>Retained trolley inventories and collection details.</p></div><span id="history-total" class="tag"></span></div><label for="history-search">Search collected trolleys</label><input id="history-search" type="search" placeholder="Reference, trolley, company or technician…" value="${escape(historySearch)}"><button class="secondary" id="prepare-history-handover">Prepare handover pack</button><div id="handover-history"></div><div id="history-results"></div></section>
 <footer>DecomPro · Less clicking. More clearing.<span class="app-version" title="${escape(`Commit ${buildInfo.revision} · Built ${buildTime} (London)`)}">${escape(versionLabel)}</span></footer></main><dialog id="profile-dialog"><form id="profile-form"><h2>Add a technician</h2><p>Local profiles identify records; they are not secure sign-in accounts.</p><label for="name">Name</label><input id="name" name="name" required maxlength="60"><label for="code">Disposal initials</label><input id="code" name="code" required maxlength="12"><div class="dialog-actions"><button class="secondary" type="button" id="cancel-profile">Cancel</button><button class="primary">Save profile</button></div><p id="profile-error" role="alert"></p></form></dialog><dialog id="edit-dialog"></dialog><dialog id="restore-dialog"></dialog><dialog id="settings-dialog"></dialog><dialog id="batch-config-dialog"></dialog><dialog id="description-review-dialog"></dialog><dialog id="import-preview-dialog"></dialog><dialog id="reference-library-dialog"></dialog><dialog id="reference-edit-dialog"></dialog><dialog id="scan-correction-dialog"></dialog><dialog id="trolley-dialog"></dialog><dialog id="trolley-manager"></dialog><dialog id="database-dialog"></dialog><dialog id="recovery-dialog"></dialog><dialog id="local-import-dialog"></dialog><dialog id="equipment-import-dialog"></dialog><dialog id="collection-session-dialog"></dialog><dialog id="team-access-dialog"></dialog><dialog id="handover-dialog"></dialog><dialog id="bulk-move-dialog"></dialog><dialog id="move-history-dialog"></dialog><dialog id="admin-dialog" class="admin-dialog"></dialog>`;
 bind(); updateRegister(); updateHistory(); updateConnectionStatus(); updateOverviewLayout(); focus();
}
function resetRescan(){rescan.upload=null;rescan.sharedRow=false;rescan.enabled=false;rescan.busy=false;rescan.serial='';rescan.item=null;rescan.reference=null;rescan.historical=null;rescan.matches=[];rescan.addition=null;rescan.message='';rescan.request++;}
function rescanDestination() {
 return state.trolleys.find(t=>t.id===state.activeTrolleyId)||(()=>{const matches=state.trolleys.filter(t=>trolleyNameKey(t.name)===trolleyNameKey(state.defaults.trolley));return matches.length===1?matches[0]:null;})();
}
function pausedNormalScan(){return state.step>0||Boolean(state.draft.serial)||Boolean(pendingScan?.collectionId===state.activeCollectionId&&pendingScan.value.trim());}
function renderRescanStation() {
 const reference=rescan.reference,item=rescan.item,destination=rescanDestination(),source=item?state.trolleys.find(t=>t.id===item.trolleyId):null;
 return `<section id="station" class="card station"><div class="section-top"><span class="eyebrow">TROLLEY RESCAN</span><label class="rescan-toggle is-active"><input id="rescan-mode" type="checkbox" aria-label="Trolley rescan mode" checked ${rescan.busy?'disabled':''}><span class="rescan-button-content">${icon('barcode')}<span>Trolley rescan</span><strong>On</strong></span></label><button id="voice" class="pill">${icon('voice')} ${state.voice?'Voice on':'Voice off'}</button></div><h2>Find it. Check it. Place it.</h2><p>Scan a serial number, barcode, security etch or asset number. Move an existing register item, or find a full record in a previous decom spreadsheet and add it to this trolley. Your normal scan stays paused.</p><div class="historical-tools"><button id="load-historical-workbook" class="secondary" ${rescan.busy?'disabled':''}>${icon('list')} Load previous decom Excel</button>${sharedClient?.role==='admin'?`<button id="share-historical-workbook" class="secondary" ${rescan.busy||!rescan.upload?'disabled':''}>Share loaded spreadsheet with team</button>`:''}${sharedClient?'<p>Search also checks your private team archive. Only administrators can share spreadsheets.</p>':''}<input id="historical-workbook" type="file" accept=".xlsx" class="sr-only" aria-label="Previous decom spreadsheet (.xlsx)"><p>${state.historicalEquipment.length} historical rows loaded on this device. Lookup files stay separate from recognition training and the register; only confirmed items are added.</p></div><div class="rescan-target"><strong>Target: ${escape(destination?.name||'Select a trolley')}</strong><span>${escape(destination?.reference||'Use Change trolley to choose the physical trolley.')}</span></div><form id="rescan-form"><label for="rescan-serial">Rescan equipment identifier</label><input id="rescan-serial" maxlength="1000" autocomplete="off" spellcheck="false" value="${escape(rescan.serial)}" ${rescan.busy?'disabled':''}><button class="primary" ${rescan.busy?'disabled':''}>${rescan.busy?'Checking…':'Find saved item'}</button></form><button id="repeat-rescan-prompt" class="text-button">${icon('voice')} Repeat spoken prompt</button>${item||rescan.historical?'<p class="hint">Review the details, then press Enter to confirm and continue to the next item.</p>':''}<p id="rescan-message" role="status">${escape(rescan.message)}</p>${reference?`<div class="rescan-reference"><h3>Load the previous spreadsheet for full details</h3><p><strong>${escape(reference.serial)}</strong><br>${escape(reference.manufacturer)} · ${escape(reference.model)}</p><p>This is recognition data, not a saved inventory item. Record it with normal scanning, or import its full equipment spreadsheet into the register. Use Load previous decom Excel above to retrieve the original asset, barcode, security etch and other fields.</p>${pausedNormalScan()?'<p>Your unfinished normal scan is kept. Finish or clear it before recording this reference.</p><button id="return-rescan-draft" class="secondary">Return to paused scan</button>':`<button id="record-rescan-reference" class="secondary" ${state.collectionPaused?'disabled':''}>Record this item</button>`}</div>`:''}${renderHistoricalPreview()}${item?`<div class="captured">${[['serial','Serial number'],['model','Model number'],['manufacturer','Manufacturer'],['asset','Asset number'],['barcode','Barcode'],['etch','Security etch'],['technician','Originally recorded by'],['date','Disposal date']].map(([key,label])=>`<div><span>${label}</span><strong>${escape(item[key])}</strong></div>`).join('')}</div><p>Recorded trolley: <strong>${escape(source?.name||item.trolley)}</strong> · ${escape(source?.reference||'')}</p><button id="confirm-rescan" class="primary wide" ${rescan.busy||!destination?'disabled':''}>${rescan.busy?'Confirming…':'Confirm trolley placement'}</button>`:''}</section>`;
}
function selectHistorical(id){
 const row=rescan.matches.find(row=>row.id===id);rescan.historical=row?structuredClone(row):null;
 rescan.addition=row?{id:createId(),values:{...Object.fromEntries(historicalFields.filter(([key])=>key!=='technician').map(([key])=>[key,row.values[key]||'N/A'])),date:state.defaults.date||today()},checked:false}:null;
}
function renderHistoricalPreview(){
 if(!rescan.matches.length)return '';
 const row=rescan.historical,addition=rescan.addition,destination=rescanDestination(),profile=sharedClient?.profile||state.profiles.find(p=>p.code===state.active);
 return `<div class="historical-preview"><h3>Previous decom equipment</h3>${rescan.matches.length>1?`<label for="historical-row-choice">Choose spreadsheet record</label><select id="historical-row-choice" ${rescan.busy?'disabled':''}><option value="">Select the correct source…</option>${rescan.matches.map(record=>`<option value="${escape(record.id)}" ${row?.id===record.id?'selected':''}>${escape(record.file)} · ${escape(record.sheet)} row ${record.row} · ${escape(record.values.serial||record.values.asset)} · ${escape(record.values.date)}</option>`).join('')}</select>`:''}${row?`<p class="historical-source">${escape(row.file)} · ${escape(row.sheet)} · row ${row.row}</p><details class="historical-original"><summary>View original spreadsheet information</summary><div class="captured">${historicalFields.map(([key,label])=>`<div><span>${label}</span><strong>${escape(row.values[key]||'N/A')}</strong></div>`).join('')}</div></details><p>Review the fields below. This adds a new register item to <strong>${escape(destination?.name||'your selected trolley')}</strong> with the disposal date you choose and your current technician initials (${escape(profile?.code||'choose a technician')}). The original spreadsheet stays preserved.</p><form id="historical-add-form" novalidate>${historicalFields.filter(([key])=>key!=='technician').map(([key,label])=>`<label for="historical-${key}">${key==='date'?'Disposal date for this addition':label}</label><input id="historical-${key}" name="${key}" type="${key==='date'?'date':'text'}" value="${escape(addition.values[key])}" maxlength="1000" required ${rescan.busy?'disabled':''}>`).join('')}<label class="historical-ack"><input id="historical-checked" name="checked" type="checkbox" ${addition.checked?'checked':''} ${rescan.busy?'disabled':''}> I checked these details against this equipment (pressing Enter also confirms this check)</label><button class="primary wide" ${rescan.busy||!destination||state.collectionPaused?'disabled':''}>${rescan.busy?'Adding…':'Add to current trolley'}</button></form>`:''}</div>`;
}
async function loadHistoricalWorkbook(event){
 const file=event.target.files?.[0];if(!file||rescan.busy||!rescan.enabled||!writable())return;
 const request=++rescan.request,client=sharedClient,locked=sharedLocked;rescan.busy=true;rescan.item=null;rescan.reference=null;rescan.historical=null;rescan.matches=[];rescan.addition=null;rescan.message='Loading previous decom spreadsheet…';render();let loaded=false;
 try{
  if(file.size>10*1024*1024)throw Error('Choose an Excel file up to 10 MB.');
  const {equipmentRowsFromWorkbook}=await import('./equipment-import.js'),parsed=await equipmentRowsFromWorkbook(await file.arrayBuffer());
  if(request!==rescan.request||client!==sharedClient||locked!==sharedLocked)return;
  if(storageError||localTabBlocked)throw Error('Lookup saving is paused. Back up your workspace before continuing.');
  const rows=historicalWorkbookRows(parsed,file.name),next={...state,historicalEquipment:mergeHistoricalEquipment(state.historicalEquipment,rows,file.name)};
  localStorage.setItem(key,JSON.stringify(next));state=next;rescan.upload={rows,file:file.name};loaded=true;rescan.message=`Loaded ${rows.length} full equipment rows from ${file.name}. Scan an identifier to review one item. The register and recognition training are unchanged.`;
 }catch(error){if(request===rescan.request)rescan.message=`Previous spreadsheet was not loaded. ${firebaseErrorMessage(error)}`;}
 finally{if(request===rescan.request){rescan.busy=false;render();if(loaded&&rescan.serial.trim())await lookupRescan();else document.querySelector('#rescan-serial')?.focus();}}
}
async function addHistoricalItem(event){
 event.preventDefault();if(rescan.busy||!rescan.historical||!rescan.addition||!rescan.enabled||!writable())return;
 const form=new FormData(event.target),values=Object.fromEntries(historicalFields.filter(([key])=>key!=='technician').map(([key])=>[key,String(form.get(key)||'').trim()]));rescan.addition.values=values;rescan.addition.checked=form.has('checked');
 if(!rescan.addition.checked){rescan.message='Check the equipment details and tick the confirmation before adding.';render();return;}
 if(state.collectionPaused){rescan.message='Resume the collection before adding this item.';render();return;}
 const client=sharedClient,locked=sharedLocked,original=structuredClone(rescan.historical),destination=rescanDestination(),collectionId=state.activeCollectionId,identifier=rescan.serial,id=rescan.addition.id;
 if(!destination){rescan.message='Choose an open target trolley using Change trolley.';render();return;}
 const request=++rescan.request;let confirmed=false;rescan.busy=true;rescan.message='Checking the register and adding this spreadsheet item…';render();
 try{
  if(client){const records=await client.load();if(client!==sharedClient||locked!==sharedLocked||request!==rescan.request)throw Error('Workspace changed. Sign in again to check the register.');state.items=records.items;state.trolleys=records.trolleys;}
  if(state.activeCollectionId!==collectionId||rescanDestination()?.id!==destination.id)throw Error('The target trolley or collection changed. Review before adding.');
  const sources=rescan.sharedRow&&client?.findHistorical?await client.findHistorical(identifier):state.historicalEquipment;if(client!==sharedClient||request!==rescan.request)throw Error('Workspace changed. Find the item again.');const source=sources.find(row=>row.id===original.id);if(!source||!sameRecord(source,original))throw Error('The source spreadsheet changed. Find the item again.');
  const target=state.trolleys.find(row=>row.id===destination.id);if(!target||target.status!=='open')throw Error('Choose an open trolley before adding. Ready or collected trolleys must be reopened first.');assertCollectionTrolley(target);
  if(!validDate(values.date))throw Error('Enter a valid disposal date for this addition.');
  const profile=client?.profile||state.profiles.find(p=>p.code===state.active);if(!profile)throw Error('Choose a technician before adding.');
  const item=validateEquipmentRecord({...values,serial:normalizeSerial(values.serial),asset:normalizeAssetNumber(values.asset),id,technician:profile.code,trolley:target.name,trolleyId:target.id,recognitionNeedsReview:true,recognitionConfirmed:true});
  assertHistoricalAddition(state.items,item,identifier);
  if(client){await client.write(item,0,{collectionId});confirmed=true;}
  if(client!==sharedClient||locked!==sharedLocked||request!==rescan.request)throw Error('Workspace changed. Sign in to check whether this item was added.');
  const next={...state,items:[...state.items.filter(row=>row.id!==item.id),item]};if(!client)localStorage.setItem(key,JSON.stringify(next));state=next;confirmed=true;if(client)persist();
  rescan.historical=null;rescan.matches=[];rescan.addition=null;rescan.serial='';rescan.message=`Item added to ${target.name}${client?' and saved to Firebase':''}. Its spreadsheet identifiers are recorded. Your paused normal scan is unchanged.`;speak('Item added to the current trolley. Next equipment identifier.');
 }catch(error){if(request===rescan.request)rescan.message=`${confirmed?'Addition confirmed; check the register before retrying.':'Item not added.'} ${firebaseErrorMessage(error)}`;}
 finally{if(request===rescan.request){rescan.busy=false;render();document.querySelector('#rescan-serial')?.focus();}}
}

function confirmRescanWithEnter() {
 if(rescan.busy||!rescan.enabled||document.querySelector('dialog[open]'))return;
 if(rescan.item){confirmRescan();return;}
 if(rescan.historical&&rescan.addition){
  const form=document.querySelector('#historical-add-form'),checked=document.querySelector('#historical-checked');
  if(!form||!checked)return;
  checked.checked=true;form.requestSubmit();
 }
}
async function lookupRescan() {
 if(rescan.busy||!rescan.enabled||!writable())return;
 const request=++rescan.request,client=sharedClient,locked=sharedLocked;rescan.sharedRow=false;rescan.busy=true;rescan.item=null;rescan.reference=null;rescan.historical=null;rescan.matches=[];rescan.addition=null;rescan.message='Looking for this identifier in the equipment register…';render();
 try{
  if(client){const records=await client.load();if(client!==sharedClient||locked!==sharedLocked)throw Error('Workspace changed. Sign in and rescan.');state.items=records.items;state.trolleys=records.trolleys;persist();}
  rescan.item=findRescanItem(state.items,rescan.serial);rescan.version=client?.versionFor(rescan.item.id)||0;
  rescan.message='Saved details found. Check the physical item and target trolley, then confirm placement.';
 }catch(error){if(request!==rescan.request)return;rescan.item=null;rescan.message=`Rescan stopped. ${firebaseErrorMessage(error)}`;
  if(error.code==='rescan/not-found'){
   rescan.matches=historicalMatches(state.historicalEquipment,rescan.serial);
   if(!rescan.matches.length&&client?.findHistorical){
    try{const rows=await client.findHistorical(rescan.serial);if(request!==rescan.request||client!==sharedClient||locked!==sharedLocked)return;rescan.matches=rows;rescan.sharedRow=Boolean(rows.length);}
    catch(failure){rescan.message=`Team history could not be checked. Ask your administrator to publish the latest rules, or load the spreadsheet on this device. ${firebaseErrorMessage(failure)}`;return;}
   }
   if(rescan.matches.length>100){rescan.matches=[];rescan.message='More than 100 historical rows match this identifier. Scan the serial, asset number or another more specific identifier.';}
   else if(rescan.matches.length){if(rescan.matches.length===1)selectHistorical(rescan.matches[0].id);rescan.message=rescan.matches.length===1?'Spreadsheet item found. Review all details and add it to the selected trolley.':'Several previous spreadsheet rows match. Select the correct source record before adding.';}
   else{const reference=lookupSerial(rescan.serial);if(reference?.method==='exact'){rescan.reference={...reference,serial:normalizeSerial(rescan.serial)};rescan.message=`Rescan stopped. ${reference.manufacturer} ${reference.model} is recognised. Load the previous decom Excel above to retrieve its full equipment record.`;}}
  }
 }
 finally{if(request===rescan.request){rescan.busy=false;render();if(rescan.enabled&&client===sharedClient&&locked===sharedLocked)speak(rescanPrompt());const input=document.querySelector('#rescan-serial');input?.focus();input?.select();}}
}
async function confirmRescan() {
 if(rescan.busy||!rescan.enabled||!rescan.item||!writable())return;
 if(state.collectionPaused){rescan.message='Resume the collection before confirming a trolley placement.';render();return;}
 const client=sharedClient,locked=sharedLocked,item=structuredClone(rescan.item),version=rescan.version,destination=rescanDestination(),collectionId=state.activeCollectionId;
 if(!destination){rescan.message='Choose the target trolley by its permanent reference using Change trolley.';render();return;}
 const request=++rescan.request;let confirmed=false;rescan.busy=true;rescan.message='Checking and confirming trolley placement…';render();
 try{
  if(client){const records=await client.load();if(client!==sharedClient||locked!==sharedLocked)throw Error('Workspace changed. Reconnect and rescan.');state.items=records.items;state.trolleys=records.trolleys;}
  if(state.activeCollectionId!==collectionId||rescanDestination()?.id!==destination.id)throw Error('The target trolley or collection changed. Check it and confirm again.');
  const identified=findRescanItem(state.items,rescan.serial);if(identified.id!==item.id)throw Error('This identifier now identifies a different item. Rescan to review the current record.');
  const latest=state.items.find(row=>row.id===item.id);
  if(!latest||!sameRecord(latest,item)||(client&&client.versionFor(item.id)!==version))throw Error('This equipment record changed since lookup. Scan one of its identifiers again to review the latest details.');
  const target=state.trolleys.find(t=>t.id===destination.id);if(!target)throw Error('The target trolley is no longer available.');assertCollectionTrolley(target);
  const row=movePlan(state.items,state.trolleys,[item.id],destination.id)[0],profile=client?.profile||state.profiles.find(p=>p.code===state.active);
  if(!profile)throw Error('Select a technician before confirming placement.');
  if(!row.skip){
   if(client){await client.write(row.after,version,{collectionId});confirmed=true;}
   if(client!==sharedClient||locked!==sharedLocked)throw Error('Workspace changed. Sign in again to retrieve the confirmed move.');
   const next={...state,items:state.items.map(record=>record.id===item.id?row.after:record),...(!client?{trolleyMoves:[...(state.trolleyMoves||[]),localMoveEvent(row,profile)]}:{})};
   commitTrolleyWorkspace(next);confirmed=true;
  }
  rescan.item=null;rescan.serial='';rescan.message=row.skip?'Already recorded on this trolley. No duplicate item or move was created. Scan the next equipment identifier.':`Existing item moved to ${target.name}. Its saved identifiers and disposal attribution are preserved. Scan the next equipment identifier.`;
  speak(row.skip?'Already on this trolley. Next equipment identifier.':'Trolley placement confirmed. Next equipment identifier.');
 }catch(error){if(request!==rescan.request)return;rescan.message=`${confirmed?'Move confirmed; check the register before retrying.':'Placement not confirmed.'} ${firebaseErrorMessage(error)}`;}
 finally{if(request===rescan.request){rescan.busy=false;render();document.querySelector('#rescan-serial')?.focus();}}
}
function updateEquipmentDescription(draft=state.draft,candidates=null) {
 if(draft.descriptionEdited)return;
 const excluded=new Set((state.referenceCorrections||[]).map(f=>f.serial.toUpperCase()));
 const facts=baseReferenceFacts().filter(f=>!excluded.has(String(f.serial).toUpperCase()));
 const types=(candidates||[{model:draft.model,manufacturer:draft.manufacturer??state.defaults.manufacturer}]).map(f=>suggestEquipmentDescription(f.model,f.manufacturer,facts));
 if(types.length&&types.every(type=>type&&type===types[0]))draft.description=types[0];else delete draft.description;
}
function editCurrentManufacturer(value){
 if(state.draft.manufacturer!==undefined)state.draft.manufacturer=value;else state.defaults.manufacturer=value;
 for(const id of ['default-manufacturer','recognized-maker']){const input=document.getElementById(id);if(input&&input.value!==value)input.value=value;}
 updateEquipmentDescription();const description=document.querySelector('#default-description');if(description)description.value=state.draft.description??state.defaults.description;
 if(state.draft.recognitionNeedsReview){state.draft.recognitionConfirmed=false;const check=document.querySelector('#confirm-recognition');if(check)check.checked=false;if(state.draft.recognitionCorrected){const certainty=document.querySelector('#recognition-certainty');if(certainty)certainty.textContent='Edited details need a fresh label check.';}}
 persist();
}
function capture(value) {
 if(state.collectionPaused){notice='This collection session is paused. Resume it before scanning.';render();return;}
 value=value.trim();if(!value||state.step>=fields.length)return;
 if(value.length>1000){notice='This scan is too long (maximum 1,000 characters). Check the barcode or enter a shorter value.';const hint=document.querySelector('.hint');if(hint){hint.textContent=notice;hint.setAttribute('role','status');}return;}
 const scannedTrolley=findTrolley(value,state.trolleys);
 if(scannedTrolley||/^TSU-[A-F0-9]{32}$/i.test(value)) {
  if(scannedTrolley)viewTrolley(scannedTrolley.id);
  else{notice='This trolley is not in the current workspace. Connect to its team database or restore its workspace backup.';render();}
  return;
 }
 if(fields[state.step][0]==='asset') {
  if(!validAssetNumber(value)){notice='Asset number must be A followed by four digits, for example A1234. If this is not applicable, use Skip to mark it as not applicable.';render();document.querySelector('#scan')?.focus();speak(notice);return;}
  value=normalizeAssetNumber(value);
 }
 if(state.step===0) {
  pendingScan=null;
  if(state.draft.serial!==value){delete state.draft.description;delete state.draft.descriptionEdited;}
  const match=value.toUpperCase()==='N/A'?null:lookupSerial(value);
  delete state.draft.recognitionEvidence;delete state.draft.recognitionCorrected;
  if(match)state.draft.recognitionEvidence=snapshotEvidence(match);
  if(match&&match.method!=='conflict') {
   state.draft={...state.draft,serial:value,model:match.model,manufacturer:match.manufacturer,recognitionNeedsReview:match.method!=='exact',recognitionConfirmed:false};updateEquipmentDescription();state.step=2;
   notice=`${match.method==='exact'?'Known serial':match.method==='similar'?`Serial family suggestion (prefix ${match.prefix}; reference ${match.referenceSerials.join(', ')})`:`Pattern suggestion (${match.suffix?'ending '+match.suffix:'prefix '+match.prefix})`}: ${match.model} · ${match.manufacturer}. ${match.support} distinct supporting example${match.support===1?'':'s'}. ${match.method==='similar'?'Check the scanned serial and physical model label before saving.':'Verify before saving.'}`;
   lastEmpty=0;persist();render();speak(`Suggested model, ${match.model}. Manufacturer, ${match.manufacturer}. Next, barcode.`);return;
  }
  if(match?.method==='conflict'||Object.hasOwn(state.draft,'recognitionNeedsReview')||(state.draft.serial&&state.draft.serial!==value)) {
   delete state.draft.model;delete state.draft.manufacturer;
  }
  delete state.draft.recognitionNeedsReview;delete state.draft.recognitionConfirmed;
  state.draft.serial=value;
  if(match?.method==='conflict'&&match.manufacturer) {
   state.draft.manufacturer=match.manufacturer;state.draft.recognitionNeedsReview=true;state.draft.recognitionConfirmed=false;updateEquipmentDescription(state.draft,match.candidates);state.step=1;
   notice=`Manufacturer suggestion: ${match.manufacturer}. ${match.suffix?`Serial ending ${match.suffix}${match.format?` · format ${match.format}`:''}`:match.prefix?`Prefix ${match.prefix}`:'This exact serial'} has ${match.support} distinct supporting example${match.support===1?'':'s'} with the same manufacturer. The model is not confirmed by this match. Scan or type the model, or choose a checked suggestion. Verify before saving.`;
   lastEmpty=0;persist();render();speak(`Suggested manufacturer, ${match.manufacturer}. Multiple models found. Please select the correct model type.`);return;
  }
  if(!state.draft.model&&state.settings.reuseModel&&match?.method!=='conflict')state.draft.model=state.settings.batchModel;
  updateEquipmentDescription();state.step=state.draft.model?2:1;
  notice=match?.method==='conflict'?'Several reference models match this serial or prefix. Choose a checked suggestion below, or enter the model and manufacturer manually.':state.draft.model?'Serial captured. No reliable match; using the batch model. Check the manufacturer.':'Serial captured. No reliable match yet; enter the model and manufacturer manually.';
  lastEmpty=0;persist();render();speak(match?.method==='conflict'?'Multiple models found. Please select the correct model type.':state.step===1?'Serial captured. Next, model number.':'Serial captured. Next, barcode.');return;
 }
 if(state.step===1&&state.draft.recognitionNeedsReview)state.draft.recognitionConfirmed=false;
 pendingScan=null;state.draft[fields[state.step][0]]=value;if(state.step===1)updateEquipmentDescription();state.step++;
 lastEmpty=0;notice='';persist();render();prompt();
}

function saveFeedback(message,field) {
 notice=message;
 const feedback=document.querySelector('#save-feedback');
 if(feedback){feedback.textContent=message;feedback.classList.add('save-message');feedback.setAttribute('role','status');feedback.tabIndex=-1;feedback.focus({preventScroll:true});feedback.scrollIntoView({block:'nearest'});}
 if(message.includes('Duplicated trolley name.')){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Choose trolley reference';button.onclick=openTrolley;feedback?.append(button);}
 if(field)document.querySelector(field==='manufacturer'&&state.draft.manufacturer!==undefined?'#recognized-maker':`#default-${field}`)?.setAttribute('aria-invalid','true');
}
async function saveItem() {
 if(rescan.enabled)return;
 if(saving){saveFeedback('Saving is still in progress. Your scan will stay here until confirmation arrives.');return;}
 const client=sharedClient,locked=sharedLocked;
 let waiting,confirmed=false;
 try {
  if(!writable()){saveFeedback(notice);return;}
  if(state.collectionPaused){saveFeedback('This collection session is paused. Resume it before saving.');return;}
  if(storageError&&!client){saveFeedback('Local saving is paused because browser storage is unavailable. Back up your workspace before refreshing or changing browser settings.');return;}
 const profile=state.profiles.find(p=>p.code===state.active);
 if(!profile){saveFeedback('Choose a technician first.');return;}
 const batch=Object.fromEntries([...new FormData(document.querySelector('#defaults'))].map(([k,v])=>[k,v.trim()]));
 const savedTrolleyId=state.activeTrolleyId;batch.trolley=state.trolleys.find(t=>t.id===savedTrolleyId)?.name??state.defaults.trolley;
 const manufacturer=(state.draft.manufacturer??batch.manufacturer).trim();
 const nextBatch=nextBatchDefaults({...batch,manufacturer},retentionSettings(state.settings));
 const missing=defaultFields.find(([key])=>!(key==='manufacturer'?manufacturer:batch[key]));
 if(missing){saveFeedback(missing[0]==='trolley'?'Choose a trolley using Change trolley, or create one in Trolleys before saving.':`Enter ${missing[1].toLowerCase()} before saving.`,missing[0]);return;}
 if(!validDate(batch.date)){saveFeedback('Enter a valid disposal date before saving.','date');return;}
 const missingScan=fields.find(([key])=>!state.draft[key]);
 if(missingScan){saveFeedback(`Capture ${missingScan[1].toLowerCase()} or skip it as N/A before saving.`);return;}
 if(!validAssetNumber(state.draft.asset)){saveFeedback('Asset number must be A followed by four digits, for example A1234, or N/A. Use Previous field to correct it.');return;}
 if(state.draft.recognitionNeedsReview&&!state.draft.recognitionConfirmed){saveFeedback('Check the suggested model and manufacturer against this equipment, then tick the confirmation before saving.');return;}
 if(duplicateSerial(state.items,state.draft.serial)){saveFeedback('This serial number is already in the register. Check the current item before saving.');speak(notice);return;}

  const savedCollectionId=state.activeCollectionId,savedNextDraft=state.settings.reuseModel?{model:state.settings.batchModel}:{};
  const draft=structuredClone(state.draft),draftText=JSON.stringify(draft),defaultsText=JSON.stringify(state.defaults);
  saving=true;
  const retain=document.querySelector('#batch-config');if(retain)retain.disabled=true;
  const button=document.querySelector('#save');if(button){button.disabled=true;button.textContent='Saving…';}
  saveFeedback(client?'Saving to the shared team database…':'Saving item…');
  waiting=setTimeout(()=>saveFeedback('Confirmation is taking longer than expected. Your scan is kept here. Check your connection; wait for this save to finish before retrying.'),15000);
  updateConnectionStatus();
  const trolley=await resolveTrolley(batch.trolley,savedTrolleyId,{followReference:true});nextBatch.trolley=trolley.name;
  if(client!==sharedClient||locked!==sharedLocked)throw Error('The workspace changed during saving. Sign in again to retrieve confirmed records. Your unfinished scan has been kept.');
  if(state.activeCollectionId!==savedCollectionId)throw Error('Collection changed before saving. Resume the original collection and retry.');
  if(trolley.status!=='open')throw Error('This trolley is ready or collected. Reopen a ready trolley or select an open trolley before saving.');
  const item=validateEquipmentRecord({...batch,...(draft.recognitionNeedsReview!==undefined?{recognitionNeedsReview:draft.recognitionNeedsReview,recognitionConfirmed:draft.recognitionConfirmed===true}:{}),trolleyId:trolley.id,trolley:trolley.name,...Object.fromEntries(fields.map(([key])=>[key,draft[key]])),asset:normalizeAssetNumber(draft.asset),manufacturer,technician:client?.profile.code||profile.code,id:createId()});
  assertCollectionTrolley(trolley);
  if(client){await client.write(item,0,{collectionId:savedCollectionId||''});confirmed=true;}
  if(client!==sharedClient||locked!==sharedLocked)throw Error('The workspace changed after the save was sent. Sign in again to check the team register. Your unfinished scan has been kept.');
  const changedDraft=state.activeCollectionId!==savedCollectionId||JSON.stringify(state.draft)!==draftText||state.step!==fields.length;
  const collectionScans={...state.collectionScans},checkpoint=collectionScans[savedCollectionId||'unassigned'];
  if(checkpoint?.step===fields.length&&JSON.stringify(checkpoint.draft)===draftText)collectionScans[savedCollectionId||'unassigned']={...checkpoint,draft:savedNextDraft,step:0,defaults:JSON.stringify(checkpoint.defaults)===defaultsText?nextBatch:checkpoint.defaults};
  const next={...state,collectionScans,defaults:!changedDraft&&JSON.stringify(state.defaults)===defaultsText?nextBatch:state.defaults,items:[...state.items.filter(i=>i.id!==item.id),item],draft:changedDraft?state.draft:state.settings.reuseModel?{model:state.settings.batchModel}:{},step:changedDraft?state.step:0};
  if(!client){localStorage.setItem(key,JSON.stringify(next));confirmed=true;}
  state=next;if(client)persist();
  notice=client?'Item saved to Firebase. It is available to your team on other devices. Place it in the caged trolley.':'Item saved in this browser. Back up after your session, or connect to Firebase to share it. Place it in the caged trolley.';if(changedDraft)notice+=' Your newer scan changes are kept. Review the saved record before saving again.';render();
  speak(changedDraft?'Item recorded. Your newer scan changes are kept. Review the saved record before saving again.':`Item recorded. Place it in the caged trolley. Next, ${fields[0][1]}.`);
 }catch(error){
  if(confirmed){saveFeedback(`Save was confirmed, but the workspace could not finish updating. ${firebaseErrorMessage(error)} Check the register before trying again.`);}
  else if(error?.name==='QuotaExceededError'||error?.name==='SecurityError')saveFeedback('Item not saved: browser storage is unavailable or full. Your scanned item is still here. Download a backup before refreshing.');
  else saveFeedback(`Item not saved. ${firebaseErrorMessage(error)}`);
 }finally {
  clearTimeout(waiting);saving=false;
  const button=document.querySelector('#save');if(button){button.disabled=false;button.innerHTML=`Save item & start next ${icon('arrow')}`;}
  const retain=document.querySelector('#batch-config');if(retain)retain.disabled=false;
  try{updateConnectionStatus();}catch(error){console.error('Save overview refresh failed:',error);}
 }
}

function batchRetentionSummary(){const keep=retentionSettings(state.settings),labels=retentionFields.filter(([key])=>keep[key]).map(([,label])=>label.toLowerCase());return labels.length?`Keep for next item: ${labels.join(', ')}. Other fields clear after saving.`:'All five fields clear after saving. Selected trolley stays.';}
function openBatchConfig(){
 if(saving)return;
 const dialog=document.querySelector('#batch-config-dialog'),keep=retentionSettings(state.settings);
 dialog.innerHTML=`<form id="batch-config-form"><div class="eyebrow">BATCH DEFAULTS</div><h2>Config</h2><p>Choose which details to keep after Save item &amp; start next. Unchecked fields clear. Your selected trolley stays.</p>${retentionFields.map(([key,label])=>`<label class="retention-option" for="keep-${key}"><span><strong>${label}</strong><small>Keep for next item</small></span><input id="keep-${key}" name="${key}" type="checkbox" ${keep[key]?'checked':''}></label>`).join('')}<p>Changing this configuration does not erase your current input. Checked fields keep the details used for the saved item, including recognised information.</p><p id="batch-config-error" role="alert"></p><div class="dialog-actions"><button id="cancel-batch-config" class="secondary" type="button">Cancel</button><button class="primary">Save configuration</button></div></form>`;
 dialog.showModal();dialog.querySelector('#cancel-batch-config').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=event=>{event.preventDefault();if(saving)return;const data=new FormData(event.target),settings={...state.settings,keepFields:Object.fromEntries(retentionFields.map(([key])=>[key,data.has(key)]))};
  if(storageError||localTabBlocked){dialog.querySelector('#batch-config-error').textContent='Configuration saving is paused. Back up your workspace before continuing.';return;}
  try{localStorage.setItem(key,JSON.stringify({...state,settings}));state.settings=settings;dialog.close();document.querySelector('#batch-config-summary').textContent=batchRetentionSummary();}
  catch{dialog.querySelector('#batch-config-error').textContent='Configuration could not be saved. Your current details and configuration are unchanged.';}
 };
}
function writable() {
 if(localTabBlocked){notice=localTabReason;render();return false;}
 if(sharedLocked&&navigator.onLine===false){notice='You are offline. Team changes are paused; your captured item is kept here. Reconnect before saving, or download a backup before closing this browser.';render();return false;}
 if(sharedLocked&&!sharedClient){notice='Reconnect to the shared database before changing team records, or disconnect to return to your local workspace.';render();return false;}
 return true;
}

function bind() {
 document.querySelector('#rescan-mode')?.addEventListener('change',event=>{if(saving||rescan.busy)return;rescan.enabled=event.target.checked;rescan.item=null;rescan.reference=null;rescan.historical=null;rescan.matches=[];rescan.addition=null;rescan.serial='';rescan.message='';render();if(rescan.enabled){document.querySelector('#rescan-serial')?.focus();prompt();}});
 document.querySelector('#rescan-serial')?.addEventListener('input',event=>{rescan.serial=event.target.value;rescan.item=null;rescan.reference=null;rescan.historical=null;rescan.matches=[];rescan.addition=null;document.querySelector('.historical-preview')?.remove();document.querySelector('.rescan-reference')?.remove();const button=document.querySelector('#confirm-rescan');if(button)button.disabled=true;});
 document.querySelector('#load-historical-workbook')?.addEventListener('click',()=>document.querySelector('#historical-workbook').click());
 document.querySelector('#historical-workbook')?.addEventListener('change',loadHistoricalWorkbook);
 document.querySelector('#share-historical-workbook')?.addEventListener('click',async()=>{
  const client=sharedClient,upload=rescan.upload;if(rescan.busy||!upload||client?.role!=='admin'||!writable())return;
  rescan.busy=true;rescan.message='Sharing this spreadsheet with your team…';render();
  try{await client.publishHistorical(upload.rows,upload.file);if(client!==sharedClient)return;rescan.upload=null;rescan.message=`Shared ${upload.rows.length} historical rows. Other team members can now rescan these identifiers.`;}
  catch(error){if(client===sharedClient)rescan.message=`Spreadsheet was not shared. Publish the latest Firestore rules if access was denied. ${firebaseErrorMessage(error)}`;}
  finally{if(client===sharedClient){rescan.busy=false;render();}}
 });
 document.querySelector('#historical-row-choice')?.addEventListener('change',event=>{selectHistorical(event.target.value);render();speak(rescanPrompt());document.querySelector('#rescan-serial')?.focus();});
 document.querySelector('#historical-add-form')?.addEventListener('submit',addHistoricalItem);
 document.querySelector('#historical-add-form')?.addEventListener('input',event=>{if(!rescan.addition||rescan.busy)return;if(event.target.name==='checked'){rescan.addition.checked=event.target.checked;return;}if(Object.hasOwn(rescan.addition.values,event.target.name)){rescan.addition.values[event.target.name]=event.target.value;rescan.addition.checked=false;const check=document.querySelector('#historical-checked');if(check)check.checked=false;}});
 document.querySelector('#repeat-rescan-prompt')?.addEventListener('click',prompt);
 document.querySelector('#rescan-serial')?.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||event.isComposing)return;
  if(event.repeat){event.preventDefault();return;}
  if(rescan.item||rescan.historical){event.preventDefault();confirmRescanWithEnter();}
 });
 document.querySelector('#historical-add-form')?.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||event.isComposing||!event.target.matches('input:not([type="checkbox"])'))return;
  event.preventDefault();if(!event.repeat)confirmRescanWithEnter();
 });
 document.querySelector('#rescan-form')?.addEventListener('submit',event=>{event.preventDefault();lookupRescan();});
 document.querySelector('#confirm-rescan')?.addEventListener('click',confirmRescan);
 document.querySelector('#return-rescan-draft')?.addEventListener('click',()=>{resetRescan();render();prompt();});
 document.querySelector('#record-rescan-reference')?.addEventListener('click',()=>{
  if(!rescan.reference||rescan.busy||saving||pausedNormalScan()||state.collectionPaused||!writable())return;
  const serial=rescan.reference.serial;resetRescan();state.step=0;pendingScan=null;render();capture(serial);
 });

 document.querySelector('#deleted-equipment')?.addEventListener('click',async()=>{
  if(!writable())return;
  try{const {openRecovery}=await import('./recovery-ui.js');await openRecovery({dialog:document.querySelector('#recovery-dialog'),getClient:()=>sharedClient,getState:()=>state,commit:next=>{commitTrolleyWorkspace(next);updateRegister();},canWrite:writable});}
  catch(error){notice=error.message;render();}
 });
 document.querySelector('#database').onclick=openDatabase;
 document.querySelector('#prepare-history-handover').onclick=openHandoverPack;
 document.querySelector('#history-search').oninput=e=>{historySearch=e.target.value;updateHistory();};
 document.querySelector('#manage-trolleys').onclick=openTrolleyManager;
 document.querySelector('#settings').onclick=openSettings;
 document.querySelector('#lock-workspace')?.addEventListener('click',()=>lockWorkspace());
 document.querySelector('#show-daily-progress').onclick=()=>{dailyProgressExpanded=!dailyProgressExpanded;updateOverviewLayout();if(dailyProgressExpanded)document.querySelector('#session-summary').scrollIntoView({behavior:'smooth'});};
 document.querySelector('#change-trolley').onclick=openTrolley;
 document.querySelector('#admin')?.addEventListener('click',async()=>{const client=sharedClient;try{const {openAdmin}=await import('./admin.js');if(sharedClient!==client)return;await openAdmin(client,name=>{if(sharedClient!==client)return;state.profiles[0].name=name;client.profile.name=name;persist();document.querySelector('#profile option').textContent=`${name} · ${state.active}`;});}catch{notice='The admin section could not load. Refresh the app and try again. Your register is preserved.';render();}});
 document.querySelector('#profile').onchange=e=>{state.active=e.target.value;persist();render();};
 document.querySelector('#voice').onclick=()=>{state.voice=!state.voice;persist();render();if(state.voice)prompt();else window.speechSynthesis?.cancel();};
 document.querySelector('#start')?.addEventListener('click',()=>{if(state.collectionPaused){notice='Resume this collection before scanning.';render();return;}scanning=true;focus();prompt();});
 document.querySelector('#scan')?.addEventListener('input',e=>{pendingScan={step:state.step,collectionId:state.activeCollectionId,value:e.target.value};});
 document.querySelector('#scan-form')?.addEventListener('submit',e=>{e.preventDefault();scanning=true;const value=document.querySelector('#scan').value;if(value.trim())capture(value);else {const now=Date.now();if(lastEmpty&&now-lastEmpty<state.settings.skipWindow){capture('N/A');}else {lastEmpty=now;notice=`Press Enter again within ${state.settings.skipWindow/1000} seconds to skip this field.`;document.querySelector('.hint').textContent=notice;}}});
 document.querySelector('#skip')?.addEventListener('click',()=>{scanning=true;capture('N/A');});
 document.querySelector('#save')?.addEventListener('click',saveItem);
 document.querySelector('#reject-suggestion')?.addEventListener('click',openScanCorrection);
 document.querySelector('#use-model-candidate')?.addEventListener('click',()=>{
  const selected=document.querySelector('#model-candidate').value;if(selected==='')return;
  const match=lookupSerial(state.draft.serial);const candidate=match?.candidates?.[Number(selected)];if(!candidate)return;
  state.draft.manufacturer=candidate.manufacturer;state.draft.recognitionNeedsReview=true;state.draft.recognitionConfirmed=false;capture(candidate.model);
 });
 document.querySelector('#recognized-maker')?.addEventListener('input',e=>editCurrentManufacturer(e.target.value));
 document.querySelector('#confirm-recognition')?.addEventListener('change',e=>{state.draft.recognitionConfirmed=e.target.checked;persist();});
 document.querySelector('#back')?.addEventListener('click',()=>{if(state.step>0){pendingScan=null;state.step--;lastEmpty=0;persist();render();prompt();}});
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{pendingScan=null;state.step=Number(b.dataset.step);lastEmpty=0;persist();render();prompt();});
 document.querySelector('#reset')?.addEventListener('click',()=>{if(Object.keys(state.draft).length&&!confirm('Clear the current unsaved item?'))return;resetDraft();lastEmpty=0;persist();render();prompt();});
 document.querySelector('#defaults').addEventListener('input',e=>{
  if(!defaultFields.some(([key])=>key===e.target.name))return;
  if(e.target.name==='trolley')return;
  if(e.target.name==='manufacturer'){editCurrentManufacturer(e.target.value);return;}
  if(e.target.name==='date'&&e.target.value!==''&&!validDate(e.target.value))return;
  if(e.target.name==='description'&&state.draft.description!==undefined){state.draft.description=e.target.value;state.draft.descriptionEdited=true;}else state.defaults[e.target.name]=e.target.value;persist();
 });
 document.querySelector('#batch-config').onclick=openBatchConfig;
 document.querySelector('#defaults').onsubmit=e=>{e.preventDefault();const batch=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,v.trim()]));if(state.draft.description!==undefined)batch.description=state.defaults.description;batch.trolley=state.trolleys.find(t=>t.id===state.activeTrolleyId)?.name??state.defaults.trolley;state.defaults=batch;notice='Batch defaults applied.';persist();render();};
 document.querySelector('#register-search').oninput=e=>{search=e.target.value;updateRegister();};
 document.querySelector('#inventory tbody').onclick=async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.moves)openMoveHistory(button.dataset.moves);
  if(button.dataset.edit) openEditor(button.dataset.edit);
  if(button.dataset.delete)openItemRemoval(button.dataset.delete);
 };
 document.querySelector('#equipment-import').onclick=openEquipmentWorkbook;
 document.querySelector('#backup').onclick=downloadBackup;
 document.querySelector('#restore').onclick=()=>document.querySelector('#backup-file').click();
 document.querySelector('#backup-file').onchange=prepareRestore;
 document.querySelector('#export').onclick=()=>exportExcel();
 document.querySelector('#add-profile').onclick=()=>document.querySelector('#profile-dialog').showModal();
 document.querySelector('#cancel-profile').onclick=()=>document.querySelector('#profile-dialog').close();
 document.querySelector('#profile-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),name=f.get('name').trim(),code=f.get('code').trim().toUpperCase();if(!name||!code||state.profiles.some(p=>p.code===code)){document.querySelector('#profile-error').textContent='Enter a name and unique disposal initials.';return;}state.profiles.push({name,code});state.active=code;persist();render();};
}
function assertCollectionTrolley(trolley) {
 if(state.activeCollectionId&&!state.collectionTrolleys.some(row=>row.trolleyId===trolley.id&&row.sessionId===state.activeCollectionId))throw Error('This trolley is outside your active collection. Assign it through Manage collection trolleys, or resume the collection that owns it.');
}
function commitScanSession(next) {
 if(storageError)throw Error('Browser storage is paused. Back up before changing your saved scan session.');
 localStorage.setItem(key,JSON.stringify(next));state=next;
}
function resumeCollection(id) {
 try {
  commitScanSession(switchCollection(state,id));pendingScan=null;collectionViewId=id;selectedEquipment.clear();trolleyViewId='';lastEmpty=0;scanning=true;
  notice=id?`Resumed ${state.collectionSessions.find(row=>row.id===id).name}. Your captured progress is restored.`:'Resumed your general scan session. Trolleys keep their collection assignments.';
  render();location.hash='station';prompt();
 }catch(error){notice=`Could not resume collection. ${error.message}`;render();}
}
function pauseCollection() {
 try {
  commitScanSession({...state,collectionPaused:true,collectionScans:{...state.collectionScans,[state.activeCollectionId||'unassigned']:scanCheckpoint(state)}});
  scanning=false;window.speechSynthesis?.cancel();notice='Collection paused. Captured progress is saved in this browser and its workspace backup.';render();
 }catch(error){notice=`Could not pause collection. ${error.message}`;render();}
}
async function refreshCollections(client=sharedClient) {
 if(!client){updateCollections();return;}
 try {
  const [records,equipment]=await Promise.all([client.loadCollections(),client.load()]);if(sharedClient!==client)return;
  let next=state;for(const session of state.collectionSessions)if(!records.collectionSessions.some(row=>row.id===session.id))next=removeCollection(next,session.id);
  const changedScan=next.activeCollectionId!==state.activeCollectionId;state={...next,trolleys:equipment.trolleys,...records};collectionError='';persist();if(changedScan){pendingScan=null;render();}else updateRegister();
 }catch(error){if(sharedClient===client){collectionError=`Shared collections are unavailable. ${client.role==='admin'?'In Database, copy the latest Firestore rules and publish them in Firebase, then refresh collections.':'Ask your team administrator to publish the latest Firestore rules, then refresh collections.'} ${firebaseErrorMessage(error)}`;updateCollections();}}
}
function updateCollectionDashboard() {
 const node=document.querySelector('#collection-dashboard');if(!node)return;
 if(dashboardCollectionId&&!state.collectionSessions.some(row=>row.id===dashboardCollectionId))dashboardCollectionId='';
 const dashboard=collectionDashboard(state,{collectionId:dashboardCollectionId,shared:sharedLocked});
 const cached=sharedLocked&&(!sharedClient||connectionPhase!=='connected'||navigator.onLine===false);
 const rows=dashboard.rows.filter(row=>dashboardStatus==='all'||row.status===dashboardStatus);
 node.innerHTML=`<div class="section-top"><div><div class="eyebrow">THE BIG PICTURE</div><h2>Collection dashboard</h2><p>See what needs attention and what is ready to leave.</p></div><a class="secondary" href="#station">${icon('barcode')} Continue scanning</a></div>
 <div class="dashboard-filters"><div><label for="dashboard-collection">Collection overview</label><select id="dashboard-collection"><option value="">Whole workspace</option>${state.collectionSessions.map(row=>`<option value="${escape(row.id)}" ${row.id===dashboardCollectionId?'selected':''}>${escape(row.name)}</option>`).join('')}</select></div><div><label for="dashboard-status">Trolleys to show</label><select id="dashboard-status"><option value="all">All statuses</option>${Object.entries(dashboardStatuses).map(([id,label])=>`<option value="${id}" ${id===dashboardStatus?'selected':''}>${label}</option>`).join('')}</select></div></div>
 <div class="dashboard-metrics" aria-live="polite">${[[dashboard.equipment,'Equipment items','box'],[dashboard.trolleys,'Trolleys','trolley'],[dashboard.issues,'Unresolved checks','review'],[dashboard.counts.ready,'Ready for pickup','check'],[dashboard.counts.collected,'Trolleys collected','history']].map(([value,label,symbol])=>`<div>${icon(symbol)}<strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
 <div class="dashboard-progress"><div><strong>${dashboard.collectedEquipment} of ${dashboard.equipment} items collected</strong><span>${dashboard.readyEquipment} items on trolleys ready for pickup</span></div><progress value="${dashboard.collectedEquipment}" max="${dashboard.equipment||1}" aria-label="Equipment collection progress"></progress></div>
 <p class="session-note">${cached?'Showing cached team records. Reconnect before confirming pickup readiness.':sharedLocked?'Based on the shared register. Refresh collections to check the latest trolley grouping.':'Based on this browser’s register.'} Readiness requires saved equipment, resolved record checks and a confirmed physical trolley check.</p>${collectionError?`<p class="collection-error" role="alert">${escape(collectionError)}</p>`:''}
 <details class="dashboard-trolley-details" ${dashboardTrolleysExpanded?'open':''}><summary>Trolley details <span>${rows.length} trolley${rows.length===1?'':'s'}</span></summary><div class="dashboard-trolleys">${rows.map(({trolley,items,issues,status,checked})=>`<article class="dashboard-trolley" data-dashboard-trolley="${escape(trolley.id)}"><div class="section-top"><div><h3>${escape(trolley.name)}</h3><small class="trolley-reference">${escape(trolley.reference)}</small></div><span class="dashboard-badge status-${status}">${dashboardStatuses[status]}</span></div><p><strong>${items.length}</strong> equipment items · <strong>${issues.length}</strong> unresolved checks</p><progress value="${checked}" max="${items.length||1}" aria-label="${escape(trolley.name)} checked records"></progress><p class="dashboard-next">${status==='empty'?'Add equipment to start filling this trolley.':status==='review'?'Resolve flagged details before the final physical check.':status==='physical'?'Records checked. Confirm the trolley’s physical contents.':status==='ready'?'Physical check confirmed. Ready for the collection company.':'Pickup recorded. Inventory remains available.'}</p><div class="trolley-actions"><button class="secondary" data-dashboard-inventory="${escape(trolley.id)}">${icon('list')} View inventory</button>${status!=='collected'&&items.length?`<button class="secondary" data-dashboard-review="${escape(trolley.id)}">${icon('review')} ${status==='ready'?'Review readiness':'Check trolley'}</button>`:''}</div></article>`).join('')||`<p class="dashboard-empty">${dashboard.rows.length?'No trolleys match this status. Choose another status to see the rest.':dashboardCollectionId?'No trolleys assigned. Use Manage collection trolleys in Collections to add them.':'Create a trolley to start tracking your collection.'}</p>`}</div></details>`;
 node.querySelector('#dashboard-collection').onchange=e=>{dashboardCollectionId=e.target.value;dashboardTrolleysExpanded=true;updateCollectionDashboard();};
 node.querySelector('#dashboard-status').onchange=e=>{dashboardStatus=e.target.value;dashboardTrolleysExpanded=true;updateCollectionDashboard();};
 node.querySelector('.dashboard-trolley-details').ontoggle=e=>{if(e.target.isConnected)dashboardTrolleysExpanded=e.target.open;};
 node.querySelectorAll('[data-dashboard-inventory]').forEach(button=>button.onclick=()=>viewTrolley(button.dataset.dashboardInventory));
 node.querySelectorAll('[data-dashboard-review]').forEach(button=>button.onclick=()=>openReadiness(button.dataset.dashboardReview));
}
function updateOverviewLayout() {
 const view=location.hash.startsWith('#trolley/')?'inventory':location.hash.startsWith('#station/trolley/')?'station':['overview','station','inventory','collections','collection-review','collection-history'].includes(location.hash.slice(1))?location.hash.slice(1):'station';
 const main=document.querySelector('main');if(main)main.dataset.view=view;
 document.querySelector('main')?.classList.toggle('overview-view',view==='overview');
 document.querySelectorAll('aside a.nav').forEach(link=>{const active=link.getAttribute('href')===`#${view}`;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
 const collections=document.querySelector('#collections'),summary=document.querySelector('#session-summary');
 if(collections)collections.hidden=!devicePreferences.showCollections&&location.hash!=='#collections';
 if(summary)summary.hidden=!devicePreferences.showDailyProgress&&!dailyProgressExpanded;
 const button=document.querySelector('#show-daily-progress');if(button)button.setAttribute('aria-expanded',String(Boolean(summary&&!summary.hidden)));
}
function updateCollections() {
 updateCollectionDashboard();
 const node=document.querySelector('#collections');if(!node)return;
 const active=state.collectionSessions.find(row=>row.id===state.activeCollectionId);
 const compact=document.querySelector('#station-session');if(compact){compact.hidden=!active;compact.innerHTML=active?`<strong>${escape(active.name)}</strong><span>${state.collectionPaused?'Paused — scan preserved':'Active collection'}</span><button id="station-pause" class="secondary">${state.collectionPaused?'Resume session':'Pause session'}</button>`:'';compact.querySelector('button')?.addEventListener('click',()=>state.collectionPaused?resumeCollection(state.activeCollectionId):pauseCollection());}
 node.innerHTML=`<div class="section-top"><div><div class="eyebrow">KEEP EACH COLLECTION TOGETHER</div><h2>Your collections</h2><p>${active?`${escape(active.name)} · ${state.collectionPaused?'Paused — progress saved':'Active scan session'}`:'Choose a collection to resume its saved scan, or create one for this week’s work.'}</p></div><div class="trolley-actions"><button class="primary" id="new-collection">Create collection</button>${sharedLocked?'<button class="secondary" id="refresh-collections">Refresh collections</button>':''}</div></div>${collectionError?`<p class="collection-error" role="alert">${escape(collectionError)}</p>`:''}${active?`<div class="collection-active-actions"><button class="secondary" id="pause-collection">${state.collectionPaused?'Resume session':'Pause session'}</button><button class="text-button" id="leave-collection">General scan session</button></div>`:''}<p class="session-note">Collection names and trolley grouping ${sharedLocked?'are shared with your team':'are stored in this workspace'}. Unfinished scans stay in this browser and your backup. Refresh shared collections to check another technician’s changes.</p><div class="collection-session-grid">${state.collectionSessions.map(session=>{const progress=collectionProgress(session.id,state.collectionTrolleys,state.trolleys,state.items,{shared:sharedLocked});return `<article class="collection-session-card"><div class="section-top"><h3>${escape(session.name)}</h3><span class="tag">${progress.complete?'Collected':session.id===state.activeCollectionId?state.collectionPaused?'Paused':'Active':'Available'}</span></div><div class="collection-session-metrics"><span><strong>${progress.items.length}</strong> equipment items</span><span><strong>${progress.issues}</strong> checks remaining</span><span><strong>${progress.collectedItems}</strong> items collected</span></div><progress value="${progress.collected}" max="${progress.trolleys.length||1}" aria-label="${escape(session.name)} trolley collection progress"></progress><p>${progress.open} open · ${progress.ready} ready · ${progress.collected} collected trolleys</p><small>${progress.trolleys.map(t=>escape(t.name)).join(' · ')||'No trolleys assigned yet.'}</small><div class="trolley-actions"><button class="primary" data-resume-collection="${escape(session.id)}">Resume ${escape(session.name)}</button><button class="secondary" data-view-collection="${escape(session.id)}">View collection inventory</button><button class="secondary" data-edit-collection="${escape(session.id)}">Manage collection trolleys</button>${!sharedLocked||sharedClient?.role==='admin'?`<button class="text-button remove" data-delete-collection="${escape(session.id)}">Delete collection</button>`:''}<button class="secondary" data-export-collection="${escape(session.id)}" ${!progress.items.length||exporting?'disabled':''}>Export collection Excel</button></div></article>`;}).join('')||'<p>No named collections yet. Existing equipment remains in the register; assign its trolley when creating a collection.</p>'}</div>`;
 node.querySelector('#new-collection').onclick=()=>editCollection();
 node.querySelector('#refresh-collections')?.addEventListener('click',()=>refreshCollections());
 node.querySelector('#pause-collection')?.addEventListener('click',()=>state.collectionPaused?resumeCollection(state.activeCollectionId):pauseCollection());
 node.querySelector('#leave-collection')?.addEventListener('click',()=>resumeCollection(''));
 node.querySelectorAll('[data-resume-collection]').forEach(button=>button.onclick=()=>resumeCollection(button.dataset.resumeCollection));
 node.querySelectorAll('[data-edit-collection]').forEach(button=>button.onclick=()=>editCollection(button.dataset.editCollection));
 node.querySelectorAll('[data-view-collection]').forEach(button=>button.onclick=()=>{collectionViewId=button.dataset.viewCollection;trolleyViewId='';search='';missingDetailsOnly=false;selectedEquipment.clear();location.hash='inventory';updateRegister();document.querySelector('#inventory').scrollIntoView({behavior:'smooth'});});
 node.querySelectorAll('[data-delete-collection]').forEach(button=>button.onclick=()=>deleteCollection(button.dataset.deleteCollection));
 node.querySelectorAll('[data-export-collection]').forEach(button=>button.onclick=()=>exportCollection(button.dataset.exportCollection));
}
async function deleteCollection(id) {
 if(collectionBusy||!writable())return;
 if(saving){notice='Wait for the current item to finish saving before deleting a collection.';render();return;}
 if(sharedLocked&&sharedClient?.role!=='admin'){notice='Only a team administrator can delete a shared collection.';render();return;}
 collectionBusy=true;const client=sharedClient,locked=sharedLocked,current=()=>client===sharedClient&&locked===sharedLocked;
 try {
  const {openSessionDeletion}=await import('./collection-session-ui.js');
  await openSessionDeletion({dialog:document.querySelector('#collection-session-dialog'),id,current,
   load:async()=>{if(!client)return state;const [records,groups]=await Promise.all([client.load(),client.loadCollections()]);return {...state,...records,...groups};},
   version:sessionId=>client?.sessionVersionFor(sessionId)||0,
   remove:async(sessionId,version)=>{
    if(!current()||saving)throw Error('Workspace changed or a save is pending. Reopen deletion.');
    const groups=client?await client.deleteSession(sessionId,version):null;
    if(!current())throw Error('Workspace changed. Reconnect and refresh collections to check deletion.');
    const activeRemoved=state.activeCollectionId===sessionId;commitTrolleyWorkspace({...removeCollection(state,sessionId),...(groups||{})});
    if(activeRemoved)pendingScan=null;if(collectionViewId===sessionId)collectionViewId='';if(dashboardCollectionId===sessionId)dashboardCollectionId='';selectedEquipment.clear();
   },
   done:session=>{notice=`Deleted ${session.name}. Saved equipment, trolleys and pickup history are preserved.`;render();}
  });
 }catch(error){notice=`Collection deletion could not open. ${firebaseErrorMessage(error)}`;render();}
 finally{collectionBusy=false;}
}
async function editCollection(id='') {
 if(collectionBusy||!writable())return;collectionBusy=true;
 const client=sharedClient,locked=sharedLocked,current=()=>client===sharedClient&&locked===sharedLocked;
 try {
  const {openSessionEditor}=await import('./collection-session-ui.js');
  await openSessionEditor({dialog:document.querySelector('#collection-session-dialog'),id,current,
   load:async()=>{if(!client)return state;const [records,groups]=await Promise.all([client.load(),client.loadCollections()]);return {...state,...records,...groups};},
   version:sessionId=>client?.sessionVersionFor(sessionId)||0,
   save:async(session,trolleyIds,version)=>{
    if(!current())throw Error('Workspace changed. Reopen this collection.');
    const records=client?await client.writeSession(session,trolleyIds,version):assignCollection(state.collectionSessions,state.collectionTrolleys,session,trolleyIds,state.trolleys);
    if(!current())throw Error('Workspace changed. Reconnect to check the saved collection.');
    const equipment=client?await client.load():null;
    if(!current())throw Error('Workspace changed. Reconnect to check the saved collection.');
    commitTrolleyWorkspace({...state,...(equipment?{trolleys:equipment.trolleys}:{}),...records});collectionError='';
   },
   done:(session,created)=>{if(created)resumeCollection(session.id);else{notice=`Updated ${session.name}. Equipment and trolley statuses are preserved.`;render();}}
  });
 }catch(error){notice=`Collection could not open. ${firebaseErrorMessage(error)}${client?' Publish the latest Firestore rules if access was denied.':''}`;render();}
 finally{collectionBusy=false;}
}
async function exportCollection(id) {
 if(exporting)return;const client=sharedClient;exporting=true;updateCollections();
 try {
  if(sharedLocked&&!client)throw Error('Reconnect to Firebase before exporting a shared collection.');
  const [records,groups]=client?await Promise.all([client.load(),client.loadCollections()]):[state,state];
  if(client!==sharedClient)throw Error('Workspace changed. Reopen the collection and retry.');
  const session=groups.collectionSessions.find(row=>row.id===id);if(!session)throw Error('This collection is no longer available.');
  const {items}=collectionScope(id,groups.collectionTrolleys,records.trolleys,records.items);
  if(!items.length)throw Error('This collection has no saved equipment to export.');
  const {supplierExcel,supplierExcelType}=await import('./supplier-excel.js');const data=await supplierExcel(items);
  downloadFile(data,`Decom-${session.name.replace(/[\\/:*?"<>|]/g,'-')}-${today()}.xlsx`,supplierExcelType);
  notice=`Collection Excel download started: ${session.name} · ${items.length} saved equipment records.`;
 }catch(error){notice=`Collection export failed. ${firebaseErrorMessage(error)}`;}
 finally{exporting=false;render();}
}

async function openEquipmentWorkbook() {
 if(equipmentImportOpening||!writable())return;
 const client=sharedClient,locked=sharedLocked;
 if(client&&client.role!=='admin'){notice='An administrator can import historical equipment while preserving its disposal attribution.';render();return;}
 equipmentImportOpening=true;
 try {
  const {openEquipmentImport}=await import('./equipment-import-ui.js');
  await openEquipmentImport({dialog:document.querySelector('#equipment-import-dialog'),client,
   current:()=>sharedClient===client&&sharedLocked===locked,
   load:()=>client?client.load():Promise.resolve(state),
   commit:(items,replace=false)=>{
    if(sharedClient!==client||sharedLocked!==locked)throw Error('Workspace changed. Reopen the importer.');
    commitTrolleyWorkspace({...state,items:replace?items:[...state.items,...items]});updateRegister();updateHistory();
   },
   close:message=>{notice=message||'Equipment import closed.';render();}
  });
 }catch(error){notice=`Equipment importer could not open. ${firebaseErrorMessage(error)}`;render();}
 finally{equipmentImportOpening=false;}
}
function resetDraft() {
 pendingScan=null;
 state.draft=state.settings.reuseModel?{model:state.settings.batchModel}:{};
 state.step=0;
}
function openTrolley() {
 if(!writable())return;
 const available=state.trolleys.filter(t=>t.status==='open'),known=available.map(t=>t.name);
 let selectedId=state.activeTrolleyId;
 const dialog=document.querySelector('#trolley-dialog');
 dialog.innerHTML=`<form id="trolley-form"><div class="eyebrow">COLLECTION TROLLEYS</div><h2>Switch to another trolley</h2><p>New records will use this trolley. Existing records stay where they are; use Edit to move an item.</p><label for="trolley-reference-choice">Existing trolley reference</label><select id="trolley-reference-choice"><option value="">Choose a trolley…</option>${available.map(t=>`<option value="${escape(t.id)}" ${t.id===selectedId?'selected':''}>${escape(t.name)} · ${escape(t.reference)} · ${state.items.filter(item=>trolleyForItem(item,t)).length} items</option>`).join('')}</select><p>Choose the permanent reference when trolley names are repeated. Existing equipment stays on its current trolley.</p><label for="trolley-name">Trolley name</label><input id="trolley-name" name="trolley" list="known-trolleys" value="${escape(state.defaults.trolley)}" required maxlength="1000"><datalist id="known-trolleys">${known.map(name=>`<option value="${escape(name)}"></option>`).join('')}</datalist><div class="trolley-list">${available.map(t=>`<button type="button" class="secondary" data-trolley-id="${escape(t.id)}">${escape(t.name)} <span>${escape(t.reference)} · ${state.items.filter(item=>trolleyForItem(item,t)).length} items</span></button>`).join('')}</div><p id="trolley-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-trolley">Cancel</button><button class="primary">Use trolley</button></div></form>`;
 dialog.showModal();
 document.querySelector('#cancel-trolley').onclick=()=>dialog.close();
 dialog.querySelector('#trolley-reference-choice').onchange=e=>{selectedId=e.target.value;const trolley=state.trolleys.find(t=>t.id===selectedId);if(trolley)document.querySelector('#trolley-name').value=trolley.name;};
 document.querySelector('#trolley-name').oninput=()=>{selectedId='';dialog.querySelector('#trolley-reference-choice').value='';};
 dialog.querySelectorAll('[data-trolley-id]').forEach(button=>button.onclick=()=>{selectedId=button.dataset.trolleyId;document.querySelector('#trolley-name').value=state.trolleys.find(t=>t.id===selectedId).name;dialog.querySelector('#trolley-reference-choice').value=selectedId;});
 document.querySelector('#trolley-form').onsubmit=async e=>{
  e.preventDefault();const trolley=document.querySelector('#trolley-name').value.trim();
  if(!trolley){document.querySelector('#trolley-error').textContent='Enter a trolley name.';return;}
  try{const record=await resolveTrolley(trolley,selectedId);assertCollectionTrolley(record);if(record.status!=='open')throw Error('This trolley is ready or collected. Select or create an open trolley.');commitTrolleyWorkspace({...state,activeTrolleyId:record.id,defaults:{...state.defaults,trolley:record.name}});notice=`New items will be recorded in ${record.name} (${record.reference}).`;render();}
  catch(error){document.querySelector('#trolley-error').textContent=error.message;}
 };
}
function openItemRemoval(id) {
 const original=state.items.find(item=>item.id===id);if(!original||!writable())return;
 const client=sharedClient,version=client?.versionFor(id)||0,dialog=document.querySelector('#edit-dialog');
 const lockedTrolley=state.trolleys.find(t=>t.status!=='open'&&trolleyForItem(original,t));
 dialog.innerHTML=`<form id="remove-item-form"><h2>Remove equipment?</h2><p>Remove <strong>${escape(original.serial)}</strong> · ${escape(original.manufacturer)} · ${escape(original.model)} from ${escape(original.trolley)}?</p><p>The item will leave the register and future exports. Shared audit history is retained.</p>${lockedTrolley?`<p>This trolley is ${escape(lockedTrolley.status)}. Unlock it before removing equipment.</p><button type="button" class="secondary" id="manage-item-lock">${!sharedLocked||sharedClient?.role==='admin'?'Unlock trolley':'Manage trolley lock'}</button>`:''}<p id="remove-item-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-remove-item">Cancel</button><button class="primary">Remove item</button></div></form>`;
 dialog.showModal();dialog.querySelector('#manage-item-lock')?.addEventListener('click',()=>{dialog.close();openTrolleyManager();if(!sharedLocked||sharedClient?.role==='admin')openTrolleyUnlock(lockedTrolley.id);});dialog.querySelector('#cancel-remove-item').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();const button=event.target.querySelector('.primary'),cancel=dialog.querySelector('#cancel-remove-item'),output=dialog.querySelector('#remove-item-error');
  if(button.disabled)return;button.disabled=true;cancel.disabled=true;output.textContent='Removing item…';
  try {
   if(client!==sharedClient||(sharedLocked&&(!client||connectionPhase!=='connected'||navigator.onLine===false)))throw Error('Reconnect to Firebase before removing equipment.');
   let item=state.items.find(row=>row.id===id),trolleys=state.trolleys;
   if(client){const snapshot=await client.load();if(client!==sharedClient)throw Error('Workspace changed. Reopen the register.');item=snapshot.items.find(row=>row.id===id);trolleys=snapshot.trolleys;if(client.versionFor(id)!==version)throw Error('This item changed. Cancel and refresh the register before removing it.');}
   if(!item)throw Error('This item is no longer in the register. Refresh the register.');
   if(!item.trolleyId){const matches=trolleys.filter(t=>t.name===item.trolley);if(matches.length!==1)throw Error('Choose the permanent trolley reference for this legacy item before removing it.');item={...item,trolleyId:matches[0].id,trolley:matches[0].name};}
   if(trolleys.some(t=>t.status!=='open'&&trolleyForItem(item,t)))throw Error('This trolley is locked. Reopen a ready trolley in Trolleys, or ask an administrator to use Unlock trolley for collected contents.');
   if(client)await client.write(item,version,{deleted:true});
   if(client!==sharedClient)throw Error('Workspace changed. Reconnect to confirm the removal.');
   commitTrolleyWorkspace({...(!client?archiveDeleted(state,[item]):state),items:state.items.filter(row=>row.id!==id)});selectedEquipment.delete(id);dialog.close();notice='Equipment removed from the register.';render();
  }catch(error){output.textContent=`Removal failed. ${firebaseErrorMessage(error)}`;button.disabled=false;cancel.disabled=false;}
 };
}
function syncTrolleyNames() {
 const names=new Map(state.trolleys.map(t=>[t.id,t.name]));
 state.items=state.items.map(item=>names.has(item.trolleyId)?{...item,trolley:names.get(item.trolleyId)}:item);
 for(const checkpoint of Object.values(state.collectionScans||{}))if(names.has(checkpoint.activeTrolleyId))checkpoint.defaults.trolley=names.get(checkpoint.activeTrolleyId);
}
function commitTrolleyWorkspace(next) {
 if(storageError&&!sharedClient)throw Error('Browser storage is unavailable. Back up your workspace before continuing.');
 if(!sharedClient)localStorage.setItem(key,JSON.stringify(next));
 state=next;if(sharedClient)persist();
 updateCollectionReview();updateSessionSummary();
}
async function resolveTrolley(name,selectedId=state.activeTrolleyId,{followReference=false}={}) {
 const client=sharedClient;
 if(client){const records=await client.load();if(client!==sharedClient)throw Error('Workspace changed. Select your trolley again.');state.trolleys=records.trolleys;}
 name=name.trim();if(!name)throw Error('Enter a trolley name.');
 const chosen=state.trolleys.find(t=>t.id===selectedId&&(followReference||trolleyNameKey(t.name)===trolleyNameKey(name)));if(chosen)return chosen;
 const matches=state.trolleys.filter(t=>trolleyNameKey(t.name)===trolleyNameKey(name));
 if(matches.length>1)throw Error('Duplicated trolley name. Choose the correct permanent reference using Change trolley before saving.');
 if(matches[0])return matches[0];
 if(state.activeCollectionId)throw Error('Create the trolley in Trolleys and assign it through Manage collection trolleys first.');
 if(!writable())throw Error('Reconnect before creating a team trolley.');
 if(client)throw Error('Select an existing shared trolley using Change trolley, or create it in Trolleys first. Saving will not create another team trolley automatically.');
 const trolley=createTrolley(name);
 state.trolleys=[...state.trolleys.filter(t=>t.id!==trolley.id),trolley];
 return trolley;
}
function viewTrolley(id) {
 missingDetailsOnly=false;
 document.querySelector('#trolley-manager')?.close();
 location.hash=`trolley/${id}`;trolleyViewId=id;
 notice='Trolley inventory opened. Your scanned equipment draft is unchanged.';render();
 document.querySelector('#inventory').scrollIntoView({behavior:'smooth'});
}
async function openTrolleyUnlock(id){
 const client=sharedClient,dialog=document.querySelector('#trolley-manager');let busy=false,cancelled=false,plan,versions;
 if(sharedLocked&&client?.role!=='admin'){notice='Only a team administrator can unlock collected trolleys.';render();return;}
 dialog.innerHTML='<h2>Unlock trolley</h2><p id="unlock-error" role="alert">Checking current trolley status…</p><button class="secondary" id="cancel-unlock">Cancel</button>';
 dialog.oncancel=e=>{if(busy)e.preventDefault();else cancelled=true;};dialog.querySelector('#cancel-unlock').onclick=()=>{if(!busy){cancelled=true;dialog.close();openTrolleyManager();}};
 try{
  const records=client?await client.load():state;if(client!==sharedClient)throw Error('Workspace changed. Reopen trolley management.');
  plan=trolleyUnlockPlan(records.trolleys,id);versions=Object.fromEntries(plan.before.map(t=>[t.id,client?.trolleyVersionFor(t.id)||0]));
  if(cancelled||!dialog.open)return;
  dialog.innerHTML=`<form id="unlock-trolley-form"><h2>Unlock trolley for corrections</h2><p>${plan.before.map(t=>escape(t.name)).join(' · ')}</p><p>${plan.before.length>1?'All trolleys in this handover will unlock together. ':''}This returns the trolley to Open so you can remove, move and edit equipment, rename it, or delete it once empty and unassigned. The previous collection details stay in unlock history. Check readiness again before marking it collected.</p><label for="unlock-reason">Reason for unlocking</label><input id="unlock-reason" required maxlength="500" placeholder="e.g. Collected status was set by mistake"><label class="review-check"><input id="unlock-confirm" type="checkbox" required> I understand the collection status will be reversed and the contents become editable.</label><p id="unlock-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-unlock">Cancel</button><button class="primary">Confirm unlock</button></div></form>`;
  dialog.querySelector('#cancel-unlock').onclick=()=>{if(!busy){cancelled=true;dialog.close();openTrolleyManager();}};
  dialog.querySelector('form').onsubmit=async e=>{
   e.preventDefault();if(busy)return;const output=dialog.querySelector('#unlock-error');
   try{
    if(client!==sharedClient||(sharedLocked&&(!client||navigator.onLine===false))||localTabBlocked)throw Error('Reconnect and reopen this unlock preview.');
    const reason=unlockReason(dialog.querySelector('#unlock-reason').value);if(!dialog.querySelector('#unlock-confirm').checked)throw Error('Confirm that you understand the unlock.');
    busy=true;dialog.querySelectorAll('input,button').forEach(input=>input.disabled=true);output.textContent='Unlocking trolley…';
    let unlocked;
    if(client)unlocked=await client.unlockTrolleys(id,versions,reason);
    else{for(const before of plan.before)if(!sameRecord(state.trolleys.find(t=>t.id===before.id),before))throw Error('A trolley changed. Reopen this preview.');unlocked=plan.after;}
    if(client!==sharedClient)throw Error('Workspace changed after unlock. Reconnect to retrieve confirmed changes.');
    const updates=new Map(unlocked.map(t=>[t.id,t]));
    commitTrolleyWorkspace({...state,trolleys:state.trolleys.map(t=>updates.get(t.id)||t),...(!client?{trolleyUnlocks:[...(state.trolleyUnlocks||[]),{at:new Date().toISOString(),by:state.active,reason,before:plan.before}]}:{})});
    dialog.close();notice='Trolley unlocked. You can now remove or edit equipment in its inventory.';render();openTrolleyManager();document.querySelector('#trolley-manager-error').textContent=notice;
   }catch(error){output.textContent=`Unlock failed. ${firebaseErrorMessage(error)}${error.code==='permission-denied'?' Publish the latest Firestore rules in Firebase first.':''}`;}
   finally{busy=false;if(dialog.isConnected)dialog.querySelectorAll('input,button').forEach(input=>input.disabled=false);}
  };
 }catch(error){if(!cancelled&&dialog.isConnected)dialog.querySelector('#unlock-error').textContent=firebaseErrorMessage(error);}
}
function openTrolleyManager() {
 readinessSession++;
 const dialog=document.querySelector('#trolley-manager');
 dialog.innerHTML=`<div class="eyebrow">COLLECTION CONTROL</div><h2>Manage trolleys</h2><p>Every trolley has a permanent reference. Labels identify the owner and link to this workspace's inventory.</p>${state.trolleys.some((t,i,all)=>all.some((other,j)=>j!==i&&trolleyNameKey(other.name)===trolleyNameKey(t.name)))?'<p class="note" role="status">Duplicate trolley names exist. Use the permanent TSU reference and item count to choose the correct trolley. Rename a duplicate, or delete it once empty and unassigned; equipment is kept on its original reference.</p>':''}<button class="primary" id="prepare-handover">Prepare handover pack</button><form id="trolley-lookup-form" class="trolley-lookup"><label for="trolley-lookup">Scan trolley barcode</label><input id="trolley-lookup" autocomplete="off" placeholder="Scan a TSU trolley reference"><button class="secondary">View inventory</button></form><div class="trolley-manager-list">${state.trolleys.map(t=>`<article class="trolley-card" data-trolley-id="${escape(t.id)}"><div class="section-top"><h3>${escape(t.name)}</h3><span class="tag ${t.status==='collected'?'collected-tag':''}">${t.status==='collected'?'Collected':t.status==='ready'?'Ready for collection':'Open'}</span></div><div class="trolley-reference">${escape(t.reference)}</div><p>Property of TSU - ${escape(t.department)}<br>${state.items.filter(item=>trolleyForItem(item,t)).length} items${t.status==='collected'?` · ${escape(t.company)} · ${escape(new Date(t.collectedAt).toLocaleDateString('en-GB'))}`:''}</p><div class="trolley-actions"><button class="secondary" data-view="${escape(t.id)}">Inventory</button><button class="secondary" data-label="${escape(t.id)}">PDF label</button><button class="secondary" data-manifest="${escape(t.id)}">PDF manifest</button><button class="secondary" data-status="${escape(t.id)}">Change status</button>${t.status==='open'?`<button class="secondary" data-use="${escape(t.id)}">Use trolley</button><button class="text-button" data-details="${escape(t.id)}">Rename / edit trolley</button>${!sharedLocked||sharedClient?.role==='admin'?`<button class="text-button remove" data-delete-trolley="${escape(t.id)}">Delete trolley</button>`:''}<button class="primary" data-readiness="${escape(t.id)}">Readiness checks</button>`:t.status==='ready'?`<button class="secondary" data-readiness="${escape(t.id)}">Review checks</button><button class="text-button" data-reopen="${escape(t.id)}">Reopen trolley</button><button class="primary" data-collect="${escape(t.id)}">Mark collected</button>`:(!sharedLocked||sharedClient?.role==='admin')?`<button class="secondary" data-unlock-trolley="${escape(t.id)}">Unlock trolley</button>`:''}</div></article>`).join('')}</div><form id="create-trolley-form" class="settings-section"><h3>Add a trolley</h3><label for="new-trolley-name">New trolley name</label><input id="new-trolley-name" name="name" required maxlength="80" placeholder="e.g. Trolley 03"><label for="new-trolley-department">Owning department</label><input id="new-trolley-department" name="department" required maxlength="100" value="${escape(defaultDepartment)}"><button class="primary wide">Create trolley</button></form><p id="trolley-manager-error" role="alert"></p><button class="secondary wide" id="close-trolley-manager">Close</button>`;
 dialog.showModal();
 document.querySelector('#prepare-handover').onclick=()=>{dialog.close();openHandoverPack();};
 document.querySelector('#close-trolley-manager').onclick=()=>dialog.close();
 document.querySelector('#trolley-lookup-form').onsubmit=e=>{e.preventDefault();const record=findTrolley(document.querySelector('#trolley-lookup').value,state.trolleys);if(record)viewTrolley(record.id);else document.querySelector('#trolley-manager-error').textContent='Trolley not found in this workspace. Check the barcode or connect to the correct team.';};
 let creatingTrolley=false;
 document.querySelector('#create-trolley-form').onsubmit=async e=>{
  e.preventDefault();if(creatingTrolley||!writable())return;
  const client=sharedClient,locked=sharedLocked,data=new FormData(e.target),name=data.get('name').trim(),department=data.get('department').trim(),button=e.target.querySelector('button'),output=dialog.querySelector('#trolley-manager-error');
  if(!name||!department)return;
  if(state.trolleys.some(t=>trolleyNameKey(t.name)===trolleyNameKey(name))){output.textContent='A trolley already uses that name. Choose its permanent reference below.';return;}
  const context=()=>client===sharedClient&&locked===sharedLocked;
  creatingTrolley=true;button.disabled=true;
  try{
   if(client){const records=await client.load();if(!context())throw Error('Workspace changed. Reconnect and choose the trolley from the refreshed list.');state.trolleys=records.trolleys;if(state.trolleys.some(t=>trolleyNameKey(t.name)===trolleyNameKey(name)))throw Error('A shared trolley already uses this name. Select its existing reference.');}
   const trolley=client?(client.allocateTrolley?await client.allocateTrolley(name,department):await createSharedTrolley(name,department,`${client.projectId||'decompro-236e9'}/${client.teamId||'college-it'}`)):createTrolley(name,department);
   if(!context())throw Error('Workspace changed before creation. Reconnect and refresh trolleys.');
   if(client)await client.writeTrolley(trolley,0);
   if(!context())throw Error('Creation finished after the workspace changed. Reconnect to retrieve the confirmed trolley; do not create it again.');
   commitTrolleyWorkspace({...state,trolleys:[...state.trolleys.filter(t=>t.id!==trolley.id),trolley],...(!state.activeCollectionId?{activeTrolleyId:trolley.id,defaults:{...state.defaults,trolley:trolley.name}}:{})});dialog.close();openTrolleyManager();
  }catch(error){if(output.isConnected)output.textContent=firebaseErrorMessage(error);}
  finally{creatingTrolley=false;if(button.isConnected)button.disabled=false;}
 };
 dialog.querySelectorAll('[data-status]').forEach(button=>button.onclick=()=>openTrolleyStatus(button.dataset.status));
 dialog.querySelectorAll('[data-unlock-trolley]').forEach(button=>button.onclick=()=>openTrolleyUnlock(button.dataset.unlockTrolley));
 dialog.querySelectorAll('[data-delete-trolley]').forEach(button=>button.onclick=()=>openTrolleyDeletion(button.dataset.deleteTrolley));
 dialog.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>viewTrolley(button.dataset.view));
 dialog.querySelectorAll('[data-use]').forEach(button=>button.onclick=()=>{const trolley=state.trolleys.find(t=>t.id===button.dataset.use);try{if(!writable())return;assertCollectionTrolley(trolley);if(trolley.status!=='open')throw Error('This trolley is ready or collected. Reopen it before adding equipment.');commitTrolleyWorkspace({...state,activeTrolleyId:trolley.id,defaults:{...state.defaults,trolley:trolley.name}});notice=`New items will be recorded in ${trolley.name}.`;render();}catch(error){document.querySelector('#trolley-manager-error').textContent=error.message;}});
 dialog.querySelectorAll('[data-label]').forEach(button=>button.onclick=async()=>{
  button.disabled=true;
  try{await printTrolleyLabel(button.dataset.label);}
  catch(error){document.querySelector('#trolley-manager-error').textContent=`Label failed: ${error.message}`;}
  finally{button.disabled=false;}
 });
 dialog.querySelectorAll('[data-manifest]').forEach(button=>button.onclick=async()=>{
  button.disabled=true;document.querySelector('#trolley-manager-error').textContent='';
  try{
   const trolley={...state.trolleys.find(t=>t.id===button.dataset.manifest)},items=state.items.map(item=>({...item}));
   const cached=sharedLocked&&(!sharedClient||connectionPhase!=='connected'||navigator.onLine===false),url=new URL(location.href);url.hash=`trolley/${trolley.id}`;
   const {trolleyManifest}=await import('./trolley-manifest');
   const data=await trolleyManifest(trolley,items,url.href,{cached});
   downloadFile(data,`${trolley.reference}-manifest.pdf`,'application/pdf');
  }catch(error){document.querySelector('#trolley-manager-error').textContent=`Manifest failed: ${error.message}`;}
  finally{button.disabled=false;}
 });
 dialog.querySelectorAll('[data-readiness]').forEach(button=>button.onclick=()=>openReadiness(button.dataset.readiness));
 dialog.querySelectorAll('[data-reopen]').forEach(button=>button.onclick=async()=>{
  if(!writable())return;button.disabled=true;
  const client=sharedClient,trolley=state.trolleys.find(t=>t.id===button.dataset.reopen),version=client?.trolleyVersionFor(trolley.id)||0;
  try{await reopenReadyTrolley(trolley,version,client);dialog.close();openTrolleyManager();document.querySelector('#trolley-manager-error').textContent='Trolley reopened. Run readiness checks again after making changes.';}
  catch(error){document.querySelector('#trolley-manager-error').textContent=firebaseErrorMessage(error);button.disabled=false;}
 });
 dialog.querySelectorAll('[data-collect],[data-details]').forEach(button=>button.onclick=()=>openTrolleyDetails(button.dataset.collect||button.dataset.details,Boolean(button.dataset.collect)));
}
async function reopenReadyTrolley(trolley,version,client){
 if(client!==sharedClient||(sharedLocked&&(!client||navigator.onLine===false))||localTabBlocked)throw Error('Reconnect before changing trolley status.');
 if(!trolley||trolley.status!=='ready')throw Error('Only ready trolleys can be reopened.');
 if(!client&&!sameRecord(state.trolleys.find(t=>t.id===trolley.id),trolley))throw Error('This trolley changed. Reopen trolley management.');
 const updated={...trolley,status:'open',readyAt:'',readyBy:''};
 if(client)await client.writeTrolley(updated,version);
 if(client!==sharedClient)throw Error('Workspace changed. Reconnect to retrieve confirmed status.');
 commitTrolleyWorkspace({...state,trolleys:state.trolleys.map(t=>t.id===updated.id?updated:t)});
}
function openTrolleyStatus(id){
 const trolley=state.trolleys.find(t=>t.id===id),client=sharedClient,version=client?.trolleyVersionFor(id)||0,dialog=document.querySelector('#trolley-manager');if(!trolley||!writable())return;
 const canUnlock=!sharedLocked||client?.role==='admin';let busy=false;
 dialog.innerHTML=`<form id="trolley-status-form"><div class="eyebrow">${escape(trolley.reference)}</div><h2>Change trolley status</h2><p>${escape(trolley.name)}</p><label for="trolley-status-select">Trolley status</label><select id="trolley-status-select"><option value="open" ${trolley.status==='open'?'selected':''} ${trolley.status==='collected'&&!canUnlock?'disabled':''}>Open — editable</option><option value="ready" ${trolley.status==='ready'?'selected':''} ${trolley.status==='collected'?'disabled':''}>Ready for collection</option><option value="collected" ${trolley.status==='collected'?'selected':''} ${trolley.status==='open'?'disabled':''}>Collected</option></select><p id="trolley-status-help" role="status"></p><p id="trolley-status-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-trolley-status">Cancel</button><button class="primary" id="apply-trolley-status" disabled>Continue</button></div></form>`;
 const select=dialog.querySelector('select'),button=dialog.querySelector('#apply-trolley-status'),cancel=dialog.querySelector('#cancel-trolley-status'),help=dialog.querySelector('#trolley-status-help'),output=dialog.querySelector('#trolley-status-error');
 select.onchange=()=>{
  output.textContent='';button.disabled=select.value===trolley.status;
  help.textContent=select.value===trolley.status?trolley.status==='collected'&&!canUnlock?'A team administrator must unlock collected trolleys.':'Choose a different status.':select.value==='ready'?'Continue to readiness checks and confirm the physical inventory before marking this trolley ready.':select.value==='collected'?'Continue to record the collecting company. Collected equipment becomes locked.':trolley.status==='collected'?'Continue to administrator unlock. A reason and acknowledgement are required; linked handover trolleys unlock together.':'Reopen this trolley so its equipment can be edited, moved or removed. Readiness must be checked again afterward.';
  button.textContent=select.value===trolley.status?'Continue':select.value==='ready'?'Review readiness':select.value==='collected'?'Record collection':trolley.status==='collected'?'Continue to unlock':'Set status to Open';
 };
 select.onchange();cancel.onclick=()=>{if(!busy){dialog.close();openTrolleyManager();}};dialog.oncancel=e=>{if(busy)e.preventDefault();};
 dialog.querySelector('form').onsubmit=async e=>{
  e.preventDefault();if(busy||select.value===trolley.status)return;
  if(client!==sharedClient){output.textContent='Workspace changed. Reopen trolley management.';return;}
  if(select.value==='ready'&&trolley.status==='open'){openReadiness(id);return;}
  if(select.value==='collected'&&trolley.status==='ready'){openTrolleyDetails(id,true);return;}
  if(select.value==='open'&&trolley.status==='collected'&&canUnlock){openTrolleyUnlock(id);return;}
  if(select.value!=='open'||trolley.status!=='ready'){output.textContent='Choose a supported status change.';return;}
  busy=true;button.disabled=true;cancel.disabled=true;select.disabled=true;
  try{await reopenReadyTrolley(trolley,version,client);dialog.close();openTrolleyManager();document.querySelector('#trolley-manager-error').textContent='Status changed to Open. You can now edit or remove equipment.';}
  catch(error){output.textContent=firebaseErrorMessage(error);}
  finally{busy=false;if(dialog.isConnected){button.disabled=false;cancel.disabled=false;select.disabled=false;}}
 };
}
function openTrolleyDeletion(id) {
 const trolley=state.trolleys.find(t=>t.id===id),client=sharedClient,version=client?.trolleyVersionFor(id)||0,dialog=document.querySelector('#trolley-manager');
 if(!trolley||!writable())return;
 if(sharedLocked&&client?.role!=='admin'){notice='Only a team administrator can delete a trolley.';render();return;}
 dialog.innerHTML=`<form id="delete-trolley-form"><div class="eyebrow">${escape(trolley.reference)}</div><h2>Delete ${escape(trolley.name)}?</h2><p>Only an empty, open trolley detached from its collection can be deleted. Move equipment to another trolley first. Shared audit history is retained.</p><label for="delete-trolley-text">Type DELETE to confirm</label><input id="delete-trolley-text" autocomplete="off" spellcheck="false"><label class="toggle-label"><input id="delete-trolley-ack" type="checkbox"> I understand this removes this trolley from the workspace.</label><p id="delete-trolley-error" role="alert"></p><button type="button" class="secondary" id="detach-delete-trolley" hidden>Detach from collection</button><div class="dialog-actions"><button type="button" class="secondary" id="cancel-delete-trolley">Cancel</button><button class="primary" id="confirm-delete-trolley" disabled>Delete trolley</button></div></form>`;
 const form=dialog.querySelector('form'),text=dialog.querySelector('#delete-trolley-text'),ack=dialog.querySelector('#delete-trolley-ack'),button=dialog.querySelector('#confirm-delete-trolley'),cancel=dialog.querySelector('#cancel-delete-trolley'),output=dialog.querySelector('#delete-trolley-error');let busy=false;
 const detach=dialog.querySelector('#detach-delete-trolley');detach.hidden=!state.collectionTrolleys.some(row=>row.trolleyId===id&&row.sessionId);
 detach.onclick=async()=>{
  if(busy)return;busy=true;button.disabled=true;cancel.disabled=true;detach.disabled=true;output.textContent='Checking the collection assignment…';
  try{
   if(saving||rescan.busy)throw Error('Wait for the pending equipment save or move to finish before detaching a trolley.');
   if(client!==sharedClient||(sharedLocked&&(!client||navigator.onLine===false)))throw Error('Reconnect and reopen this trolley before detaching it.');
   const groups=client?await client.loadCollections():state;
   if(client!==sharedClient)throw Error('Workspace changed. Reconnect to check assignments.');
   const links=groups.collectionTrolleys.filter(row=>row.trolleyId===id&&row.sessionId);
   if(links.length>1)throw Error('This trolley has conflicting collection assignments. Review Manage collection trolleys.');
   const owner=links[0]?.sessionId,session=groups.collectionSessions.find(row=>row.id===owner);
   if(owner&&!session)throw Error('The collection is unavailable. Refresh collections before detaching.');
   const remaining=groups.collectionTrolleys.filter(row=>row.sessionId===owner&&row.trolleyId!==id).map(row=>row.trolleyId);
   const updated=owner?(client?await client.writeSession(session,remaining,client.sessionVersionFor(owner)):assignCollection(groups.collectionSessions,groups.collectionTrolleys,session,remaining,state.trolleys)):groups;
   if(client!==sharedClient)throw Error('Workspace changed after detaching. Reconnect to retrieve confirmed assignments.');
   const collectionScans=structuredClone(state.collectionScans||{}),checkpoint=collectionScans[owner];
   if(checkpoint?.activeTrolleyId===id){checkpoint.activeTrolleyId='';checkpoint.defaults.trolley='';}
   const clearActive=owner&&state.activeCollectionId===owner&&state.activeTrolleyId===id;
   commitTrolleyWorkspace({...state,collectionSessions:updated.collectionSessions,collectionTrolleys:updated.collectionTrolleys,collectionScans,...(clearActive?{activeTrolleyId:'',defaults:{...state.defaults,trolley:''}}:{})});
   updateCollections();detach.hidden=true;output.textContent=owner?`Detached from ${session.name}. The trolley and equipment are unchanged. Click Delete trolley to retry deletion.`:'This trolley is already detached. Click Delete trolley to retry deletion.';
  }catch(error){output.textContent=`Trolley not detached. ${firebaseErrorMessage(error)}`;}
  finally{busy=false;button.disabled=!valid();cancel.disabled=false;detach.disabled=false;}
 };
 const valid=()=>text.value==='DELETE'&&ack.checked;
 form.oninput=()=>{button.disabled=busy||!valid();};cancel.onclick=()=>{dialog.close();openTrolleyManager();};dialog.oncancel=event=>{if(busy)event.preventDefault();};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!valid())return;busy=true;button.disabled=true;cancel.disabled=true;output.textContent='Deleting trolley…';
  try {
   if(saving||rescan.busy)throw Error('Wait for the pending equipment save or move to finish before deleting a trolley.');
   if(client!==sharedClient||(sharedLocked&&(!client||connectionPhase!=='connected'||navigator.onLine===false)))throw Error('Reconnect before deleting a shared trolley.');
   if(client)await client.deleteTrolley(id,version);else removeTrolley(state,id);
   if(client!==sharedClient)throw Error('Workspace changed. Reconnect to confirm deletion.');
   // A live snapshot may already have removed the confirmed trolley.
   const next=reconcileTrolleySelection(state,state.trolleys.filter(row=>row.id!==id));commitTrolleyWorkspace(next);
   if(trolleyViewId===id){trolleyViewId='';location.hash='inventory';}resetRescan();dialog.close();notice=`Deleted ${trolley.name}. Equipment and shared audit history are preserved.`;render();openTrolleyManager();
  }catch(error){output.textContent=`Trolley not deleted. ${error.code==='permission-denied'?'An administrator must publish the latest Firestore rules from Database before shared trolley deletion is available. ':''}${firebaseErrorMessage(error)}`;busy=false;button.disabled=!valid();cancel.disabled=false;if(/Detach this trolley/.test(error.message))detach.hidden=false;}
 };
}
async function openReadiness(id) {
 const session=++readinessSession,client=sharedClient,dialog=document.querySelector('#trolley-manager');
 let trolley=state.trolleys.find(t=>t.id===id),register=state.items,version=client?.trolleyVersionFor(id)||0;
 dialog.innerHTML='<h2>Collection readiness</h2><p>Checking the equipment register…</p><p id="readiness-error" role="alert"></p><button class="secondary" id="close-readiness">Back to trolleys</button>';
 dialog.showModal();dialog.querySelector('#close-readiness').onclick=()=>{dialog.close();openTrolleyManager();};
 try {
  if(sharedLocked&&!client)throw Error('Reconnect to Firebase before reviewing shared readiness.');
  if(client){const snapshot=await client.readinessSnapshot(id);trolley=snapshot.trolley;register=snapshot.items;version=snapshot.version;}
  if(session!==readinessSession||client!==sharedClient||!dialog.open)return;
  if(!trolley||trolley.status==='collected')throw Error('This trolley has already been collected or is unavailable.');
  if(client){state.items=register;state.trolleys=state.trolleys.map(t=>t.id===id?trolley:t);persist();updateRegister();updateHistory();}
  const review=checkReadiness(trolley,register,{shared:Boolean(client)}),fingerprint=JSON.stringify(register);
  const itemVersions=new Map(review.items.map(item=>[item.id,client?.versionFor(item.id)||0]));
  const affected=review.items.filter(item=>review.issues.some(issue=>issue.itemId===item.id));
  dialog.innerHTML=`<div class="eyebrow">COLLECTION CONTROL</div><h2>Collection readiness</h2><p>${escape(trolley.name)} · ${escape(trolley.reference)}</p><div class="readiness-summary ${review.canReady?'clear':'attention'}"><strong>${review.items.length} item${review.items.length===1?'':'s'} · ${review.unresolved.length} unresolved issue${review.unresolved.length===1?'':'s'}</strong><p>${!review.items.length?'Add equipment before marking this trolley ready.':review.canReady?'The records are ready for a final physical check.':'Correct duplicates and unchecked suggestions. Explain unavailable details below.'}</p></div>${trolley.status==='ready'?`<p>Ready since ${escape(new Date(trolley.readyAt).toLocaleString('en-GB',{timeZone:'Europe/London'}))} · ${escape(trolley.readyBy)}. Reopen the trolley to change its records.</p>`:''}<div class="readiness-list">${affected.map(item=>{
   const issues=review.issues.filter(issue=>issue.itemId===item.id);
   return `<article class="readiness-card" data-readiness-item="${escape(item.id)}"><h3>Item ${review.items.indexOf(item)+1} · ${escape(item.serial)} · ${escape(item.model)}</h3><p>${escape(item.manufacturer)} · Asset ${escape(item.asset)}</p><ul>${issues.map(issue=>`<li>${escape(issue.message)}${issue.kind==='duplicate'?`<span>Also recorded in ${escape([...new Set(register.filter(row=>issue.otherIds.includes(row.id)).map(row=>row.trolley))].join(', '))}</span>`:''}${issue.resolved?'<span>Reason recorded</span>':''}</li>`).join('')}</ul>${trolley.status==='open'?`<form data-review-notes="${escape(item.id)}">${issues.filter(issue=>issue.kind==='missing').map(issue=>`<label for="note-${escape(item.id)}-${issue.field}">Why is ${issue.field==='serial'?'the serial number':issue.field} unavailable?</label><textarea id="note-${escape(item.id)}-${issue.field}" name="${issue.field}" maxlength="500" rows="2" placeholder="e.g. Label missing; checked casing and base">${escape(issue.note)}</textarea>`).join('')}${issues.some(issue=>issue.kind==='recognition')?`<label class="review-check"><input type="checkbox" name="confirmed"> I checked the model and manufacturer against this equipment.</label>`:''}${issues.some(issue=>['missing','recognition'].includes(issue.kind))?'<button class="secondary">Save review notes</button>':''}<p class="review-error" role="alert"></p></form><button class="text-button" data-fix-item="${escape(item.id)}">Edit equipment record</button>`:''}</article>`;
  }).join('')}</div>${!affected.length&&review.items.length?'<p class="readiness-clear">No missing details, duplicates or unchecked suggestions found.</p>':''}<form id="mark-ready-form" class="readiness-footer">${trolley.status==='open'?`${review.canReady?'<label class="review-check"><input type="checkbox" id="ready-confirm" required> I checked these items and any recorded exceptions before collection.</label>':'<p>Resolve the issues above before confirming the trolley.</p>'}<button class="primary wide" ${!review.canReady?'disabled':''}>Mark ready for collection</button>`:''}<p id="readiness-error" role="alert"></p><button class="secondary wide" type="button" id="close-readiness">Back to trolleys</button></form>`;
  dialog.querySelector('#close-readiness').onclick=()=>{dialog.close();openTrolleyManager();};
  const reviewWritable=output=>{
   if(client!==sharedClient||(sharedLocked&&(!client||navigator.onLine===false))){output.textContent='Reconnect to Firebase before saving this review. Your entered notes stay here.';return false;}
   return true;
  };
  dialog.querySelectorAll('[data-fix-item]').forEach(button=>button.onclick=()=>{readinessSession++;dialog.close();openEditor(button.dataset.fixItem);});
  dialog.querySelectorAll('[data-review-notes]').forEach(form=>form.onsubmit=async e=>{
   e.preventDefault();
   const original=review.items.find(item=>item.id===form.dataset.reviewNotes),error=form.querySelector('.review-error'),button=form.querySelector('button');
   if(!reviewWritable(error))return;
   button.disabled=true;
   try {
    const data=new FormData(form),notes={...original.readinessNotes};
    for(const field of readinessFields)if(data.has(field))notes[field]=data.get(field);
    const updated={...original,readinessNotes:validateReadinessNotes(notes),...(form.querySelector('[name=confirmed]')?{recognitionConfirmed:data.get('confirmed')==='on'}:{})};
    if(client)await client.write(updated,itemVersions.get(original.id));
    else if(JSON.stringify(state.items.find(item=>item.id===original.id))!==JSON.stringify(original))throw Error('This record changed. Reopen the review.');
    if(client!==sharedClient)throw Error('Workspace changed. Reconnect to see the saved review.');
    commitTrolleyWorkspace({...state,items:state.items.map(item=>item.id===updated.id?updated:item)});
    if(session===readinessSession&&dialog.open)await openReadiness(id);
   }catch(failure){error.textContent=firebaseErrorMessage(failure);button.disabled=false;}
  });
  dialog.querySelector('#mark-ready-form').onsubmit=async e=>{
   e.preventDefault();
   const output=dialog.querySelector('#readiness-error'),button=e.target.querySelector('.primary');
   if(!reviewWritable(output))return;
   if(!review.canReady||!button||!dialog.querySelector('#ready-confirm')?.checked)return;
   button.disabled=true;
   try {
    if(session!==readinessSession||client!==sharedClient)throw Error('Workspace changed. Reopen readiness checks.');
    if(!client&&(JSON.stringify(state.items)!==fingerprint||state.trolleys.find(t=>t.id===id)?.status!=='open'))throw Error('The register changed. Reopen readiness checks.');
    const updated={...trolley,status:'ready',readyAt:new Date().toISOString(),readyBy:client?.profile.code||state.active};
    if(client)await client.writeTrolley(updated,version);
    if(client!==sharedClient)throw Error('Workspace changed. Reconnect to see the readiness status.');
    commitTrolleyWorkspace({...state,trolleys:state.trolleys.map(t=>t.id===id?updated:t)});
    dialog.close();openTrolleyManager();document.querySelector('#trolley-manager-error').textContent='Trolley ready for collection. Print its PDF manifest for handover. Reopen it to change equipment.';
   }catch(failure){output.textContent=firebaseErrorMessage(failure);button.disabled=false;}
  };
 }catch(error){if(session===readinessSession&&dialog.open)dialog.querySelector('#readiness-error').textContent=firebaseErrorMessage(error);}
}
function openTrolleyDetails(id,collecting) {
 readinessSession++;
 const trolley=state.trolleys.find(t=>t.id===id),expectedVersion=sharedClient?.trolleyVersionFor(id)||0,dialog=document.querySelector('#trolley-manager');
 dialog.innerHTML=`<form id="trolley-details-form"><div class="eyebrow">${escape(trolley.reference)}</div><h2>${collecting?'Mark trolley collected':'Edit trolley'}</h2><p>${escape(trolley.name)} · ${state.items.filter(item=>trolleyForItem(item,trolley)).length} items</p>${collecting?'<p>Collection locks this trolley against new equipment and retains its inventory.</p><label for="collection-company">Decommission company</label><input id="collection-company" name="company" required maxlength="100" placeholder="Company collecting this trolley">':`<label for="edit-trolley-name">Trolley name</label><input id="edit-trolley-name" name="name" required maxlength="80" value="${escape(trolley.name)}"><p>The permanent reference and barcode stay the same.</p><label for="edit-trolley-department">Owning department</label><input id="edit-trolley-department" name="department" required maxlength="100" value="${escape(trolley.department)}">`}<p id="trolley-manager-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-trolley-details">Cancel</button><button class="primary">${collecting?'Confirm collection':'Save trolley'}</button></div></form>`;
 document.querySelector('#cancel-trolley-details').onclick=()=>{dialog.close();openTrolleyManager();};
 document.querySelector('#trolley-details-form').onsubmit=async e=>{
  e.preventDefault();if(!writable())return;const button=e.target.querySelector('.primary');button.disabled=true;
  try{
   const client=sharedClient,data=new FormData(e.target);
   const name=collecting?trolley.name:data.get('name').trim();
   if(!name)throw Error('Enter a trolley name.');
   if(!collecting&&trolley.status!=='open')throw Error('Reopen this trolley before renaming it.');
   if(!collecting){const records=client?await client.load():state;if(client!==sharedClient)throw Error('Workspace changed. Reopen trolley management.');if(records.trolleys.some(row=>row.id!==id&&trolleyNameKey(row.name)===trolleyNameKey(name)))throw Error('A trolley already uses that name. Choose a distinct name.');if(name!==trolley.name&&records.items.some(item=>!item.trolleyId&&item.trolley===trolley.name)&&(client||records.trolleys.filter(row=>row.name===trolley.name).length>1))throw Error('Assign legacy equipment to this permanent trolley reference before renaming it.');}
   if(collecting&&(trolley.status!=='ready'||!checkReadiness(trolley,state.items,{shared:Boolean(sharedClient)}).canReady))throw Error('Run readiness checks and resolve all issues before collection.');
   const updated=collecting?{...trolley,status:'collected',company:data.get('company').trim(),collectedAt:new Date().toISOString(),collectedBy:sharedClient?.profile.code||state.active}:{...trolley,name,department:data.get('department').trim()};
   if(client)await client.writeTrolley(updated,expectedVersion);
   if(client!==sharedClient)throw Error('Workspace changed. Reconnect to confirm the trolley update.');
   const trolleys=state.trolleys.map(row=>row.id===id?updated:row),defaults={...state.defaults};
   let activeTrolleyId=state.activeTrolleyId;
   if(collecting&&(activeTrolleyId===trolley.id||(!activeTrolleyId&&defaults.trolley===trolley.name))){const next=trolleys.find(row=>row.status==='open');defaults.trolley=next?.name||'';activeTrolleyId=next?.id||'';}
   if(!collecting){if(activeTrolleyId===id||(!activeTrolleyId&&defaults.trolley===trolley.name))defaults.trolley=updated.name;}
   const items=state.items.map(item=>!collecting&&trolleyForItem(item,trolley)?{...item,trolley:updated.name,trolleyId:id}:item);
   commitTrolleyWorkspace({...state,trolleys,items,defaults,activeTrolleyId});syncTrolleyNames();persist();dialog.close();notice=collecting?'Trolley marked collected. Its inventory and reference are retained.':'Trolley details updated. Its permanent reference is unchanged.';render();
  }catch(error){document.querySelector('#trolley-manager-error').textContent=firebaseErrorMessage(error);button.disabled=false;}
 };
}
function refreshVoiceChoices(preferred) {
 const select=document.querySelector('#speech-voice');if(!select)return;
 const selected=preferred??select.value,voices=availableVoices();
 select.innerHTML=`<option value="">Automatic · prefer British English</option>${voices.map(v=>`<option value="${escape(v.voiceURI)}">${escape(v.name)} · ${escape(v.lang)}${v.localService?' · on device':' · browser service'}</option>`).join('')}`;
 if(selected&&!voices.some(v=>v.voiceURI===selected))select.insertAdjacentHTML('beforeend',`<option value="${escape(selected)}">Saved voice unavailable · automatic fallback</option>`);
 select.value=selected;updateVoiceInfo();
}
function updateVoiceInfo() {
 const select=document.querySelector('#speech-voice'),info=document.querySelector('#voice-info');if(!select||!info)return;
 const voices=availableVoices(),voice=voices.find(v=>v.voiceURI===select.value);
 if(!('speechSynthesis' in window)){info.textContent='Speech is unavailable in this browser. Scanning still works.';return;}
 if(select.value&&!voice){info.textContent='Your saved voice is unavailable on this device. Prompts use an available English voice until it returns.';return;}
 if(voice)info.textContent=`${voice.localService?'This voice runs on your device.':'This browser-provided voice may need Internet access.'} No Google Cloud account or API key is used.`;
 else info.textContent=`${voices.some(v=>/google/i.test(v.name))?'Google-labelled voices are available in this browser. Choose one above.':'No Google-labelled voices are currently available here. Try Chrome on your work device; voices depend on the browser and operating system.'} Automatic prefers British English, then another English voice.`;
}
window.speechSynthesis?.addEventListener?.('voiceschanged',()=>refreshVoiceChoices());
function baseReferenceFacts(){return [...builtInReferences,...state.referenceExamples,...state.items.map(row=>({...row,source:'Saved equipment'}))];}
function lookupSerial(serial){return lookupReference(serial,baseReferenceFacts(),state.referenceCorrections||[]);}
function recognitionEvidenceCard() {
 const evidence=state.draft.recognitionEvidence;if(!evidence)return '';
 const corrected=state.draft.recognitionCorrected,title=corrected?(state.draft.recognitionConfirmed?'Corrected after a label check':'Edited suggestion details'):evidence.method==='exact'?'Exact serial match':evidence.method==='similar'?'Serial family suggestion':evidence.method==='pattern'?'Serial prefix suggestion':evidence.manufacturer?'Manufacturer-only suggestion':'Conflicting reference details';
 const uncertainty=corrected?(state.draft.recognitionConfirmed?'Model and manufacturer checked by you.':'Edited details need a fresh label check.'):evidence.method==='exact'?'Known reference; check the physical label.':evidence.method==='conflict'?(evidence.manufacturer?'Manufacturer inferred; model uncertain.':'Manufacturer and model uncertain.'):'Manufacturer and model inferred; label check required.';
 return `<section class="recognition-evidence" aria-label="Recognition evidence"><div class="eyebrow">${corrected?'ORIGINAL SUGGESTION EVIDENCE':'WHY THESE DETAILS?'}</div><h3>${escape(title)}</h3><p id="recognition-certainty">${escape(uncertainty)}</p>${corrected?`<p>Original suggestion: ${escape(evidence.model||'Model uncertain')} · ${escape(evidence.manufacturer||'Manufacturer uncertain')}</p><p>Using: <strong>${escape(state.draft.model)} · ${escape(state.draft.manufacturer)}</strong></p>`:''}<dl><div><dt>${evidence.suffix?(evidence.format?'Matching format and ending':'Matching ending'):evidence.prefix?'Matching prefix':'Matching serial'}</dt><dd>${escape(evidence.suffix?evidence.format?`${evidence.format} · ends ${evidence.suffix}`:`Ends ${evidence.suffix}`:evidence.prefix||state.draft.serial)}</dd></div><div><dt>Supporting examples</dt><dd>${evidence.support} distinct serial${evidence.support===1?'':'s'}</dd></div><div><dt>Sources</dt><dd>${sourceKinds(evidence.sources).map(escape).join(' · ')}</dd></div></dl>${evidence.referenceSerials.length?`<p>Nearby reference: ${evidence.referenceSerials.map(escape).join(', ')}</p>`:''}<details><summary>Source details</summary>${evidence.sources.map(source=>`<p>${escape(source)}</p>`).join('')}${evidence.sourceCount>evidence.sources.length?`<p>And ${evidence.sourceCount-evidence.sources.length} more sources.</p>`:''}</details><button id="reject-suggestion" class="secondary">${corrected?'Edit checked details':'This suggestion is wrong'}</button></section>`;
}
function openScanCorrection() {
 if(!state.draft.recognitionEvidence||!writable())return;
 const serial=state.draft.serial,client=sharedClient,remember=canEditReferences(),version=remember?(client?.correctionVersionFor(serial)||0):0,dialog=document.querySelector('#scan-correction-dialog');
 dialog.innerHTML=`<form id="scan-correction-form"><div class="eyebrow">CHECK THE EQUIPMENT LABEL</div><h2>Correct this suggestion</h2><p>Correct the scanned serial ${escape(serial)}. Your other captured fields stay intact. This does not change other equipment records.</p><label for="scan-corrected-model">Checked model</label><input id="scan-corrected-model" name="model" required maxlength="1000" value="${state.draft.recognitionCorrected?escape(state.draft.model):''}"><label for="scan-corrected-maker">Checked manufacturer</label><input id="scan-corrected-maker" name="manufacturer" required maxlength="1000" value="${escape(state.draft.manufacturer||'')}"><label for="scan-correction-note">Reason for correction</label><input id="scan-correction-note" name="note" maxlength="500" placeholder="e.g. Model verified on the label"><label class="toggle-label"><input id="remember-scan-correction" name="remember" type="checkbox" ${remember?'checked':'disabled'}> Save a reviewed reference for future scans</label><p>${remember?'The reviewed reference affects this serial and future pattern training. Original evidence stays in the library.':'Your checked equipment record will teach the team when you save the item. A team administrator can publish a reviewed reference.'}</p><label class="toggle-label"><input id="checked-scan-correction" name="checked" type="checkbox" required> I checked these corrected details against the equipment label.</label><p id="scan-correction-error" role="alert"></p><div class="dialog-actions"><button id="cancel-scan-correction" type="button" class="secondary">Cancel</button><button class="primary">Apply checked correction</button></div></form>`;
 dialog.showModal();const note=document.querySelector('#scan-correction-note'),rememberInput=document.querySelector('#remember-scan-correction');note.required=remember;
 rememberInput.onchange=()=>note.required=rememberInput.checked;
 document.querySelector('#cancel-scan-correction').onclick=()=>dialog.close();
 let busy=false;dialog.oncancel=e=>{if(busy)e.preventDefault();};
 document.querySelector('#scan-correction-form').onsubmit=async e=>{
  e.preventDefault();if(busy||!writable())return;const button=e.target.querySelector('.primary');
  try{
   if(client!==sharedClient||state.draft.serial!==serial)throw Error('The workspace or current serial changed. Reopen this correction.');
   const data=new FormData(e.target),correction=validateCorrections([{serial,mode:'corrected',model:data.get('model'),manufacturer:data.get('manufacturer'),note:data.get('note')||'Checked the equipment label'}])[0];
   const saveReference=rememberInput.checked;if(saveReference&&!canEditReferences())throw Error('Only an administrator can change shared reviewed references.');
   busy=true;button.disabled=true;document.querySelector('#cancel-scan-correction').disabled=true;dialog.querySelectorAll('input').forEach(input=>input.disabled=true);
   if(saveReference&&client)await client.writeCorrection(correction,version);
   if(client!==sharedClient||state.draft.serial!==serial)throw Error('The connection or current item changed. Reconnect before applying this correction.');
   const draft={...state.draft,model:correction.model,manufacturer:correction.manufacturer,recognitionNeedsReview:true,recognitionConfirmed:true,recognitionCorrected:true};
   updateEquipmentDescription(draft);
   const next={...state,draft,step:Math.max(2,state.step),referenceCorrections:saveReference?[...(state.referenceCorrections||[]).filter(row=>row.serial!==correction.serial),correction]:state.referenceCorrections};
   if(!client){if(storageError)throw Error('Browser storage is paused. Back up the workspace before correcting.');localStorage.setItem(key,JSON.stringify(next));}
   state=next;if(client)persist();dialog.close();notice=saveReference?'Checked correction applied and saved to the reference library.':'Checked correction applied to this item. Save the equipment to teach future scans.';render();prompt();
  }catch(error){document.querySelector('#scan-correction-error').textContent=firebaseErrorMessage(error);}
  finally{busy=false;button.disabled=false;dialog.querySelectorAll('input').forEach(input=>input.disabled=input.id==='remember-scan-correction'&&!remember);document.querySelector('#cancel-scan-correction')?.removeAttribute('disabled');}
 };
}
function canEditReferences(){return !sharedLocked||sharedClient?.role==='admin';}
function openReferenceLibrary() {
 const dialog=document.querySelector('#reference-library-dialog');
 dialog.innerHTML=`<div class="eyebrow">RECOGNITION KNOWLEDGE</div><h2>Reference library</h2><p>Review spreadsheet facts and learned equipment. Corrections affect future recognition; equipment history stays as recorded.</p>${!canEditReferences()?'<p class="note">Your team administrator can correct shared references. You can search and review them here.</p>':''}<label for="library-search">Search reference library</label><input id="library-search" type="search" value="${escape(librarySearch)}" placeholder="Serial, prefix, model, manufacturer or source…"><label for="library-filter">Show references</label><select id="library-filter"><option value="all">All references</option><option value="conflict">Conflicting serials</option><option value="corrected">Reviewed corrections</option><option value="excluded">Excluded from recognition</option></select><p id="library-count" aria-live="polite"></p><div id="library-results"></div><p id="library-error" role="alert"></p><div class="dialog-actions"><button class="secondary" id="close-library">Close</button><button class="primary" id="add-library-reference" ${!canEditReferences()?'disabled':''}>Add checked reference</button></div>`;
 dialog.showModal();document.querySelector('#library-filter').value=libraryFilter;
 document.querySelector('#library-search').oninput=e=>{librarySearch=e.target.value;libraryLimit=40;updateReferenceLibrary();};
 document.querySelector('#library-filter').onchange=e=>{libraryFilter=e.target.value;libraryLimit=40;updateReferenceLibrary();};
 document.querySelector('#close-library').onclick=()=>dialog.close();document.querySelector('#add-library-reference').onclick=()=>openReferenceEditor('');updateReferenceLibrary();
}
function updateReferenceLibrary() {
 const results=document.querySelector('#library-results');if(!results)return;
 const rows=libraryRows(baseReferenceFacts(),state.referenceCorrections||[]),terms=librarySearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const matches=rows.filter(row=>(libraryFilter==='all'||row.status===libraryFilter)&&terms.every(term=>[row.serial,...row.originals.flatMap(f=>[f.model,f.manufacturer,f.source]),row.correction?.model,row.correction?.manufacturer,row.correction?.note].join(' ').toLowerCase().includes(term)));
 document.querySelector('#library-count').textContent=`Showing ${Math.min(matches.length,libraryLimit)} of ${matches.length} serials · ${rows.filter(row=>row.status==='conflict').length} conflicting serials`;
 const statusText={ready:'Ready',conflict:'Conflicting facts',corrected:'Reviewed correction',excluded:'Excluded'};
 results.innerHTML=matches.slice(0,libraryLimit).map(row=>`<article class="reference-card"><div class="section-top"><strong>${escape(row.serial)}</strong><span class="tag ${row.status==='conflict'?'reference-conflict':''}">${statusText[row.status]}</span></div><p>${row.status==='excluded'?'Excluded from exact lookup and pattern training.':row.effective.map(f=>`${escape(f.model)} · ${escape(f.manufacturer)}`).join('<br>')||'No usable original facts.'}</p>${row.correction?`<p class="reference-note">Review note: ${escape(row.correction.note)}</p>`:''}<details><summary>Original evidence (${row.originals.length} model/manufacturer fact${row.originals.length===1?'':'s'})</summary>${row.originals.map(f=>`<p>${escape(f.model)} · ${escape(f.manufacturer)}<br><small>${escape(f.source)}</small></p>`).join('')||'<p>No original spreadsheet or equipment fact.</p>'}</details><button class="secondary" data-reference-edit="${escape(row.serial)}" ${!canEditReferences()?'disabled':''}>Review reference</button></article>`).join('')||'<p>No references match this search.</p>';
 if(matches.length>libraryLimit)results.insertAdjacentHTML('beforeend','<button class="secondary wide" id="more-references">Show more references</button>');document.querySelector('#more-references')?.addEventListener('click',()=>{libraryLimit+=40;updateReferenceLibrary();});
 results.querySelectorAll('[data-reference-edit]').forEach(button=>button.onclick=()=>openReferenceEditor(button.dataset.referenceEdit));
}
function openReferenceEditor(serial) {
 if(!canEditReferences()||!writable())return;
 const row=libraryRows(baseReferenceFacts(),state.referenceCorrections||[]).find(row=>row.serial===serial),initial=row?.effective.length===1?row.effective[0]:null,mode=row?.correction?.mode||'corrected',version=sharedClient?.correctionVersionFor(serial)||0;
 document.querySelector('#reference-library-dialog').close();const dialog=document.querySelector('#reference-edit-dialog');
 dialog.innerHTML=`<form id="reference-edit-form"><div class="eyebrow">CHECK AGAINST THE EQUIPMENT LABEL</div><h2>${serial?'Review reference':'Add checked reference'}</h2><p>This affects future serial recognition and pattern training. Existing equipment records are preserved.</p><label for="reference-serial">Serial number</label><input id="reference-serial" name="serial" required maxlength="200" value="${escape(serial)}" ${serial?'readonly':''}><label for="reference-mode">Recognition action</label><select id="reference-mode" name="mode"><option value="corrected">Use checked model and manufacturer</option><option value="excluded">Exclude this serial from recognition</option><option value="original">Restore original evidence</option></select><label for="reference-model">Checked model</label><input id="reference-model" name="model" maxlength="1000" value="${escape(initial?.model||'')}"><label for="reference-manufacturer">Checked manufacturer</label><input id="reference-manufacturer" name="manufacturer" maxlength="1000" value="${escape(initial?.manufacturer||'')}"><label for="reference-note">Reason for this review</label><input id="reference-note" name="note" required maxlength="500" placeholder="e.g. Checked model on the equipment label" value="${escape(row?.correction?.note||'')}"><p id="reference-edit-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-reference-edit">Cancel</button><button class="primary">Save reference review</button></div></form>`;
 dialog.showModal();const select=document.querySelector('#reference-mode');select.value=mode;
 const adjust=()=>{for(const id of ['#reference-model','#reference-manufacturer']){const input=document.querySelector(id);input.required=select.value==='corrected';input.disabled=select.value!=='corrected';}};select.onchange=adjust;adjust();
 document.querySelector('#cancel-reference-edit').onclick=()=>{dialog.close();openReferenceLibrary();};
 document.querySelector('#reference-edit-form').onsubmit=async e=>{
  e.preventDefault();if(!canEditReferences()||!writable())return;const button=e.target.querySelector('.primary');button.disabled=true;
  try{const data=new FormData(e.target),correction=validateCorrections([{serial:data.get('serial'),mode:data.get('mode'),model:data.get('model')||'',manufacturer:data.get('manufacturer')||'',note:data.get('note')}])[0];
   const existing=(state.referenceCorrections||[]).find(row=>row.serial===correction.serial);if(!serial&&existing)throw Error('A review already exists for this serial. Search for it and use Review reference.');
   if(sharedClient)await sharedClient.writeCorrection(correction,version);
   const next={...state,referenceCorrections:[...(state.referenceCorrections||[]).filter(row=>row.serial!==correction.serial),correction]};if(!sharedClient){if(storageError)throw Error('Browser storage is paused. Back up your workspace before continuing.');localStorage.setItem(key,JSON.stringify(next));}state=next;if(sharedClient)persist();dialog.close();openReferenceLibrary();document.querySelector('#library-error').textContent='Reference review saved. It applies to the next serial lookup; rescan a captured serial to use it on your current item.';
  }catch(error){document.querySelector('#reference-edit-error').textContent=firebaseErrorMessage(error);button.disabled=false;}
 };
}
async function openDescriptionReview() {
 const dialog=document.querySelector('#description-review-dialog'),client=sharedClient,workspaceKey=key;
 if(sharedLocked&&(!client||client.role!=='admin')){notice='Sign in as a team administrator to review shared equipment descriptions.';render();return;}
 let busy=false,rows=[],versions=new Map();
 const validContext=()=>client===sharedClient&&workspaceKey===key&&(!sharedLocked||Boolean(client));
 dialog.innerHTML=`<div class="eyebrow">EXISTING EQUIPMENT</div><h2>Review saved equipment descriptions</h2><p>Check each proposed change against the equipment. Only the description changes; serial, model, manufacturer, asset, barcode, trolley and disposal details stay as recorded.</p><p>Ready or collected trolleys remain locked. Reopen a ready trolley to correct its items.</p><div id="description-preview"></div><p id="description-review-result" role="status"></p><div class="dialog-actions"><button class="secondary" id="close-description-review">Close</button><button class="secondary" id="refresh-description-review">Refresh suggestions</button><button class="primary" id="apply-description-review" disabled>Update selected descriptions</button></div>`;
 dialog.showModal();dialog.oncancel=e=>{if(busy)e.preventDefault();};
 const output=dialog.querySelector('#description-review-result'),button=dialog.querySelector('#apply-description-review'),close=dialog.querySelector('#close-description-review'),refresh=dialog.querySelector('#refresh-description-review');
 const controls=disabled=>{button.disabled=disabled||!dialog.querySelector('[data-description-id]:checked');close.disabled=disabled;refresh.disabled=disabled;dialog.querySelectorAll('[data-description-id]').forEach(input=>input.disabled=disabled);};
 close.onclick=()=>{if(!busy){dialog.close();render();}};
 async function preview(){
  if(busy)return;busy=true;controls(true);output.textContent='Checking saved equipment…';
  try{
   if(!validContext())throw Error('Workspace changed. Close this review and reconnect.');
   const records=client?await client.load():state;
   if(!validContext())throw Error('Workspace changed. Close this review and reconnect.');
   const exclusions=new Set((records.corrections||state.referenceCorrections||[]).filter(row=>row.mode!=='original').map(row=>row.serial.toUpperCase()));
   const facts=[...builtInReferences,...(records.examples||state.referenceExamples),...records.items.map(row=>({...row,source:'Saved equipment'}))].filter(row=>!exclusions.has(String(row.serial).toUpperCase()));
   const plan=equipmentDescriptionPlan(records.items,records.trolleys,facts);rows=plan.changes;versions=new Map(rows.map(row=>[row.before.id,client?.versionFor(row.before.id)||0]));
   dialog.querySelector('#description-preview').innerHTML=rows.map(row=>`<label class="review-check"><input type="checkbox" data-description-id="${escape(row.before.id)}" ${row.selected?'checked':''}><span><strong>${escape(row.before.serial)}</strong> · ${escape(row.before.model)} · ${escape(row.before.manufacturer)}<br>${escape(row.before.description)} → <strong>${escape(row.after.description)}</strong><br><small>${escape(row.before.trolley)}</small></span></label>`).join('')||'<p>No supported description changes found.</p>';
   output.textContent=`${rows.length} suggested changes. Skipped: ${plan.skipped.locked} locked or unassigned, ${plan.skipped.unknown} uncertain, ${plan.skipped.unchanged} already correct. Old Monitor defaults are selected; review other descriptions individually.`;
   dialog.querySelectorAll('[data-description-id]').forEach(input=>input.onchange=()=>controls(false));
  }catch(error){rows=[];dialog.querySelector('#description-preview').textContent='';output.textContent=firebaseErrorMessage(error);}
  finally{busy=false;controls(false);}
 }
 refresh.onclick=preview;
 button.onclick=async()=>{
  if(busy)return;
  const ids=new Set([...dialog.querySelectorAll('[data-description-id]:checked')].map(input=>input.dataset.descriptionId)),selected=rows.filter(row=>ids.has(row.before.id));if(!selected.length)return;
  busy=true;controls(true);let saved=0;const failures=[];
  try{
   if(!validContext()||localTabBlocked||(!client&&storageError)||(client&&navigator.onLine===false))throw Error('Saving is unavailable. Reconnect or back up your local workspace before continuing.');
   const records=client?await client.load():state;
   if(!validContext())throw Error('Workspace changed. Close this review and reconnect.');
   for(const row of selected){
    if(!sameRecord(records.items.find(item=>item.id===row.before.id),row.before)||(client&&client.versionFor(row.before.id)!==versions.get(row.before.id)))throw Error('Equipment changed after this preview. Refresh suggestions and review it again.');
    const trolley=records.trolleys.filter(t=>row.before.trolleyId?t.id===row.before.trolleyId:t.name===row.before.trolley);
    if(trolley.length!==1||trolley[0].status!=='open')throw Error('A trolley is now locked or unavailable. Refresh suggestions before updating.');
    if(client&&!row.before.trolleyId)throw Error('Assign legacy equipment to its permanent trolley reference before updating.');
   }
   if(!client){
    const updates=new Map(selected.map(row=>[row.before.id,row.after]));commitTrolleyWorkspace({...state,items:state.items.map(item=>updates.get(item.id)||item)});saved=selected.length;
   }else for(const row of selected){
    if(!validContext()||navigator.onLine===false){failures.push('Connection changed. Reconnect to retrieve confirmed records.');break;}
    output.textContent=`Updating ${saved+1} of ${selected.length} descriptions…`;
    try{
     await client.write(row.after,versions.get(row.before.id));saved++;
     if(!validContext()){failures.push('Workspace changed after a confirmed save. Reconnect to retrieve it.');break;}
     state.items=state.items.map(item=>item.id===row.before.id?row.after:item);persist();
     dialog.querySelectorAll('[data-description-id]').forEach(input=>{if(input.dataset.descriptionId===row.before.id){input.checked=false;input.closest('label').textContent=`${row.before.serial}: description updated to ${row.after.description}.`;}});
    }catch(error){failures.push(`${row.before.serial}: ${firebaseErrorMessage(error)}`);}
   }
   if(validContext()){
    updateRegister();updateHistory();
    if(!failures.length){dialog.querySelector('#description-preview').textContent='';output.textContent=`${saved} equipment descriptions updated. All other item details and your unfinished scan were preserved. Refresh suggestions to check remaining items.`;}
    else output.textContent=`${saved} descriptions confirmed. ${failures.join(' ')} Refresh suggestions before retrying remaining items.`;
   }
  }catch(error){output.textContent=`Descriptions not updated. ${firebaseErrorMessage(error)}`;}
  finally{busy=false;controls(false);button.disabled=true;}
 };
 await preview();
}
function openSettings() {
 const settings=state.settings;
 const dialog=document.querySelector('#settings-dialog');
 dialog.innerHTML=`<form id="settings-form"><div class="eyebrow">YOUR SCAN STATION</div><h2>Make it work your way.</h2><p class="app-version">DecomPro ${escape(versionLabel)}</p><p>Scanner settings are included in workspace backups. Security, appearance and dashboard choices stay on this device.</p><div class="settings-section"><h3>${icon('shield')} Device security</h3><label for="idle-minutes">Lock after inactivity</label><select id="idle-minutes" name="idleMinutes">${[5,10,15,30,0].map(minutes=>`<option value="${minutes}" ${minutes===devicePreferences.idleMinutes?'selected':''}>${minutes===0?'Never':`${minutes} minutes`}</option>`).join('')}</select><label class="toggle-label"><input type="checkbox" name="remember" ${devicePreferences.remember?'checked':''}> Remember me on this trusted device</label><p>Choose when shared team workspaces lock automatically, or select Never to disable the inactivity timeout. Leave Remember me off on shared computers. Locking requires your password again and keeps unfinished scans.</p>${sharedClient?'<button type="button" class="secondary" id="settings-lock">Lock workspace now</button><button type="button" class="text-button" id="settings-signout">Sign out & return to local workspace</button>':'<p>Connect to Firebase to use workspace locking.</p>'}</div><div class="settings-section"><h3>${icon('dashboard')} Dashboard layout</h3><label class="toggle-label"><input type="checkbox" name="showDailyProgress" ${devicePreferences.showDailyProgress?'checked':''}> Show daily progress on the overview</label><label class="toggle-label"><input type="checkbox" name="showCollections" ${devicePreferences.showCollections?'checked':''}> Show collection management on the overview</label><p>Collections remain available in the navigation. Trolley details expand when you need them.</p></div><div class="settings-section"><h3>${icon('settings')} Workspace tools</h3><div class="settings-tool-grid"><button type="button" class="secondary" data-settings-tool="database">${icon('database')} Database connection</button><button type="button" class="secondary" data-settings-tool="trolleys">${icon('trolley')} Manage trolleys</button><button type="button" class="secondary" data-settings-tool="import">Import equipment Excel</button><button type="button" class="secondary" data-settings-tool="backup">${icon('download')} Download backup</button><button type="button" class="secondary" data-settings-tool="restore">Restore backup</button></div></div><div class="settings-section"><h3>${icon('grid')} Test data</h3><p>96 synthetic items, eight trolleys, two collections and three test technicians. Includes missing details, duplicate labels, unchecked suggestions and collection history.</p><a class="secondary test-workspace-link" href="${escape(workspaceUrl(true))}" target="_blank" rel="noopener">Open test workspace</a>${testWorkspace?'<button type="button" class="secondary" id="reset-test-data">Reset synthetic data</button>':''}<p>The test register is separate from real records and cannot connect to Firebase. Your edits stay in this browser.</p></div><div class="settings-section appearance-section"><h3>${icon('grid')} Appearance</h3><label for="appearance-theme">Colour theme</label><select id="appearance-theme" name="appearance">${[['light','Light · clean and bright'],['dark','Dark · midnight blue'],['system','Follow device']].map(([value,label])=>`<option value="${value}" ${themePreference()===value?'selected':''}>${label}</option>`).join('')}</select><div class="theme-palette" aria-hidden="true"><span></span><span></span><span></span><span></span></div><p>Preview your theme here, then save settings. Appearance stays on this device and is separate from workspace backups.</p></div><div class="settings-section"><h3>${icon('voice')} Spoken prompts</h3><label class="toggle-label"><input type="checkbox" name="voice" ${state.voice?'checked':''}> Speak the next field</label><label for="speech-voice">Prompt voice</label><select id="speech-voice" name="voiceURI"></select><p id="voice-info" aria-live="polite"></p><label for="speech-rate">Speech speed <output id="rate-value">${settings.speechRate}×</output></label><input id="speech-rate" name="speechRate" type="range" min="0.6" max="1.5" step="0.01" value="${settings.speechRate}"><label for="speech-volume">Volume <output id="volume-value">${Math.round(settings.speechVolume*100)}%</output></label><input id="speech-volume" name="speechVolume" type="range" min="0" max="1" step="0.05" value="${settings.speechVolume}"><button type="button" class="secondary" id="test-voice">${icon('voice')} Test voice</button></div><div class="settings-section"><h3>${icon('box')} Model recognition</h3><p><strong>Serial recognition ready</strong> · ${builtInReferences.length} built-in spreadsheet references · ${state.referenceExamples.length} imported references. Saved records also contribute after technician review.</p><button type="button" class="secondary" id="manage-references">Manage reference library</button><button type="button" class="secondary" id="import-excel">Import reference spreadsheet</button><input id="reference-file" type="file" accept=".xlsx" class="sr-only" tabindex="-1" aria-label="Choose reference spreadsheet"><p>Each item starts with a serial lookup.</p><p>Known serials and consistent serial prefixes prefill model and manufacturer. Longer prefixes are checked before broad families. When a family agrees on the manufacturer but has different model labels, the manufacturer is filled and you supply the model. Conflicting manufacturers stay manual. All suggestions must be checked before saving.</p></div><div class="settings-section"><h3>${icon('barcode')} Scanner controls</h3><label for="skip-window">Double-Enter window</label><select name="skipWindow" id="skip-window">${[300,500,700,1000,1500].map(ms=>`<option value="${ms}" ${ms===settings.skipWindow?'selected':''}>${ms/1000} seconds${ms===700?' (default)':''}</option>`).join('')}</select><p>Two empty Enter presses inside this window fill N/A and advance the field.</p></div><div class="settings-section"><h3>${icon('box')} Identical equipment</h3><label class="toggle-label"><input type="checkbox" id="reuse-model" name="reuseModel" ${settings.reuseModel?'checked':''}> Use one model for this batch</label><label for="batch-model">Batch model number</label><input id="batch-model" name="batchModel" value="${escape(settings.batchModel)}" maxlength="1000" placeholder="e.g. P2419H" ${settings.reuseModel?'required':''}><p>Prefills Model and starts each new item at Serial number. Turn this off when equipment changes. Captured values for your current item stay in place.</p></div><div class="settings-section" id="app-build-info"><h3>About DecomPro</h3><p><strong>Version</strong> ${escape(buildInfo.version)}<br><strong>Build</strong> ${escape(buildInfo.number==='local'?'Local development build':buildInfo.number)}<br><strong>Commit</strong> ${escape(buildInfo.revision)}<br><strong>Built</strong> ${escape(buildTime)} (London)</p><p>These details identify the version loaded on this device. Include them when reporting an issue.</p></div><p id="settings-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-settings">Cancel</button><button class="primary">Save settings</button></div></form>`;
 dialog.showModal();
 dialog.onclose=()=>previewTheme();
 dialog.oncancel=()=>previewTheme();
 document.querySelector('#appearance-theme').onchange=e=>previewTheme(e.target.value);
 refreshVoiceChoices(settings.voiceURI);
 document.querySelector('#speech-voice').onchange=updateVoiceInfo;
 const repair=document.createElement('button');repair.type='button';repair.className='secondary';repair.id='review-equipment-descriptions';repair.textContent='Review saved equipment descriptions';repair.disabled=sharedLocked&&sharedClient?.role!=='admin';document.querySelector('#manage-references').after(repair);repair.onclick=()=>{dialog.close();openDescriptionReview();};
 document.querySelector('#manage-references').onclick=()=>{dialog.close();openReferenceLibrary();};
 document.querySelector('#import-excel').onclick=()=>document.querySelector('#reference-file').click();
 document.querySelector('#reference-file').onchange=importReference;
 document.querySelector('#cancel-settings').onclick=()=>dialog.close();
 document.querySelector('#reset-test-data')?.addEventListener('click',()=>{if(!confirm('Reset this test workspace to its original 96 synthetic records? Only test data will be replaced.'))return;try{const next=createTestWorkspace(today());localStorage.setItem(key,JSON.stringify(next));state=next;resetRescan();storageError='';pendingScan=null;search='';historySearch='';missingDetailsOnly=false;trolleyViewId='';selectedEquipment.clear();collectionReviewTrolley='all';collectionReviewKind='all';dashboardCollectionId='';dashboardStatus='all';collectionViewId=state.activeCollectionId;scanning=false;lastEmpty=0;location.hash='inventory';notice='Synthetic test data reset.';render();}catch(error){document.querySelector('#settings-error').textContent=`Test data was not reset. ${error.message}`;}});
 document.querySelector('#settings-lock')?.addEventListener('click',()=>lockWorkspace());
 document.querySelector('#settings-signout')?.addEventListener('click',()=>{dialog.close();disconnectDatabase();});
 dialog.querySelectorAll('[data-settings-tool]').forEach(button=>button.onclick=()=>{dialog.close();({database:openDatabase,trolleys:openTrolleyManager,import:openEquipmentWorkbook,backup:downloadBackup,restore:()=>document.querySelector('#backup-file').click()})[button.dataset.settingsTool]();});
 document.querySelector('#reuse-model').onchange=e=>document.querySelector('#batch-model').required=e.target.checked;
 document.querySelector('#speech-rate').oninput=e=>document.querySelector('#rate-value').textContent=`${e.target.value}×`;
 document.querySelector('#speech-volume').oninput=e=>document.querySelector('#volume-value').textContent=`${Math.round(e.target.value*100)}%`;
 document.querySelector('#test-voice').onclick=()=>{
  if(!('speechSynthesis' in window)){document.querySelector('#settings-error').textContent='Speech is unavailable in this browser. Scanning still works.';return;}
  speechSynthesis.cancel();const utterance=utteranceFor('Next, serial number.',{speechRate:Number(document.querySelector('#speech-rate').value),speechVolume:Number(document.querySelector('#speech-volume').value),voiceURI:document.querySelector('#speech-voice').value});speechSynthesis.speak(utterance);
 };
 document.querySelector('#settings-form').onsubmit=async e=>{
  e.preventDefault();const data=new FormData(e.target);
  const next={keepBatchDefaults:state.settings.keepBatchDefaults,keepFields:retentionSettings(state.settings),speechRate:Number(data.get('speechRate')),speechVolume:Number(data.get('speechVolume')),skipWindow:Number(data.get('skipWindow')),reuseModel:data.has('reuseModel'),batchModel:data.get('batchModel').trim(),voiceURI:data.get('voiceURI')||'',serialFirst:true};
  if(next.reuseModel&&!next.batchModel){document.querySelector('#settings-error').textContent='Enter a batch model or turn off the identical equipment setting.';return;}
  try{const preferences={idleMinutes:Number(data.get('idleMinutes')),remember:data.has('remember'),showDailyProgress:data.has('showDailyProgress'),showCollections:data.has('showCollections')};await sharedClient?.rememberDevice?.(preferences.remember);devicePreferences=saveDevicePreferences(preferences);saveTheme(data.get('appearance'));}catch{document.querySelector('#settings-error').textContent='Device settings could not be saved. Your equipment records are preserved.';return;}
  state.settings=next;state.voice=data.has('voice');lastEmpty=0;
  if(!Object.keys(state.draft).length&&state.step===0)resetDraft();
  if(!state.voice)window.speechSynthesis?.cancel();notice='Device, dashboard, scanner and voice settings saved.';persist();render();
 };
}
async function importReference(e) {
 const file=e.target.files[0];e.target.value='';if(!file||!writable())return;
 try {
  if(file.size>20*1024*1024)throw Error('Choose an XLSX file smaller than 20 MB.');
  const rows=await referenceRowsFromWorkbook(await file.arrayBuffer());
  if(!rows.length)throw Error('No reference rows found under Serial Number, Model and Manufacturer headings.');
  pendingImport={rows,name:file.name,client:sharedClient,locked:sharedLocked};importFilter='all';importLimit=60;
  resetImportPreview();document.querySelector('#settings-dialog').close();openImportPreview();
 } catch(error){notice=`Reference preview failed. ${error.message}`;render();}
}
function resetImportPreview(facts=baseReferenceFacts(),corrections=state.referenceCorrections||[]) {
 pendingImport.preview=buildImportPreview(pendingImport.rows,facts,corrections);
 pendingImport.selected=new Set(pendingImport.preview.filter(row=>row.status==='new').map(row=>row.id));
}
function openImportPreview(message='') {
 const dialog=document.querySelector('#import-preview-dialog'),counts=importCounts(pendingImport.preview);
 dialog.innerHTML=`<div class="eyebrow">REVIEW BEFORE IMPORTING</div><h2>Spreadsheet import preview</h2><p>${escape(pendingImport.name)} · ${pendingImport.client?`Shared team ${escape(pendingImport.client.teamId)}`:'Local reference library'}</p><p>Only serial, model and manufacturer references are saved. This does not add equipment to the collection register.</p><div class="import-counts">${Object.entries(counts).map(([status,count])=>`<span><strong>${count}</strong> ${status==='new'?'new':status==='duplicate'?'duplicates':status==='conflict'?'conflicts':'incomplete'}</span>`).join('')}</div><p>New references are selected. Conflicts need a deliberate selection and label check. Duplicates and incomplete rows are skipped.</p><label for="import-filter">Show spreadsheet rows</label><select id="import-filter"><option value="all">All rows</option><option value="new">New references</option><option value="conflict">Conflicts to review</option><option value="duplicate">Duplicates</option><option value="incomplete">Incomplete rows</option></select><div id="import-preview-rows"></div><p id="import-selection-count" aria-live="polite"></p><label class="recognition-review import-review"><input id="confirm-import-conflicts" type="checkbox"> I checked the selected conflicting details against the equipment labels.</label><p id="import-preview-error" role="alert">${escape(message)}</p><div class="dialog-actions"><button id="cancel-reference-import" class="secondary">Cancel import</button><button id="commit-reference-import" class="primary">Import selected references</button></div>`;
 dialog.showModal();document.querySelector('#import-filter').value=importFilter;
 document.querySelector('#import-filter').onchange=e=>{importFilter=e.target.value;importLimit=60;updateImportRows();};
 document.querySelector('#cancel-reference-import').onclick=()=>{if(importBusy)return;pendingImport=null;dialog.close();};
 dialog.oncancel=e=>{if(importBusy)e.preventDefault();else pendingImport=null;};
 document.querySelector('#confirm-import-conflicts').onchange=updateImportSelection;
 document.querySelector('#commit-reference-import').onclick=commitReferenceImport;updateImportRows();
}
function updateImportRows() {
 const rows=pendingImport.preview.filter(row=>importFilter==='all'||row.status===importFilter),container=document.querySelector('#import-preview-rows');
 container.innerHTML=rows.slice(0,importLimit).map(row=>`<article class="reference-card import-row"><div class="section-top"><strong>${escape(row.fact.serial||'No serial number')}</strong><span class="tag ${row.status==='conflict'?'reference-conflict':''}">${{new:'New reference',duplicate:'Duplicate',conflict:'Conflict',incomplete:'Incomplete'}[row.status]}</span></div><p>${escape(row.fact.model||'No model')} · ${escape(row.fact.manufacturer||'No manufacturer')}<br><small>${escape(row.sheet)} · Row ${row.row}</small></p><p>${escape(row.reason)}</p>${row.status==='conflict'?`<details><summary>Compare known evidence</summary>${row.existingFacts.map(f=>`<p>${escape(f.model)} · ${escape(f.manufacturer)}<br><small>${escape(f.source)}</small></p>`).join('')||'<p>Different details occur elsewhere in this spreadsheet.</p>'}${row.review?`<p>Review note: ${escape(row.review.note)}</p>`:''}</details>`:''}<label class="toggle-label"><input type="checkbox" data-import-row="${row.id}" aria-label="Import ${escape(row.fact.serial||`row ${row.row}`)} · ${escape(row.fact.model)} · ${escape(row.fact.manufacturer)}" ${pendingImport.selected.has(row.id)?'checked':''} ${!importBusy&&['new','conflict'].includes(row.status)?'':'disabled'}> Include this reference</label></article>`).join('')||'<p>No spreadsheet rows in this category.</p>';
 if(rows.length>importLimit)container.insertAdjacentHTML('beforeend','<button id="more-import-rows" class="secondary wide">Show more rows</button>');
 document.querySelector('#more-import-rows')?.addEventListener('click',()=>{if(importBusy)return;importLimit+=60;updateImportRows();});
 container.querySelectorAll('[data-import-row]').forEach(input=>input.onchange=()=>{if(input.checked)pendingImport.selected.add(Number(input.dataset.importRow));else pendingImport.selected.delete(Number(input.dataset.importRow));document.querySelector('#confirm-import-conflicts').checked=false;updateImportSelection();});updateImportSelection();
}
function updateImportSelection() {
 const selected=pendingImport.preview.filter(row=>pendingImport.selected.has(row.id)),conflicts=selected.filter(row=>row.status==='conflict').length;
 document.querySelector('#import-selection-count').textContent=`${selected.length} references selected · ${conflicts} conflicts selected`;
 document.querySelector('.import-review').hidden=!conflicts;
 document.querySelector('#commit-reference-import').disabled=importBusy||!selected.length;
}
async function commitReferenceImport() {
 if(importBusy||!pendingImport)return;
 const dialog=document.querySelector('#import-preview-dialog'),errorOutput=document.querySelector('#import-preview-error');
 if(pendingImport.client!==sharedClient||pendingImport.locked!==sharedLocked){errorOutput.textContent='Workspace changed. Cancel and preview this spreadsheet again in the correct workspace.';return;}
 if(!writable())return;
 const client=sharedClient,selected=pendingImport.preview.filter(row=>pendingImport.selected.has(row.id));if(!selected.length)return;
 if(selected.some(row=>row.status==='conflict')&&!document.querySelector('#confirm-import-conflicts').checked){errorOutput.textContent='Check the selected conflicting details and tick the confirmation before importing.';return;}
 importBusy=true;document.querySelector('#commit-reference-import').disabled=true;document.querySelector('#cancel-reference-import').disabled=true;dialog.querySelectorAll('input,select').forEach(input=>input.disabled=true);errorOutput.textContent='Checking the latest reference library…';
 try {
  const records=client?await client.load():null;
  if(client!==sharedClient||pendingImport.locked!==sharedLocked)throw Error('Connection changed. Reconnect and preview this spreadsheet again.');
  const facts=records?[...builtInReferences,...records.examples,...records.items.map(row=>({...row,source:'Saved equipment'}))]:baseReferenceFacts();
  const fresh=buildImportPreview(pendingImport.rows,facts,records?.corrections||state.referenceCorrections||[]);
  if(selected.some(row=>fresh[row.id].status!=='duplicate'&&(fresh[row.id].status!==row.status||fresh[row.id].evidence!==row.evidence))){resetImportPreview(facts,records?.corrections||state.referenceCorrections||[]);dialog.close();openImportPreview('The library changed since this preview. Review the updated conflicts and selections before importing.');return;}
  const examples=selected.filter(row=>fresh[row.id].status!=='duplicate').map(row=>row.fact);
  if(!examples.length){resetImportPreview(facts,records?.corrections||state.referenceCorrections||[]);dialog.close();openImportPreview('The selected references are already known. Nothing was imported.');return;}
  if(client)await client.importExamples(examples);
  if(client!==sharedClient||pendingImport.locked!==sharedLocked)throw Error('Connection changed while importing. Reconnect to check the saved references.');
  const next={...state,referenceExamples:cleanExamples([...state.referenceExamples,...examples])};
  if(!sharedClient){if(storageError)throw Error('Browser storage is paused. Back up the workspace before importing.');localStorage.setItem(key,JSON.stringify(next));}
  state=next;if(sharedClient)persist();pendingImport=null;dialog.close();notice=`Imported ${examples.length} reference examples. Scan a serial number first to look up its model and manufacturer.`;render();
 } catch(error){errorOutput.textContent=`Reference import failed. ${firebaseErrorMessage(error)}${client?' Some batches may already be saved; retry checks the server and skips known references.':' Your reference library has not been changed.'}`;}
 finally {importBusy=false;if(pendingImport&&document.querySelector('#import-preview-dialog')?.open){document.querySelector('#cancel-reference-import').disabled=false;document.querySelector('#import-filter').disabled=false;document.querySelector('#confirm-import-conflicts').disabled=false;updateImportRows();}}
}

async function printTrolleyLabel(id) {
 const trolley=state.trolleys.find(t=>t.id===id);
 if(!trolley)throw Error('This trolley is no longer in the workspace.');
 if(!sharedClient)commitTrolleyWorkspace({...state});
 const {trolleyLabel}=await import('./trolley-label');
 const url=new URL(location.href);url.hash=`trolley/${trolley.id}`;
 const data=await trolleyLabel(trolley,state.items.filter(item=>trolleyForItem(item,trolley)).length,url.href);
 downloadFile(data,`${trolley.reference}.pdf`,'application/pdf');
}
function updateCollectionReview() {
 const node=document.querySelector('#collection-review');if(!node)return;
 node.hidden=location.hash!=='#collection-review';
 document.querySelector('a[href="#collection-review"]')?.classList.toggle('active',!node.hidden);
 const reviews=collectionReview(state.trolleys,state.items,{shared:sharedLocked});
 if(collectionReviewTrolley!=='all'&&!reviews.some(row=>row.trolley.id===collectionReviewTrolley))collectionReviewTrolley='all';
 const scoped=reviews.filter(row=>collectionReviewTrolley==='all'||row.trolley.id===collectionReviewTrolley);
 const flagged=scoped.flatMap(review=>review.rows.filter(row=>row.issues.some(issue=>collectionReviewKind==='all'||issue.kind===collectionReviewKind)).map(row=>({...row,trolley:review.trolley})));
 const cached=sharedLocked&&(!sharedClient||connectionPhase!=='connected'||navigator.onLine===false);
 node.innerHTML=`<div class="section-top"><div><div class="eyebrow">BEFORE COLLECTION</div><h2>Collection review</h2><p>Review your trolleys, correct equipment details and confirm each physical collection check.</p></div><button class="primary" id="review-handover">Prepare handover pack</button></div><p class="session-note">${cached?'Showing cached team records. Reconnect to confirm the latest checks.':sharedLocked?'Based on the shared team register. Final readiness checks are confirmed directly with Firebase.':'Based on this browser’s register.'} Asset N/A is allowed; review it where a label is available. Recorded exceptions stay with the equipment.</p><div class="collection-review-trolleys">${reviews.map(review=>`<article class="review-trolley-card"><div class="section-top"><h3>${escape(review.trolley.name)}</h3><span class="tag">${review.trolley.status==='ready'&&review.canReady?'Ready for collection':review.canReady?'Awaiting physical check':'Needs review'}</span></div><small class="trolley-reference">${escape(review.trolley.reference)}</small><p><strong>${review.checkedCount} / ${review.items.length}</strong> records have no unresolved checks · ${review.unresolved.length} unresolved issue${review.unresolved.length===1?'':'s'}</p><progress value="${review.checkedCount}" max="${review.items.length||1}" aria-label="${escape(review.trolley.name)} record checks"></progress>${!review.items.length?'<p>Add equipment before marking this trolley ready.</p>':''}<div class="trolley-actions"><button class="secondary" data-review-trolley="${escape(review.trolley.id)}">Review flagged items</button><button class="primary" data-review-ready="${escape(review.trolley.id)}">${review.trolley.status==='ready'?'Review readiness / reopen':'Run final readiness checks'}</button></div></article>`).join('')||'<p>No open or ready trolleys. Create a trolley in Trolleys to start a new collection.</p>'}</div><div class="collection-review-filters"><div><label for="collection-review-trolley">Trolley to review</label><select id="collection-review-trolley"><option value="all">All uncollected trolleys</option>${reviews.map(({trolley})=>`<option value="${escape(trolley.id)}" ${collectionReviewTrolley===trolley.id?'selected':''}>${escape(trolley.name)}</option>`).join('')}</select></div><div><label for="collection-review-kind">Checks to show</label><select id="collection-review-kind">${[['all','All flagged details'],['missing','Missing serial, model or manufacturer'],['duplicate','Duplicate serial or asset'],['recognition','Unchecked model suggestions'],['asset','Asset number unavailable']].map(([value,label])=>`<option value="${value}" ${value===collectionReviewKind?'selected':''}>${label}</option>`).join('')}</select></div></div><p aria-live="polite">${flagged.length} flagged equipment record${flagged.length===1?'':'s'} in this view.</p><div class="readiness-list">${flagged.map(({item,issues,trolley})=>`<article class="collection-review-item"><div class="eyebrow">${escape(trolley.name)}</div><h3>${escape(item.serial)} · ${escape(item.model)}</h3><p>${escape(item.manufacturer)} · Asset ${escape(item.asset)}</p><ul>${issues.filter(issue=>collectionReviewKind==='all'||issue.kind===collectionReviewKind).map(issue=>`<li>${escape(issue.message)}${issue.kind==='duplicate'?`<span>Also in ${escape(state.items.filter(other=>issue.otherIds.includes(other.id)).map(other=>`${other.trolley} (${other.serial})`).join(', '))}</span>`:''}${issue.note?`<span>Recorded exception: ${escape(issue.note)}</span>`:''}${issue.kind==='asset'?'<span>N/A is permitted. Enter an asset number if a label is available.</span>':''}</li>`).join('')}</ul>${trolley.status==='open'?`<button class="secondary" data-review-edit="${escape(item.id)}">Edit equipment ${escape(item.serial)}</button>`:'<p>Reopen this ready trolley before changing equipment.</p>'}<button class="text-button" data-review-notes="${escape(trolley.id)}">${trolley.status==='ready'?'Review readiness / reopen':'Review notes and physical check'}</button></article>`).join('')||'<p class="readiness-clear">No flagged equipment matches these filters. Check trolley progress above before preparing a handover.</p>'}</div>`;
 node.querySelector('#collection-review-trolley').onchange=e=>{collectionReviewTrolley=e.target.value;updateCollectionReview();};
 node.querySelector('#collection-review-kind').onchange=e=>{collectionReviewKind=e.target.value;updateCollectionReview();};
 node.querySelector('#review-handover').onclick=openHandoverPack;
 node.querySelectorAll('[data-review-trolley]').forEach(button=>button.onclick=()=>{collectionReviewTrolley=button.dataset.reviewTrolley;collectionReviewKind='all';updateCollectionReview();node.querySelector('.collection-review-filters').scrollIntoView({behavior:'smooth'});});
 node.querySelectorAll('[data-review-edit]').forEach(button=>button.onclick=()=>openEditor(button.dataset.reviewEdit));
 node.querySelectorAll('[data-review-ready],[data-review-notes]').forEach(button=>button.onclick=()=>openReadiness(button.dataset.reviewReady||button.dataset.reviewNotes));
}

function updateSessionSummary() {
 const node=document.querySelector('#session-summary');if(!node)return;
 const summary=sessionSummary(state.items,state.trolleys,state.profiles,today());
 node.innerHTML=`<div class="section-top"><div><div class="eyebrow">SESSION SUMMARY</div><h2>A little progress. A lot less clutter.</h2><p>${escape(new Date(today()+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))} · Whole workspace</p></div><a class="secondary" href="#collection-review">Review collection ${icon('check')}</a><a class="secondary" href="#station">Continue scanning ${icon('arrow')}</a></div>
 <div class="session-metrics"><div><strong>${summary.todayCount}</strong><span>Disposal records today</span></div><div><strong>${summary.missingCount}</strong><span>Missing model or manufacturer</span><button class="text-button" id="review-missing" ${summary.missingCount?'':'disabled'}>Review missing details ${icon('arrow')}</button></div><div><strong>${summary.statuses.open}</strong><span>Trolleys being filled</span></div><div><strong>${summary.statuses.ready}</strong><span>Ready for collection</span></div><div><strong>${summary.statuses.collected}</strong><span>Trolleys collected</span></div></div>
 <p class="session-note">Today's totals use the saved disposal date, not the time scanned. Missing details include N/A. ${sharedLocked&&(!sharedClient||connectionPhase!=='connected'||navigator.onLine===false)?'Showing cached team records; reconnect to confirm the latest totals.':sharedLocked?'Based on the shared register.':'Based on this browser’s register.'}</p>
 <details id="session-breakdown" ${summaryExpanded?'open':''}><summary>Technician progress and trolley shortcuts</summary><div class="session-breakdown"><div><h3>Technician progress</h3><ul class="technician-progress">${summary.technicians.map(p=>`<li><span><strong>${escape(p.name)}</strong><small>${escape(p.code)}</small></span><span><strong>${p.today} today</strong><small>${p.total} in register</small></span></li>`).join('')}</ul></div><div><h3>Trolley overview</h3><div class="session-trolleys">${summary.trolleys.map(t=>`<article><div><strong>${escape(t.name)}</strong><span class="tag ${t.status==='collected'?'collected-tag':''}">${t.status==='open'?'Being filled':t.status==='ready'?'Ready':'Collected'}</span><p>${t.count} items · Property of TSU - ${escape(t.department)}</p><small class="trolley-reference">${escape(t.reference)}</small></div><div class="trolley-actions"><button class="secondary" data-summary-inventory="${escape(t.id)}">View inventory</button><button class="secondary" data-summary-label="${escape(t.id)}">Print label</button></div></article>`).join('')||'<p>No trolleys yet. Create one in Trolleys to get started.</p>'}</div></div></div></details><p id="summary-error" aria-live="polite"></p>`;
 node.querySelector('#session-breakdown').ontoggle=e=>{if(e.target.isConnected)summaryExpanded=e.target.open;};
 node.querySelector('#review-missing').onclick=()=>{missingDetailsOnly=true;search='';trolleyViewId='';document.querySelector('#register-search').value='';location.hash='inventory';updateRegister();document.querySelector('#inventory').scrollIntoView({behavior:'smooth'});};
 node.querySelectorAll('[data-summary-inventory]').forEach(button=>button.onclick=()=>viewTrolley(button.dataset.summaryInventory));
 node.querySelectorAll('[data-summary-label]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await printTrolleyLabel(button.dataset.summaryLabel);}catch(error){const output=document.querySelector('#summary-error');if(output)output.textContent=`Label failed: ${error.message}`;}finally{button.disabled=false;}});
}
function updateBulkMoveTools(visible) {
 const checkbox=document.querySelector('#select-visible');
 checkbox.disabled=!visible.length;checkbox.checked=visible.length>0&&visible.every(item=>selectedEquipment.has(item.id));checkbox.indeterminate=!checkbox.checked&&visible.some(item=>selectedEquipment.has(item.id));
 const node=document.querySelector('#bulk-move-tools');
 node.innerHTML=selectedEquipment.size?`<div class="bulk-move-bar"><div><strong>${selectedEquipment.size} selected</strong><span>${selectedEquipment.size-visible.filter(item=>selectedEquipment.has(item.id)).length} selected items hidden by current filters.</span></div><div><button class="secondary" id="clear-selection">Clear selection</button><button class="secondary" id="export-selected">Export selected (${selectedEquipment.size})</button><button class="secondary remove" id="delete-selected">Delete selected</button><button class="primary" id="move-selected">Move to trolley ${icon('arrow')}</button></div></div>`:'';
 node.querySelector('#clear-selection')?.addEventListener('click',()=>{selectedEquipment.clear();updateRegister();});
 node.querySelector('#move-selected')?.addEventListener('click',openBulkMove);
 node.querySelector('#export-selected')?.addEventListener('click',()=>exportExcel(true));
 node.querySelector('#delete-selected')?.addEventListener('click',openBulkDeletion);
}
function openBulkDeletion(){
 if(!writable()||!selectedEquipment.size)return;
 const client=sharedClient,locked=sharedLocked,initial=state.items.filter(item=>selectedEquipment.has(item.id)).map(item=>structuredClone(item)),versions=new Map(initial.map(item=>[item.id,client?.versionFor(item.id)||0])),dialog=document.querySelector('#bulk-move-dialog');
 let busy=false,needsRefresh=false;
 dialog.innerHTML=`<form id="bulk-delete-form"><div class="eyebrow">REMOVE EQUIPMENT</div><h2>Delete selected equipment?</h2><p>${initial.length} selected item${initial.length===1?'':'s'}, including any hidden by the current search. Equipment on ready or collected trolleys must be unlocked first.</p><ul class="move-preview-list">${initial.map(item=>`<li><strong>${escape(item.serial)} · ${escape(item.asset)}</strong><span>${escape(item.description)} · ${escape(item.manufacturer)} · ${escape(item.model)} · ${escape(item.trolley)}</span></li>`).join('')}</ul><p>These items will leave the register and future exports. Shared audit history is retained. Your unfinished scan stays intact.</p><label for="bulk-delete-text">Type DELETE to confirm</label><input id="bulk-delete-text" autocomplete="off" spellcheck="false"><label class="toggle-label"><input id="bulk-delete-ack" type="checkbox"> I understand all listed items will be removed from the register.</label><p id="bulk-delete-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-bulk-delete">Close</button><button class="primary" id="confirm-bulk-delete" disabled>Delete selected items</button></div></form>`;
 dialog.showModal();const form=dialog.querySelector('form'),text=dialog.querySelector('#bulk-delete-text'),ack=dialog.querySelector('#bulk-delete-ack'),button=dialog.querySelector('#confirm-bulk-delete'),close=dialog.querySelector('#cancel-bulk-delete'),output=dialog.querySelector('#bulk-delete-error');
 const valid=()=>text.value==='DELETE'&&ack.checked,current=()=>client===sharedClient&&locked===sharedLocked;
 form.oninput=()=>button.disabled=busy||needsRefresh||!valid();close.onclick=()=>{if(!busy)dialog.close();};dialog.oncancel=e=>{if(busy)e.preventDefault();};
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!valid())return;
  busy=true;button.disabled=true;close.disabled=true;text.disabled=true;ack.disabled=true;let removed=0;const failures=[];
  try{
   if(saving||rescan.busy)throw Error('Wait for the pending equipment save or move to finish.');
   if(!current()||localTabBlocked||(sharedLocked&&(!client||navigator.onLine===false)))throw Error('Reconnect and reopen this deletion preview.');
   const records=client?await client.load():state;if(!current())throw Error('Workspace changed. Reconnect to retrieve the register.');
   const plan=equipmentDeletionPlan(records.items,records.trolleys,initial);
   if(client&&initial.some(item=>client.versionFor(item.id)!==versions.get(item.id)))throw Error('Selected equipment changed. Close this preview and review the latest records.');
   if(!client){
    const ids=new Set(plan.map(item=>item.id));commitTrolleyWorkspace({...archiveDeleted(state,plan),items:state.items.filter(item=>!ids.has(item.id))});removed=plan.length;for(const id of ids)selectedEquipment.delete(id);
   }else for(const item of plan){
    if(!current()||navigator.onLine===false){failures.push('Connection changed. Reconnect to retrieve confirmed deletions.');break;}
    output.textContent=`Removing ${removed+1} of ${plan.length} items…`;
    try{
     await client.write(item,versions.get(item.id),{deleted:true});removed++;
     if(!current()){failures.push('Workspace changed after a confirmed deletion. Reconnect to retrieve the register.');break;}
     state.items=state.items.filter(row=>row.id!==item.id);selectedEquipment.delete(item.id);persist();
    }catch(error){failures.push(`${item.serial}: ${firebaseErrorMessage(error)}`);}
   }
   if(current()){
    updateRegister();updateHistory();
    if(!failures.length){dialog.close();notice=`${removed} selected item${removed===1?'':'s'} deleted. Your unfinished scan is preserved.`;render();}
    else output.textContent=`${removed} deletions confirmed. ${failures.join(' ')} Close this preview and choose Delete selected again to review the remaining selection.`;
   }
  }catch(error){output.textContent=`Items not deleted. ${firebaseErrorMessage(error)}`;}
  finally{busy=false;needsRefresh=removed>0;if(dialog.isConnected){close.disabled=false;text.disabled=false;ack.disabled=false;button.disabled=removed>0||!valid();}}
 };
}
function openBulkMove() {
 if(!writable())return;
 const client=sharedClient,ids=[...selectedEquipment],initial=state.items.filter(item=>ids.includes(item.id)).map(item=>({...item})),versions=new Map(initial.map(item=>[item.id,client?.versionFor(item.id)||0]));
 const profile={...(client?.profile||state.profiles.find(p=>p.code===state.active))};
 const dialog=document.querySelector('#bulk-move-dialog');let busy=false;
 const destinations=state.trolleys.filter(t=>t.status==='open');
 dialog.innerHTML=`<div class="eyebrow">REORGANISE EQUIPMENT</div><h2>Move selected equipment</h2><p>${ids.length} selected item${ids.length===1?'':'s'}. Only open trolleys can be changed. Ready trolleys must be reopened; collected inventories stay locked.</p><form id="bulk-move-form"><label for="move-destination">Destination trolley</label><select id="move-destination" required><option value="">Choose an open trolley…</option>${destinations.map(t=>`<option value="${escape(t.id)}">${escape(t.name)} · ${escape(t.reference)}</option>`).join('')}</select><div id="move-preview"></div><p class="note">${client?'Each item is checked and saved separately to Firebase. If a move fails, confirmed moves stay saved and remaining items can be retried.':'The selected moves and their history are saved together in this browser. Back up to keep a separate copy.'} Disposal attribution and your unfinished scan stay intact.</p><p id="bulk-move-error" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-bulk-move">Close</button><button class="primary" id="confirm-bulk-move" disabled>Confirm move</button></div></form>`;
 dialog.showModal();dialog.oncancel=e=>{if(busy)e.preventDefault();};
 const output=dialog.querySelector('#bulk-move-error'),button=dialog.querySelector('#confirm-bulk-move'),select=dialog.querySelector('#move-destination'),close=dialog.querySelector('#cancel-bulk-move');
 close.onclick=()=>dialog.close();
 select.onchange=()=>{
  try{const rows=movePlan(state.items,state.trolleys,ids,select.value),count=rows.filter(row=>!row.skip).length;dialog.querySelector('#move-preview').innerHTML=`<p><strong>${count} item${count===1?'':'s'} to move</strong> · ${rows.length-count} already in this trolley.</p><ul class="move-preview-list">${rows.map(row=>`<li><strong>${escape(row.before.serial)}</strong><span>${escape(row.source.name)} → ${escape(row.destination.name)}${row.skip?' (unchanged)':''}</span></li>`).join('')}</ul>`;button.disabled=!count;output.textContent='';}
  catch(error){button.disabled=true;dialog.querySelector('#move-preview').textContent='';output.textContent=error.message;}
 };
 dialog.querySelector('form').onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const validContext=()=>client===sharedClient&&!(!client&&sharedLocked)&&profile.code===state.active;
  if(!validContext()||!writable())return;
  let rows;
  try{rows=movePlan(state.items,state.trolleys,ids,select.value);for(const row of rows)if(!sameRecord(row.before,initial.find(item=>item.id===row.before.id)))throw Error('Selected equipment changed after you opened this preview. Close it and select the items again.');}
  catch(error){output.textContent=error.message;return;}
  busy=true;button.disabled=true;close.disabled=true;select.disabled=true;
  const moving=rows.filter(row=>!row.skip),failures=[];let moved=0;
  try{
   if(!client){
    if(storageError)throw Error('Browser storage is unavailable. Back up before moving equipment.');
    const updates=new Map(moving.map(row=>[row.before.id,row.after]));
    const next={...state,items:state.items.map(item=>updates.get(item.id)||item),trolleyMoves:[...(state.trolleyMoves||[]),...moving.map(row=>localMoveEvent(row,profile))]};
    localStorage.setItem(key,JSON.stringify(next));state=next;moved=moving.length;
    for(const row of rows)selectedEquipment.delete(row.before.id);
   }else{
    for(const row of rows){
     if(!validContext()||navigator.onLine===false){failures.push('Connection changed. Reconnect and review the remaining selection.');break;}
     if(row.skip){selectedEquipment.delete(row.before.id);continue;}
     output.textContent=`Saving move ${moved+1} of ${moving.length}…`;
     try{
      await client.write(row.after,versions.get(row.before.id));moved++;
      if(!validContext()){failures.push('The workspace changed after a confirmed save. Reconnect to retrieve its inventory.');break;}
      state.items=state.items.map(item=>item.id===row.before.id?row.after:item);selectedEquipment.delete(row.before.id);persist();
     }catch(error){failures.push(`${row.before.serial}: ${firebaseErrorMessage(error)} Continue by refreshing the register and reviewing this item.`);}
    }
   }
   if(validContext()){
    updateRegister();updateHistory();
    if(!failures.length){notice=`${moved} item${moved===1?'':'s'} moved. Move history recorded; disposal attribution preserved.`;dialog.close();render();}
    else if(dialog.isConnected){output.textContent=`${moved} move${moved===1?'':'s'} confirmed. ${failures.join(' ')} Close this preview before retrying the remaining selection.`;}
   }
  }catch(error){if(dialog.isConnected)output.textContent=`Items not moved. ${error.message} Your selection and unfinished scan are preserved.`;}
  finally{busy=false;if(dialog.isConnected){close.disabled=false;select.disabled=true;button.disabled=true;}}
 };
}
async function openMoveHistory(id) {
 const client=sharedClient,item=state.items.find(row=>row.id===id),dialog=document.querySelector('#move-history-dialog');if(!item)return;
 dialog.innerHTML=`<div class="eyebrow">TROLLEY MOVES</div><h2>Move history</h2><p>${escape(item.serial)} · Disposal recorded by ${escape(item.technician)}</p><div id="move-history-results">${client?'Checking saved Firebase revisions…':'Checking browser history…'}</div><div class="dialog-actions"><button class="secondary" id="close-move-history">Close</button></div>`;dialog.showModal();dialog.querySelector('button').onclick=()=>dialog.close();
 const results=dialog.querySelector('#move-history-results');
 try{
  if(sharedLocked&&!client)throw Error('Reconnect to Firebase to retrieve verified move history.');
  const rows=client?await client.moveHistory(id):(state.trolleyMoves||[]).filter(row=>row.itemId===id).sort((a,b)=>b.at.localeCompare(a.at));
  if(client!==sharedClient||!results.isConnected||!dialog.open)return;
  results.innerHTML=rows.map(row=>`<article class="move-history-entry"><strong>${escape(row.from.name)} → ${escape(row.to.name)}</strong><p>${escape(row.actor.name)} · ${escape(new Date(row.at).toLocaleString('en-GB'))}</p></article>`).join('')||'<p>No trolley moves recorded for this item.</p>';
 }catch(error){if(results.isConnected&&dialog.open)results.textContent=`History unavailable: ${firebaseErrorMessage(error)}`;}
}
function updateRegister() {
 syncTrolleyNames();
 if(!document.querySelector('#inventory'))return;
 for(const id of selectedEquipment)if(!state.items.some(item=>item.id===id))selectedEquipment.delete(id);
 updateSessionSummary();
 updateCollections();
 updateCollectionReview();
 const selected=state.trolleys.find(t=>t.id===trolleyViewId);
 const group=state.collectionSessions.find(row=>row.id===collectionViewId);
 const scope=trolleyViewId?(selected?state.items.filter(item=>trolleyForItem(item,selected)):[]):group?collectionScope(group.id,state.collectionTrolleys,state.trolleys,state.items).items:state.items;
 const filter=document.querySelector('#collection-register-filter');filter.innerHTML=`<option value="">All equipment</option>${state.collectionSessions.map(row=>`<option value="${escape(row.id)}" ${row.id===collectionViewId?'selected':''}>${escape(row.name)}</option>`).join('')}`;filter.disabled=Boolean(trolleyViewId);filter.onchange=e=>{collectionViewId=e.target.value;selectedEquipment.clear();search='';document.querySelector('#register-search').value='';updateRegister();};
 const trolleyFilter=document.querySelector('#trolley-register-filter');
 const trolleyCounts=new Map(state.trolleys.map(t=>[t.id,state.items.filter(item=>trolleyForItem(item,t)).length]));
 const cages=[...state.trolleys].sort((a,b)=>a.name.localeCompare(b.name,'en-GB',{numeric:true,sensitivity:'base'}));
 trolleyFilter.innerHTML=`<option value="">All trolleys</option>${cages.map(t=>`<option value="${escape(t.id)}" ${t.id===trolleyViewId?'selected':''} title="${escape(t.reference)}">${escape(t.name)} · ${trolleyCounts.get(t.id)} items · ${escape(t.reference.slice(-8))}</option>`).join('')}`;
 if(trolleyViewId&&!selected)trolleyFilter.insertAdjacentHTML('beforeend',`<option value="${escape(trolleyViewId)}" selected>Trolley unavailable</option>`);
 trolleyFilter.onchange=e=>{
  trolleyViewId=e.target.value;selectedEquipment.clear();missingDetailsOnly=false;search='';document.querySelector('#register-search').value='';
  const station=document.querySelector('main')?.dataset.view==='station';
  history.replaceState(null,'',`#${station?(trolleyViewId?`station/trolley/${trolleyViewId}`:'station'):(trolleyViewId?`trolley/${trolleyViewId}`:'inventory')}`);
  updateOverviewLayout();updateRegister();
 };
 const filterHelp=document.querySelector('#register-filter-help'),scanTarget=state.trolleys.find(t=>t.id===state.activeTrolleyId);
 filterHelp.hidden=!trolleyViewId||!location.hash.startsWith('#station');
 filterHelp.textContent=filterHelp.hidden?'':`Viewing ${selected?.name||'this trolley'} only. New scans still save to ${scanTarget?.name||'the selected scan trolley'}. Use Change trolley to change the scan destination.`;
 const scanOrder=new Map(state.items.map((item,index)=>[item.id,index+1]));
 const items=sortRegister(filteredItems(missingDetailsOnly?scope.filter(item=>missingEquipmentDetails(item).length):scope,search),state.items,registerSort);
 document.querySelectorAll('#inventory [data-sort-column]').forEach(th=>{
  const active=th.dataset.sortColumn===registerSort.key,button=th.querySelector('button'),label=registerColumns.find(([key])=>key===th.dataset.sortColumn)[1];
  th.setAttribute('aria-sort',active?registerSort.direction:'none');button.querySelector('span').textContent=active?(registerSort.direction==='ascending'?'↑':'↓'):'↕';
  button.title=`Sort ${label.toLowerCase()} ${active&&registerSort.direction==='ascending'?'descending':'ascending'}`;
  button.onclick=()=>{registerSort={key:button.dataset.sort,direction:active&&registerSort.direction==='ascending'?'descending':'ascending'};updateRegister();};
 });
 document.querySelector('#inventory-title').textContent=selected?`${selected.name} inventory`:group?`${group.name} inventory`:'Ready for the next collection';
 const banner=document.querySelector('#trolley-inventory-banner');
 banner.innerHTML=trolleyViewId?`<div class="trolley-inventory-banner"><div><strong>${selected?escape(selected.reference):'Trolley not found in this workspace'}</strong><p>${selected?`Property of TSU - ${escape(selected.department)} · ${selected.status==='collected'?`Collected by ${escape(selected.company)}`:selected.status==='ready'?'Ready for collection - reopen before changing equipment':'Open for equipment'}`:'Connect to the team database that owns this trolley.'}</p></div><button class="secondary" id="show-all-trolleys">Show all inventory</button></div>`:'';
 document.querySelector('#show-all-trolleys')?.addEventListener('click',()=>{location.hash='inventory';});
 document.querySelector('#review-filter').innerHTML=missingDetailsOnly?'<div class="trolley-inventory-banner"><span>Showing items missing manufacturer or model details. Export still includes the selected inventory.</span><button class="secondary" id="clear-review-filter">Clear review filter</button></div>':'';
 document.querySelector('#clear-review-filter')?.addEventListener('click',()=>{missingDetailsOnly=false;updateRegister();});
 document.querySelector('#search-count').textContent=`Showing ${items.length} of ${scope.length} items`;
 const exportButton=document.querySelector('#export');exportButton.disabled=exporting||!scope.length;exportButton.innerHTML=`${icon('download')} ${exporting?'Preparing Excel…':`Export ${scope.length} items`}`;exportButton.title=`Export ${selected?selected.name:group?group.name:'all equipment'}; search and selection do not change this export. Use Export selected for checked items.`;
 document.querySelector('.register .count').textContent=scope.length;
 document.querySelector('#inventory tbody').innerHTML=items.map(item=>`<tr><td class="selection-cell"><input type="checkbox" data-select-item="${escape(item.id)}" aria-label="Select item ${escape(item.serial)}" ${selectedEquipment.has(item.id)?'checked':''}></td><td class="scan-order-cell" aria-label="Scan order ${scanOrder.get(item.id)}">${scanOrder.get(item.id)}</td><td><strong>${escape(item.description)}</strong><span>${escape(item.manufacturer)} · ${escape(item.model)}</span></td><td>${escape(item.serial)}</td><td>${escape(item.asset)}</td><td><span class="tag">${escape(item.trolley)}</span></td><td>${escape(item.technician)}</td><td>${escape(item.date.split('-').reverse().join('/'))}</td><td><div class="row-actions"><button class="text-button" data-edit="${escape(item.id)}" aria-label="Edit item ${escape(item.serial)}">Edit</button><button class="text-button" data-moves="${escape(item.id)}" aria-label="Move history for ${escape(item.serial)}">Moves</button><button class="text-button remove" data-delete="${escape(item.id)}" aria-label="Delete item ${escape(item.serial)}">Remove</button></div></td></tr>`).join('') || `<tr><td colspan="9" class="empty"><div class="empty-icon">${icon('box')}</div><strong>${missingDetailsOnly?'No items need missing details filled in.':search?'No equipment matches your search.':'A little less clutter starts here.'}</strong><span>${missingDetailsOnly?'Clear the review filter to see the rest of your inventory.':search?'Try another serial number, trolley or technician.':'Scan your first item to start your collection register.'}</span></td></tr>`;
 document.querySelectorAll('[data-select-item]').forEach(input=>input.onchange=()=>{if(input.checked)selectedEquipment.add(input.dataset.selectItem);else selectedEquipment.delete(input.dataset.selectItem);updateBulkMoveTools(items);});
 document.querySelector('#select-visible').onchange=e=>{for(const item of items){if(e.target.checked)selectedEquipment.add(item.id);else selectedEquipment.delete(item.id);}document.querySelectorAll('[data-select-item]').forEach(input=>input.checked=selectedEquipment.has(input.dataset.selectItem));updateBulkMoveTools(items);};
 updateBulkMoveTools(items);
}
async function openHandoverPack() {
 if(!writable())return;
 try{const {openHandover}=await import('./handover-ui.js');openHandover({dialog:document.querySelector('#handover-dialog'),getState:()=>state,getClient:()=>sharedClient,canWrite:writable,commit:commitTrolleyWorkspace,download:downloadFile,notify:message=>{notice=message;render();location.hash='collection-history';}});}
 catch(error){notice=`Handover could not open: ${error.message}`;render();}
}
function updateHandoverHistory(terms) {
 const node=document.querySelector('#handover-history'),groups=handoverGroups(state.trolleys).filter(group=>terms.every(term=>[group.reference,group.company,group.collectedBy,...group.trolleys.flatMap(t=>[t.name,t.reference,t.department])].join(' ').toLowerCase().includes(term)));
 node.innerHTML=groups.map(group=>`<article class="handover-history-card"><div class="eyebrow">COLLECTION HANDOVER</div><h3>${escape(group.reference)}</h3><p>${escape(group.company)} · ${escape(new Date(group.collectedAt).toLocaleString('en-GB',{timeZone:'Europe/London'}))} · Recorded by ${escape(group.collectedBy)}</p><p>${group.trolleys.length} trolleys · ${state.items.filter(item=>group.trolleys.some(t=>trolleyForItem(item,t))).length} items</p><p>${group.trolleys.map(t=>escape(t.name)).join(' · ')}</p>${group.complete?`<div class="trolley-actions"><button class="secondary" data-handover-pdf="${escape(group.id)}">Download retained handover PDF</button><button class="primary" data-handover-excel="${escape(group.id)}">Download supplier Excel</button></div><p class="handover-export-status" aria-live="polite"></p>`:'<p>Some handover details are missing. Reconnect to retrieve the complete register.</p>'}<p class="handover-download-error" aria-live="polite"></p></article>`).join('');
 node.querySelectorAll('[data-handover-pdf],[data-handover-excel]').forEach(button=>button.onclick=async()=>{
  const client=sharedClient,excel=Boolean(button.dataset.handoverExcel),id=button.dataset.handoverExcel||button.dataset.handoverPdf,card=button.closest('article');button.disabled=true;card.querySelector('.handover-download-error').textContent='';card.querySelector('.handover-export-status')?.replaceChildren();
  try{
   if(excel&&sharedLocked&&(!client||navigator.onLine===false))throw Error('Reconnect to Firebase before exporting the supplier list so all handover records can be confirmed.');
   const cached=sharedLocked&&(!client||connectionPhase!=='connected'||navigator.onLine===false),records=client&&(excel||!cached)?await client.load():{trolleys:state.trolleys,items:state.items};
   if(client!==sharedClient)return;
   const group=handoverGroups(records.trolleys).find(row=>row.id===id);if(!group?.complete)throw Error('The full handover is unavailable. Reconnect and check the register.');
   if(excel){
    const items=records.items.filter(item=>group.trolleys.some(t=>trolleyForItem(item,t))).map(item=>({...item}));
    const {supplierExcel,supplierExcelType}=await import('./supplier-excel.js');const bytes=await supplierExcel(items);if(client!==sharedClient)return;
    downloadFile(bytes,`${group.reference}-supplier.xlsx`,supplierExcelType);
    const status=card.querySelector('.handover-export-status');if(status?.isConnected)status.textContent=`Supplier Excel download started with ${items.length} item${items.length===1?'':'s'} from this handover. Ready to attach to your email.`;
   }else{const {handoverPdf}=await import('./handover-pdf.js');const bytes=await handoverPdf(group,records.trolleys,records.items,location.href,{cached});if(client!==sharedClient)return;downloadFile(bytes,`${group.reference}.pdf`,'application/pdf');}
  }catch(error){const output=button.closest('article')?.querySelector('.handover-download-error');if(output)output.textContent=`Download failed: ${firebaseErrorMessage(error)}`;}
  finally{button.disabled=false;}
 });
}
function updateHistory() {
 if(!document.querySelector('#collection-history'))return;
 updateCollectionReview();
 document.querySelector('a[href="#overview"]').classList.toggle('active',location.hash==='#overview');
 const section=document.querySelector('#collection-history');section.hidden=location.hash!=='#collection-history';
 document.querySelector('a[href="#collection-history"]').classList.toggle('active',!section.hidden);document.querySelector('a[href="#station"]').classList.toggle('active',!location.hash||location.hash==='#station');document.querySelector('a[href="#inventory"]').classList.toggle('active',location.hash==='#inventory'||Boolean(trolleyViewId));
 const collected=state.trolleys.filter(t=>t.status==='collected').sort((a,b)=>Date.parse(b.collectedAt)-Date.parse(a.collectedAt));
 const terms=historySearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const rows=collected.filter(t=>terms.every(term=>[t.reference,t.name,t.department,t.company,t.collectedBy,t.handover?handoverReference(t.handover.id):''].join(' ').toLowerCase().includes(term)));
 updateHandoverHistory(terms);
 document.querySelector('#history-total').textContent=`${collected.length} collected`;
 document.querySelector('#history-results').innerHTML=rows.map(t=>`<article class="history-card"><div class="section-top"><div><h3>${escape(t.name)}</h3><div class="trolley-reference">${escape(t.reference)}</div></div><span class="tag collected-tag">Collected</span></div><dl><div><dt>Decommission company</dt><dd>${escape(t.company)}</dd></div><div><dt>Collected</dt><dd>${escape(new Date(t.collectedAt).toLocaleString('en-GB',{timeZone:'Europe/London'}))}</dd></div><div><dt>Recorded by</dt><dd>${escape(t.collectedBy)}</dd></div><div><dt>Contents</dt><dd>${state.items.filter(item=>trolleyForItem(item,t)).length} items</dd></div></dl><p>Property of TSU - ${escape(t.department)}</p><button class="secondary" data-history-inventory="${escape(t.id)}">View inventory</button></article>`).join('')||`<p class="history-empty">${historySearch?'No collected trolleys match your search.':'No trolleys have been collected yet. Mark a trolley collected in Trolleys to retain its details here.'}</p>`;
 section.querySelectorAll('[data-history-inventory]').forEach(button=>button.onclick=()=>viewTrolley(button.dataset.historyInventory));
}
function updateConnectionStatus() {
 const node=document.querySelector('#connection-status');if(!node)return;
 let title=testWorkspace?'Test workspace':'Local workspace',detail=testWorkspace?'Synthetic records are isolated in this browser. Firebase uploads are disabled.':'Records are stored in this browser. Back up after each session.',kind='local';
 if(sharedLocked){
  if(navigator.onLine===false){title='Offline · team changes paused';detail='Your captured item stays here. Reconnect before saving; download a backup before closing.';kind='warning';}
  else if(!sharedClient){title='Shared workspace · reconnect required';detail='Cached records are available to view. Open Database to reconnect; team changes are locked.';kind='warning';}
  else if(saving){title='Saving equipment to Firebase';detail='Wait for confirmation. Your captured item stays here until Firebase accepts it.';kind='warning';}
  else if(connectionPhase!=='connected'){title='Checking shared connection';detail='Waiting for confirmation from Firebase. Saved items are confirmed before your draft is cleared.';kind='warning';}
  else{title='Shared workspace · confirmed by Firebase';detail=`Team ${sharedClient.teamId}${lastConfirmedAt?' · Last confirmed '+new Date(lastConfirmedAt).toLocaleTimeString('en-GB',{timeZone:'Europe/London'}):''}`;kind='connected';}
 }
 node.className=`connection-status compact-connection ${kind}`;node.innerHTML=`<button class="connection-chip" id="connection-action" title="${escape(detail)}" aria-label="${escape(title)}. Open database settings">${icon('database')}<span>${kind==='connected'?'Database connected':kind==='local'?testWorkspace?'Test workspace':'Local workspace':kind==='warning'?'Connection needs attention':'Connecting…'}</span><span class="sr-only">${escape(title)} · ${escape(detail)}</span><i aria-hidden="true"></i></button>`;node.querySelector('button').onclick=openDatabase;
 updateSessionSummary();updateCollectionReview();updateCollectionDashboard();
}
async function checkSharedConnection() {
 const client=sharedClient,button=document.querySelector('#check-connection'),output=document.querySelector('#connection-check-result');if(!client)return;
 button.disabled=true;output.textContent='Checking the team register with Firebase…';
 try{const records=await client.load();if(sharedClient!==client)return;state.items=records.items;state.trolleys=records.trolleys;state.referenceExamples=records.examples;state.referenceCorrections=records.corrections||[];connectionPhase='connected';lastConfirmedAt=new Date().toISOString();persist();updateRegister();updateHistory();updateConnectionStatus();output.textContent=`Firebase confirmed ${records.items.length} equipment records, ${records.trolleys.length} trolleys and ${records.examples.length} imported references for team ${client.teamId}. On another device, sign in to this same team to compare its register.`;}
 catch(error){connectionPhase='syncing';updateConnectionStatus();output.textContent=`Connection check failed. ${firebaseErrorMessage(error)} Your captured item has been kept.`;}
 finally{button.disabled=false;}
}
function openEditor(id) {
 if(!writable())return;
 const item=state.items.find(item=>item.id===id);if(!item)return;
 const client=sharedClient,version=client?.versionFor(id)||0;
 let busy=false;
 const dialog=document.querySelector('#edit-dialog');
 dialog.innerHTML=`<form id="edit-form"><div class="eyebrow">COLLECTION REGISTER</div><h2>Edit equipment</h2><p>Correct the saved record without rescanning it.</p><div class="edit-grid">${[...defaultFields,...fields.map(([key,label])=>[key,label,'text'])].map(([key,label,type])=>`<div><label for="edit-${key}">${escape(label)}</label>${key==='trolley'?`<select id="edit-trolley" name="trolley" required><option value="">Choose an open trolley…</option>${state.trolleys.filter(t=>t.status==='open'||t.id===item.trolleyId).map(t=>`<option value="${escape(t.id)}" ${t.id===item.trolleyId?'selected':''}>${escape(t.name)} · ${escape(t.reference)}${t.status!=='open'?' · Locked':''}</option>`).join('')}</select>`:`<input id="edit-${key}" name="${key}" type="${type}" value="${escape(item[key])}" maxlength="1000" required>`}</div>`).join('')}<div><label for="edit-technician">Recorded technician</label><select id="edit-technician" name="technician" ${sharedClient?'disabled':''}>${[...new Set([item.technician,...state.profiles.map(p=>p.code)])].map(code=>`<option value="${escape(code)}" ${code===item.technician?'selected':''}>${escape(state.profiles.find(p=>p.code===code)?.name||code)} · ${escape(code)}</option>`).join('')}</select></div></div>${item.recognitionNeedsReview?`<label class="review-check"><input type="checkbox" id="edit-recognition-confirmed" ${item.recognitionConfirmed?'checked':''}> I checked the model and manufacturer against this equipment.</label>`:''}<p id="edit-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-edit">Cancel</button><button class="primary">Save changes</button></div></form>`;
 dialog.showModal();
 dialog.oncancel=e=>{if(busy)e.preventDefault();};
 document.querySelector('#cancel-edit').onclick=()=>{if(!busy)dialog.close();};
 if(item.recognitionNeedsReview)for(const id of ['edit-model','edit-manufacturer','edit-serial'])document.querySelector('#'+id).oninput=()=>{document.querySelector('#edit-recognition-confirmed').checked=false;};
 document.querySelector('#edit-form').onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const form=e.target,error=dialog.querySelector('#edit-error');
  if(client!==sharedClient||(sharedLocked&&(!client||navigator.onLine===false))){error.textContent='Reconnect to Firebase and reopen this record before saving.';return;}
  const values=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,value.trim()]));
  if(client)values.technician=item.technician;
  if(Object.values(values).some(value=>!value)||!validDate(values.date)){error.textContent='Complete each field, using N/A where needed, and enter a valid date.';return;}
  if(!validAssetNumber(values.asset)){error.textContent='Asset number must be A followed by four digits, for example A1234, or N/A.';dialog.querySelector('#edit-asset').focus();return;}
  values.asset=normalizeAssetNumber(values.asset);
  if(duplicateSerial(state.items.filter(row=>row.id!==item.id),values.serial)){error.textContent='This serial number belongs to another item. Check it before saving.';return;}
  const confirmed=dialog.querySelector('#edit-recognition-confirmed')?.checked;
  const controls=[...form.querySelectorAll('input,select,button')],disabled=controls.map(control=>control.disabled);
  busy=true;controls.forEach(control=>control.disabled=true);error.textContent='Saving equipment changes…';
  try {
   if(!client&&!sameRecord(state.items.find(row=>row.id===item.id),item))throw Error('This record changed. Reopen it before saving.');
   const destination=state.trolleys.find(t=>t.id===values.trolley);if(!destination)throw Error('Select an available trolley. Refresh trolley management if it is missing.');assertCollectionTrolley(destination);values.trolley=destination.name;
   if(client!==sharedClient)throw Error('Workspace changed. Reopen this record before saving.');
   if(destination.status!=='open'||state.trolleys.some(t=>t.status!=='open'&&trolleyForItem(item,t)))throw Error('Ready or collected trolley contents are locked. Reopen a ready trolley before editing.');
   const updated={...item,...values,trolleyId:destination.id,...(item.recognitionNeedsReview?{recognitionConfirmed:confirmed}:{})};
   if(updated.readinessNotes){updated.readinessNotes={...updated.readinessNotes};for(const field of readinessFields)if(values[field]!==item[field])delete updated.readinessNotes[field];}
   if(client)await client.write(updated,version);
   if(client!==sharedClient)throw Error('Workspace changed after saving. Reconnect to retrieve the confirmed record.');
   const next={...state,items:state.items.map(row=>row.id===item.id?updated:row)};
   if(!client) {
    if(item.trolleyId!==updated.trolleyId){const row=movePlan(state.items,state.trolleys,[item.id],updated.trolleyId)[0];next.trolleyMoves=[...(state.trolleyMoves||[]),localMoveEvent(row,state.profiles.find(p=>p.code===state.active))];}
    if(storageError)throw Error('Browser storage is unavailable. Back up before changing equipment.');
    localStorage.setItem(key,JSON.stringify(next));
   }
   state=next;notice='Equipment changes saved.';if(client)persist();render();
  }catch(failure){error.textContent=failure.message;}
  finally{busy=false;controls.forEach((control,index)=>control.disabled=disabled[index]);}

 };
}
function openDatabase() {
 if(testWorkspace){notice='This test workspace cannot connect to Firebase. Use Return to real workspace to access the team database.';render();return;}
 let saved={};try{saved=JSON.parse(localStorage.getItem('decompro.firebaseConfig')||'{}');}catch{}
 saved.config ||= defaultFirebaseConfig;
 const dialog=document.querySelector('#database-dialog');
 dialog.innerHTML=`<div class="eyebrow">TEAM WORKSPACE</div><h2>${sharedClient?'Logged in to DecomPro':'Connect your Firebase database'}</h2><p>Firestore shares records and reference examples across the team. Membership and identities are controlled by Firebase Authentication and security rules.</p>${sharedClient?`<div class="restore-summary"><strong>${escape(sharedClient.teamId)}</strong><span>${escape(sharedClient.email)} · ${escape(sharedClient.role)}</span></div><button class="secondary wide" id="check-connection">Check connection</button><p id="connection-check-result" aria-live="polite">Checks equipment, trolley and reference access directly with Firebase.</p>${sharedClient.role==='admin'?'<button class="secondary" id="team-access">Team access checklist</button><button class="secondary" id="copy-firestore-rules">Copy latest Firestore rules</button><p id="firestore-rules-result" aria-live="polite"></p><textarea id="firestore-rules-text" rows="8" aria-label="Latest Firestore rules" readonly hidden></textarea>':''}<button class="secondary" id="upload-local" ${sharedClient.role!=='admin'?'disabled':''}>Import local equipment (admin)</button><p>Preview your preserved local equipment, check duplicates and import historical records without overwriting team items.</p>`:''}${!sharedClient?`<form id="database-form"><p>Sign in with the account your team administrator created. Your local register stays preserved when you connect.</p><details class="connection-settings"><summary>Connection settings</summary><label for="firebase-config">Firebase public web app config (JSON)</label><textarea id="firebase-config" name="config" rows="5" required spellcheck="false" placeholder='{"apiKey":"…","authDomain":"…","projectId":"…","appId":"…"}'>${escape(saved.config?JSON.stringify(saved.config,null,2):'')}</textarea><label for="team-id">Team ID</label><input id="team-id" name="teamId" value="${escape(saved.teamId||'college-it')}" required><p>These project details are prefilled. Your administrator can change them here if needed.</p></details><label for="firebase-email">Team account email</label><input id="firebase-email" name="email" type="email" autocomplete="username" value="${escape(lockedAccountEmail)}" required><label for="firebase-password">Password</label><input id="firebase-password" name="password" type="password" autocomplete="current-password" required><label class="toggle-label"><input id="remember-device" name="remember" type="checkbox" ${devicePreferences.remember?'checked':''}> Remember me on this trusted device</label><p>Your account identifies who disposed of each item. Connecting does not automatically upload your local records.</p><button type="button" class="text-button" id="forgot-password">Forgot password?</button><p id="password-reset-result" role="status"></p><p id="database-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="close-database">Close</button><button class="primary">Sign in & connect</button></div></form>`:`<div class="dialog-actions"><button type="button" class="secondary" id="close-database">Close</button><button type="button" class="primary" id="disconnect-database">Logout</button></div>`}${sharedLocked&&!sharedClient?'<button class="text-button" id="disconnect-database">Sign out & return to local workspace</button>':''}`;
 dialog.addEventListener('close',()=>{const password=dialog.querySelector('#firebase-password');if(password)password.value='';},{once:true});
 dialog.showModal();
 document.querySelector('#copy-firestore-rules')?.addEventListener('click',async()=>{
  const output=document.querySelector('#firestore-rules-result');
  try {
   const {default:rules}=await import('../database/firestore.rules?raw');
   try{await navigator.clipboard.writeText(rules);output.textContent='Rules copied. In Firebase → Cloud Firestore → Rules, replace the editor content and select Publish. Then choose Refresh collections in DecomPro.';}
   catch{const text=document.querySelector('#firestore-rules-text');text.hidden=false;text.value=rules;text.focus();text.select();output.textContent='Copy the selected rules below. In Firebase → Cloud Firestore → Rules, replace the editor content and select Publish. Then refresh collections.';}
  }catch(error){output.textContent=`Rules could not load. Refresh the app and retry. ${error.message}`;}
 });
 document.querySelector('#close-database').onclick=()=>{const password=dialog.querySelector('#firebase-password');if(password)password.value='';dialog.close();};
 document.querySelector('#disconnect-database')?.addEventListener('click',disconnectDatabase);
 document.querySelector('#check-connection')?.addEventListener('click',checkSharedConnection);
 document.querySelector('#upload-local')?.addEventListener('click',uploadLocal);
 document.querySelector('#team-access')?.addEventListener('click',openTeamAccess);
 let signingIn=false;
 document.querySelector('#forgot-password')?.addEventListener('click',async()=>{
  const button=dialog.querySelector('#forgot-password'),email=dialog.querySelector('#firebase-email'),output=dialog.querySelector('#password-reset-result');
  if(!email.reportValidity())return;
  if(button.disabled)return;button.disabled=true;output.textContent='Requesting password reset…';
  try{const {resetFirebasePassword}=await import('./firebase-db');await resetFirebasePassword(JSON.parse(dialog.querySelector('#firebase-config').value),email.value.trim());output.textContent='If this email has an account, a password reset email has been requested. Check your inbox and junk folder.';}
  catch(error){output.textContent=error.code==='auth/too-many-requests'?'Too many requests. Wait a little before trying again.':'The reset request could not be completed. Check your connection and try again.';}
  finally{button.disabled=false;}
 });
 const loginForm=document.querySelector('#database-form');if(!loginForm)return;
 loginForm.onsubmit=async e=>{
  e.preventDefault();if(signingIn)return;signingIn=true;
  const form=new FormData(e.target),button=e.target.querySelector('.primary'),passwordInput=e.target.querySelector('#firebase-password'),output=e.target.querySelector('#database-error'),controls=[...e.target.querySelectorAll('input,textarea,button.primary')];
  const disabled=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);output.textContent='';
  try {
   button.textContent=lockCompletion?'Finishing sign-out…':'Signing in…';
   await waitForLockCompletion();
   button.textContent='Signing in…';
   await activateDatabase(JSON.parse(form.get('config')),form.get('teamId').trim(),form.get('email').trim(),form.get('password'),{remember:form.has('remember')});
  }catch(error){passwordInput.value='';if(output.isConnected)output.textContent=firebaseErrorMessage(error);else if(sharedLocked&&!sharedClient){lockedAccountEmail=String(form.get('email')||'').trim();openDatabase();document.querySelector('#database-error').textContent=firebaseErrorMessage(error);}}
  finally{signingIn=false;controls.forEach((control,index)=>control.disabled=disabled[index]);button.textContent='Sign in & connect';}
 };
}
async function openTeamAccess() {
 const client=sharedClient;if(!client||client.role!=='admin')return;
 const dialog=document.querySelector('#team-access-dialog');
 dialog.innerHTML=`<div class="eyebrow">PERSONAL TEAM ACCOUNTS</div><h2>Team access checklist</h2><p>Each technician signs in with their own email and password. Their Firebase membership supplies the disposal name and initials on shared records.</p><ol><li>Create the technician in <a href="https://console.firebase.google.com/project/${escape(client.projectId||defaultFirebaseConfig.projectId)}/authentication/users" target="_blank" rel="noopener">Firebase Authentication → Users</a>.</li><li>Copy their UID. In Firestore, add <strong>teams/${escape(client.teamId)}/members/UID</strong> with displayName, code, role (technician) and active (boolean true).</li><li>On the other device, open this same website and sign in through Database. Choose Check connection to retrieve the shared register.</li></ol><p>Use different initials for each technician. Share passwords directly through your college’s approved process.</p><div id="team-access-list" aria-live="polite">Checking current memberships with Firebase…</div><div class="dialog-actions"><button class="secondary" id="close-team-access">Close</button></div>`;
 dialog.querySelector('#close-team-access').onclick=()=>dialog.close();dialog.showModal();
 try {
  const members=await client.listMembers();if(sharedClient!==client)return;
  dialog.querySelector('#team-access-list').innerHTML=`<h3>Current team memberships</h3>${members.map(member=>`<p><strong>${escape(member.displayName)} · ${escape(member.code)}</strong><br>${escape(member.role)} · ${member.active?'Active':'Inactive'}</p>`).join('')||'<p>No members returned.</p>'}`;
 }catch(error){dialog.querySelector('#team-access-list').textContent=`Account check failed. ${firebaseErrorMessage(error)}`;}
}
async function waitForLockCompletion() {
 const pending=lockCompletion;if(!pending)return;
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Firebase sign-out is still pending. Refresh this page, then sign in again. Your saved records and unfinished scan are preserved.')),15000);
  pending.then(()=>{clearTimeout(timer);resolve();},error=>{clearTimeout(timer);reject(error);});
 });
}
async function activateDatabase(config,teamId,email,password,{remember=devicePreferences.remember}={}) {
 if(testWorkspace)throw Error('Firebase uploads are disabled in the test workspace.');
 await waitForLockCompletion();
 const {connectFirebase}=await import('./firebase-db');
 const previousClient=sharedClient;
 if(email&&previousClient){const input=document.querySelector('#scan');if(input&&fields[state.step]&&input.value.length<=1000){if(input.value.trim())state.draft[fields[state.step][0]]=input.value;else delete state.draft[fields[state.step][0]];}persist();previousClient.stop();}
 let client;
 try {
  client=await connectFirebase(config,teamId,email,password,{remember,freshSession:sharedLocked&&!previousClient});
  const records=await client.load();
  devicePreferences=saveDevicePreferences({...devicePreferences,remember});
  const workspaceId=`${config.projectId}/${teamId}/${client.uid}`,sameCollections=state.collectionWorkspace===workspaceId;
  const currentTrolley=records.trolleys.find(t=>t.id===state.activeTrolleyId);if(currentTrolley)state.defaults.trolley=currentTrolley.name;
  const next=validateWorkspace({...(sameCollections?reconcileTrolleySelection(state,records.trolleys):state),...(!sameCollections?{collectionSessions:[],collectionTrolleys:[],collectionScans:{},activeCollectionId:'',collectionPaused:false,...(state.collectionWorkspace?{draft:{},step:0}:{})}:{}),historicalEquipment:sameCollections?state.historicalEquipment:[],deletedItems:[],collectionWorkspace:workspaceId,activeTrolleyId:records.trolleys.some(t=>t.id===state.activeTrolleyId)?state.activeTrolleyId:records.trolleys.filter(t=>trolleyNameKey(t.name)===trolleyNameKey(state.defaults.trolley)).length===1?records.trolleys.find(t=>trolleyNameKey(t.name)===trolleyNameKey(state.defaults.trolley)).id:'',profiles:[client.profile],active:client.profile.code,trolleyMoves:[],items:records.items,trolleys:records.trolleys,referenceExamples:records.examples,referenceCorrections:records.corrections||[]});
  resetRescan();lockedAccountEmail='';workspaceManuallyLocked=false;localStorage.removeItem('decompro.workspaceLocked');recordActivity();
  if(!sharedLocked)localStorage.setItem(localWorkspaceKey,JSON.stringify(state));
  localStorage.setItem('decompro.firebaseConfig',JSON.stringify({config,teamId}));localStorage.setItem('decompro.mode','shared');
  selectedEquipment.clear();sharedClient?.stop();sharedClient=client;sharedLocked=true;releaseLocalTab?.();connectionPhase='connected';lastConfirmedAt=new Date().toISOString();state=next;collectionViewId=state.activeCollectionId||'';collectionError='';notice='';persist();render();
  client.listen(items=>{if(sharedClient!==client)return;state.items=items;persist();updateRegister();updateHistory();updateReferenceLibrary();document.querySelector('.stats .stat-content strong').innerHTML=`${items.length}<small> items recorded</small>`;document.querySelector('a[href="#inventory"] span').textContent=items.length;},examples=>{if(sharedClient===client){state.referenceExamples=examples;persist();updateReferenceLibrary();}},error=>{if(sharedClient===client){client.stop();sharedClient=null;notice=`Shared connection failed. Changes are locked until reconnection. ${error.message}`;render();}},trolleys=>{if(sharedClient===client){const old=state.trolleys.find(t=>t.id===state.activeTrolleyId),next=trolleys.find(t=>t.id===state.activeTrolleyId);if(old&&next&&state.defaults.trolley===old.name)state.defaults.trolley=next.name;state=reconcileTrolleySelection(state,trolleys);syncTrolleyNames();persist();updateRegister();updateHistory();}},phase=>{if(sharedClient===client){connectionPhase=phase;if(phase==='connected')lastConfirmedAt=new Date().toISOString();updateConnectionStatus();}},corrections=>{if(sharedClient===client){state.referenceCorrections=corrections;persist();updateReferenceLibrary();}});
  refreshCollections(client);
 }catch(error){try{if(client?.logout)await client.logout();else client?.stop();}catch{client?.stop();}
  if(email&&previousClient&&sharedClient===previousClient){sharedClient=null;sharedLocked=true;workspaceManuallyLocked=true;try{localStorage.setItem('decompro.workspaceLocked','true');}catch{}lockedAccountEmail=previousClient.email||'';notice=firebaseErrorMessage(error);render();}
  throw error;
 }
}
async function disconnectDatabase() {
 if(!confirm('Return to your preserved local workspace? Shared records remain in Firebase.'))return;
 try {
  const local=localStorage.getItem(localWorkspaceKey);if(!local)throw Error('No preserved local workspace was found. Export the cached team register before continuing.');
  const restored=validateWorkspace(JSON.parse(local));
  if(sharedClient)await sharedClient.logout();else{const saved=JSON.parse(localStorage.getItem('decompro.firebaseConfig')||'{}');if(saved.config){const {disconnectFirebaseAuth}=await import('./firebase-db');await disconnectFirebaseAuth(saved.config);}}
  resetRescan();selectedEquipment.clear();sharedClient=null;sharedLocked=false;localStorage.removeItem('decompro.mode');await acquireLocalTab();state=restored;collectionViewId=state.activeCollectionId||'';collectionError='';notice='Returned to your local workspace. Shared records are unchanged.';persist();render();
 }catch(error){notice=error.message;render();}
}
async function uploadLocal() {
 const client=sharedClient,button=document.querySelector('#upload-local');
 if(!client||client.role!=='admin')return;
 button.disabled=true;
 try {
  const local=validateWorkspace(JSON.parse(localStorage.getItem(localWorkspaceKey)||'null'));
  let remote=await client.load(),plan=localImportPlan(local,remote),busy=false;
  if(sharedClient!==client)return;
  const dialog=document.querySelector('#local-import-dialog');
  function completeInventory(trolley) {const source=plan.filter(row=>row.item.trolleyId===trolley.id),actual=remote.items.filter(item=>item.trolleyId===trolley.id);return source.length>0&&actual.length===source.length&&source.every(row=>actual.some(item=>sameRecord(row.item,item)));}
  function pendingHistory() {return local.trolleys.some(t=>t.status==='collected'&&remote.trolleys.some(r=>r.id===t.id&&r.status==='open')&&completeInventory(t));}
  function draw(results=null) {
   const total=status=>plan.filter(row=>row.status===status).length;
   dialog.innerHTML=`<div class="eyebrow">SAFE TEAM IMPORT</div><h2>Import local equipment</h2><p>Team ${escape(client.teamId)} · ${local.items.length} preserved local items. Historical technician initials stay attached to each item.</p><div class="restore-summary"><strong>${total('new')} ready to import</strong><span>${total('saved')} already saved · ${total('blocked')} need attention</span></div><p>Your local workspace and backup stay preserved. Reference spreadsheets and reviewed corrections can be transferred separately through Settings. Imported ready trolleys start open for a fresh check; completed collections are restored only when their whole inventory matches.</p><div class="table-wrap"><table><thead><tr><th>Serial / model</th><th>Trolley</th><th>Result</th></tr></thead><tbody>${plan.map(row=>`<tr><td>${escape(row.item.serial)}<br>${escape(row.item.model)}</td><td>${escape(row.item.trolley)}</td><td>${escape(row.reason)}</td></tr>`).join('')}</tbody></table></div><p id="local-import-result" role="status">${results?escape(results):'Review these items before confirming. Items that need attention are skipped.'}</p><div class="dialog-actions"><button class="secondary" id="close-local-import">Close</button><button class="primary" id="confirm-local-import" ${!total('new')&&!pendingHistory()?'disabled':''}>${results?'Retry remaining items':total('new')?'Import ready items':'Restore collection history'}</button></div>`;
   dialog.querySelector('#close-local-import').onclick=()=>dialog.close();
   dialog.querySelector('#confirm-local-import').onclick=run;
  }
  async function run() {
   if(busy||sharedClient!==client)return;
   busy=true;dialog.querySelectorAll('button').forEach(node=>node.disabled=true);
   const output=dialog.querySelector('#local-import-result');output.textContent='Checking the latest Firebase records…';
   const outcomes=[];
   try {
    remote=await client.load();if(sharedClient!==client)return;const fresh=localImportPlan(local,remote);
    if(importSignature(fresh)!==importSignature(plan)){plan=fresh;draw('The shared register changed. Review the updated results before importing.');return;}
    let added=0,restoredHistory=0;
    for(const row of plan.filter(row=>row.status==='new')) {
     if(sharedClient!==client)throw Error('The database connection changed. Reconnect and review the import again.');
     output.textContent=`Saving ${row.item.serial} to Firebase… (${added} saved)`;
     try {
      if(!remote.trolleys.some(t=>t.id===row.trolley.id)){
       const trolley={...row.trolley,status:'open',readyAt:'',readyBy:'',collectedAt:'',collectedBy:'',company:''};
       await client.writeTrolley(trolley,0);remote.trolleys.push(trolley);
      }
      await client.write(row.item,0,{historicalImport:true});row.status='saved';row.reason='Saved to Firebase';added++;
     }catch(error){row.reason=`Not imported: ${firebaseErrorMessage(error)}`;outcomes.push(`${row.item.serial}: ${firebaseErrorMessage(error)}`);}
    }
    // Recover partial historical imports on retry, but never collect a trolley
    // containing unrelated shared equipment or unresolved local records.
    remote=await client.load();
    for(const trolley of local.trolleys.filter(t=>t.status==='collected')) {
     if(sharedClient!==client)return;
     const shared=remote.trolleys.find(t=>t.id===trolley.id);
     if(shared?.status!=='open')continue;
     try {
      const review=await client.readinessSnapshot(trolley.id);
      if(sharedClient!==client)return;
      remote.items=review.items;remote.trolleys=remote.trolleys.map(row=>row.id===trolley.id?review.trolley:row);
      if(review.trolley.status!=='open'||review.trolley.name!==trolley.name||!completeInventory(trolley)){outcomes.push(`${trolley.name}: collection history not restored because the full inventory does not match`);continue;}
      await client.writeTrolley(trolley,review.version,{historicalImport:true});restoredHistory++;
     }catch(error){outcomes.push(`${trolley.name}: collection history not restored: ${firebaseErrorMessage(error)}`);}
    }
    remote=await client.load();
    if(sharedClient!==client)throw Error('The database connection changed. Reconnect to check the saved records.');
    state.items=remote.items;state.trolleys=remote.trolleys;state.referenceExamples=remote.examples;state.referenceCorrections=remote.corrections||[];connectionPhase='connected';lastConfirmedAt=new Date().toISOString();
    persist();updateRegister();updateHistory();updateConnectionStatus();
    document.querySelector('.stats .stat-content strong').innerHTML=`${state.items.length}<small> items recorded</small>`;document.querySelector('a[href="#inventory"] span').textContent=state.items.length;
    // Keep individual failure explanations visible; a retry rechecks server data.
    draw(`${added} item${added===1?'':'s'} saved to Firebase. ${restoredHistory?`${restoredHistory} collection histor${restoredHistory===1?'y':'ies'} restored. `:''}${outcomes.length?outcomes.join(' · '):'Your preserved local records are unchanged.'}`);
   }catch(error){if(sharedClient!==client||!dialog.querySelector('#close-local-import'))return;output.textContent=`Import stopped. ${firebaseErrorMessage(error)} Items already saved remain in Firebase. Your local workspace is unchanged; reopen the preview to check remaining items.`;dialog.querySelector('#close-local-import').disabled=false;}
   finally{busy=false;}
  }
  draw();dialog.oncancel=event=>{if(busy)event.preventDefault();};dialog.showModal();
 }catch(error){document.querySelector('#database-error').textContent=firebaseErrorMessage(error);}
 finally{button.disabled=false;}
}
async function resumeDatabase() {
 if(!sharedLocked||workspaceManuallyLocked)return;
 if(idleExpired(lastActivity,Date.now(),devicePreferences.idleMinutes)){await lockWorkspace('Workspace locked after inactivity. Sign in to continue.');return;}
 notice='Cached shared register. Reconnecting to Firebase; team changes stay locked until connected.';render();
 try{const saved=JSON.parse(localStorage.getItem('decompro.firebaseConfig')||'{}');if(!saved.config)throw Error('Open Database to configure the connection.');await activateDatabase(saved.config,saved.teamId);}
 catch(error){notice=`Shared register is locked. Open Database to sign in or return to your local workspace. ${error.message}`;render();}
}
function downloadFile(data,name,type) {
 const url=URL.createObjectURL(new Blob([data],{type}));
 const link=document.createElement('a');link.href=url;link.download=name;
 document.body.append(link);
 try {link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
function downloadBackup() {
 downloadFile(JSON.stringify({app:'DecomPro',version:1,exportedAt:new Date().toISOString(),state},null,2),`DecomPro-${testWorkspace?'TEST-':''}backup-${today()}.json`,'application/json');
 notice='Workspace backup downloaded. Keep it safe to recover records on another browser.';render();
}
async function prepareRestore(e) {
 if(sharedLocked){e.target.value='';notice='Disconnect from the shared database before restoring a local backup. Team records are not replaced by browser backups.';render();return;}
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try {
  if(file.size>20*1024*1024)throw Error('This backup is too large. The maximum size is 20 MB.');
  pendingRestore=parseBackup(await file.text());
  const dialog=document.querySelector('#restore-dialog');
  dialog.innerHTML=`<div class="eyebrow">WORKSPACE RECOVERY</div><h2>Restore this backup?</h2><p>${escape(file.name)}</p><div class="restore-summary"><strong>${pendingRestore.items.length} items</strong><span>${pendingRestore.profiles.length} technician profiles · ${Object.keys(pendingRestore.draft).length} captured fields</span></div><p class="restore-warning">This replaces this browser’s ${state.items.length} current records, profiles, batch defaults and scanning progress. Download a backup of your current workspace first if you want to keep it.</p><p id="restore-error" role="alert"></p><div class="dialog-actions"><button class="secondary" id="cancel-restore">Cancel</button><button class="primary" id="confirm-restore">Replace workspace & restore</button></div>`;
  dialog.showModal();
  document.querySelector('#cancel-restore').onclick=()=>{pendingRestore=null;dialog.close();};
  document.querySelector('#confirm-restore').onclick=()=>{
   try {localStorage.setItem(key,JSON.stringify(pendingRestore));}
   catch {document.querySelector('#restore-error').textContent='Browser storage is unavailable or full. Your current workspace has not been replaced.';return;}
   state=pendingRestore;resetRescan();pendingRestore=null;storageError='';search='';missingDetailsOnly=false;trolleyViewId='';selectedEquipment.clear();collectionReviewTrolley='all';collectionReviewKind='all';scanning=false;lastEmpty=0;collectionViewId=state.activeCollectionId||'';notice='Backup restored. Select Start scanning when you are ready.';location.hash='inventory';render();
  };
 } catch(error) {pendingRestore=null;notice=`Backup was not restored. ${error instanceof SyntaxError?'The file is not valid JSON.':error.message}`;render();}
}
async function exportExcel(selectedOnly=false) {
 if(exporting)return;
 if(!selectedOnly&&collectionViewId&&!trolleyViewId)return exportCollection(collectionViewId);
 const selected=state.trolleys.find(t=>t.id===trolleyViewId);
 const items=(selectedOnly?state.items.filter(item=>selectedEquipment.has(item.id)):trolleyViewId?(selected?state.items.filter(item=>trolleyForItem(item,selected)):[]):state.items).map(item=>({...item}));
 if(!items.length){notice='There are no saved items to export. Save an item first; an unsaved scan is not included.';render();return;}
 exporting=true;
 const button=document.querySelector('#export');button.disabled=true;button.textContent='Preparing Excel…';
 try {
  const {supplierExcel,supplierExcelType}=await import('./supplier-excel.js');const data=await supplierExcel(items);
  downloadFile(data,`Decom-${today()}.xlsx`,supplierExcelType);
  notice=`Excel download started with ${items.length} saved item${items.length===1?'':'s'}.`;render();
 }catch(error){
  const detail=error?.message||'The browser could not create the Excel download.';
  const reason=/dynamically imported|module script|preload/i.test(detail)?'The Excel component could not load. Refresh the app to load the latest version and retry.':detail;
  const count=state.items.length;
  notice=`Excel export failed: ${reason} ${count?`The current workspace contains ${count} saved item${count===1?'':'s'}. Use Backup to download the workspace.`:'There are no saved items in the current workspace.'}`;
  render();
 }finally {
  exporting=false;
  const button=document.querySelector('#export');if(button)updateRegister();
 }
}

document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!rescan.enabled&&state.step===fields.length&&!document.querySelector('dialog[open]')&&!['INPUT','SELECT','BUTTON','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();saveItem();}});
window.addEventListener('hashchange',()=>{trolleyViewId=readTrolleyHash();updateRegister();updateHistory();updateOverviewLayout();document.querySelector(location.hash==='#overview'?'#overview':location.hash==='#collection-history'?'#collection-history':location.hash==='#collection-review'?'#collection-review':location.hash==='#station'||location.hash.startsWith('#station/trolley/')?'#station':location.hash==='#collections'?'#collections':'#inventory')?.scrollIntoView({behavior:'smooth'});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateSessionSummary();});
window.addEventListener('offline',updateConnectionStatus);
window.addEventListener('online',()=>{connectionPhase='syncing';updateConnectionStatus();});
function recordActivity() {lastActivity=Date.now();try{sessionStorage.setItem('decompro.lastActivity',String(lastActivity));}catch{}}
async function lockWorkspace(message='Workspace locked. Sign in to continue.') {
 if(!sharedLocked||lockInProgress)return;
 lockInProgress=true;let completeLock;lockCompletion=new Promise(resolve=>completeLock=resolve);
 try {
  workspaceManuallyLocked=true;try{localStorage.setItem('decompro.workspaceLocked','true');}catch{}
  const input=document.querySelector('#scan');if(input&&fields[state.step]&&input.value.length<=1000){if(input.value.trim())state.draft[fields[state.step][0]]=input.value;else delete state.draft[fields[state.step][0]];}persist();
  resetRescan();const client=sharedClient;lockedAccountEmail=client?.email||lockedAccountEmail;sharedClient=null;scanning=false;window.speechSynthesis?.cancel();notice=message;render();
  if(client?.logout)await client.logout();else {client?.stop();const saved=JSON.parse(localStorage.getItem('decompro.firebaseConfig')||'{}');if(saved.config){const {disconnectFirebaseAuth}=await import('./firebase-db');await disconnectFirebaseAuth(saved.config);}}
 }catch{
  notice='Workspace locked. Firebase sign-out could not be confirmed; sign in again before continuing.';
  const messageNode=document.querySelector('.workspace-lock .session-note');if(messageNode)messageNode.textContent=notice;else render();
 }finally{lockInProgress=false;lockCompletion=null;completeLock();}
}
function checkInactivity() {if(sharedLocked&&sharedClient&&idleExpired(lastActivity,Date.now(),devicePreferences.idleMinutes))lockWorkspace('Workspace locked after inactivity. Sign in to continue.');}
for(const event of ['pointerdown','keydown','input'])document.addEventListener(event,()=>{if(sharedClient){checkInactivity();if(sharedClient)recordActivity();}},{capture:true});
window.addEventListener('storage',event=>{if(event.key==='decompro.workspaceLocked'&&event.newValue==='true'&&sharedClient)lockWorkspace('Workspace locked from another tab. Sign in to continue.');});
setInterval(checkInactivity,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkInactivity();});
render();
if(!localTabBlocked)resumeDatabase();
