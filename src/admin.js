const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function openAdmin(client,onProfileChange=()=>{}) {
 if(client?.role!=='admin')return;
 const dialog=document.querySelector('#admin-dialog');
 let users=[],revision=0,busy=false;
 const errorText=error=>error.code==='functions/not-found'||error.code==='functions/unavailable'||error.code==='functions/internal'&&/^(internal)$|fetch|network/i.test(error.message)?'The account administration service is unavailable. Your existing workspace is preserved. Deploy the Firebase admin function, then retry.':error.message||'Account action could not be confirmed. Refresh users before retrying.';
 function shell() {
  dialog.innerHTML=`<div class="eyebrow">TEAM ADMINISTRATION</div><h2>Manage users</h2><p>Personal accounts for your DecomPro team. Only active administrators can make changes.</p><div class="dialog-actions"><button class="secondary" id="admin-refresh">Refresh users</button><button class="primary" id="admin-create">Create account</button></div><p id="admin-status" role="status"></p><div id="admin-users"></div><div id="admin-editor"></div><div id="admin-link" hidden></div><div class="dialog-actions"><button class="secondary" id="admin-close">Close</button></div>`;
  dialog.querySelector('#admin-refresh').onclick=()=>load();dialog.querySelector('#admin-create').onclick=()=>editor();dialog.querySelector('#admin-close').onclick=()=>dialog.close();
 }
 const connected=()=>dialog.isConnected&&Boolean(dialog.querySelector('#admin-status'));
 function status(message){if(connected())dialog.querySelector('#admin-status').textContent=message;}
 function lock(value){busy=value;dialog.querySelectorAll('button').forEach(button=>button.disabled=value);}
 async function load() {
  if(busy)return;lock(true);status('Checking team accounts…');
  try {
   const result=await client.adminAction({action:'list'});if(!connected())return;users=result.users;revision=result.revision;
   dialog.querySelector('#admin-users').innerHTML=users.map(user=>`<article class="admin-user"><div><strong>${escape(user.displayName)} <span class="tag">${escape(user.code)}</span></strong><p>${escape(user.email||'No Authentication account')}<br>${escape(user.role)} · ${user.active?'Active access':'Inactive access'}${user.authDisabled?' · Firebase sign-in disabled':''}${user.authMissing?' · Authentication account missing':''}</p></div><div class="dialog-actions"><button class="secondary" data-admin-edit="${escape(user.uid)}">Edit ${escape(user.displayName)}</button><button class="text-button" data-admin-reset="${escape(user.uid)}" ${user.authMissing?'data-unavailable="true"':''}>Password reset link</button></div></article>`).join('')||'<p>No team members found.</p>';
   dialog.querySelectorAll('[data-admin-edit]').forEach(button=>button.onclick=()=>editor(users.find(user=>user.uid===button.dataset.adminEdit)));
   dialog.querySelectorAll('[data-admin-reset]').forEach(button=>button.onclick=()=>reset(users.find(user=>user.uid===button.dataset.adminReset)));
   status(`${users.length} team account${users.length===1?'':'s'} loaded.`);
  }catch(error){status(errorText(error));}
  finally{lock(false);dialog.querySelectorAll('[data-unavailable]').forEach(button=>button.disabled=true);}
 }
 function editor(user=null) {
  if(busy)return;
  dialog.querySelector('#admin-link').hidden=true;
  const node=dialog.querySelector('#admin-editor');
  node.innerHTML=`<form id="admin-user-form"><h3>${user?'Edit user':'Create technician account'}</h3><label for="admin-name">Technician name</label><input id="admin-name" name="displayName" required maxlength="60" value="${escape(user?.displayName||'')}"><label for="admin-email">Account email</label><input id="admin-email" name="email" type="email" required maxlength="254" value="${escape(user?.email||'')}" ${user?'disabled':''}><label for="admin-code">Disposal initials</label><input id="admin-code" name="code" required maxlength="12" pattern="[A-Za-z0-9]{1,12}" value="${escape(user?.code||'')}" ${user?'readonly':''}><p>Initials stay fixed after creation so existing equipment keeps its attribution.</p><label for="admin-role">Access role</label><select id="admin-role" name="role"><option value="technician" ${user?.role!=='admin'?'selected':''}>Technician</option><option value="admin" ${user?.role==='admin'?'selected':''}>Administrator</option></select>${user?`<label class="toggle-label"><input id="admin-active" name="active" type="checkbox" ${user.active?'checked':''}> Active team access</label>`:'<label class="toggle-label"><input id="admin-existing" type="checkbox"> This person already has a Firebase account</label><p>New users choose a password through a private setup link. Existing accounts keep their current password.</p>'}<p id="admin-form-error" role="alert"></p><div class="dialog-actions"><button class="secondary" type="button" id="admin-cancel-edit">Cancel</button><button class="primary" type="submit">${user?'Save user changes':'Create user account'}</button></div></form>`;
  node.querySelector('#admin-cancel-edit').onclick=()=>{node.innerHTML='';};
  node.querySelector('form').onsubmit=async event=>{
   event.preventDefault();if(busy)return;
   const values=Object.fromEntries(new FormData(event.target));values.active=user?event.target.querySelector('#admin-active').checked:true;values.code=values.code.toUpperCase();
   if(user?.active&&!values.active&&!confirm(`Deactivate ${user.displayName}’s access to this team? Their equipment history will remain available.`))return;
   lock(true);status(user?'Updating team access…':'Creating the technician account…');
   try {
    const result=await client.adminAction({...values,action:user?'update':event.target.querySelector('#admin-existing').checked?'link':'create',uid:user?.uid,revision});
    if(!connected())return;node.innerHTML='';if(user&&user.uid===client.uid)onProfileChange(values.displayName);
    lock(false);await load();if(!connected())return;status(result.message);showLink(result);
   }catch(error){if(!connected())return;node.querySelector('#admin-form-error').textContent=errorText(error);status('Changes were not confirmed. Refresh users before retrying.');}
   finally{lock(false);dialog.querySelectorAll('[data-unavailable]').forEach(button=>button.disabled=true);}
  };
  node.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 function showLink(result) {
  const node=dialog.querySelector('#admin-link');if(!result.setupLink){node.hidden=true;return;}
  node.hidden=false;node.innerHTML='<h3>Private password setup link</h3><p>Share this link directly with the technician. Anyone with it can set their password. It is not stored in the register or backups.</p><label for="admin-setup-link">Setup or reset link</label><textarea id="admin-setup-link" rows="4" readonly></textarea><button class="secondary" id="admin-copy-link">Copy private link</button><p id="admin-copy-status" role="status"></p>';
  node.querySelector('textarea').value=result.setupLink;
  node.querySelector('#admin-copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(result.setupLink);node.querySelector('#admin-copy-status').textContent='Private link copied.';}catch{node.querySelector('textarea').select();node.querySelector('#admin-copy-status').textContent='Select and copy the link above.';}};
  node.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 async function reset(user) {
  if(busy||user.authMissing)return;lock(true);status('Generating a private password reset link…');
  try{const result=await client.adminAction({action:'reset',uid:user.uid,revision});lock(false);await load();if(!connected())return;status(result.message);showLink(result);}
  catch(error){status(errorText(error));}
  finally{lock(false);dialog.querySelectorAll('[data-unavailable]').forEach(button=>button.disabled=true);}
 }
 shell();dialog.oncancel=event=>{if(busy)event.preventDefault();};dialog.addEventListener('close',()=>{dialog.innerHTML='';},{once:true});dialog.showModal();await load();
}
