import { fields, headers, supplierRow, duplicateSerial } from './data';
import './style.css';
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
let state = { profiles:[{name:'Jawad',code:'JA'}], active:'JA', defaults:{date:today(),description:'Monitor',manufacturer:'',source:'Storage',reason:'EOL',trolley:'Trolley 01'}, items:[], draft:{}, step:0, voice:true, settings:{...defaultSettings} };
let storageError = '', notice = '', scanning = false, lastEmpty = 0;
let search = '', editingId = null, pendingRestore = null;
try { const saved=localStorage.getItem(key); if(saved) state=validateWorkspace(JSON.parse(saved)); } catch { storageError='Saved data could not be loaded. Export any visible records before continuing. Storage has been paused to protect the saved data.'; }
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function persist() { if(storageError) return false; try { localStorage.setItem(key,JSON.stringify(state)); return true; } catch { storageError='Browser storage is unavailable or full. Export your records now; changes may be lost on refresh.'; render(); return false; } }
function speak(text) { if(!state.voice || !('speechSynthesis' in window)) return; speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='en-GB'; u.rate=state.settings.speechRate;u.volume=state.settings.speechVolume; speechSynthesis.speak(u); }
function prompt() { speak(state.step<fields.length ? `Next, ${fields[state.step][1]}` : 'Review equipment. Press Enter to save and place it in the trolley.'); }
function focus() { if(scanning) document.querySelector('#scan')?.focus(); }
function render() {
 const current=fields[state.step]; const profile=state.profiles.find(p=>p.code===state.active);
 document.querySelector('#app').innerHTML=`
 <aside><a class="brand" href="#"><span class="brand-mark">${icon('barcode')}</span><span>Decom<span class="brand-light">Pro</span></span></a><div class="workspace">IT OPERATIONS</div><a class="nav active" href="#station">${icon('grid')} Scan station <span class="nav-active-dot"></span></a><a class="nav" href="#inventory">${icon('list')} Collection register <span>${state.items.length}</span></a><button class="nav settings-nav" id="settings" aria-label="Open settings">${icon('settings')}<span class="settings-nav-label">Settings</span></button><div class="aside-bottom"><span class="dot"></span> Local workspace<p>Records stay on this browser.<br>Export after each session.</p></div></aside>
 <main><div class="breadcrumb">Workspace <span>/</span> Decommissioning</div><header><div><div class="eyebrow">OUT WITH THE OLD. ON WITH THE NEW.</div><h1>Make room for what’s next<span>.</span></h1><p>Your scan station for a smoother, simpler collection day.</p></div><div class="profile"><label for="profile">Technician profile</label><select id="profile">${state.profiles.map(p=>`<option value="${escape(p.code)}" ${p.code===state.active?'selected':''}>${escape(p.name)} · ${escape(p.code)}</option>`).join('')}</select><button class="text-button" id="add-profile">${icon('plus')} Add technician</button></div></header>
 ${storageError?`<div class="alert error" role="alert">${escape(storageError)}</div>`:''}${notice?`<div class="alert" role="status">${escape(notice)}</div>`:''}
 <div class="stats"><div><div class="stat-icon mint">${icon('box')}</div><div class="stat-content"><span>READY FOR COLLECTION</span><strong>${state.items.length}<small> items recorded</small></strong></div></div><div><div class="stat-icon blue">${icon('grid')}</div><div class="stat-content"><span>CURRENT TROLLEY</span><strong>${escape(state.defaults.trolley)}</strong><button class="text-button trolley-switch" id="change-trolley">Change trolley ${icon('arrow')}</button></div></div><div><div class="stat-icon peach">${icon('user')}</div><div class="stat-content"><span>DISPOSAL RECORDED BY</span><strong>${escape(profile?.name||'Select technician')}<small>${escape(profile?.code||'')}</small></strong></div></div></div>
 <div class="station-layout"><section id="station" class="card station"><div class="section-top"><span class="eyebrow"><span class="station-dot"></span> SCAN STATION</span><button id="voice" class="pill">${icon('voice')} ${state.voice?'Voice on':'Voice off'}</button></div><div class="steps">${fields.map((f,i)=>`<button class="step ${i===state.step?'current':''} ${i<state.step?'complete':''}" data-step="${i}" ${i>state.step?'disabled':''}><span>${i<state.step?icon('check'):i+1}</span>${escape(f[1].replace(' number',''))}</button>`).join('')}</div>
 ${state.settings.reuseModel?`<div class="batch-model-chip">Batch model <strong>${escape(state.settings.batchModel)}</strong></div>`:''}<div class="scan-icon">${icon(current?'barcode':'check')}</div><div class="scan-label">${current?`FIELD ${state.step+1} OF ${fields.length}`:'READY TO RECORD'}</div><h2>${current?escape(current[1]):'Review this equipment'}</h2><p>${current?'Scan the label or type its value, then press Enter.':'Check the values below, then save this item to the collection register.'}</p>
 ${current?`<form id="scan-form"><label class="sr-only" for="scan">${escape(current[1])}</label><input id="scan" autocomplete="off" spellcheck="false" placeholder="Waiting for a scan…" value="${escape(state.draft[current[0]]||'')}"><button class="primary" type="submit">Capture value ${icon('arrow')}</button></form><div class="scan-actions"><button id="start" class="text-button">${icon(scanning?'voice':'play')} ${scanning?'Repeat spoken prompt':'Start scanning'}</button><button id="skip" class="secondary">${icon('skip')} Skip · N/A</button></div><div class="hint">Double-click the scanner trigger (two empty Enter presses) to skip.</div>`:`<button id="save" class="primary wide">Save item & start next ${icon('arrow')}</button>`}
 <div class="captured">${fields.filter(f=>state.draft[f[0]]).map(([k,label])=>`<div><span>${escape(label)}</span><strong>${escape(state.draft[k])}</strong></div>`).join('')||`<span class="capture-empty">${icon('list')} Your captured values will appear here.</span>`}</div><div class="station-footer"><button id="back" class="text-button" ${state.step===0?'disabled':''}>${icon('back')} Previous field</button><button id="reset" class="text-button">Clear current item</button></div></section>
 <section class="card defaults"><div class="defaults-heading"><span class="defaults-icon">${icon('list')}</span><div class="eyebrow">BATCH DEFAULTS</div></div><h2>Set once. Keep scanning.</h2><p>Applied to each item when you save it.</p><form id="defaults">${defaultFields.map(([k,label,type])=>`<label for="default-${k}">${label}</label><input id="default-${k}" name="${k}" type="${type}" value="${escape(state.defaults[k])}" required>`).join('')}<button class="secondary wide" type="submit">Apply batch defaults</button></form><div class="note">Technician initials automatically fill <strong>Who disposed of it?</strong> in your Excel export.</div></section></div>
 <section id="inventory" class="card register"><div class="section-top"><div><div class="eyebrow">COLLECTION REGISTER</div><h2>Ready for the next collection <span class="count">${state.items.length}</span></h2></div><button id="export" class="primary" ${!state.items.length?'disabled':''}>${icon('download')} Export Excel</button></div><div class="register-tools"><div class="search-field">${icon('list')}<label class="sr-only" for="register-search">Search collection register</label><input id="register-search" type="search" placeholder="Search equipment, serial, trolley or technician…" value="${escape(search)}"></div><div class="backup-actions"><button class="secondary" id="backup">${icon('download')} Backup</button><button class="secondary" id="restore">Restore backup</button><input class="sr-only" id="backup-file" type="file" accept=".json,application/json" tabindex="-1" aria-label="Choose backup file"></div></div><div id="search-count" class="search-count" aria-live="polite"></div><div class="table-wrap"><table><thead><tr><th>Equipment / model</th><th>Serial number</th><th>Asset number</th><th>Trolley</th><th>Technician</th><th>Disposal date</th><th>Actions</th></tr></thead><tbody></tbody></table></div><div class="register-footer">Excel exports all records in the supplier’s 17-column format, including records hidden by search. Backups also keep trolley details, profiles and captured progress.</div></section>
 <footer>DecomPro · Less clicking. More clearing.</footer></main><dialog id="profile-dialog"><form id="profile-form"><h2>Add a technician</h2><p>Local profiles identify records; they are not secure sign-in accounts.</p><label for="name">Name</label><input id="name" name="name" required maxlength="60"><label for="code">Disposal initials</label><input id="code" name="code" required maxlength="12"><div class="dialog-actions"><button class="secondary" type="button" id="cancel-profile">Cancel</button><button class="primary">Save profile</button></div><p id="profile-error" role="alert"></p></form></dialog><dialog id="edit-dialog"></dialog><dialog id="restore-dialog"></dialog><dialog id="settings-dialog"></dialog><dialog id="trolley-dialog"></dialog>`;
 bind(); updateRegister(); focus();
}
function capture(value) { value=value.trim(); if(!value || state.step>=fields.length) return; state.draft[fields[state.step][0]]=value; state.step++; lastEmpty=0; notice=''; persist(); render(); prompt(); }
function saveItem() {
 const profile=state.profiles.find(p=>p.code===state.active);
 if(!profile) {notice='Choose a technician first.';render();return;}
 if(Object.values(state.defaults).some(v=>!v.trim())) {notice='Complete and apply all batch defaults first.';render();return;}
 if(fields.some(([k])=>!state.draft[k])) return;
 if(duplicateSerial(state.items,state.draft.serial)){notice='This serial number is already in the register. Check the current item before saving.';render();speak(notice);return;}
 state.items.push({...state.defaults,...state.draft,technician:profile.code,id:crypto.randomUUID()}); resetDraft();notice='Item recorded. Place it in the caged trolley.';persist();render();speak(`Item recorded. Place it in the caged trolley. Next, ${fields[state.step][1]}.`);
}
function bind() {
 document.querySelector('#settings').onclick=openSettings;
 document.querySelector('#change-trolley').onclick=openTrolley;
 document.querySelector('#profile').onchange=e=>{state.active=e.target.value;persist();render();};
 document.querySelector('#voice').onclick=()=>{state.voice=!state.voice;persist();render();if(state.voice)prompt();else window.speechSynthesis?.cancel();};
 document.querySelector('#start')?.addEventListener('click',()=>{scanning=true;focus();prompt();});
 document.querySelector('#scan-form')?.addEventListener('submit',e=>{e.preventDefault();scanning=true;const value=document.querySelector('#scan').value;if(value.trim())capture(value);else {const now=Date.now();if(lastEmpty&&now-lastEmpty<state.settings.skipWindow){capture('N/A');}else {lastEmpty=now;notice=`Press Enter again within ${state.settings.skipWindow/1000} seconds to skip this field.`;document.querySelector('.hint').textContent=notice;}}});
 document.querySelector('#skip')?.addEventListener('click',()=>{scanning=true;capture('N/A');});
 document.querySelector('#save')?.addEventListener('click',saveItem);
 document.querySelector('#back').onclick=()=>{if(state.step>0){state.step--;lastEmpty=0;persist();render();prompt();}};
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{state.step=Number(b.dataset.step);lastEmpty=0;persist();render();prompt();});
 document.querySelector('#reset').onclick=()=>{if(Object.keys(state.draft).length&&!confirm('Clear the current unsaved item?'))return;resetDraft();lastEmpty=0;persist();render();prompt();};
 document.querySelector('#defaults').onsubmit=e=>{e.preventDefault();state.defaults=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,v.trim()]));notice='Batch defaults applied.';persist();render();};
 document.querySelector('#register-search').oninput=e=>{search=e.target.value;updateRegister();};
 document.querySelector('#inventory tbody').onclick=e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.edit) openEditor(button.dataset.edit);
  if(button.dataset.delete && confirm('Remove this item from the collection register?')) {
   state.items=state.items.filter(i=>i.id!==button.dataset.delete);persist();render();
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
 state.step=state.settings.reuseModel?1:0;
}
function openTrolley() {
 const known=[...new Set([state.defaults.trolley,...state.items.map(item=>item.trolley)])];
 const dialog=document.querySelector('#trolley-dialog');
 dialog.innerHTML=`<form id="trolley-form"><div class="eyebrow">COLLECTION TROLLEYS</div><h2>Switch to another trolley</h2><p>New records will use this trolley. Existing records stay where they are; use Edit to move an item.</p><label for="trolley-name">Trolley name</label><input id="trolley-name" name="trolley" list="known-trolleys" value="${escape(state.defaults.trolley)}" required maxlength="1000"><datalist id="known-trolleys">${known.map(name=>`<option value="${escape(name)}"></option>`).join('')}</datalist><div class="trolley-list">${known.map(name=>`<button type="button" class="secondary" data-trolley="${escape(name)}">${escape(name)} <span>${state.items.filter(item=>item.trolley===name).length} items</span></button>`).join('')}</div><p id="trolley-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-trolley">Cancel</button><button class="primary">Use trolley</button></div></form>`;
 dialog.showModal();
 document.querySelector('#cancel-trolley').onclick=()=>dialog.close();
 dialog.querySelectorAll('[data-trolley]').forEach(button=>button.onclick=()=>document.querySelector('#trolley-name').value=button.dataset.trolley);
 document.querySelector('#trolley-form').onsubmit=e=>{
  e.preventDefault();const trolley=document.querySelector('#trolley-name').value.trim();
  if(!trolley){document.querySelector('#trolley-error').textContent='Enter a trolley name.';return;}
  state.defaults.trolley=trolley;notice=`New items will be recorded in ${trolley}.`;persist();render();
 };
}
function openSettings() {
 const settings=state.settings;
 const dialog=document.querySelector('#settings-dialog');
 dialog.innerHTML=`<form id="settings-form"><div class="eyebrow">YOUR SCAN STATION</div><h2>Make it work your way.</h2><p>Settings stay with this browser and are included in workspace backups.</p><div class="settings-section"><h3>${icon('voice')} Spoken prompts</h3><label class="toggle-label"><input type="checkbox" name="voice" ${state.voice?'checked':''}> Speak the next field</label><label for="speech-rate">Speech speed <output id="rate-value">${settings.speechRate}×</output></label><input id="speech-rate" name="speechRate" type="range" min="0.6" max="1.5" step="0.01" value="${settings.speechRate}"><label for="speech-volume">Volume <output id="volume-value">${Math.round(settings.speechVolume*100)}%</output></label><input id="speech-volume" name="speechVolume" type="range" min="0" max="1" step="0.05" value="${settings.speechVolume}"><button type="button" class="secondary" id="test-voice">${icon('voice')} Test voice</button></div><div class="settings-section"><h3>${icon('barcode')} Scanner controls</h3><label for="skip-window">Double-trigger window</label><select name="skipWindow" id="skip-window">${[300,500,700,1000,1500].map(ms=>`<option value="${ms}" ${ms===settings.skipWindow?'selected':''}>${ms/1000} seconds${ms===700?' (default)':''}</option>`).join('')}</select><p>Two empty Enter presses inside this window fill N/A and advance the field.</p></div><div class="settings-section"><h3>${icon('box')} Identical equipment</h3><label class="toggle-label"><input type="checkbox" id="reuse-model" name="reuseModel" ${settings.reuseModel?'checked':''}> Use one model for this batch</label><label for="batch-model">Batch model number</label><input id="batch-model" name="batchModel" value="${escape(settings.batchModel)}" maxlength="1000" placeholder="e.g. P2419H" ${settings.reuseModel?'required':''}><p>Prefills Model and starts each new item at Serial number. Turn this off when equipment changes. Captured values for your current item stay in place.</p></div><p id="settings-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-settings">Cancel</button><button class="primary">Save settings</button></div></form>`;
 dialog.showModal();
 document.querySelector('#cancel-settings').onclick=()=>dialog.close();
 document.querySelector('#reuse-model').onchange=e=>document.querySelector('#batch-model').required=e.target.checked;
 document.querySelector('#speech-rate').oninput=e=>document.querySelector('#rate-value').textContent=`${e.target.value}×`;
 document.querySelector('#speech-volume').oninput=e=>document.querySelector('#volume-value').textContent=`${Math.round(e.target.value*100)}%`;
 document.querySelector('#test-voice').onclick=()=>{
  if(!('speechSynthesis' in window)){document.querySelector('#settings-error').textContent='Speech is unavailable in this browser. Scanning still works.';return;}
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance('Next, serial number.');utterance.lang='en-GB';utterance.rate=Number(document.querySelector('#speech-rate').value);utterance.volume=Number(document.querySelector('#speech-volume').value);speechSynthesis.speak(utterance);
 };
 document.querySelector('#settings-form').onsubmit=e=>{
  e.preventDefault();const data=new FormData(e.target);
  const next={speechRate:Number(data.get('speechRate')),speechVolume:Number(data.get('speechVolume')),skipWindow:Number(data.get('skipWindow')),reuseModel:data.has('reuseModel'),batchModel:data.get('batchModel').trim()};
  if(next.reuseModel&&!next.batchModel){document.querySelector('#settings-error').textContent='Enter a batch model or turn off the identical equipment setting.';return;}
  state.settings=next;state.voice=data.has('voice');lastEmpty=0;
  if(!Object.keys(state.draft).length&&state.step===0)resetDraft();
  if(!state.voice)window.speechSynthesis?.cancel();notice='Scanner and voice settings saved.';persist();render();
 };
}
function updateRegister() {
 const items=filteredItems(state.items,search);
 document.querySelector('#search-count').textContent=`Showing ${items.length} of ${state.items.length} items`;
 document.querySelector('#inventory tbody').innerHTML=items.map(item=>`<tr><td><strong>${escape(item.description)}</strong><span>${escape(item.manufacturer)} · ${escape(item.model)}</span></td><td>${escape(item.serial)}</td><td>${escape(item.asset)}</td><td><span class="tag">${escape(item.trolley)}</span></td><td>${escape(item.technician)}</td><td>${escape(item.date.split('-').reverse().join('/'))}</td><td><div class="row-actions"><button class="text-button" data-edit="${escape(item.id)}" aria-label="Edit item ${escape(item.serial)}">Edit</button><button class="text-button remove" data-delete="${escape(item.id)}" aria-label="Delete item ${escape(item.serial)}">Remove</button></div></td></tr>`).join('') || `<tr><td colspan="7" class="empty"><div class="empty-icon">${icon('box')}</div><strong>${search?'No equipment matches your search.':'A little less clutter starts here.'}</strong><span>${search?'Try another serial number, trolley or technician.':'Scan your first item to start your collection register.'}</span></td></tr>`;
}
function openEditor(id) {
 const item=state.items.find(item=>item.id===id);if(!item)return;
 editingId=id;
 const dialog=document.querySelector('#edit-dialog');
 dialog.innerHTML=`<form id="edit-form"><div class="eyebrow">COLLECTION REGISTER</div><h2>Edit equipment</h2><p>Correct the saved record without rescanning it.</p><div class="edit-grid">${[...defaultFields,...fields.map(([key,label])=>[key,label,'text'])].map(([key,label,type])=>`<div><label for="edit-${key}">${escape(label)}</label><input id="edit-${key}" name="${key}" type="${type}" value="${escape(item[key])}" maxlength="1000" required></div>`).join('')}<div><label for="edit-technician">Recorded technician</label><select id="edit-technician" name="technician">${[...new Set([item.technician,...state.profiles.map(p=>p.code)])].map(code=>`<option value="${escape(code)}" ${code===item.technician?'selected':''}>${escape(state.profiles.find(p=>p.code===code)?.name||code)} · ${escape(code)}</option>`).join('')}</select></div></div><p id="edit-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="cancel-edit">Cancel</button><button class="primary">Save changes</button></div></form>`;
 dialog.showModal();
 document.querySelector('#cancel-edit').onclick=()=>dialog.close();
 document.querySelector('#edit-form').onsubmit=e=>{
  e.preventDefault();
  const values=Object.fromEntries([...new FormData(e.target)].map(([key,value])=>[key,value.trim()]));
  const error=document.querySelector('#edit-error');
  if(Object.values(values).some(value=>!value)||!validDate(values.date)){error.textContent='Complete each field, using N/A where needed, and enter a valid date.';return;}
  if(duplicateSerial(state.items.filter(item=>item.id!==editingId),values.serial)){error.textContent='This serial number belongs to another item. Check it before saving.';return;}
  state.items=state.items.map(item=>item.id===editingId?{...item,...values}:item);
  notice='Equipment changes saved.';persist();render();
 };
}
function downloadFile(data,name,type) {
 const url=URL.createObjectURL(new Blob([data],{type}));
 const link=document.createElement('a');link.href=url;link.download=name;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadBackup() {
 downloadFile(JSON.stringify({app:'DecomPro',version:1,exportedAt:new Date().toISOString(),state},null,2),`DecomPro-backup-${today()}.json`,'application/json');
 notice='Workspace backup downloaded. Keep it safe to recover records on another browser.';render();
}
async function prepareRestore(e) {
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
async function exportExcel() { try {const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Sheet1');sheet.addRow(headers);for(const item of state.items)sheet.addRow(supplierRow(item));sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF164E3D'}};sheet.getRow(1).height=30;sheet.columns.forEach((c,i)=>c.width=i===1?28:22);sheet.getColumn(1).numFmt='dd/mm/yyyy';sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter='A1:Q1';const data=await workbook.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=`Decom-${today()}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice='Excel exported. Keep this file as your session backup.';render();}catch {notice='Export failed. Your records are still in the register; please try again.';render();} }
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&state.step===fields.length&&!document.querySelector('dialog[open]')&&!['INPUT','SELECT','BUTTON','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();saveItem();}});
render();
