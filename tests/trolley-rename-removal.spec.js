import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';
import {defaultSettings} from '../src/workspace.js';
async function seed(page,{ready=false}={}){
 const trolley=createTrolley('Cage 1'),other=createTrolley('Cage 2');
 if(ready)Object.assign(trolley,{status:'ready',readyAt:new Date().toISOString(),readyBy:'MA'});
 const defaults={date:'2026-10-12',description:'Monitor',manufacturer:'Dell',source:'Basement',reason:'EOL',trolley:trolley.name};
 const item={...defaults,id:'rename-item',serial:'RENAME-001',model:'P2419H',asset:'A0042',barcode:'B42',etch:'N/A',technician:'MA',trolleyId:trolley.id};
 const state={captureOrder:'serial-first',activeTrolleyId:trolley.id,trolleys:[trolley,other],profiles:[{name:'Ali',code:'MA'}],active:'MA',defaults,items:[item],draft:{serial:'UNFINISHED'},step:1,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]};
 await page.addInitScript(state=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(state));},state);
 await page.goto('/#inventory');await expect(page.locator('#inventory tbody')).toContainText(item.serial);return {state,trolley,item};
}
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
async function edit(page,id){await page.getByRole('button',{name:'Trolleys',exact:true}).click();await page.locator(`[data-details="${id}"]`).click();}

test('rename updates inventory and active trolley, keeps identifiers and unfinished scan, and survives reload',async({page})=>{
 const {trolley,item}=await seed(page);await edit(page,trolley.id);await page.getByLabel('Trolley name',{exact:true}).fill('New cage name');await page.getByRole('button',{name:'Save trolley',exact:true}).click();await expect(page.locator('#trolley-manager')).not.toBeVisible();
 let state=await stored(page);expect(state.trolleys[0]).toMatchObject({id:trolley.id,reference:trolley.reference,name:'New cage name'});expect(state.items).toEqual([{...item,trolley:'New cage name'}]);expect(state.defaults.trolley).toBe('New cage name');expect(state.draft.serial).toBe('UNFINISHED');
 await expect(page.locator('#inventory tbody')).toContainText('New cage name');await page.reload();await expect(page.locator('#inventory tbody')).toContainText('New cage name');
});

test('duplicate names are rejected and cancelling a rename preserves trolley details',async({page})=>{
 const {trolley}=await seed(page);await edit(page,trolley.id);await page.getByLabel('Trolley name',{exact:true}).fill(' cage 2 ');await page.getByRole('button',{name:'Save trolley',exact:true}).click();await expect(page.locator('#trolley-manager-error')).toContainText('already uses');expect((await stored(page)).trolleys[0].name).toBe('Cage 1');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('#trolley-manager')).toContainText('Cage 1');
});

test('remove uses in-app confirmation even when native browser dialogs are suppressed, cancels safely and persists removal',async({page})=>{
 await seed(page);await page.evaluate(()=>window.confirm=()=>false);await page.getByRole('button',{name:'Delete item RENAME-001',exact:true}).click();await expect(page.locator('#edit-dialog')).toContainText('Remove equipment?');await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await stored(page)).items).toHaveLength(1);
 await page.getByRole('button',{name:'Delete item RENAME-001',exact:true}).click();await page.getByRole('button',{name:'Remove item',exact:true}).dblclick();await expect(page.locator('#inventory tbody')).not.toContainText('RENAME-001');expect((await stored(page)).items).toHaveLength(0);expect((await stored(page)).draft.serial).toBe('UNFINISHED');await page.reload();await expect(page.locator('#inventory tbody')).not.toContainText('RENAME-001');
});

test('ready trolley cannot be renamed or have equipment removed; explanation stays in confirmation',async({page})=>{
 const {trolley}=await seed(page,{ready:true});await page.getByRole('button',{name:'Trolleys',exact:true}).click();await expect(page.locator(`[data-details="${trolley.id}"]`)).toHaveCount(0);await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Delete item RENAME-001',exact:true}).click();await page.getByRole('button',{name:'Remove item',exact:true}).click();await expect(page.locator('#remove-item-error')).toContainText('Reopen a ready trolley');expect((await stored(page)).items).toHaveLength(1);
});

async function shared(page){
 const fixture=await seed(page);await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));window.remote={items:state.items,trolleys:state.trolleys,examples:[],corrections:[]};window.itemVersion=1;window.trolleyVersion=1;window.writeCount=0;});
 await page.route(/\/(?:src\/firebase-db[^/]*|assets\/firebase-db-[^/]+\.js)(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`export async function connectFirebase(){return {uid:'rename-tech',profile:{name:'Ali',code:'MA'},role:'technician',teamId:'college-it',email:'qa@example.invalid',stop(){},listen(a,b,c,d,phase){phase('connected')},versionFor(){return window.itemVersion},trolleyVersionFor(){return window.trolleyVersion},async load(){return structuredClone(window.remote)},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]}},async writeTrolley(trolley,version){if(version!==window.trolleyVersion)throw Error('Another technician changed this trolley');window.remote.trolleys=window.remote.trolleys.map(row=>row.id===trolley.id?trolley:row);window.trolleyVersion++},async write(item,version,options){window.writeCount++;if(window.failRemoval){window.failRemoval=false;throw Error('Temporary connection failure');}if(version!==window.itemVersion)throw Error('Another technician changed this record');if(options?.deleted)window.remote.items=window.remote.items.filter(row=>row.id!==item.id);window.itemVersion++}}}` }));
 await page.getByRole('button',{name:'Shared database',exact:true}).click();await page.getByLabel('Team account email').fill('qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.locator('#database-dialog')).not.toBeVisible();return fixture;
}

test('shared rename keeps existing items linked and removal retries visibly after a connection failure',async({page})=>{
 const {trolley}=await shared(page);await edit(page,trolley.id);await page.getByLabel('Trolley name',{exact:true}).fill('Team renamed cage');await page.getByRole('button',{name:'Save trolley',exact:true}).click();await expect(page.locator('#inventory tbody')).toContainText('Team renamed cage');
 await page.evaluate(()=>window.failRemoval=true);await page.getByRole('button',{name:'Delete item RENAME-001',exact:true}).click();await page.getByRole('button',{name:'Remove item',exact:true}).click();await expect(page.locator('#remove-item-error')).toContainText('Temporary connection failure');expect((await stored(page)).items).toHaveLength(1);
 await page.getByRole('button',{name:'Remove item',exact:true}).click();await expect(page.locator('#edit-dialog')).not.toBeVisible();expect(await page.evaluate(()=>window.remote.items.length)).toBe(0);
});

test('shared removal refuses an item changed after confirmation opened',async({page})=>{
 await shared(page);await page.getByRole('button',{name:'Delete item RENAME-001',exact:true}).click();await page.evaluate(()=>{window.itemVersion++;window.remote.items[0].asset='A9999';});await page.getByRole('button',{name:'Remove item',exact:true}).click();await expect(page.locator('#remove-item-error')).toContainText('changed');expect(await page.evaluate(()=>window.writeCount)).toBe(0);expect((await stored(page)).items).toHaveLength(1);
});
