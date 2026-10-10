import {sessionSummary,missingEquipmentDetails} from './session-summary.js';
import {localImportPlan,importSignature,sameRecord} from './local-import.js';
import {checkReadiness,readinessFields,validateReadinessNotes} from './readiness.js';
import { fields, headers, supplierRow, duplicateSerial, normalizeAssetNumber, validAssetNumber } from './data';
import './style.css';
import { cleanExamples, referenceRowsFromWorkbook } from './recognition';
import {buildImportPreview,importCounts} from './import-preview.js';
import {snapshotEvidence,sourceKinds} from './recognition-evidence.js';
import builtInReferences from './reference-catalogue.json';
import {lookupReference,libraryRows,validateCorrections} from './reference-library';
import { availableVoices, utteranceFor } from './speech';
import { defaultFirebaseConfig } from './firebase-config';
import { firebaseErrorMessage } from './firebase-errors';
import { createId } from './ids';
import {createTrolley,defaultDepartment,findTrolley,trolleyForItem} from './trolleys';
import { defaultFields, validateWorkspace, parseBackup, filteredItems, validDate, defaultSettings } from './workspace';
const icons = {
 barcode:'<path d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M7 8v8m3-8v8m4-8v8m3-8v8"/>',
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
const key = 'decompro.v1';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
let state = { captureOrder:'serial-first', activeTrolleyId:'', trolleys:[], profiles:[{name:'Jawad',code:'JA'}], active:'JA', defaults:{date:today(),description:'Monitor',manufacturer:'',source:'Storage',reason:'EOL',trolley:'Trolley 01'}, items:[], draft:{}, step:0, voice:true, settings:{...defaultSettings}, referenceExamples:[], referenceCorrections:[] };
let storageError = '', notice = '', scanning = false, lastEmpty = 0;
let sharedClient = null;
let readinessSession=0;
let connectionPhase='syncing',lastConfirmedAt='',historySearch='';
let sharedLocked = false;
let saving=false, exporting=false, editingVersion=0;
const localWorkspaceKey='decompro.localWorkspace';
let librarySearch='',libraryFilter='all',libraryLimit=40;
let pendingImport=null,importBusy=false,importLimit=60,importFilter='all';
let summaryExpanded=false,missingDetailsOnly=false;
let search = '', editingId = null, pendingRestore = null;
try { sharedLocked=localStorage.getItem('decompro.mode')==='shared'; const saved=localStorage.getItem(key); if(saved) state=validateWorkspace(JSON.parse(saved)); } catch { storageError='Saved data could not be loaded. Export any visible records before continuing. Storage has been paused to protect the saved data.'; }
if(!sharedLocked) {
 for(const name of new Set([state.defaults.trolley,...state.items.map(item=>item.trolley)]))if(name&&!state.trolleys.some(t=>t.name===name))state.trolleys.push(createTrolley(name));
 for(const item of state.items)if(!item.trolleyId)item.trolleyId=state.trolleys.find(t=>t.name===item.trolley)?.id;
}
let trolleyViewId=readTrolleyHash();
function readTrolleyHash(){return location.hash.match(/^#trolley\/([A-Za-z0-9-]+)$/)?.[1]||'';}
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function persist() { if(storageError) return false; try { localStorage.setItem(key,JSON.stringify(state)); return true; } catch { storageError='Browser storage is unavailable or full. Export your records now; changes may be lost on refresh.'; render(); return false; } }
function speak(text) { if(!state.voice || !('speechSynthesis' in window)) return; speechSynthesis.cancel(); const u=utteranceFor(text,state.settings); speechSynthesis.speak(u); }
function prompt() { speak(state.step<fields.length ? `Next, ${fields[state.step][1]}` : 'Review equipment. Press Enter to save and place it in the trolley.'); }
function focus() { if(scanning) document.querySelector('#scan')?.focus(); }
function render() {
 const current=fields[state.step]; const profile=state.profiles.find(p=>p.code===state.active);
 const modelMatch=state.step===1&&state.draft.serial?lookupSerial(state.draft.serial):null;
 const modelCandidates=modelMatch?.method==='conflict'?modelMatch.candidates||[]:[];
 document.querySelector('#app').innerHTML=`
 <aside><a class="brand" href="#"><span class="brand-mark">${icon('barcode')}</span><span>Decom<span class="brand-light">Pro</span></span></a><div class="workspace">IT OPERATIONS</div><a class="nav active" href="#station">${icon('grid')} Scan station <span class="nav-active-dot"></span></a><a class="nav" href="#inventory">${icon('list')} Collection register <span>${state.items.length}</span></a><a class="nav" href="#collection-history">${icon('check')} Collection history</a><button class="nav settings-nav" id="settings" aria-label="Open settings">${icon('settings')}<span class="settings-nav-label">Settings</span></button><button class="nav settings-nav" id="manage-trolleys" aria-label="Trolleys">${icon('box')}<span class="settings-nav-label">Trolleys</span></button><button class="nav settings-nav" id="database" aria-label="Shared database">${icon('box')}<span class="settings-nav-label">Database</span></button>${sharedClient?.role==='admin'?`<button class="nav settings-nav" id="admin" aria-label="Administration">${icon('user')}<span class="settings-nav-label">Admin</span></button>`:''}<div class="aside-bottom"><span class="dot"></span> ${sharedClient?'Shared Firebase workspace':sharedLocked?'Shared workspace · reconnect':'Local workspace'}<p>${sharedClient?escape(sharedClient.email):'Export or back up after each session.'}</p></div></aside>
 <main><div id="connection-status" class="connection-status" aria-live="polite"></div><div class="breadcrumb">Workspace <span>/</span> Decommissioning</div><header><div><div class="eyebrow">OUT WITH THE OLD. ON WITH THE NEW.</div><h1>Make room for what’s next<span>.</span></h1><p>Your scan station for a smoother, simpler collection day.</p></div><div class="profile"><label for="profile">Technician profile</label><select id="profile" ${sharedLocked?'disabled':''}>${state.profiles.map(p=>`<option value="${escape(p.code)}" ${p.code===state.active?'selected':''}>${escape(p.name)} · ${escape(p.code)}</option>`).join('')}</select><button class="text-button" id="add-profile" ${sharedLocked?'disabled':''}>${icon('plus')} Add technician</button></div></header>
 ${storageError?`<div class="alert error" role="alert">${escape(storageError)}</div>`:''}${notice?`<div class="alert" role="status">${escape(notice)}</div>`:''}
 <div class="stats"><div><div class="stat-icon mint">${icon('box')}</div><div class="stat-content"><span>ITEMS IN REGISTER</span><strong>${state.items.length}<small> items recorded</small></strong></div></div><div><div class="stat-icon blue">${icon('grid')}</div><div class="stat-content"><span>CURRENT TROLLEY</span><strong>${escape(state.defaults.trolley)}</strong><button class="text-button trolley-switch" id="change-trolley">Change trolley ${icon('arrow')}</button></div></div><div><div class="stat-icon peach">${icon('user')}</div><div class="stat-content"><span>DISPOSAL RECORDED BY</span><strong>${escape(profile?.name||'Select technician')}<small>${escape(profile?.code||'')}</small></strong></div></div></div>
 <section id="session-summary" class="card session-summary" aria-label="Session summary"></section>
 <div class="station-layout"><section id="station" class="card station"><div class="section-top"><span class="eyebrow"><span class="station-dot"></span> SCAN STATION</span><button id="voice" class="pill">${icon('voice')} ${state.voice?'Voice on':'Voice off'}</button></div><div class="steps">${fields.map((f,i)=>`<button class="step ${i===state.step?'current':''} ${i<state.step?'complete':''}" data-step="${i}" ${i>state.step?'disabled':''}><span>${i<state.step?icon('check'):i+1}</span>${escape(f[1].replace(' number',''))}</button>`).join('')}</div>
 ${state.settings.reuseModel?`<div class="batch-model-chip">Batch model <strong>${escape(state.settings.batchModel)}</strong></div>`:''}<div class="scan-icon">${icon(current?'barcode':'check')}</div><div class="scan-label">${current?`FIELD ${state.step+1} OF ${fields.length}`:'READY TO RECORD'}</div><h2>${current?escape(current[1]):'Review this equipment'}</h2><p>${current?'Scan the label or type its value, then press Enter.':'Check the values below, then save this item to the collection register.'}</p>
 ${current?`<form id="scan-form"><label class="sr-only" for="scan">${escape(current[1])}</label><input id="scan" autocomplete="off" spellcheck="false" placeholder="${current[0]==='asset'?'Asset number: A1234 or N/A':'Waiting for a scan…'}" value="${escape(state.draft[current[0]]||'')}"><button class="primary" type="submit">Capture value ${icon('arrow')}</button></form><div class="scan-actions"><button id="start" class="text-button">${icon(scanning?'voice':'play')} ${scanning?'Repeat spoken prompt':'Start scanning'}</button><button id="skip" class="secondary">${icon('skip')} Skip · N/A</button></div><div class="hint">${current[0]==='asset'?'Format: A followed by four digits (A1234). ':''}Double-click the scanner trigger (two empty Enter presses) to skip.</div>`:` ${state.draft.recognitionNeedsReview?`<label class="recognition-review"><input id="confirm-recognition" type="checkbox" ${state.draft.recognitionConfirmed?'checked':''}> I checked the suggested model and manufacturer against this equipment.</label>`:''}<button id="save" class="primary wide" ${saving?'disabled':''}>${saving?'Saving…':'Save item & start next'} ${icon('arrow')}</button><p id="save-feedback" aria-live="polite">${escape(notice||storageError)}</p>`}
 ${recognitionEvidenceCard()}
 ${modelCandidates.length?`<div class="model-candidates"><strong>Choose a matching model</strong><p>${modelMatch.prefix?`Prefix ${escape(modelMatch.prefix)}`:'This serial'} has conflicting reference models. Check the equipment label before choosing.</p><label for="model-candidate">Reference model and manufacturer</label><select id="model-candidate"><option value="">Choose a suggestion…</option>${modelCandidates.map((candidate,index)=>`<option value="${index}">${escape(candidate.model)} · ${escape(candidate.manufacturer)} (${candidate.support} example${candidate.support===1?'':'s'})</option>`).join('')}</select><button type="button" class="secondary" id="use-model-candidate">Use selected model</button><p>You can also scan or type the model above.</p></div>`:''}
 ${state.draft.manufacturer!==undefined?`<div class="recognized-manufacturer"><label for="recognized-maker">Manufacturer</label><input id="recognized-maker" aria-label="Manufacturer for this item" value="${escape(state.draft.manufacturer)}" maxlength="1000"><span>Check these details before saving.</span></div>`:''}<div class="captured">${fields.filter(f=>state.draft[f[0]]).map(([k,label])=>`<div><span>${escape(label)}</span><strong>${escape(state.draft[k])}</strong></div>`).join('')||`<span class="capture-empty">${icon('list')} Your captured values will appear here.</span>`}</div><div class="station-footer"><button id="back" class="text-button" ${state.step===0?'disabled':''}>${icon('back')} Previous field</button><button id="reset" class="text-button">Clear current item</button></div></section>
 <section class="card defaults"><div class="defaults-heading"><span class="defaults-icon">${icon('list')}</span><div class="eyebrow">BATCH DEFAULTS</div></div><h2>Set once. Keep scanning.</h2><p>Applied to each item when you save it.</p><form id="defaults">${defaultFields.map(([k,label,type])=>`<label for="default-${k}">${label}</label><input id="default-${k}" name="${k}" type="${type}" value="${escape(state.defaults[k])}" required>`).join('')}<button class="secondary wide" type="submit">Apply batch defaults</button></form><div class="note">Technician initials automatically fill <strong>Who disposed of it?</strong> in your Excel export.</div></section></div>
 <section id="inventory" class="card register"><div class="section-top"><div><div class="eyebrow">COLLECTION REGISTER</div><h2><span id="inventory-title">Ready for the next collection</span> <span class="count">${state.items.length}</span></h2></div><button id="export" class="primary" ${!state.items.length||exporting?'disabled':''}>${icon('download')} ${exporting?'Preparing Excel…':'Export Excel'}</button></div><div id="trolley-inventory-banner"></div><div class="register-tools"><div class="search-field">${icon('list')}<label class="sr-only" for="register-search">Search collection register</label><input id="register-search" type="search" placeholder="Search equipment, serial, trolley or technician…" value="${escape(search)}"></div><div class="backup-actions"><button class="secondary" id="backup">${icon('download')} Backup</button><button class="secondary" id="restore">Restore backup</button><input class="sr-only" id="backup-file" type="file" accept=".json,application/json" tabindex="-1" aria-label="Choose backup file"></div></div><div id="review-filter"></div><div id="search-count" class="search-count" aria-live="polite"></div><div class="table-wrap"><table><thead><tr><th>Equipment / model</th><th>Serial number</th><th>Asset number</th><th>Trolley</th><th>Technician</th><th>Disposal date</th><th>Actions</th></tr></thead><tbody></tbody></table></div><div class="register-footer">Excel exports the selected trolley, or all inventory when no trolley is selected. Search does not change the export. Backups also keep trolley details, profiles and captured progress.</div></section>
 <section id="collection-history" class="card collection-history" hidden><div class="section-top"><div><div class="eyebrow">COMPLETED COLLECTIONS</div><h2>Collection history</h2><p>Retained trolley inventories and collection details.</p></div><span id="history-total" class="tag"></span></div><label for="history-search">Search collected trolleys</label><input id="history-search" type="search" placeholder="Reference, trolley, company or technician…" value="${escape(historySearch)}"><div id="history-results"></div></section>
 <footer>DecomPro · Less clicking. More clearing.</footer></main><dialog id="profile-dialog"><form id="profile-form"><h2>Add a technician</h2><p>Local profiles identify records; they are not secure sign-in accounts.</p><label for="name">Name</label><input id="name" name="name" required maxlength="60"><label for="code">Disposal initials</label><input id="code" name="code" required maxlength="12"><div class="dialog-actions"><button class="secondary" type="button" id="cancel-profile">Cancel</button><button class="primary">Save profile</button></div><p id="profile-error" role="alert"></p></form></dialog><dialog id="edit-dialog"></dialog><dialog id="restore-dialog"></dialog><dialog id="settings-dialog"></dialog><dialog id="import-preview-dialog"></dialog><dialog id="reference-library-dialog"></dialog><dialog id="reference-edit-dialog"></dialog><dialog id="scan-correction-dialog"></dialog><dialog id="trolley-dialog"></dialog><dialog id="trolley-manager"></dialog><dialog id="database-dialog"></dialog><dialog id="local-import-dialog"></dialog><dialog id="team-access-dialog"></dialog><dialog id="admin-dialog" class="admin-dialog"></dialog>`;
 bind(); updateRegister(); updateHistory(); updateConnectionStatus(); focus();
}
function capture(value) {
 value=value.trim();if(!value||state.step>=fields.length)return;
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
  const match=value.toUpperCase()==='N/A'?null:lookupSerial(value);
  delete state.draft.recognitionEvidence;delete state.draft.recognitionCorrected;
  if(match)state.draft.recognitionEvidence=snapshotEvidence(match);
  if(match&&match.method!=='conflict') {
   state.draft={...state.draft,serial:value,model:match.model,manufacturer:match.manufacturer,recognitionNeedsReview:match.method!=='exact',recognitionConfirmed:false};state.step=2;
   notice=`${match.method==='exact'?'Known serial':match.method==='similar'?`Serial family suggestion (prefix ${match.prefix}; reference ${match.referenceSerials.join(', ')})`:`Pattern suggestion (prefix ${match.prefix})`}: ${match.model} · ${match.manufacturer}. ${match.support} distinct supporting example${match.support===1?'':'s'}. ${match.method==='similar'?'Check the scanned serial and physical model label before saving.':'Verify before saving.'}`;
   lastEmpty=0;persist();render();speak(`Suggested model, ${match.model}. Manufacturer, ${match.manufacturer}. Next, barcode.`);return;
  }
  if(match?.method==='conflict'||Object.hasOwn(state.draft,'recognitionNeedsReview')||(state.draft.serial&&state.draft.serial!==value)) {
   delete state.draft.model;delete state.draft.manufacturer;
  }
  delete state.draft.recognitionNeedsReview;delete state.draft.recognitionConfirmed;
  state.draft.serial=value;
  if(match?.method==='conflict'&&match.manufacturer) {
   state.draft.manufacturer=match.manufacturer;state.draft.recognitionNeedsReview=true;state.draft.recognitionConfirmed=false;state.step=1;
   notice=`Manufacturer suggestion: ${match.manufacturer}. ${match.prefix?`Prefix ${match.prefix}`:'This exact serial'} has ${match.support} distinct supporting example${match.support===1?'':'s'} with the same manufacturer but different model labels. Scan or type the model, or choose a checked suggestion. Verify before saving.`;
   lastEmpty=0;persist();render();speak(`Suggested manufacturer, ${match.manufacturer}. Model is uncertain. Next, model number.`);return;
  }
  if(!state.draft.model&&state.settings.reuseModel&&match?.method!=='conflict')state.draft.model=state.settings.batchModel;
  state.step=state.draft.model?2:1;
  notice=match?.method==='conflict'?'Several reference models match this serial or prefix. Choose a checked suggestion below, or enter the model and manufacturer manually.':state.draft.model?'Serial captured. No reliable match; using the batch model. Check the manufacturer.':'Serial captured. No reliable match yet; enter the model and manufacturer manually.';
  lastEmpty=0;persist();render();speak(state.step===1?'Serial captured. Next, model number.':'Serial captured. Next, barcode.');return;
 }
 if(state.step===1&&state.draft.recognitionNeedsReview)state.draft.recognitionConfirmed=false;
 state.draft[fields[state.step][0]]=value;state.step++;
 lastEmpty=0;notice='';persist();render();prompt();
}

function saveFeedback(message,field) {
 notice=message;render();
 if(field)document.querySelector(field==='manufacturer'&&state.draft.manufacturer!==undefined?'#recognized-maker':`#default-${field}`)?.focus();
}
async function saveItem() {
 if(saving||!writable())return;
 if(storageError&&!sharedClient){saveFeedback('Local saving is paused because browser storage is unavailable. Back up your workspace before refreshing or changing browser settings.');return;}
 const profile=state.profiles.find(p=>p.code===state.active);
 if(!profile){saveFeedback('Choose a technician first.');return;}
 const batch=Object.fromEntries([...new FormData(document.querySelector('#defaults'))].map(([k,v])=>[k,v.trim()]));
 const manufacturer=(state.draft.manufacturer??batch.manufacturer).trim();
 const missing=defaultFields.find(([key])=>!(key==='manufacturer'?manufacturer:batch[key]));
 if(missing){saveFeedback(`Enter ${missing[1].toLowerCase()} before saving.`,missing[0]);return;}
 if(!validDate(batch.date)){saveFeedback('Enter a valid disposal date before saving.','date');return;}
 const missingScan=fields.find(([key])=>!state.draft[key]);
 if(missingScan){saveFeedback(`Capture ${missingScan[1].toLowerCase()} or skip it as N/A before saving.`);return;}
 if(!validAssetNumber(state.draft.asset)){saveFeedback('Asset number must be A followed by four digits, for example A1234, or N/A. Use Previous field to correct it.');return;}
 if(state.draft.recognitionNeedsReview&&!state.draft.recognitionConfirmed){saveFeedback('Check the suggested model and manufacturer against this equipment, then tick the confirmation before saving.');return;}
 if(duplicateSerial(state.items,state.draft.serial)){saveFeedback('This serial number is already in the register. Check the current item before saving.');speak(notice);return;}
 saving=true;updateConnectionStatus();
 const button=document.querySelector('#save');if(button){button.disabled=true;button.textContent='Saving…';}
 document.querySelector('#save-feedback').textContent=sharedClient?'Saving to the shared team database…':'Saving item…';
 try {
  const trolley=await resolveTrolley(batch.trolley);
  if(trolley.status!=='open')throw Error('This trolley is ready or collected. Reopen a ready trolley or select an open trolley before saving.');
  const item={...batch,...(state.draft.recognitionNeedsReview!==undefined?{recognitionNeedsReview:state.draft.recognitionNeedsReview,recognitionConfirmed:state.draft.recognitionConfirmed===true}:{}),trolleyId:trolley.id,...Object.fromEntries(fields.map(([key])=>[key,state.draft[key]])),asset:normalizeAssetNumber(state.draft.asset),manufacturer,technician:sharedClient?.profile.code||profile.code,id:createId()};
  if(sharedClient)await sharedClient.write(item);
  const next={...state,defaults:batch,items:[...state.items.filter(i=>i.id!==item.id),item],draft:state.settings.reuseModel?{model:state.settings.batchModel}:{},step:0};
  // A local save must reach storage before clearing the scanned draft.
  if(!sharedClient)localStorage.setItem(key,JSON.stringify(next));
  state=next;if(sharedClient)persist();
  notice=sharedClient?'Item saved to Firebase. It is available to your team on other devices. Place it in the caged trolley.':'Item saved in this browser. Back up after your session, or connect to Firebase to share it. Place it in the caged trolley.';render();
  speak(`Item recorded. Place it in the caged trolley. Next, ${fields[state.step][1]}.`);
 }catch(error){
  if(error.name==='QuotaExceededError'||error.name==='SecurityError')saveFeedback('Item not saved: browser storage is unavailable or full. Your scanned item is still here. Download a backup before refreshing.');
  else saveFeedback(`Item not saved. ${firebaseErrorMessage(error)}`);
 }finally {saving=false;updateConnectionStatus();document.querySelector('#save')?.removeAttribute('disabled');const remaining=document.querySelector('#save');if(remaining)remaining.innerHTML=`Save item & start next ${icon('arrow')}`;}
}

function writable() {
 if(sharedLocked&&navigator.onLine===false){notice='You are offline. Team changes are paused; your captured item is kept here. Reconnect before saving, or download a backup before closing this browser.';render();return false;}
 if(sharedLocked&&!sharedClient){notice='Reconnect to the shared database before changing team records, or disconnect to return to your local workspace.';render();return false;}
 return true;
}

function bind() {
 document.querySelector('#database').onclick=openDatabase;
 document.querySelector('#history-search').oninput=e=>{historySearch=e.target.value;updateHistory();};
 document.querySelector('#manage-trolleys').onclick=openTrolleyManager;
 document.querySelector('#settings').onclick=openSettings;
 document.querySelector('#change-trolley').onclick=openTrolley;
 document.querySelector('#admin')?.addEventListener('click',async()=>{const client=sharedClient;try{const {openAdmin}=await import('./admin.js');if(sharedClient!==client)return;await openAdmin(client,name=>{if(sharedClient!==client)return;state.profiles[0].name=name;client.profile.name=name;persist();document.querySelector('#profile option').textContent=`${name} · ${state.active}`;});}catch{notice='The admin section could not load. Refresh the app and try again. Your register is preserved.';render();}});
 document.querySelector('#profile').onchange=e=>{state.active=e.target.value;persist();render();};
 document.querySelector('#voice').onclick=()=>{state.voice=!state.voice;persist();render();if(state.voice)prompt();else window.speechSynthesis?.cancel();};
 document.querySelector('#start')?.addEventListener('click',()=>{scanning=true;focus();prompt();});
 document.querySelector('#scan-form')?.addEventListener('submit',e=>{e.preventDefault();scanning=true;const value=document.querySelector('#scan').value;if(value.trim())capture(value);else {const now=Date.now();if(lastEmpty&&now-lastEmpty<state.settings.skipWindow){capture('N/A');}else {lastEmpty=now;notice=`Press Enter again within ${state.settings.skipWindow/1000} seconds to skip this field.`;document.querySelector('.hint').textContent=notice;}}});
 document.querySelector('#skip')?.addEventListener('click',()=>{scanning=true;capture('N/A');});
 document.querySelector('#save')?.addEventListener('click',saveItem);
 document.querySelector('#reject-suggestion')?.addEventListener('click',openScanCorrection);
 document.querySelector('#use-model-candidate')?.addEventListener('click',()=>{
  const selected=document.querySelector('#model-candidate').value;if(selected==='')return;
  const match=lookupSerial(state.draft.serial);const candidate=match?.candidates?.[Number(selected)];if(!candidate)return;
  state.draft.manufacturer=candidate.manufacturer;state.draft.recognitionNeedsReview=true;state.draft.recognitionConfirmed=false;capture(candidate.model);
 });
 document.querySelector('#recognized-maker')?.addEventListener('input',e=>{state.draft.manufacturer=e.target.value;if(state.draft.recognitionNeedsReview){state.draft.recognitionConfirmed=false;const check=document.querySelector('#confirm-recognition');if(check)check.checked=false;if(state.draft.recognitionCorrected){const certainty=document.querySelector('#recognition-certainty');if(certainty)certainty.textContent='Edited details need a fresh label check.';}}persist();});
 document.querySelector('#confirm-recognition')?.addEventListener('change',e=>{state.draft.recognitionConfirmed=e.target.checked;persist();});
 document.querySelector('#back').onclick=()=>{if(state.step>0){state.step--;lastEmpty=0;persist();render();prompt();}};
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{state.step=Number(b.dataset.step);lastEmpty=0;persist();render();prompt();});
 document.querySelector('#reset').onclick=()=>{if(Object.keys(state.draft).length&&!confirm('Clear the current unsaved item?'))return;resetDraft();lastEmpty=0;persist();render();prompt();};
 document.querySelector('#defaults').addEventListener('input',e=>{
  if(!defaultFields.some(([key])=>key===e.target.name))return;
  if(e.target.name==='date'&&!validDate(e.target.value))return;
  if(e.target.name==='trolley'&&state.trolleys.find(t=>t.id===state.activeTrolleyId)?.name!==e.target.value)state.activeTrolleyId='';
  state.defaults[e.target.name]=e.target.value;persist();
 });
 document.querySelector('#defaults').onsubmit=e=>{e.preventDefault();state.defaults=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,v.trim()]));notice='Batch defaults applied.';persist();render();};
 document.querySelector('#register-search').oninput=e=>{search=e.target.value;updateRegister();};
 document.querySelector('#inventory tbody').onclick=async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.edit) openEditor(button.dataset.edit);
  if(button.dataset.delete && writable() && confirm('Remove this item from the collection register?')) {
   try {const item=state.items.find(i=>i.id===button.dataset.delete);if(state.trolleys.some(t=>t.status!=='open'&&trolleyForItem(item,t)))throw Error('Ready or collected trolley contents are locked. Reopen a ready trolley before changing equipment.');if(sharedClient)await sharedClient.write(item,sharedClient.versionFor(item.id),{deleted:true});state.items=state.items.filter(i=>i.id!==button.dataset.delete);persist();render();}
   catch(error){notice=`Removal failed. ${error.message}`;render();}
  }
 };
 document.querySelector('#backup').onclick=downloadBackup;
 document.querySelector('#restore').onclick=()=>document.querySelector('#backup-file').click();
 document.querySelector('#backup-file').onchange=prepareRestore;
 document.querySelector('#export').onclick=exportExcel;
 document.querySelector('#add-profile').onclick=()=>document.querySelector('#profile-dialog').showModal();
 document.querySelector('#cancel-profile').onclick=()=>document.querySelector('#profile-dialog').close();
 document.querySelector('#profile-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),name=f.get('name').trim(),code=f.get('code').trim().toUpperCase();if(!name||!code||state.profiles.some(p=>p.code===code)){document.querySelector('#profile-error').textContent='Enter a name and unique disposal initials.';return;}state.profiles.push({name,code});state.active=code;persist();render();};
}
function resetDraft() {
 state.draft=state.settings.reuseModel?{model:state.settings.batchModel}:{};
 state.step=0;
}
function openTrolley() {
 if(!writable())return;
 const known=state.trolleys.filter(t=>t.status==='open').map(t=>t.name);
 const dialog=document.querySelector('#trolley-dialog');
 dialog.innerHTML=`<form id="trolley-form"><div class="eyebrow">COLLECTION TROLLEYS</div><h2>Switch to another trolley</h2><p>New records will use this trolley. Existing records stay where they are; use Edit to move an item.</p><label for="trolley-name">Trolley name</label><input id="trolley-name" name="trolley" list="known-trolleys" value="${escape(state.defaults.trolley)}" required maxlength="1000"><datalist id="known-trolleys">${known.map(name=>`<option value="${escape(name)}"></option>`).join('')}</datalist><div class="trolley-list">${known.map(name=>`<button type="button" class="secondary" data-trolley="${escape(name)}">${escape(name)} <span>${state.items.filter(item=>item.trolley===name).length} items</span></button>`).join('')}</div><p id="trolley-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-trolley">Cancel</button><button class="primary">Use trolley</button></div></form>`;
 dialog.showModal();
 document.querySelector('#cancel-trolley').onclick=()=>dialog.close();
 dialog.querySelectorAll('[data-trolley]').forEach(button=>button.onclick=()=>document.querySelector('#trolley-name').value=button.dataset.trolley);
 document.querySelector('#trolley-form').onsubmit=async e=>{
  e.preventDefault();const trolley=document.querySelector('#trolley-name').value.trim();
  if(!trolley){document.querySelector('#trolley-error').textContent='Enter a trolley name.';return;}
  try{const record=await resolveTrolley(trolley);if(record.status!=='open')throw Error('This trolley is ready or collected. Select or create an open trolley.');commitTrolleyWorkspace({...state,activeTrolleyId:record.id,defaults:{...state.defaults,trolley}});notice=`New items will be recorded in ${trolley}.`;render();}
  catch(error){document.querySelector('#trolley-error').textContent=error.message;}
 };
}
function commitTrolleyWorkspace(next) {
 if(storageError&&!sharedClient)throw Error('Browser storage is unavailable. Back up your workspace before continuing.');
 if(!sharedClient)localStorage.setItem(key,JSON.stringify(next));
 state=next;if(sharedClient)persist();
}
async function resolveTrolley(name) {
 name=name.trim();if(!name)throw Error('Enter a trolley name.');
 const chosen=state.trolleys.find(t=>t.id===state.activeTrolleyId&&t.name.toLowerCase()===name.toLowerCase());if(chosen)return chosen;
 const matches=state.trolleys.filter(t=>t.name.toLowerCase()===name.toLowerCase());
 if(matches.length>1)throw Error('Several trolleys use this name. Select the correct reference in Trolleys.');
 if(matches[0])return matches[0];
 if(!writable())throw Error('Reconnect before creating a team trolley.');
 const trolley=createTrolley(name);
 if(sharedClient)await sharedClient.writeTrolley(trolley,0);
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
function openTrolleyManager() {
 readinessSession++;
 const dialog=document.querySelector('#trolley-manager');
 dialog.innerHTML=`<div class="eyebrow">COLLECTION CONTROL</div><h2>Manage trolleys</h2><p>Every trolley has a permanent reference. Labels identify the owner and link to this workspace's inventory.</p><form id="trolley-lookup-form" class="trolley-lookup"><label for="trolley-lookup">Scan trolley barcode</label><input id="trolley-lookup" autocomplete="off" placeholder="Scan a TSU trolley reference"><button class="secondary">View inventory</button></form><div class="trolley-manager-list">${state.trolleys.map(t=>`<article class="trolley-card" data-trolley-id="${escape(t.id)}"><div class="section-top"><h3>${escape(t.name)}</h3><span class="tag ${t.status==='collected'?'collected-tag':''}">${t.status==='collected'?'Collected':t.status==='ready'?'Ready for collection':'Open'}</span></div><div class="trolley-reference">${escape(t.reference)}</div><p>Property of TSU - ${escape(t.department)}<br>${state.items.filter(item=>trolleyForItem(item,t)).length} items${t.status==='collected'?` · ${escape(t.company)} · ${escape(new Date(t.collectedAt).toLocaleDateString('en-GB'))}`:''}</p><div class="trolley-actions"><button class="secondary" data-view="${escape(t.id)}">Inventory</button><button class="secondary" data-label="${escape(t.id)}">PDF label</button><button class="secondary" data-manifest="${escape(t.id)}">PDF manifest</button>${t.status==='open'?`<button class="secondary" data-use="${escape(t.id)}">Use trolley</button><button class="text-button" data-details="${escape(t.id)}">Edit department</button><button class="primary" data-readiness="${escape(t.id)}">Readiness checks</button>`:t.status==='ready'?`<button class="secondary" data-readiness="${escape(t.id)}">Review checks</button><button class="text-button" data-reopen="${escape(t.id)}">Reopen trolley</button><button class="primary" data-collect="${escape(t.id)}">Mark collected</button>`:''}</div></article>`).join('')}</div><form id="create-trolley-form" class="settings-section"><h3>Add a trolley</h3><label for="new-trolley-name">New trolley name</label><input id="new-trolley-name" name="name" required maxlength="80" placeholder="e.g. Trolley 03"><label for="new-trolley-department">Owning department</label><input id="new-trolley-department" name="department" required maxlength="100" value="${escape(defaultDepartment)}"><button class="primary wide">Create trolley</button></form><p id="trolley-manager-error" role="alert"></p><button class="secondary wide" id="close-trolley-manager">Close</button>`;
 dialog.showModal();
 document.querySelector('#close-trolley-manager').onclick=()=>dialog.close();
 document.querySelector('#trolley-lookup-form').onsubmit=e=>{e.preventDefault();const record=findTrolley(document.querySelector('#trolley-lookup').value,state.trolleys);if(record)viewTrolley(record.id);else document.querySelector('#trolley-manager-error').textContent='Trolley not found in this workspace. Check the barcode or connect to the correct team.';};
 document.querySelector('#create-trolley-form').onsubmit=async e=>{
  e.preventDefault();if(!writable())return;
  const data=new FormData(e.target),name=data.get('name').trim(),department=data.get('department').trim(),button=e.target.querySelector('button');
  if(!name||!department)return;
  if(state.trolleys.some(t=>t.name.toLowerCase()===name.toLowerCase())){document.querySelector('#trolley-manager-error').textContent='A trolley already uses that name. Choose a new name so histories stay distinct.';return;}
  button.disabled=true;
  try{const trolley=createTrolley(name,department);if(sharedClient)await sharedClient.writeTrolley(trolley,0);commitTrolleyWorkspace({...state,trolleys:[...state.trolleys.filter(t=>t.id!==trolley.id),trolley]});dialog.close();openTrolleyManager();}
  catch(error){document.querySelector('#trolley-manager-error').textContent=firebaseErrorMessage(error);button.disabled=false;}
 };
 dialog.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>viewTrolley(button.dataset.view));
 dialog.querySelectorAll('[data-use]').forEach(button=>button.onclick=()=>{const trolley=state.trolleys.find(t=>t.id===button.dataset.use);try{if(!writable())return;if(trolley.status!=='open')throw Error('This trolley is ready or collected. Reopen it before adding equipment.');commitTrolleyWorkspace({...state,activeTrolleyId:trolley.id,defaults:{...state.defaults,trolley:trolley.name}});notice=`New items will be recorded in ${trolley.name}.`;render();}catch(error){document.querySelector('#trolley-manager-error').textContent=error.message;}});
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
  try{
   if(trolley.status!=='ready')throw Error('Only ready trolleys can be reopened.');
   const updated={...trolley,status:'open',readyAt:'',readyBy:''};
   if(client)await client.writeTrolley(updated,version);
   if(client!==sharedClient)throw Error('Workspace changed. Reconnect to see the trolley status.');
   commitTrolleyWorkspace({...state,trolleys:state.trolleys.map(t=>t.id===updated.id?updated:t)});dialog.close();openTrolleyManager();
   document.querySelector('#trolley-manager-error').textContent='Trolley reopened. Run readiness checks again after making changes.';
  }catch(error){document.querySelector('#trolley-manager-error').textContent=firebaseErrorMessage(error);button.disabled=false;}
 });
 dialog.querySelectorAll('[data-collect],[data-details]').forEach(button=>button.onclick=()=>openTrolleyDetails(button.dataset.collect||button.dataset.details,Boolean(button.dataset.collect)));
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
 dialog.innerHTML=`<form id="trolley-details-form"><div class="eyebrow">${escape(trolley.reference)}</div><h2>${collecting?'Mark trolley collected':'Edit trolley department'}</h2><p>${escape(trolley.name)} · ${state.items.filter(item=>trolleyForItem(item,trolley)).length} items</p>${collecting?'<p>Collection locks this trolley against new equipment and retains its inventory.</p><label for="collection-company">Decommission company</label><input id="collection-company" name="company" required maxlength="100" placeholder="Company collecting this trolley">':`<label for="edit-trolley-department">Owning department</label><input id="edit-trolley-department" name="department" required maxlength="100" value="${escape(trolley.department)}">`}<p id="trolley-manager-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-trolley-details">Cancel</button><button class="primary">${collecting?'Confirm collection':'Save department'}</button></div></form>`;
 document.querySelector('#cancel-trolley-details').onclick=()=>{dialog.close();openTrolleyManager();};
 document.querySelector('#trolley-details-form').onsubmit=async e=>{
  e.preventDefault();if(!writable())return;const button=e.target.querySelector('.primary');button.disabled=true;
  try{
   const data=new FormData(e.target);
   if(collecting&&(trolley.status!=='ready'||!checkReadiness(trolley,state.items,{shared:Boolean(sharedClient)}).canReady))throw Error('Run readiness checks and resolve all issues before collection.');
   const updated=collecting?{...trolley,status:'collected',company:data.get('company').trim(),collectedAt:new Date().toISOString(),collectedBy:sharedClient?.profile.code||state.active}:{...trolley,department:data.get('department').trim()};
   if(sharedClient)await sharedClient.writeTrolley(updated,expectedVersion);
   const trolleys=state.trolleys.map(row=>row.id===id?updated:row),defaults={...state.defaults};
   let activeTrolleyId=state.activeTrolleyId;
   if(collecting&&(activeTrolleyId===trolley.id||(!activeTrolleyId&&defaults.trolley===trolley.name))){const next=trolleys.find(row=>row.status==='open');defaults.trolley=next?.name||'';activeTrolleyId=next?.id||'';}
   commitTrolleyWorkspace({...state,trolleys,defaults,activeTrolleyId});dialog.close();notice=collecting?'Trolley marked collected. Its inventory and reference are retained.':'Trolley department updated.';render();
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
 return `<section class="recognition-evidence" aria-label="Recognition evidence"><div class="eyebrow">${corrected?'ORIGINAL SUGGESTION EVIDENCE':'WHY THESE DETAILS?'}</div><h3>${escape(title)}</h3><p id="recognition-certainty">${escape(uncertainty)}</p>${corrected?`<p>Original suggestion: ${escape(evidence.model||'Model uncertain')} · ${escape(evidence.manufacturer||'Manufacturer uncertain')}</p><p>Using: <strong>${escape(state.draft.model)} · ${escape(state.draft.manufacturer)}</strong></p>`:''}<dl><div><dt>${evidence.prefix?'Matching prefix':'Matching serial'}</dt><dd>${escape(evidence.prefix||state.draft.serial)}</dd></div><div><dt>Supporting examples</dt><dd>${evidence.support} distinct serial${evidence.support===1?'':'s'}</dd></div><div><dt>Sources</dt><dd>${sourceKinds(evidence.sources).map(escape).join(' · ')}</dd></div></dl>${evidence.referenceSerials.length?`<p>Nearby reference: ${evidence.referenceSerials.map(escape).join(', ')}</p>`:''}<details><summary>Source details</summary>${evidence.sources.map(source=>`<p>${escape(source)}</p>`).join('')}${evidence.sourceCount>evidence.sources.length?`<p>And ${evidence.sourceCount-evidence.sources.length} more sources.</p>`:''}</details><button id="reject-suggestion" class="secondary">${corrected?'Edit checked details':'This suggestion is wrong'}</button></section>`;
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
function openSettings() {
 const settings=state.settings;
 const dialog=document.querySelector('#settings-dialog');
 dialog.innerHTML=`<form id="settings-form"><div class="eyebrow">YOUR SCAN STATION</div><h2>Make it work your way.</h2><p>Settings stay with this browser and are included in workspace backups.</p><div class="settings-section"><h3>${icon('voice')} Spoken prompts</h3><label class="toggle-label"><input type="checkbox" name="voice" ${state.voice?'checked':''}> Speak the next field</label><label for="speech-voice">Prompt voice</label><select id="speech-voice" name="voiceURI"></select><p id="voice-info" aria-live="polite"></p><label for="speech-rate">Speech speed <output id="rate-value">${settings.speechRate}×</output></label><input id="speech-rate" name="speechRate" type="range" min="0.6" max="1.5" step="0.01" value="${settings.speechRate}"><label for="speech-volume">Volume <output id="volume-value">${Math.round(settings.speechVolume*100)}%</output></label><input id="speech-volume" name="speechVolume" type="range" min="0" max="1" step="0.05" value="${settings.speechVolume}"><button type="button" class="secondary" id="test-voice">${icon('voice')} Test voice</button></div><div class="settings-section"><h3>${icon('box')} Model recognition</h3><p><strong>Serial recognition ready</strong> · ${builtInReferences.length} built-in spreadsheet references · ${state.referenceExamples.length} imported references. Saved records also contribute after technician review.</p><button type="button" class="secondary" id="manage-references">Manage reference library</button><button type="button" class="secondary" id="import-excel">Import reference spreadsheet</button><input id="reference-file" type="file" accept=".xlsx" class="sr-only" tabindex="-1" aria-label="Choose reference spreadsheet"><p>Each item starts with a serial lookup.</p><p>Known serials and consistent serial prefixes prefill model and manufacturer. Longer prefixes are checked before broad families. When a family agrees on the manufacturer but has different model labels, the manufacturer is filled and you supply the model. Conflicting manufacturers stay manual. All suggestions must be checked before saving.</p></div><div class="settings-section"><h3>${icon('barcode')} Scanner controls</h3><label for="skip-window">Double-trigger window</label><select name="skipWindow" id="skip-window">${[300,500,700,1000,1500].map(ms=>`<option value="${ms}" ${ms===settings.skipWindow?'selected':''}>${ms/1000} seconds${ms===700?' (default)':''}</option>`).join('')}</select><p>Two empty Enter presses inside this window fill N/A and advance the field.</p></div><div class="settings-section"><h3>${icon('box')} Identical equipment</h3><label class="toggle-label"><input type="checkbox" id="reuse-model" name="reuseModel" ${settings.reuseModel?'checked':''}> Use one model for this batch</label><label for="batch-model">Batch model number</label><input id="batch-model" name="batchModel" value="${escape(settings.batchModel)}" maxlength="1000" placeholder="e.g. P2419H" ${settings.reuseModel?'required':''}><p>Prefills Model and starts each new item at Serial number. Turn this off when equipment changes. Captured values for your current item stay in place.</p></div><p id="settings-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-settings">Cancel</button><button class="primary">Save settings</button></div></form>`;
 dialog.showModal();
 refreshVoiceChoices(settings.voiceURI);
 document.querySelector('#speech-voice').onchange=updateVoiceInfo;
 document.querySelector('#manage-references').onclick=()=>{dialog.close();openReferenceLibrary();};
 document.querySelector('#import-excel').onclick=()=>document.querySelector('#reference-file').click();
 document.querySelector('#reference-file').onchange=importReference;
 document.querySelector('#cancel-settings').onclick=()=>dialog.close();
 document.querySelector('#reuse-model').onchange=e=>document.querySelector('#batch-model').required=e.target.checked;
 document.querySelector('#speech-rate').oninput=e=>document.querySelector('#rate-value').textContent=`${e.target.value}×`;
 document.querySelector('#speech-volume').oninput=e=>document.querySelector('#volume-value').textContent=`${Math.round(e.target.value*100)}%`;
 document.querySelector('#test-voice').onclick=()=>{
  if(!('speechSynthesis' in window)){document.querySelector('#settings-error').textContent='Speech is unavailable in this browser. Scanning still works.';return;}
  speechSynthesis.cancel();const utterance=utteranceFor('Next, serial number.',{speechRate:Number(document.querySelector('#speech-rate').value),speechVolume:Number(document.querySelector('#speech-volume').value),voiceURI:document.querySelector('#speech-voice').value});speechSynthesis.speak(utterance);
 };
 document.querySelector('#settings-form').onsubmit=e=>{
  e.preventDefault();const data=new FormData(e.target);
  const next={speechRate:Number(data.get('speechRate')),speechVolume:Number(data.get('speechVolume')),skipWindow:Number(data.get('skipWindow')),reuseModel:data.has('reuseModel'),batchModel:data.get('batchModel').trim(),voiceURI:data.get('voiceURI')||'',serialFirst:true};
  if(next.reuseModel&&!next.batchModel){document.querySelector('#settings-error').textContent='Enter a batch model or turn off the identical equipment setting.';return;}
  state.settings=next;state.voice=data.has('voice');lastEmpty=0;
  if(!Object.keys(state.draft).length&&state.step===0)resetDraft();
  if(!state.voice)window.speechSynthesis?.cancel();notice='Scanner and voice settings saved.';persist();render();
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
function updateSessionSummary() {
 const node=document.querySelector('#session-summary');if(!node)return;
 const summary=sessionSummary(state.items,state.trolleys,state.profiles,today());
 node.innerHTML=`<div class="section-top"><div><div class="eyebrow">SESSION SUMMARY</div><h2>A little progress. A lot less clutter.</h2><p>${escape(new Date(today()+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))} · Whole workspace</p></div><a class="secondary" href="#station">Continue scanning ${icon('arrow')}</a></div>
 <div class="session-metrics"><div><strong>${summary.todayCount}</strong><span>Disposal records today</span></div><div><strong>${summary.missingCount}</strong><span>Missing model or manufacturer</span><button class="text-button" id="review-missing" ${summary.missingCount?'':'disabled'}>Review missing details ${icon('arrow')}</button></div><div><strong>${summary.statuses.open}</strong><span>Trolleys being filled</span></div><div><strong>${summary.statuses.ready}</strong><span>Ready for collection</span></div><div><strong>${summary.statuses.collected}</strong><span>Trolleys collected</span></div></div>
 <p class="session-note">Today's totals use the saved disposal date, not the time scanned. Missing details include N/A. ${sharedLocked&&(!sharedClient||connectionPhase!=='connected'||navigator.onLine===false)?'Showing cached team records; reconnect to confirm the latest totals.':sharedLocked?'Based on the shared register.':'Based on this browser’s register.'}</p>
 <details id="session-breakdown" ${summaryExpanded?'open':''}><summary>Technician progress and trolley shortcuts</summary><div class="session-breakdown"><div><h3>Technician progress</h3><ul class="technician-progress">${summary.technicians.map(p=>`<li><span><strong>${escape(p.name)}</strong><small>${escape(p.code)}</small></span><span><strong>${p.today} today</strong><small>${p.total} in register</small></span></li>`).join('')}</ul></div><div><h3>Trolley overview</h3><div class="session-trolleys">${summary.trolleys.map(t=>`<article><div><strong>${escape(t.name)}</strong><span class="tag ${t.status==='collected'?'collected-tag':''}">${t.status==='open'?'Being filled':t.status==='ready'?'Ready':'Collected'}</span><p>${t.count} items · Property of TSU - ${escape(t.department)}</p><small class="trolley-reference">${escape(t.reference)}</small></div><div class="trolley-actions"><button class="secondary" data-summary-inventory="${escape(t.id)}">View inventory</button><button class="secondary" data-summary-label="${escape(t.id)}">Print label</button></div></article>`).join('')||'<p>No trolleys yet. Create one in Trolleys to get started.</p>'}</div></div></div></details><p id="summary-error" aria-live="polite"></p>`;
 node.querySelector('#session-breakdown').ontoggle=e=>{if(e.target.isConnected)summaryExpanded=e.target.open;};
 node.querySelector('#review-missing').onclick=()=>{missingDetailsOnly=true;search='';trolleyViewId='';document.querySelector('#register-search').value='';location.hash='inventory';updateRegister();document.querySelector('#inventory').scrollIntoView({behavior:'smooth'});};
 node.querySelectorAll('[data-summary-inventory]').forEach(button=>button.onclick=()=>viewTrolley(button.dataset.summaryInventory));
 node.querySelectorAll('[data-summary-label]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await printTrolleyLabel(button.dataset.summaryLabel);}catch(error){const output=document.querySelector('#summary-error');if(output)output.textContent=`Label failed: ${error.message}`;}finally{button.disabled=false;}});
}
function updateRegister() {
 updateSessionSummary();
 const selected=state.trolleys.find(t=>t.id===trolleyViewId);
 const scope=trolleyViewId?(selected?state.items.filter(item=>trolleyForItem(item,selected)):[]):state.items;
 const items=filteredItems(missingDetailsOnly?scope.filter(item=>missingEquipmentDetails(item).length):scope,search);
 document.querySelector('#inventory-title').textContent=selected?`${selected.name} inventory`:'Ready for the next collection';
 const banner=document.querySelector('#trolley-inventory-banner');
 banner.innerHTML=trolleyViewId?`<div class="trolley-inventory-banner"><div><strong>${selected?escape(selected.reference):'Trolley not found in this workspace'}</strong><p>${selected?`Property of TSU - ${escape(selected.department)} · ${selected.status==='collected'?`Collected by ${escape(selected.company)}`:selected.status==='ready'?'Ready for collection - reopen before changing equipment':'Open for equipment'}`:'Connect to the team database that owns this trolley.'}</p></div><button class="secondary" id="show-all-trolleys">Show all inventory</button></div>`:'';
 document.querySelector('#show-all-trolleys')?.addEventListener('click',()=>{location.hash='inventory';});
 document.querySelector('#review-filter').innerHTML=missingDetailsOnly?'<div class="trolley-inventory-banner"><span>Showing items missing manufacturer or model details. Export still includes the selected inventory.</span><button class="secondary" id="clear-review-filter">Clear review filter</button></div>':'';
 document.querySelector('#clear-review-filter')?.addEventListener('click',()=>{missingDetailsOnly=false;updateRegister();});
 document.querySelector('#search-count').textContent=`Showing ${items.length} of ${scope.length} items`;
 document.querySelector('.register .count').textContent=scope.length;
 document.querySelector('#inventory tbody').innerHTML=items.map(item=>`<tr><td><strong>${escape(item.description)}</strong><span>${escape(item.manufacturer)} · ${escape(item.model)}</span></td><td>${escape(item.serial)}</td><td>${escape(item.asset)}</td><td><span class="tag">${escape(item.trolley)}</span></td><td>${escape(item.technician)}</td><td>${escape(item.date.split('-').reverse().join('/'))}</td><td><div class="row-actions"><button class="text-button" data-edit="${escape(item.id)}" aria-label="Edit item ${escape(item.serial)}">Edit</button><button class="text-button remove" data-delete="${escape(item.id)}" aria-label="Delete item ${escape(item.serial)}">Remove</button></div></td></tr>`).join('') || `<tr><td colspan="7" class="empty"><div class="empty-icon">${icon('box')}</div><strong>${missingDetailsOnly?'No items need missing details filled in.':search?'No equipment matches your search.':'A little less clutter starts here.'}</strong><span>${missingDetailsOnly?'Clear the review filter to see the rest of your inventory.':search?'Try another serial number, trolley or technician.':'Scan your first item to start your collection register.'}</span></td></tr>`;
}
function updateHistory() {
 const section=document.querySelector('#collection-history');section.hidden=location.hash!=='#collection-history';
 document.querySelector('a[href="#collection-history"]').classList.toggle('active',!section.hidden);document.querySelector('a[href="#station"]').classList.toggle('active',!location.hash||location.hash==='#station');document.querySelector('a[href="#inventory"]').classList.toggle('active',location.hash==='#inventory'||Boolean(trolleyViewId));
 const collected=state.trolleys.filter(t=>t.status==='collected').sort((a,b)=>Date.parse(b.collectedAt)-Date.parse(a.collectedAt));
 const terms=historySearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const rows=collected.filter(t=>terms.every(term=>[t.reference,t.name,t.department,t.company,t.collectedBy].join(' ').toLowerCase().includes(term)));
 document.querySelector('#history-total').textContent=`${collected.length} collected`;
 document.querySelector('#history-results').innerHTML=rows.map(t=>`<article class="history-card"><div class="section-top"><div><h3>${escape(t.name)}</h3><div class="trolley-reference">${escape(t.reference)}</div></div><span class="tag collected-tag">Collected</span></div><dl><div><dt>Decommission company</dt><dd>${escape(t.company)}</dd></div><div><dt>Collected</dt><dd>${escape(new Date(t.collectedAt).toLocaleString('en-GB',{timeZone:'Europe/London'}))}</dd></div><div><dt>Recorded by</dt><dd>${escape(t.collectedBy)}</dd></div><div><dt>Contents</dt><dd>${state.items.filter(item=>trolleyForItem(item,t)).length} items</dd></div></dl><p>Property of TSU - ${escape(t.department)}</p><button class="secondary" data-history-inventory="${escape(t.id)}">View inventory</button></article>`).join('')||`<p class="history-empty">${historySearch?'No collected trolleys match your search.':'No trolleys have been collected yet. Mark a trolley collected in Trolleys to retain its details here.'}</p>`;
 section.querySelectorAll('[data-history-inventory]').forEach(button=>button.onclick=()=>viewTrolley(button.dataset.historyInventory));
}
function updateConnectionStatus() {
 const node=document.querySelector('#connection-status');if(!node)return;
 let title='Local workspace',detail='Records are stored in this browser. Back up after each session.',kind='local';
 if(sharedLocked){
  if(navigator.onLine===false){title='Offline · team changes paused';detail='Your captured item stays here. Reconnect before saving; download a backup before closing.';kind='warning';}
  else if(!sharedClient){title='Shared workspace · reconnect required';detail='Cached records are available to view. Open Database to reconnect; team changes are locked.';kind='warning';}
  else if(saving){title='Saving equipment to Firebase';detail='Wait for confirmation. Your captured item stays here until Firebase accepts it.';kind='warning';}
  else if(connectionPhase!=='connected'){title='Checking shared connection';detail='Waiting for confirmation from Firebase. Saved items are confirmed before your draft is cleared.';kind='warning';}
  else{title='Shared workspace · confirmed by Firebase';detail=`Team ${sharedClient.teamId}${lastConfirmedAt?' · Last confirmed '+new Date(lastConfirmedAt).toLocaleTimeString('en-GB',{timeZone:'Europe/London'}):''}`;kind='connected';}
 }
 node.className=`connection-status ${kind}`;node.innerHTML=`<div><strong>${escape(title)}</strong><span>${escape(detail)}</span></div><button class="secondary" id="connection-action">${sharedLocked?'Database':'Connect team database'}</button>`;node.querySelector('button').onclick=openDatabase;
 updateSessionSummary();
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
 editingVersion=sharedClient?.versionFor(id)||0;
 editingId=id;
 const dialog=document.querySelector('#edit-dialog');
 dialog.innerHTML=`<form id="edit-form"><div class="eyebrow">COLLECTION REGISTER</div><h2>Edit equipment</h2><p>Correct the saved record without rescanning it.</p><div class="edit-grid">${[...defaultFields,...fields.map(([key,label])=>[key,label,'text'])].map(([key,label,type])=>`<div><label for="edit-${key}">${escape(label)}</label><input id="edit-${key}" name="${key}" type="${type}" value="${escape(item[key])}" maxlength="1000" required></div>`).join('')}<div><label for="edit-technician">Recorded technician</label><select id="edit-technician" name="technician" ${sharedClient?'disabled':''}>${[...new Set([item.technician,...state.profiles.map(p=>p.code)])].map(code=>`<option value="${escape(code)}" ${code===item.technician?'selected':''}>${escape(state.profiles.find(p=>p.code===code)?.name||code)} · ${escape(code)}</option>`).join('')}</select></div></div>${item.recognitionNeedsReview?`<label class="review-check"><input type="checkbox" id="edit-recognition-confirmed" ${item.recognitionConfirmed?'checked':''}> I checked the model and manufacturer against this equipment.</label>`:''}<p id="edit-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-edit">Cancel</button><button class="primary">Save changes</button></div></form>`;
 dialog.showModal();
 document.querySelector('#cancel-edit').onclick=()=>dialog.close();
 if(item.recognitionNeedsReview)for(const id of ['edit-model','edit-manufacturer','edit-serial'])document.querySelector('#'+id).oninput=()=>{document.querySelector('#edit-recognition-confirmed').checked=false;};
 document.querySelector('#edit-form').onsubmit=async e=>{
  e.preventDefault();
  const values=Object.fromEntries([...new FormData(e.target)].map(([key,value])=>[key,value.trim()]));
  if(sharedClient)values.technician=item.technician;
  const error=document.querySelector('#edit-error');
  if(Object.values(values).some(value=>!value)||!validDate(values.date)){error.textContent='Complete each field, using N/A where needed, and enter a valid date.';return;}
  if(!validAssetNumber(values.asset)){error.textContent='Asset number must be A followed by four digits, for example A1234, or N/A.';document.querySelector('#edit-asset').focus();return;}
  values.asset=normalizeAssetNumber(values.asset);
  if(duplicateSerial(state.items.filter(item=>item.id!==editingId),values.serial)){error.textContent='This serial number belongs to another item. Check it before saving.';return;}
  let destination;
  try{destination=values.trolley===item.trolley?state.trolleys.find(t=>t.id===item.trolleyId)||await resolveTrolley(values.trolley):await resolveTrolley(values.trolley);if(destination.status!=='open'||state.trolleys.some(t=>t.status!=='open'&&trolleyForItem(item,t)))throw Error('Ready or collected trolley contents are locked. Reopen a ready trolley before editing.');}
  catch(failure){error.textContent=failure.message;return;}
  const updated={...item,...values,trolleyId:destination.id,...(item.recognitionNeedsReview?{recognitionConfirmed:document.querySelector('#edit-recognition-confirmed').checked}:{})};
  if(updated.readinessNotes){updated.readinessNotes={...updated.readinessNotes};for(const field of readinessFields)if(values[field]!==item[field])delete updated.readinessNotes[field];}
  const button=e.target.querySelector('button[type=submit]')||e.target.querySelector('.primary');button.disabled=true;
  try {if(sharedClient)await sharedClient.write(updated,editingVersion);state.items=state.items.map(row=>row.id===editingId?updated:row);notice='Equipment changes saved.';persist();render();}
  catch(failure){error.textContent=failure.message;button.disabled=false;}
 };
}
function openDatabase() {
 let saved={};try{saved=JSON.parse(localStorage.getItem('decompro.firebaseConfig')||'{}');}catch{}
 saved.config ||= defaultFirebaseConfig;
 const dialog=document.querySelector('#database-dialog');
 dialog.innerHTML=`<div class="eyebrow">TEAM WORKSPACE</div><h2>${sharedClient?'Connected to Firebase':'Connect your Firebase database'}</h2><p>Firestore shares records and reference examples across the team. Membership and identities are controlled by Firebase Authentication and security rules.</p>${sharedClient?`<div class="restore-summary"><strong>${escape(sharedClient.teamId)}</strong><span>${escape(sharedClient.email)} · ${escape(sharedClient.role)}</span></div><button class="secondary wide" id="check-connection">Check connection</button><p id="connection-check-result" aria-live="polite">Checks equipment, trolley and reference access directly with Firebase.</p>${sharedClient.role==='admin'?'<button class="secondary" id="team-access">Team access checklist</button>':''}<button class="secondary" id="upload-local" ${sharedClient.role!=='admin'?'disabled':''}>Import local equipment (admin)</button><p>Preview your preserved local equipment, check duplicates and import historical records without overwriting team items.</p>`:''}<form id="database-form"><p>Sign in with the account your team administrator created. Your local register stays preserved when you connect.</p><details class="connection-settings"><summary>Connection settings</summary><label for="firebase-config">Firebase public web app config (JSON)</label><textarea id="firebase-config" name="config" rows="5" required spellcheck="false" placeholder='{"apiKey":"…","authDomain":"…","projectId":"…","appId":"…"}'>${escape(saved.config?JSON.stringify(saved.config,null,2):'')}</textarea><label for="team-id">Team ID</label><input id="team-id" name="teamId" value="${escape(saved.teamId||'college-it')}" required><p>These project details are prefilled. Your administrator can change them here if needed.</p></details><label for="firebase-email">Team account email</label><input id="firebase-email" name="email" type="email" autocomplete="username" required><label for="firebase-password">Password</label><input id="firebase-password" name="password" type="password" autocomplete="current-password" required><p>Your account identifies who disposed of each item. Connecting does not automatically upload your local records.</p><p id="database-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="close-database">Close</button><button class="primary">Sign in & connect</button></div></form>${sharedLocked?'<button class="text-button" id="disconnect-database">Sign out & return to local workspace</button>':''}`;
 dialog.showModal();
 document.querySelector('#close-database').onclick=()=>dialog.close();
 document.querySelector('#disconnect-database')?.addEventListener('click',disconnectDatabase);
 document.querySelector('#check-connection')?.addEventListener('click',checkSharedConnection);
 document.querySelector('#upload-local')?.addEventListener('click',uploadLocal);
 document.querySelector('#team-access')?.addEventListener('click',openTeamAccess);
 document.querySelector('#database-form').onsubmit=async e=>{
  e.preventDefault();const button=e.target.querySelector('.primary');button.disabled=true;
  try {const form=new FormData(e.target);await activateDatabase(JSON.parse(form.get('config')),form.get('teamId').trim(),form.get('email').trim(),form.get('password'));}
  catch(error){document.querySelector('#database-error').textContent=firebaseErrorMessage(error);button.disabled=false;}
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
async function activateDatabase(config,teamId,email,password) {
 const {connectFirebase}=await import('./firebase-db');
 const client=await connectFirebase(config,teamId,email,password);
 try {
  const records=await client.load();
  const next=validateWorkspace({...state,activeTrolleyId:records.trolleys.some(t=>t.id===state.activeTrolleyId)?state.activeTrolleyId:'',profiles:[client.profile],active:client.profile.code,items:records.items,trolleys:records.trolleys,referenceExamples:records.examples,referenceCorrections:records.corrections||[]});
  if(!sharedLocked)localStorage.setItem(localWorkspaceKey,JSON.stringify(state));
  localStorage.setItem('decompro.firebaseConfig',JSON.stringify({config,teamId}));localStorage.setItem('decompro.mode','shared');
  sharedClient?.stop();sharedClient=client;sharedLocked=true;connectionPhase='connected';lastConfirmedAt=new Date().toISOString();state=next;notice='Connected to the shared Firebase team register.';persist();render();
  client.listen(items=>{if(sharedClient!==client)return;state.items=items;persist();updateRegister();updateHistory();updateReferenceLibrary();document.querySelector('.stats .stat-content strong').innerHTML=`${items.length}<small> items recorded</small>`;document.querySelector('a[href="#inventory"] span').textContent=items.length;},examples=>{if(sharedClient===client){state.referenceExamples=examples;persist();updateReferenceLibrary();}},error=>{if(sharedClient===client){client.stop();sharedClient=null;notice=`Shared connection failed. Changes are locked until reconnection. ${error.message}`;render();}},trolleys=>{if(sharedClient===client){state.trolleys=trolleys;persist();updateRegister();updateHistory();}},phase=>{if(sharedClient===client){connectionPhase=phase;if(phase==='connected')lastConfirmedAt=new Date().toISOString();updateConnectionStatus();}},corrections=>{if(sharedClient===client){state.referenceCorrections=corrections;persist();updateReferenceLibrary();}});
 }catch(error){client.stop();throw error;}
}
async function disconnectDatabase() {
 if(!confirm('Return to your preserved local workspace? Shared records remain in Firebase.'))return;
 try {
  const local=localStorage.getItem(localWorkspaceKey);if(!local)throw Error('No preserved local workspace was found. Export the cached team register before continuing.');
  const restored=validateWorkspace(JSON.parse(local));
  if(sharedClient)await sharedClient.logout();else{const saved=JSON.parse(localStorage.getItem('decompro.firebaseConfig')||'{}');if(saved.config){const {disconnectFirebaseAuth}=await import('./firebase-db');await disconnectFirebaseAuth(saved.config);}}
  sharedClient=null;sharedLocked=false;localStorage.removeItem('decompro.mode');state=restored;notice='Returned to your local workspace. Shared records are unchanged.';persist();render();
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
 if(!sharedLocked)return;
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
 downloadFile(JSON.stringify({app:'DecomPro',version:1,exportedAt:new Date().toISOString(),state},null,2),`DecomPro-backup-${today()}.json`,'application/json');
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
   state=pendingRestore;pendingRestore=null;storageError='';search='';scanning=false;lastEmpty=0;notice='Backup restored. Select Start scanning when you are ready.';render();
  };
 } catch(error) {pendingRestore=null;notice=`Backup was not restored. ${error instanceof SyntaxError?'The file is not valid JSON.':error.message}`;render();}
}
async function exportExcel() {
 if(exporting)return;
 const selected=state.trolleys.find(t=>t.id===trolleyViewId);
 const items=(trolleyViewId?(selected?state.items.filter(item=>trolleyForItem(item,selected)):[]):state.items).map(item=>({...item}));
 if(!items.length){notice='There are no saved items to export. Save an item first; an unsaved scan is not included.';render();return;}
 exporting=true;
 const button=document.querySelector('#export');button.disabled=true;button.textContent='Preparing Excel…';
 try {
  const {default:ExcelJS}=await import('exceljs');
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Sheet1');
  sheet.addRow(headers);for(const item of items)sheet.addRow(supplierRow(item));
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF164E3D'}};
  sheet.getRow(1).height=30;sheet.columns.forEach((column,index)=>column.width=index===1?28:22);
  sheet.getColumn(1).numFmt='dd/mm/yyyy';sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter='A1:K1';
  const data=await workbook.xlsx.writeBuffer();
  downloadFile(data,`Decom-${today()}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  notice=`Excel download started with ${items.length} saved item${items.length===1?'':'s'}.`;render();
 }catch(error){
  const detail=error?.message||'The browser could not create the Excel download.';
  const reason=/dynamically imported|module script|preload/i.test(detail)?'The Excel component could not load. Refresh the app to load the latest version and retry.':detail;
  const count=state.items.length;
  notice=`Excel export failed: ${reason} ${count?`The current workspace contains ${count} saved item${count===1?'':'s'}. Use Backup to download the workspace.`:'There are no saved items in the current workspace.'}`;
  render();
 }finally {
  exporting=false;
  const button=document.querySelector('#export');if(button){button.disabled=!state.items.length;button.innerHTML=`${icon('download')} Export Excel`;}
 }
}

document.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.step===fields.length&&!document.querySelector('dialog[open]')&&!['INPUT','SELECT','BUTTON','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();saveItem();}});
window.addEventListener('hashchange',()=>{trolleyViewId=readTrolleyHash();updateRegister();updateHistory();document.querySelector(location.hash==='#collection-history'?'#collection-history':location.hash==='#station'?'#station':'#inventory')?.scrollIntoView({behavior:'smooth'});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateSessionSummary();});
window.addEventListener('offline',updateConnectionStatus);
window.addEventListener('online',()=>{connectionPhase='syncing';updateConnectionStatus();});
render();
resumeDatabase();
