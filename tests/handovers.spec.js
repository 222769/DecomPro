import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';
import {defaultSettings,parseBackup} from '../src/workspace.js';
import {handoverReference} from '../src/handover-data.js';
import {readFile} from 'node:fs/promises';

async function seed(page) {
 const ready=name=>({...createTrolley(name),status:'ready',readyAt:new Date().toISOString(),readyBy:'JA'});
 const trolleys=[ready('Collection 01'),ready('Collection 02'),createTrolley('Still filling')];
 const defaults={date:'2026-10-10',description:'Monitor',manufacturer:'Dell',source:'Storage',reason:'EOL',trolley:trolleys[2].name};
 const items=trolleys.slice(0,2).map((t,i)=>({...defaults,id:`pack-item-${i}`,serial:`HANDOVER-00${i+1}`,model:i?'N/A':'P2419H',manufacturer:'Dell',barcode:'N/A',etch:'N/A',asset:`A000${i}`,technician:'JA',trolley:t.name,trolleyId:t.id,...(i?{readinessNotes:{model:'Label damaged'}}:{})}));
 const state={captureOrder:'serial-first',activeTrolleyId:trolleys[2].id,trolleys,profiles:[{name:'Ali',code:'MA'},{name:'Jawad',code:'JA'}],active:'MA',defaults,items,draft:{serial:'UNFINISHED'},step:1,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]};
 await page.addInitScript(state=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(state));},state);await page.goto('/');return {state,trolleys};
}
async function prepare(page,trolleys){
 await page.getByRole('button',{name:'Trolleys',exact:true}).click();await page.locator('#prepare-handover').click();
 await page.getByLabel('Collection company',{exact:true}).fill('Decom Supplier');
 for(const trolley of trolleys.slice(0,2))await page.locator(`[name=handover-trolley][value="${trolley.id}"]`).check();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download handover PDF',exact:true}).click();return await download;
}
test('handover PDF includes only selected ready inventories and exceptions; collection and backup retain the complete pack',async({page})=>{
 const {trolleys}=await seed(page),before=await page.evaluate(()=>localStorage.getItem('decompro.v1'));
 const file=await prepare(page,trolleys),reference=handoverReference(trolleys[0].id),pdf=(await readFile(await file.path())).toString('latin1');
 expect(file.suggestedFilename()).toBe(`${reference}.pdf`);expect(pdf.startsWith('%PDF')).toBe(true);
 for(const text of [reference,'Decom Supplier','HANDOVER-001','HANDOVER-002','Label damaged','Released by','Received by',trolleys[0].reference,trolleys[1].reference])expect(pdf).toContain(text);
 expect(pdf).not.toContain(trolleys[2].reference);expect((pdf.match(/\/Type \/Page\b/g)||[]).length).toBeGreaterThanOrEqual(3);
 expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(before);
 await expect(page.getByRole('button',{name:'Mark selected collected'})).toBeDisabled();
 await page.getByLabel('I checked the pack and these trolleys have been collected').check();await page.getByRole('button',{name:'Mark selected collected'}).click();
 await expect(page.locator('.handover-history-card')).toContainText(reference);await expect(page.locator('.handover-history-card')).toContainText('2 trolleys · 2 items');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(saved.trolleys.slice(0,2).map(t=>t.status)).toEqual(['collected','collected']);expect(saved.trolleys[2].status).toBe('open');expect(saved.trolleys[0].handover.trolleyIds).toEqual(trolleys.slice(0,2).map(t=>t.id));expect(saved.draft.serial).toBe('UNFINISHED');expect(saved.items.map(i=>i.technician)).toEqual(['JA','JA']);
 const retainedDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download retained handover PDF'}).click();const retained=await retainedDownload;expect(retained.suggestedFilename()).toBe(`${reference}.pdf`);expect((await readFile(await retained.path())).toString('latin1')).toContain('Collection recorded by: MA');
 await page.getByLabel('Search collected trolleys').fill(reference);await expect(page.locator('.handover-history-card')).toBeVisible();
 const backupDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Backup',exact:true}).click();const backup=await backupDownload;expect(parseBackup(await readFile(await backup.path(),'utf8')).trolleys[0].handover).toEqual(saved.trolleys[0].handover);
 await page.reload();await expect(page.locator('.handover-history-card')).toContainText(reference);
});
test('changing printed details requires a fresh PDF; failed local collection preserves all ready trolleys',async({page})=>{
 await page.setViewportSize({width:390,height:844});const {trolleys}=await seed(page);await prepare(page,trolleys);
 await page.getByLabel('Collection company',{exact:true}).fill('Updated Supplier');await expect(page.getByRole('button',{name:'Mark selected collected'})).toBeDisabled();await expect(page.locator('#confirm-handover')).toBeDisabled();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download handover PDF'}).click();await download;
 const before=await page.evaluate(()=>localStorage.getItem('decompro.v1'));await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Storage full','QuotaExceededError');};});
 await page.getByLabel('I checked the pack and these trolleys have been collected').check();await page.getByRole('button',{name:'Mark selected collected'}).click();
 await expect(page.locator('#handover-error')).toContainText('Collection could not be confirmed');expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('shared collection failures preserve the whole ready group and permit a new checked pack',async({page})=>{
 const {state,trolleys}=await seed(page);await page.evaluate(state=>{window.packFixture={items:state.items,trolleys:state.trolleys,examples:[],corrections:[]};window.packAttempts=0;},state);
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectFirebase(){return {profile:{name:'Ali',code:'MA'},role:'technician',email:'ali@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,connection){connection('connected');},trolleyVersionFor(){return 3;},async load(){return structuredClone(window.packFixture);},async collectHandover(pack,versions){window.packAttempts++;if(window.packAttempts===1)throw Error('A trolley changed after the pack was prepared.');window.packVersions=versions;const updated=window.packFixture.trolleys.filter(t=>pack.trolleyIds.includes(t.id)).map(t=>({...t,status:'collected',company:pack.company,collectedAt:pack.collectedAt,collectedBy:'MA',handover:{id:pack.id,trolleyIds:pack.trolleyIds}}));window.packFixture.trolleys=window.packFixture.trolleys.map(t=>updated.find(row=>row.id===t.id)||t);return updated;}};}
 `}));
 await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('ali@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();
 await prepare(page,trolleys);await page.getByLabel('I checked the pack and these trolleys have been collected').check();await page.getByRole('button',{name:'Mark selected collected'}).click();
 await expect(page.locator('#handover-error')).toContainText('could not be confirmed');expect(await page.evaluate(()=>window.packFixture.trolleys.slice(0,2).map(t=>t.status))).toEqual(['ready','ready']);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download handover PDF'}).click();await download;await page.getByLabel('I checked the pack and these trolleys have been collected').check();await page.getByRole('button',{name:'Mark selected collected'}).click();
 await expect(page.locator('.handover-history-card')).toContainText('2 trolleys · 2 items');expect(await page.evaluate(()=>window.packVersions)).toEqual(Object.fromEntries(trolleys.slice(0,2).map(t=>[t.id,3])));expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('UNFINISHED');
});
