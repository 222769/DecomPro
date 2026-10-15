import {createHandover,handoverLimit,handoverReference} from './handover-data.js';
import {checkReadiness} from './readiness.js';
import {validateTrolleys,trolleyForItem} from './trolleys.js';
import {sameRecord} from './local-import.js';
import {firebaseErrorMessage} from './firebase-errors.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localTime=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;};
export function openHandover({dialog,getState,getClient,canWrite,commit,download,notify}) {
 const client=getClient(),ready=getState().trolleys.filter(t=>t.status==='ready');let prepared=null,busy=false;
 dialog.innerHTML=`<div class="eyebrow">COLLECTION DAY</div><h2>Prepare a handover pack</h2><p>Choose up to ${handoverLimit} ready trolleys. Download the equipment Excel for the college and a handover PDF with inventories, exceptions and signature spaces. Confirm collection when the equipment has left.</p><form id="handover-form"><label for="handover-company">Collection company</label><input id="handover-company" required maxlength="100" placeholder="Decommission company"><label for="handover-date">Collection date and time (your device’s time zone)</label><input id="handover-date" type="datetime-local" required value="${localTime()}"><fieldset class="handover-selection"><legend>Ready trolleys</legend>${ready.map(t=>`<label><input type="checkbox" name="handover-trolley" value="${escape(t.id)}"><span><strong>${escape(t.name)}</strong><small>${escape(t.reference)}</small><small>Property of TSU - ${escape(t.department)}</small></span></label>`).join('')||'<p>No ready trolleys. Complete their readiness checks first.</p>'}</fieldset><div class="handover-download-actions"><button class="secondary" id="download-handover" ${ready.length?'':'disabled'}>Download handover PDF</button><button type="button" class="secondary" id="download-handover-excel" ${ready.length?'':'disabled'}>Download equipment Excel</button></div><p id="handover-excel-status" aria-live="polite"></p><p id="handover-prepared" aria-live="polite"></p><label class="review-check"><input type="checkbox" id="confirm-handover" disabled> I checked the pack and these trolleys have been collected by the company.</label><p id="handover-error" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="secondary" id="close-handover">Close</button><button type="button" class="primary" id="collect-handover" disabled>Mark selected collected</button></div></form>`;
 dialog.showModal();const form=dialog.querySelector('form'),output=dialog.querySelector('#handover-error'),message=dialog.querySelector('#handover-prepared'),excelStatus=dialog.querySelector('#handover-excel-status'),check=dialog.querySelector('#confirm-handover'),collect=dialog.querySelector('#collect-handover'),print=dialog.querySelector('#download-handover'),excel=dialog.querySelector('#download-handover-excel');
 const connected=()=>dialog.isConnected&&dialog.open&&client===getClient();
 function setBusy(value){busy=value;form.querySelectorAll('input,button').forEach(node=>node.disabled=value);if(!value){print.disabled=excel.disabled=!ready.length;check.disabled=!prepared;collect.disabled=!prepared||!check.checked;}}
 function reset(){prepared=null;check.checked=false;check.disabled=true;collect.disabled=true;excelStatus.textContent='';message.textContent='Details changed. Download an updated pack before confirming collection.';}
 form.querySelectorAll('input:not(#confirm-handover)').forEach(input=>input.oninput=reset);
 check.onchange=()=>{collect.disabled=!prepared||!check.checked;};
 dialog.oncancel=e=>{if(busy)e.preventDefault();};dialog.querySelector('#close-handover').onclick=()=>dialog.close();
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!connected())return;
  if(!canWrite())return;
  prepared=null;check.checked=false;output.textContent='';setBusy(true);
  try{
   const ids=[...form.querySelectorAll('[name=handover-trolley]:checked')].map(input=>input.value);
   if(!ids.length||ids.length>handoverLimit)throw Error(`Select between one and ${handoverLimit} ready trolleys for this pack.`);
   const pack=createHandover(ids,form.querySelector('#handover-company').value,new Date(form.querySelector('#handover-date').value).toISOString());
   const records=client?await client.load():structuredClone(getState());if(!connected())return;
   const trolleys=ids.map(id=>records.trolleys.find(t=>t.id===id));
   if(trolleys.some(t=>!t||t.status!=='ready'||!checkReadiness(t,records.items,{shared:Boolean(client)}).canReady))throw Error('A selected trolley is not ready or has unresolved checks. Review its readiness before preparing a pack.');
   const expectedVersions=Object.fromEntries(ids.map(id=>[id,client?.trolleyVersionFor(id)||0]));
   const {handoverPdf}=await import('./handover-pdf.js');const bytes=await handoverPdf(pack,records.trolleys,records.items,location.href);if(!connected())return;
   download(bytes,`${handoverReference(pack.id)}.pdf`,'application/pdf');
   prepared={pack,records,expectedVersions,actor:client?.profile.code||getState().active};
   message.textContent=`${handoverReference(pack.id)} · ${ids.length} trolleys. PDF download started. Print it and check the equipment before confirming.`;
  }catch(error){if(connected())output.textContent=`Pack not prepared: ${firebaseErrorMessage(error)}`;}
  finally{if(connected())setBusy(false);}
 };
 excel.onclick=async()=>{
  if(busy||!connected()||!canWrite())return;
  output.textContent='';excelStatus.textContent='';setBusy(true);
  try{
   const ids=[...form.querySelectorAll('[name=handover-trolley]:checked')].map(input=>input.value);
   if(!ids.length||ids.length>handoverLimit)throw Error(`Select between one and ${handoverLimit} ready trolleys for the Excel export.`);
   const records=client?await client.load():structuredClone(getState());if(!connected())return;
   const trolleys=ids.map(id=>records.trolleys.find(t=>t.id===id));
   if(trolleys.some(t=>!t||t.status!=='ready'||!checkReadiness(t,records.items,{shared:Boolean(client)}).canReady))throw Error('A selected trolley is not ready or has unresolved checks. Review its readiness before exporting.');
   const items=records.items.filter(item=>trolleys.some(t=>trolleyForItem(item,t)));
   if(!items.length)throw Error('The selected trolleys have no saved equipment to export.');
   const {supplierExcel,supplierExcelType}=await import('./supplier-excel.js');const bytes=await supplierExcel(items);if(!connected())return;
   download(bytes,`${handoverReference(ids[0])}-equipment.xlsx`,supplierExcelType);
   excelStatus.textContent=`Equipment Excel download started: ${items.length} item${items.length===1?'':'s'} from ${ids.length} selected trolley${ids.length===1?'':'s'}.`;
  }catch(error){if(connected())output.textContent=`Excel export failed: ${firebaseErrorMessage(error)}`;}
  finally{if(connected())setBusy(false);}
 };
 collect.onclick=async()=>{
  if(busy||!prepared||!check.checked||!connected()||!canWrite())return;
  const {pack,records,expectedVersions,actor}=prepared;setBusy(true);output.textContent='Confirming collection…';
  try{
   if(actor!==(client?.profile.code||getState().active))throw Error('Technician changed. Prepare a fresh pack.');
   if(Date.parse(pack.collectedAt)>Date.now()+60000)throw Error('The collection time is in the future. Enter the actual time and download an updated pack.');
   let updated;
   if(client)updated=await client.collectHandover(pack,expectedVersions);
   else {
    if(!sameRecord(getState().items,records.items)||pack.trolleyIds.some(id=>!sameRecord(getState().trolleys.find(t=>t.id===id),records.trolleys.find(t=>t.id===id))))throw Error('Inventory changed after printing. Prepare an updated pack.');
    updated=validateTrolleys(records.trolleys.filter(t=>pack.trolleyIds.includes(t.id)).map(t=>({...t,status:'collected',company:pack.company,collectedAt:pack.collectedAt,collectedBy:actor,handover:{id:pack.id,trolleyIds:pack.trolleyIds}})));
   }
   if(!connected())return;
   const state=getState(),trolleys=state.trolleys.map(t=>updated.find(row=>row.id===t.id)||t),defaults={...state.defaults};let activeTrolleyId=state.activeTrolleyId;
   if(updated.some(t=>t.id===activeTrolleyId||(!activeTrolleyId&&t.name===defaults.trolley))){const next=trolleys.find(t=>t.status==='open');activeTrolleyId=next?.id||'';defaults.trolley=next?.name||'';}
   commit({...state,trolleys,defaults,activeTrolleyId});dialog.close();notify(`Handover ${handoverReference(pack.id)} saved. ${updated.length} trolleys collected; inventories retained in collection history.`);
  }catch(error){if(connected()){prepared=null;check.checked=false;output.textContent=`Collection could not be confirmed: ${firebaseErrorMessage(error)} Check collection history and the latest database state before trying again.`;}}
  finally{if(connected())setBusy(false);}
 };
}
