import {restorePlan} from './recovery.js';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function openRecovery({dialog,getClient,getState,commit,canWrite}){
 const client=getClient();if(client&&client.role!=='admin')throw Error('Only an administrator can restore equipment.');
 let rows=[],selected=null,busy=false;
 const current=()=>client===getClient()&&dialog.isConnected;
 const read=()=>client?client.loadDeleted():Promise.resolve(getState().deletedItems||[]);
 const draw=message=>{
  dialog.innerHTML=`<h2>Deleted equipment</h2><p>Review an item and choose an open trolley to restore it. Original equipment details and disposal attribution are preserved.</p><p role="status" id="recovery-status">${escape(message||'')}</p>${selected?`<form id="recovery-form"><h3>${escape(selected.serial)} · ${escape(selected.model)}</h3><p>${escape(selected.manufacturer)} · Asset ${escape(selected.asset)} · Original trolley ${escape(selected.trolley)}</p><label for="recovery-trolley">Restore to trolley</label><select id="recovery-trolley" required><option value="">Choose an open trolley…</option>${getState().trolleys.filter(row=>row.status==='open').map(row=>`<option value="${escape(row.id)}" ${row.id===selected.trolleyId?'selected':''}>${escape(row.name)} · ${escape(row.reference)}</option>`).join('')}</select><button class="primary" ${busy?'disabled':''}>Restore item</button></form>`:`<div class="readiness-list">${rows.map(row=>`<article><strong>${escape(row.serial)} · ${escape(row.model)}</strong><p>${escape(row.manufacturer)} · ${escape(row.asset)} · ${escape(row.trolley)}</p><button class="secondary" data-recover="${escape(row.id)}">Review restore</button></article>`).join('')||'<p>No deleted equipment is available to restore.</p>'}</div>`}<div class="dialog-actions"><button class="secondary" id="recovery-close" ${busy?'disabled':''}>Close</button></div>`;
  dialog.querySelector('#recovery-close').onclick=()=>dialog.close();
  dialog.querySelectorAll('[data-recover]').forEach(button=>button.onclick=()=>{selected=rows.find(row=>row.id===button.dataset.recover);draw();});
  dialog.querySelector('form')?.addEventListener('submit',restore);
 };
 async function restore(event){
  event.preventDefault();if(busy||!canWrite()||!current())return;
  const target=dialog.querySelector('#recovery-trolley').value,item=structuredClone(selected),version=client?.versionFor(item.id);busy=true;draw('Restoring equipment…');
  try{
   const [latest,deleted]=await Promise.all([client?client.load():Promise.resolve(getState()),read()]);
   if(!current())return;
   const original=deleted.find(row=>row.id===item.id);if(!original||JSON.stringify(original)!==JSON.stringify(item)||(client&&client.versionFor(item.id)!==version))throw Error('This deleted item changed. Close and reopen Deleted equipment.');
   const restored=restorePlan(original,latest.items,latest.trolleys,target);
   if(client)await client.write(restored,version,{restore:true});
   if(!current())return;
   commit({...getState(),items:[...latest.items,restored],trolleys:latest.trolleys,...(!client?{deletedItems:deleted.filter(row=>row.id!==item.id)}:{})});
   rows=rows.filter(row=>row.id!==item.id);selected=null;busy=false;draw('Item restored. It is available in the collection register.');
  }catch(error){busy=false;if(current())draw(`Item not restored. ${error.message}`);}
 }
 dialog.oncancel=event=>{if(busy)event.preventDefault();};draw('Loading deleted equipment…');dialog.showModal();
 try{rows=await read();if(current())draw();}catch(error){if(current())draw(`Deleted equipment could not load. ${error.message}`);}
}
