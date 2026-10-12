import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';
import {defaultSettings} from '../src/workspace.js';
async function login(page){
 await page.locator('#station,.workspace-lock').first().waitFor({state:'attached'});
 if(await page.locator('#unlock-workspace').count())await page.locator('#unlock-workspace').click();else await page.getByRole('button',{name:'Shared database',exact:true}).click();
 await page.getByLabel('Team account email').fill('jawad@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.locator('#connection-status')).toContainText('Database connected');
}
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));

test('local refresh reuses one trolley when an old equipment name and different default casing are saved',async({page})=>{
 const trolley=createTrolley('Trolley 1.1');
 const defaults={date:'2026-10-12',description:'Monitor',manufacturer:'Dell',source:'Storage',reason:'EOL',trolley:' trolley   1.1 '};
 const state={captureOrder:'serial-first',activeTrolleyId:trolley.id,trolleys:[trolley],profiles:[{name:'Jawad',code:'JA'}],active:'JA',defaults,items:[{...defaults,id:'relogin-item',serial:'RELOGIN-001',model:'Checked model',barcode:'N/A',etch:'N/A',asset:'A0001',technician:'JA',trolleyId:trolley.id,trolley:'Old cage label'}],draft:{},step:0,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]};
 await page.addInitScript(state=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(state));},state);await page.goto('/');
 for(let i=0;i<3;i++){await page.getByRole('button',{name:'Trolleys',exact:true}).click();await expect(page.locator('.trolley-card')).toHaveCount(1);await expect(page.locator('#trolley-manager .trolley-reference')).toHaveText(trolley.reference);await page.getByRole('button',{name:'Close',exact:true}).click();await page.reload();}
 expect((await stored(page)).trolleys).toHaveLength(1);
});

test('Jawad creates one trolley and repeated sign-ins, refreshes and empty-cache recovery never create another',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('test.remote'))localStorage.setItem('test.remote',JSON.stringify({items:[],trolleys:[],examples:[],corrections:[]}));});
 await page.route(/\/(?:src\/firebase-db[^/]*|assets\/firebase-db-[^/]+\.js)(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`
 const read=()=>JSON.parse(localStorage.getItem('test.remote'));
 export async function connectFirebase(){sessionStorage.setItem('test.signins',String(Number(sessionStorage.getItem('test.signins')||0)+1));return {uid:'jawad',profile:{name:'Jawad Ahmed',code:'JA'},role:'technician',projectId:'decompro-236e9',teamId:'college-it',email:'jawad@example.invalid',stop(){},async logout(){},listen(a,b,c,d,phase){phase('connected')},async load(){return read()},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]}},trolleyVersionFor(){return 1},versionFor(){return 1},async writeTrolley(trolley){const data=read();data.trolleys.push(trolley);localStorage.setItem('test.remote',JSON.stringify(data));localStorage.setItem('test.trolleyWrites',String(Number(localStorage.getItem('test.trolleyWrites')||0)+1));},async write(item){const data=read();data.items.push(item);localStorage.setItem('test.remote',JSON.stringify(data));}}}
 `}));
 await page.goto('/');await login(page);expect((await stored(page)).trolleys).toHaveLength(0);expect(await page.evaluate(()=>localStorage.getItem('test.trolleyWrites'))).toBeNull();
 await page.getByRole('button',{name:'Trolleys',exact:true}).click();await page.getByLabel('New trolley name',{exact:true}).fill('Trolley 1.1');await page.getByRole('button',{name:'Create trolley',exact:true}).click();await expect(page.locator('.trolley-card')).toHaveCount(1);const created=(await stored(page)).trolleys[0];await page.locator(`[data-use="${created.id}"]`).click();await expect(page.locator('#trolley-manager')).not.toBeVisible();
 for(let i=0;i<3;i++){
  await page.getByRole('button',{name:'Lock workspace',exact:true}).click();await expect(page.locator('.workspace-lock')).toBeVisible();await login(page);await page.reload();await expect(page.locator('#connection-status')).toContainText('Database connected');expect((await stored(page)).trolleys).toEqual([created]);expect((await stored(page)).activeTrolleyId).toBe(created.id);
 }
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));state.trolleys=[];state.activeTrolleyId='';localStorage.setItem('decompro.v1',JSON.stringify(state));});await page.reload();await expect(page.locator('#connection-status')).toContainText('Database connected');expect((await stored(page)).trolleys).toEqual([created]);expect((await stored(page)).activeTrolleyId).toBe(created.id);
 await page.locator('#default-manufacturer').fill('Dell');
 for(const value of ['RELOGIN-NEW-001','N/A','N/A','N/A','A0001']){await page.locator('#scan').fill(value);await page.locator('#scan').press('Enter');}await page.locator('#save').click();await expect(page.locator('#save')).toHaveCount(0);const remote=await page.evaluate(()=>JSON.parse(localStorage.getItem('test.remote')));expect(remote.items).toHaveLength(1);expect(remote.items[0].trolleyId).toBe(created.id);expect(remote.items[0].technician).toBe('JA');expect(remote.trolleys).toHaveLength(1);expect(await page.evaluate(()=>localStorage.getItem('test.trolleyWrites'))).toBe('1');
});

