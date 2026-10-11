import {equipmentRowsFromWorkbook,equipmentImportPlan} from './equipment-import.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function openEquipmentImport({dialog,client,current,load,commit,close}) {
 let snapshot=await load(),rows=[],selected=new Set(),busy=false,trolleyId=snapshot.trolleys.find(t=>t.status==='open')?.id||'',date='',technician='',message='',limit=50,optionsOpen=false;
 if(!current())throw Error('Workspace changed. Open the equipment importer again.');
 const selectedRows=()=>rows.filter(row=>selected.has(row.id));
 const plan=()=>equipmentImportPlan(selectedRows(),snapshot.items,snapshot.trolleys.find(t=>t.id===trolleyId),{date,technician});
 const signature=entries=>JSON.stringify(entries.map(row=>[row.id,row.status,row.reason,row.item]));
 function finish(){if(busy)return;dialog.close();close(message);}
 dialog.oncancel=e=>{e.preventDefault();finish();};
 function draw() {
  const options=dialog.querySelector('#equipment-import-options');if(options)optionsOpen=options.open;
  const preview=plan(),byId=new Map(preview.map(row=>[row.id,row]));
  dialog.innerHTML=`<div class="eyebrow">CONTINUE AN EXISTING COLLECTION</div><h2>Import equipment into register</h2><p>Add equipment from an Excel sheet, then continue scanning. This is separate from the recognition spreadsheet importer in Settings. Existing equipment and your current scan are preserved.</p>${client?'<p>Historical equipment imports require a team administrator. Spreadsheet dates and disposal initials are preserved.</p>':''}<label for="equipment-workbook">Equipment spreadsheet (.xlsx)</label><input id="equipment-workbook" type="file" accept=".xlsx"><label for="equipment-import-trolley">Assign imported equipment to trolley</label><select id="equipment-import-trolley"><option value="">Choose an open trolley</option>${snapshot.trolleys.filter(t=>t.status==='open').map(t=>`<option value="${escape(t.id)}" ${t.id===trolleyId?'selected':''}>${escape(t.name)} · ${escape(t.reference)}</option>`).join('')}</select><p>Only selected rows are imported. Create another trolley through Trolleys before importing if needed.</p><details id="equipment-import-options" ${optionsOpen?'open':''}><summary>Fill missing dates or disposal initials</summary><label for="equipment-import-date">Date for rows with no disposal date</label><input id="equipment-import-date" type="date" value="${escape(date)}"><label for="equipment-import-technician">Disposal initials for rows with no technician</label><input id="equipment-import-technician" maxlength="1000" value="${escape(technician)}"><p>These values only fill blank cells. Invalid dates must be corrected in Excel. Other blank fields become N/A and are shown in the preview.</p></details>${rows.length?`<div class="restore-summary"><strong>${preview.filter(row=>row.status==='new').length} ready to import</strong><span>${preview.filter(row=>row.status==='blocked').length} blocked · ${preview.filter(row=>row.status==='saved').length} already imported · ${rows.length-selected.size} excluded</span></div><p>Historical asset values are retained. Imported model details need a label check in Edit before contributing to serial recognition.</p><div class="table-wrap"><table><thead><tr><th>Include</th><th>Spreadsheet row</th><th>Equipment details</th><th>Result</th></tr></thead><tbody>${rows.slice(0,limit).map(row=>{const entry=byId.get(row.id);return `<tr><td><input type="checkbox" data-equipment-row="${escape(row.id)}" aria-label="Include ${escape(row.sheet)} row ${row.row}" ${selected.has(row.id)?'checked':''}></td><td>${escape(row.sheet)} · ${row.row}</td><td><strong>${escape(row.values.serial||'N/A')}</strong> · ${escape(row.values.model||'N/A')}<br>${escape(row.values.manufacturer||'N/A')}<details><summary>View all fields</summary><dl>${Object.entries(entry?.item||row.values).filter(([key])=>!['id','recognitionNeedsReview','recognitionConfirmed','trolleyId'].includes(key)).map(([key,value])=>`<dt>${escape(key)}</dt><dd>${escape(value)}</dd>`).join('')}</dl></details></td><td>${escape(entry?.reason||'Excluded')}${entry?.warnings.length?`<small>${escape(entry.warnings.join(' · '))}</small>`:''}${row.error?`<p role="alert">${escape(row.error)}</p>`:''}</td></tr>`;}).join('')}</tbody></table></div>${rows.length>limit?'<button type="button" class="secondary" id="equipment-import-more">Show more rows</button>':''}`:''}<p id="equipment-import-message" role="status">${escape(message)}</p><div class="dialog-actions"><button class="secondary" id="close-equipment-import">Close</button><button class="primary" id="confirm-equipment-import" ${!preview.some(row=>row.status==='new')?'disabled':''}>Import selected equipment</button></div>`;
  dialog.querySelector('#close-equipment-import').onclick=finish;
  dialog.querySelector('#equipment-workbook').onchange=readFile;
  dialog.querySelector('#equipment-import-trolley').onchange=e=>{trolleyId=e.target.value;draw();};
  dialog.querySelector('#equipment-import-date').onchange=e=>{date=e.target.value;draw();};
  dialog.querySelector('#equipment-import-technician').onchange=e=>{technician=e.target.value.trim();draw();};
  dialog.querySelectorAll('[data-equipment-row]').forEach(input=>input.onchange=()=>{input.checked?selected.add(input.dataset.equipmentRow):selected.delete(input.dataset.equipmentRow);draw();});
  dialog.querySelector('#equipment-import-more')?.addEventListener('click',()=>{limit+=50;draw();});
  dialog.querySelector('#confirm-equipment-import').onclick=save;
 }
 function lock(){busy=true;dialog.querySelectorAll('button,input,select').forEach(node=>node.disabled=true);}
 async function readFile(event) {
  const file=event.target.files?.[0];if(!file||busy)return;lock();
  try{const parsed=await equipmentRowsFromWorkbook(await file.arrayBuffer());if(!current())throw Error('Workspace changed. Close and reopen this importer.');rows=parsed;selected=new Set(rows.map(row=>row.id));limit=50;snapshot=await load();message=`${rows.length} equipment rows loaded. Review the selected rows before importing.`;}
  catch(error){message=`Spreadsheet could not be loaded. ${error.message}`;rows=[];selected.clear();}
  finally{busy=false;draw();}
 }
 async function save() {
  if(busy||!current())return;const previous=plan();lock();let saved=0;
  try {
   snapshot=await load();if(!current())throw Error('Workspace changed. Close and reopen this importer.');
   const fresh=plan();if(signature(fresh)!==signature(previous)){message='The register or trolley changed. Review the updated preview before importing.';return;}
   const ready=fresh.filter(row=>row.status==='new');if(!ready.length)return;
   if(!client){commit(ready.map(row=>row.item));saved=ready.length;snapshot=await load();}
   else {
    for(const row of ready){if(!current())throw Error('Workspace changed. Reconnect to check imported equipment.');
     dialog.querySelector('#equipment-import-message').textContent=`Saving ${row.item.serial}… ${saved} saved`;
     try{await client.write(row.item,0,{historicalImport:true});saved++;rows.find(source=>source.id===row.id).error='';}
     catch(error){rows.find(source=>source.id===row.id).error=error.message;}
    }
    snapshot=await load();if(!current())throw Error('Workspace changed. Reconnect to check imported equipment.');commit(snapshot.items,true);
   }
   message=`${saved} equipment records imported${client?' to Firebase':' into this browser'}. ${plan().filter(row=>row.status==='new').length} selected records remain to import. Continue scanning into your chosen trolley using Change trolley.`;
  }catch(error){message=`Import stopped. ${saved} records saved. ${error.message} Review before retrying; existing equipment is preserved.`;}
  finally{busy=false;draw();}
 }
 draw();dialog.showModal();
}
