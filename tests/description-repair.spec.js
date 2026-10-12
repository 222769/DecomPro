import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';import {defaultSettings} from '../src/workspace.js';
async function seed(page){
 const trolley=createTrolley('Cage 1'),collected={...createTrolley('Collected'),status:'collected',company:'Collector',collectedAt:new Date().toISOString(),collectedBy:'MA'};
 const defaults={date:'2026-10-12',description:'Monitor',manufacturer:'Lenovo',source:'Storage',reason:'EOL',trolley:trolley.name};
 const base={...defaults,id:'old-laptop',model:'G15',serial:'OLD-LAPTOP',asset:'A0042',barcode:'B42',etch:'N/A',technician:'JA',trolleyId:trolley.id};
 const items=[base,{...base,id:'custom',serial:'CUSTOM',description:'Laptop kit'},{...base,id:'unknown',serial:'UNKNOWN',model:'Unknown'},{...base,id:'collected',serial:'COLLECTED',trolleyId:collected.id,trolley:collected.name}];
 const state={captureOrder:'serial-first',activeTrolleyId:trolley.id,trolleys:[trolley,collected],profiles:[{name:'Ali',code:'MA'}],active:'MA',defaults,items,draft:{serial:'UNFINISHED'},step:1,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]};
 await page.addInitScript(state=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(state));},state);await page.goto('/#inventory');return state;
}
async function open(page){await page.getByRole('button',{name:'Open settings',exact:true}).click();await page.getByRole('button',{name:'Review saved equipment descriptions',exact:true}).click();await expect(page.locator('#description-review-result')).toContainText('suggested changes');}
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
test('existing descriptions update only selected open equipment, retain identity and draft, and remain corrected after reload',async({page})=>{
 const before=await seed(page);await open(page);await expect(page.locator('[data-description-id="old-laptop"]')).toBeChecked();await expect(page.locator('[data-description-id="custom"]')).not.toBeChecked();await expect(page.locator('#description-preview')).not.toContainText('COLLECTED');
 await page.getByRole('button',{name:'Update selected descriptions',exact:true}).click();await expect(page.locator('#description-review-result')).toContainText('1 equipment descriptions updated');
 const after=await stored(page);expect(after.items).toEqual(before.items.map(item=>item.id==='old-laptop'?{...item,description:'Laptop'}:item));expect(after.draft).toEqual(before.draft);expect(after.defaults).toEqual(before.defaults);
 await page.reload();await expect(page.locator('#inventory tbody')).toContainText('Laptop');await open(page);await expect(page.locator('[data-description-id="old-laptop"]')).toHaveCount(0);
});
test('cancel and deselection preserve saved equipment',async({page})=>{
 const before=await seed(page);await open(page);await page.locator('[data-description-id="old-laptop"]').uncheck();await expect(page.getByRole('button',{name:'Update selected descriptions',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Close',exact:true}).click();expect((await stored(page)).items).toEqual(before.items);
});
test('storage failure preserves old descriptions and refresh permits a safe retry',async({page})=>{
 const before=await seed(page);await open(page);await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='decompro.v1')throw new DOMException('Full','QuotaExceededError');return window.originalSet.call(this,key,value);};});
 await page.getByRole('button',{name:'Update selected descriptions',exact:true}).click();await expect(page.locator('#description-review-result')).toContainText('Descriptions not updated');expect((await stored(page)).items).toEqual(before.items);
 await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);await page.getByRole('button',{name:'Refresh suggestions',exact:true}).click();await page.getByRole('button',{name:'Update selected descriptions',exact:true}).click();await expect(page.locator('#description-review-result')).toContainText('1 equipment descriptions updated');
});
async function connect(page,before,role='admin'){
 await page.route(/\/(?:src\/firebase-db[^/]*|assets\/firebase-db-[^/]+\.js)(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`
 export async function connectFirebase(){
 window.repairRemote=${JSON.stringify({items:before.items,trolleys:before.trolleys,examples:[],corrections:[]})};window.repairVersions=Object.fromEntries(window.repairRemote.items.map(i=>[i.id,1]));window.repairWrites=[];
 return {uid:'repair-admin',profile:{name:'Ali',code:'MA'},role:'${role}',email:'qa@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,phase){phase('connected')},listenCollections(){},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]}},versionFor(id){return window.repairVersions[id]},async load(){return structuredClone(window.repairRemote)},async write(item,version){if(window.repairFail===item.id)throw Error('QA temporary save failure');if(version!==window.repairVersions[item.id])throw Error('Another technician changed this record');window.repairWrites.push(structuredClone(item));window.repairVersions[item.id]++;window.repairRemote.items=window.repairRemote.items.map(i=>i.id===item.id?structuredClone(item):i);},async logout(){}};
 }`}));
 await page.getByRole('button',{name:'Shared database',exact:true}).click();await page.getByLabel('Team account email').fill('qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('qa-only');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#database-dialog')).not.toBeVisible();
}
test('shared administrator repairs preserve recorded technician and retry only unconfirmed descriptions',async({page})=>{
 const before=await seed(page);await connect(page,before);await open(page);await page.locator('[data-description-id="custom"]').check();await page.evaluate(()=>window.repairFail='custom');
 await page.getByRole('button',{name:'Update selected descriptions',exact:true}).click();await expect(page.locator('#description-review-result')).toContainText('1 descriptions confirmed');
 expect(await page.evaluate(()=>window.repairWrites)).toEqual([{...before.items[0],description:'Laptop'}]);
 await page.evaluate(()=>window.repairFail=null);await page.getByRole('button',{name:'Refresh suggestions',exact:true}).click();await expect(page.locator('[data-description-id="old-laptop"]')).toHaveCount(0);await page.locator('[data-description-id="custom"]').check();await page.getByRole('button',{name:'Update selected descriptions',exact:true}).click();await expect(page.locator('#description-review-result')).toContainText('1 equipment descriptions updated');
 expect(await page.evaluate(()=>window.repairWrites)).toEqual([{...before.items[0],description:'Laptop'},{...before.items[1],description:'Laptop'}]);expect((await stored(page)).draft).toEqual(before.draft);
});
test('shared revision changes and ready trolleys invalidate a preview before any description is written',async({page})=>{
 const before=await seed(page);await connect(page,before);await open(page);await page.evaluate(()=>window.repairVersions['old-laptop']++);
 await page.getByRole('button',{name:'Update selected descriptions',exact:true}).click();await expect(page.locator('#description-review-result')).toContainText('Equipment changed after this preview');expect(await page.evaluate(()=>window.repairWrites.length)).toBe(0);
 await page.getByRole('button',{name:'Refresh suggestions',exact:true}).click();await page.evaluate(()=>window.repairRemote.trolleys[0].status='ready');await page.getByRole('button',{name:'Update selected descriptions',exact:true}).click();await expect(page.locator('#description-review-result')).toContainText('trolley is now locked');expect(await page.evaluate(()=>window.repairWrites.length)).toBe(0);
});
test('shared technician cannot apply the bulk description repair',async({page})=>{
 const before=await seed(page);await connect(page,before,'technician');await page.getByRole('button',{name:'Open settings',exact:true}).click();await expect(page.getByRole('button',{name:'Review saved equipment descriptions',exact:true})).toBeDisabled();
});
