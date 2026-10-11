import {createCollection,collectionScope} from './collection-sessions.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function openSessionEditor({dialog,id='',load,current,save,done,version}) {
 const state=await load();if(!current())throw Error('Workspace changed. Reopen collection management.');
 const existing=state.collectionSessions.find(row=>row.id===id);if(id&&!existing)throw Error('This collection is no longer available.');
 const newSession=existing||createCollection('New collection');
 const checked=new Set(state.collectionTrolleys.filter(row=>row.sessionId===id).map(row=>row.trolleyId));
 const expectedVersion=id?version(id):0;let busy=false;
 dialog.innerHTML=`<form id="collection-session-form"><div class="eyebrow">NAMED COLLECTIONS</div><h2>${id?'Manage collection trolleys':'Create a collection'}</h2><label for="collection-name">Collection name</label><input id="collection-name" name="name" maxlength="80" required value="${escape(existing?.name||'')}" placeholder="e.g. Summer 2026"><p>Select up to 12 trolleys. Their existing and future equipment will belong to this collection. Grouping keeps disposal records and physical collection statuses intact.</p><div class="collection-trolley-options">${state.trolleys.map(trolley=>{const owner=state.collectionTrolleys.find(row=>row.trolleyId===trolley.id),foreign=owner&&owner.sessionId!==id,group=state.collectionSessions.find(row=>row.id===owner?.sessionId);return `<label class="collection-trolley-option"><input type="checkbox" name="trolley" value="${escape(trolley.id)}" ${checked.has(trolley.id)?'checked':''} ${foreign?'disabled':''}><span><strong>${escape(trolley.name)}</strong><small>${escape(trolley.reference)} · ${escape(trolley.status)} · ${collectionScope(owner?.sessionId||'',[{trolleyId:trolley.id,sessionId:owner?.sessionId||''}],[trolley],state.items).items.length} items${foreign?` · Assigned to ${escape(group?.name||'another collection')}`:''}</small></span></label>`;}).join('')||'<p>Create a trolley through Trolleys, then assign it here.</p>'}</div><p>To move a trolley between collections, remove its assignment from the old collection first. This changes grouping only.</p><p id="collection-session-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" id="close-session-editor">Cancel</button><button class="primary">Save collection</button></div></form>`;
 dialog.oncancel=event=>{if(busy)event.preventDefault();};dialog.querySelector('#close-session-editor').onclick=()=>dialog.close();
 dialog.querySelector('#collection-session-form').onsubmit=async event=>{
  event.preventDefault();if(busy||!current())return;busy=true;dialog.querySelectorAll('input,button').forEach(node=>node.disabled=true);
  const name=dialog.querySelector('#collection-name').value.trim(),ids=[...dialog.querySelectorAll('input[name=trolley]:checked')].map(node=>node.value),session={...newSession,name};
  try {await save(session,ids,expectedVersion);if(!current())throw Error('Workspace changed. Reconnect to check the saved collection.');dialog.close();done(session,!existing);}
  catch(error){dialog.querySelector('#collection-session-error').textContent=error.message;}
  finally{busy=false;dialog.querySelectorAll('button,#collection-name').forEach(node=>node.disabled=false);dialog.querySelectorAll('input[name=trolley]').forEach(node=>{node.disabled=state.collectionTrolleys.some(row=>row.trolleyId===node.value&&row.sessionId!==id);});}
 };
 dialog.showModal();
}
