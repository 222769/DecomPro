import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';
import {defaultSettings} from '../src/workspace.js';
async function seed(page){
 const trolley=createTrolley('Repair cage');
 const defaults={date:'2026-10-10',description:'Monitor',manufacturer:'Dell',source:'Basement',reason:'EOL',trolley:trolley.name};
 const state={captureOrder:'serial-first',activeTrolleyId:trolley.id,trolleys:[trolley],profiles:[{name:'Ali',code:'MA'}],active:'MA',defaults,items:[{...defaults,id:'repair-one',serial:'REPAIR-001',model:'N/A',manufacturer:'N/A',asset:'A0001',barcode:'N/A',etch:'N/A',technician:'MA',trolleyId:trolley.id}],draft:{serial:'KEEP-DRAFT'},step:1,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]};
 await page.addInitScript(state=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(state));},state);await page.goto('/');return state;
}
test('failed equipment removal preserves visible inventory, stored records and unfinished scan',async({page})=>{
 await seed(page);const before=await page.evaluate(()=>localStorage.getItem('decompro.v1'));
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Storage full','QuotaExceededError');};});
 page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete item REPAIR-001',exact:true}).click();await page.getByRole('button',{name:'Remove item',exact:true}).click();
 await expect(page.locator('#remove-item-error')).toContainText('Removal failed');
 await expect(page.locator('#inventory tbody')).toContainText('REPAIR-001');expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(before);
});
test('restoring a backup clears previous review and search filters so restored records are visible',async({page})=>{
 const state=await seed(page);await page.getByRole('button',{name:'Today’s progress',exact:true}).click();await page.getByRole('button',{name:'Review missing details'}).click();await page.getByLabel('Search collection register').fill('not-in-restored-backup');
 const restored={...state,items:[{...state.items[0],id:'restored-one',serial:'RESTORED-001',model:'P2419H',manufacturer:'Dell'}]};
 await page.locator('#backup-file').setInputFiles({name:'restored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({app:'DecomPro',version:1,state:restored}))});
 await page.getByRole('button',{name:'Replace workspace & restore'}).click();
 await expect(page.locator('#inventory tbody')).toContainText('RESTORED-001');await expect(page.getByRole('button',{name:'Clear review filter'})).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('KEEP-DRAFT');
});
test('an equipment edit stays open while Firebase confirms it and only submits once',async({page})=>{
 const state=await seed(page);
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`export async function connectFirebase(){return {profile:{name:'Ali',code:'MA'},role:'technician',email:'test@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,phase){phase('connected');},versionFor(){return 1;},async load(){return {items:${JSON.stringify(state.items)},trolleys:${JSON.stringify(state.trolleys)},examples:[],corrections:[]};},async write(item){window.editCalls=(window.editCalls||0)+1;await new Promise(resolve=>window.finishEdit=resolve);}};}`}));
 await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('test@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test');await page.getByRole('button',{name:'Sign in & connect'}).click();
 await page.getByRole('button',{name:'Edit item REPAIR-001',exact:true}).click();await page.locator('#edit-model').fill('P2419H');await page.locator('#edit-manufacturer').fill('Dell');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.editCalls)).toBe(1);
 await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(page.locator('#edit-dialog')).toBeVisible();
 await page.locator('#edit-form').evaluate(form=>form.requestSubmit());expect(await page.evaluate(()=>window.editCalls)).toBe(1);
 await page.evaluate(()=>window.finishEdit());await expect(page.locator('#edit-dialog')).not.toBeVisible();await expect(page.locator('#inventory tbody')).toContainText('P2419H');
});

async function readyToSave(page){await page.goto('/');await page.getByLabel('Manufacturer',{exact:true}).fill('Dell');for(const value of ['SAVE-TEST-NEW','Manual model','N/A','N/A','A1234']){await page.locator('#scan').fill(value);await page.locator('#scan').press('Enter');}await expect(page.locator('#save')).toBeVisible();}
test('save preparation errors appear beneath the button and allow a successful retry with the draft preserved',async({page})=>{
 await readyToSave(page);await page.evaluate(()=>{const original=window.FormData;window.restoreSaveForm=()=>window.FormData=original;window.FormData=class extends original{constructor(form){if(form?.id==='defaults')throw Error('Save preparation test failure');super(form);}};});
 await page.locator('#save').click();await expect(page.locator('#save-feedback')).toContainText('Save preparation test failure');await expect(page.locator('#save')).toBeEnabled();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('SAVE-TEST-NEW');
 await page.evaluate(()=>window.restoreSaveForm());await page.locator('#save').click();await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();await expect(page.locator('#inventory tbody')).toContainText('SAVE-TEST-NEW');
});

test('pending shared saves remain visible, reject duplicates and preserve the scan if the workspace locks before confirmation',async({page})=>{
 await page.clock.install();await readyToSave(page);
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'application/javascript',body:`export async function connectFirebase(){return {uid:'save-user',profile:{name:'Jawad',code:'JA'},role:'technician',email:'test@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,phase){phase('connected');},async load(){return {items:[],trolleys:${JSON.stringify(state.trolleys)},examples:[],corrections:[]};},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]};},async write(item){window.sharedSaveCalls=(window.sharedSaveCalls||0)+1;await new Promise(resolve=>window.confirmSave=resolve);},async logout(){}};}`}));
 await page.getByRole('button',{name:'Shared database',exact:true}).click();await page.getByLabel('Team account email').fill('test@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in & connect'}).click();
 await page.locator('#save').click();await expect(page.locator('#save')).toBeDisabled();await expect(page.locator('#save-feedback')).toContainText('Saving to the shared');await page.clock.fastForward('00:16');await expect(page.locator('#save-feedback')).toContainText('taking longer');expect(await page.evaluate(()=>window.sharedSaveCalls)).toBe(1);
 await page.getByRole('button',{name:'Lock workspace',exact:true}).click();await expect(page.locator('.workspace-lock')).toBeVisible();await page.evaluate(()=>window.confirmSave());expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('SAVE-TEST-NEW');await expect(page.locator('.workspace-lock')).toBeVisible();
});