test('a confirmed creation finishing after timeout cannot change the new session or create another trolley',async({page})=>{
 await page.clock.install();await page.addInitScript(()=>{if(!localStorage.getItem('test.remote'))localStorage.setItem('test.remote',JSON.stringify({items:[],trolleys:[],examples:[],corrections:[]}));});
 await page.route(/\/(?:src\/firebase-db[^/]*|assets\/firebase-db-[^/]+\.js)(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`const read=()=>JSON.parse(localStorage.getItem('test.remote'));export async function connectFirebase(){return {uid:'jawad',profile:{name:'Jawad Ahmed',code:'JA'},role:'technician',projectId:'decompro-236e9',teamId:'college-it',email:'jawad@example.invalid',stop(){},async logout(){},listen(a,b,c,d,phase){phase('connected')},async load(){return read()},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]}},trolleyVersionFor(){return 1},async writeTrolley(trolley){window.creationCount=(window.creationCount||0)+1;const data=read();data.trolleys.push(trolley);localStorage.setItem('test.remote',JSON.stringify(data));await new Promise(resolve=>window.finishCreation=resolve);},async write(item){const data=read();data.items.push(item);localStorage.setItem('test.remote',JSON.stringify(data));}}}`}));
 await page.goto('/');await login(page);await page.getByRole('button',{name:'Trolleys',exact:true}).click();await page.getByLabel('New trolley name',{exact:true}).fill('Trolley 1.1');await page.getByRole('button',{name:'Create trolley',exact:true}).evaluate(button=>{button.click();button.form.requestSubmit();});await expect.poll(()=>page.evaluate(()=>window.creationCount)).toBe(1);
 await page.clock.fastForward('05:01');await expect(page.locator('.workspace-lock')).toBeVisible();await login(page);const afterLogin=await stored(page);expect(afterLogin.trolleys).toHaveLength(1);await page.evaluate(()=>window.finishCreation());await expect(page.locator('#trolley-manager')).not.toBeVisible();expect((await stored(page)).activeTrolleyId).toBe(afterLogin.activeTrolleyId);
 const trolley=afterLogin.trolleys[0];await page.getByRole('button',{name:'Trolleys',exact:true}).click();await page.locator(`[data-use="${trolley.id}"]`).click();await page.locator('#default-manufacturer').fill('Dell');
 for(const value of ['TIMEOUT-RECOVERY-001','N/A','N/A','N/A','A0011']){await page.locator('#scan').fill(value);await page.locator('#scan').press('Enter');}await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('test.remote')).items.length)).toBe(1);expect(await page.evaluate(()=>window.creationCount)).toBe(1);
 await page.clock.fastForward('05:01');await login(page);expect((await stored(page)).activeTrolleyId).toBe(trolley.id);expect((await stored(page)).trolleys).toHaveLength(1);
});
