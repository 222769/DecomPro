import {test,expect} from '@playwright/test';import {createTrolley} from '../src/trolleys.js';import {defaultSettings} from '../src/workspace.js';
async function seed(page,{status='open',duplicates=false}={}){
 const source={...createTrolley('Source'),...(status==='ready'?{status,readyAt:new Date().toISOString(),readyBy:'JA'}:{}),...(status==='collected'?{status,collectedAt:new Date().toISOString(),collectedBy:'JA',company:'Collector'}:{})},target=createTrolley('Target');
 const item={id:'rescan-existing',date:'2026-02-16',description:'Monitor',model:'Checked model',manufacturer:'Checked maker',source:'Storage',serial:'EXISTING-0001',barcode:'0000123000',etch:'ORIGINAL-ETCH',asset:'A0042',reason:'EOL',technician:'JA',trolley:source.name,trolleyId:source.id};
 const state={captureOrder:'serial-first',activeTrolleyId:target.id,trolleys:[source,target],profiles:[{name:'Ali',code:'MA'}],active:'MA',defaults:{date:'2026-10-12',description:'Desktop',manufacturer:'Batch maker',source:'New location',reason:'Different reason',trolley:target.name},items:duplicates?[item,{...item,id:'ambiguous-record'}]:[item],draft:{},step:0,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]};
 await page.addInitScript(state=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(state));},state);await page.goto('/#station');await expect(page.locator('#station')).toBeVisible();return {source,target,item,state};
}
async function lookup(page,serial='existing-0001'){await page.locator('#rescan-mode').check();await page.getByLabel('Rescan serial or asset number',{exact:true}).fill(serial);await page.getByRole('button',{name:'Find saved item',exact:true}).click();}
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));

test('rescan auto-fills exact saved fields and moves the same item with original attribution and move history',async({page})=>{
 const {item,target}=await seed(page);await lookup(page);for(const value of [item.model,item.manufacturer,item.asset,item.barcode,item.etch])await expect(page.locator('#station .captured')).toContainText(value);await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Existing item moved');const state=await stored(page);expect(state.items).toEqual([{...item,trolley:target.name,trolleyId:target.id}]);expect(state.trolleyMoves).toHaveLength(1);expect(state.trolleyMoves[0].actor.code).toBe('MA');
 await page.getByLabel('Rescan serial or asset number',{exact:true}).fill(item.serial);await page.getByRole('button',{name:'Find saved item',exact:true}).click();await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Already recorded');expect((await stored(page)).items).toHaveLength(1);expect((await stored(page)).trolleyMoves).toHaveLength(1);await page.reload();await expect(page.locator('#rescan-mode')).not.toBeChecked();
});

test('normal scanning does not fill asset/barcode and switching modes preserves its captured and typed progress',async({page})=>{
 await seed(page);await page.locator('#scan').fill('EXISTING-0001');await page.locator('#scan').press('Enter');const before=await stored(page);expect(before.draft.asset).toBeUndefined();expect(before.draft.barcode).toBeUndefined();await page.locator('#scan').fill('NORMAL-UNSUBMITTED');await lookup(page);await page.locator('#rescan-mode').uncheck();await expect(page.locator('#scan')).toHaveValue('NORMAL-UNSUBMITTED');expect((await stored(page)).draft).toEqual(before.draft);expect((await stored(page)).step).toBe(before.step);
});

for(const serial of ['N/A','UNREGISTERED-SERIAL','C17K3520DNCR'])test(`rescan rejects ${serial} rather than creating or guessing a record`,async({page})=>{
 await seed(page);const before=await stored(page);await lookup(page,serial);await expect(page.locator('#rescan-message')).toContainText('Rescan stopped');await expect(page.locator('#confirm-rescan')).toHaveCount(0);expect((await stored(page)).items).toEqual(before.items);
});

test('ambiguous registered serials are not picked arbitrarily',async({page})=>{
 await seed(page,{duplicates:true});await lookup(page);await expect(page.locator('#rescan-message')).toContainText('More than one equipment record');await expect(page.locator('#confirm-rescan')).toHaveCount(0);
});
for(const status of ['ready','collected'])test(`rescan cannot move from a ${status} trolley`,async({page})=>{
 await seed(page,{status});const before=await stored(page);await lookup(page);await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Placement not confirmed');expect((await stored(page)).items).toEqual(before.items);
});

test('storage failure keeps the item and preview intact for a retry',async({page})=>{
 await seed(page);const before=await stored(page);await lookup(page);await page.evaluate(()=>{window.setOriginal=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='decompro.v1')throw new DOMException('Storage full','QuotaExceededError');return window.setOriginal.call(this,key,value);};});await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Placement not confirmed');expect((await stored(page)).items).toEqual(before.items);await expect(page.locator('#station .captured')).toContainText('A0042');await page.evaluate(()=>Storage.prototype.setItem=window.setOriginal);await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Existing item moved');
});

test('phone rescan preview survives navigation and normal form Enter cannot save a duplicate',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);await lookup(page);await page.getByRole('link',{name:'Overview',exact:true}).click();await page.getByRole('link',{name:'Scan station',exact:true}).click();await expect(page.locator('#station .captured')).toContainText('0000123000');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect((await stored(page)).items).toHaveLength(1);
});

async function connectRescanTeam(page){
 const seeded=await seed(page);await page.evaluate(state=>{window.remote={items:state.items,trolleys:state.trolleys,examples:[],corrections:[]};window.version=1;window.moveWrites=[];},seeded.state);
 await page.route(/\/(?:src\/firebase-db[^/]*|assets\/firebase-db-[^/]+\.js)(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`export async function connectFirebase(){return {uid:'rescan-tech',profile:{name:'Ali',code:'MA'},role:'technician',teamId:'college-it',email:'qa@example.invalid',stop(){},async logout(){},listen(a,b,c,d,phase){phase('connected')},versionFor(){return window.version},async load(){return structuredClone(window.remote)},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]}},async write(item,version,options){window.moveWrites.push({item,version,options});if(window.failOnce){window.failOnce=false;throw Error('Temporary move failure');}window.remote.items=window.remote.items.map(row=>row.id===item.id?item:row);window.version++}}}` }));
 await page.getByRole('button',{name:'Shared database',exact:true}).click();await page.getByLabel('Team account email').fill('qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#database-dialog')).not.toBeVisible();return seeded;
}

test('shared rescan rechecks revisions, rejects stale details and then moves the updated item',async({page})=>{
 const {item,target}=await connectRescanTeam(page);await lookup(page);await page.evaluate(()=>{window.remote.items[0].asset='A0043';window.version=2;});await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('changed since lookup');expect(await page.evaluate(()=>window.moveWrites.length)).toBe(0);
 await page.getByRole('button',{name:'Find saved item',exact:true}).click();await expect(page.locator('#station .captured')).toContainText('A0043');await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Existing item moved');const state=await stored(page);expect(state.items).toEqual([{...item,asset:'A0043',trolleyId:target.id,trolley:target.name}]);expect(await page.evaluate(()=>window.moveWrites[0].version)).toBe(2);
});

test('failed shared move keeps its preview for retry and offline confirmation never writes',async({page,context})=>{
 await connectRescanTeam(page);await lookup(page);await context.setOffline(true);await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('.alert')).toContainText('offline');expect(await page.evaluate(()=>window.moveWrites.length)).toBe(0);await context.setOffline(false);await page.evaluate(()=>window.failOnce=true);await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Temporary move failure');await expect(page.locator('#station .captured')).toContainText('0000123000');await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Existing item moved');expect((await stored(page)).items).toHaveLength(1);expect(await page.evaluate(()=>window.moveWrites.length)).toBe(2);
});


test('scanner input stays focused and replaces an unsuccessful serial without a mouse click',async({page})=>{
 await seed(page);await lookup(page,'UNKNOWN-SERIAL');await expect(page.locator('#rescan-message')).toContainText('Rescan stopped');await expect(page.locator('#rescan-serial')).toBeFocused();await page.keyboard.insertText('EXISTING-0001');await page.keyboard.press('Enter');await expect(page.locator('#rescan-message')).toContainText('Saved details found');await expect(page.locator('#rescan-serial')).toHaveValue('EXISTING-0001');await expect(page.locator('#station .captured')).toContainText('0000123000');
});
test('rescan by asset prefills the original serial and all details and moves that same record',async({page})=>{
 const {item,target}=await seed(page);await lookup(page,' a0042 ');for(const value of [item.serial,item.model,item.manufacturer,item.barcode,item.asset])await expect(page.locator('#station .captured')).toContainText(value);await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Existing item moved');expect((await stored(page)).items).toEqual([{...item,trolley:target.name,trolleyId:target.id}]);
});
test('asset rescan rejects duplicate assets and clears any confirmation preview',async({page})=>{
 await seed(page,{duplicates:true});await lookup(page,'A0042');await expect(page.locator('#rescan-message')).toContainText('More than one');await expect(page.locator('#confirm-rescan')).toHaveCount(0);expect((await stored(page)).items).toHaveLength(2);
});
test('shared asset rescan rechecks identifier uniqueness when confirming a move',async({page})=>{
 const {item,target}=await connectRescanTeam(page);await lookup(page,'A0042');await page.evaluate(()=>window.remote.items.push({...window.remote.items[0],id:'new-conflict',serial:'ANOTHER-SERIAL'}));await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('More than one');expect(await page.evaluate(()=>window.moveWrites.length)).toBe(0);
 await page.evaluate(()=>window.remote.items=window.remote.items.filter(row=>row.id!=='new-conflict'));await page.getByRole('button',{name:'Find saved item',exact:true}).click();await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Existing item moved');expect(await page.evaluate(()=>window.moveWrites[0].item)).toEqual({...item,trolley:target.name,trolleyId:target.id});
});
test('C17K352ZDNCR recognition reference explains missing inventory and starts a prefilled normal scan without creating a record',async({page})=>{
 await seed(page);await lookup(page,'C17K352ZDNCR');await expect(page.locator('.rescan-reference')).toContainText('Apple');await expect(page.locator('.rescan-reference')).toContainText('A1418');await expect(page.locator('#confirm-rescan')).toHaveCount(0);expect((await stored(page)).items).toHaveLength(1);
 await page.getByRole('button',{name:'Record this item',exact:true}).click();await expect(page.locator('#rescan-mode')).not.toBeChecked();await expect(page.locator('#recognized-maker')).toHaveValue('Apple');await expect(page.locator('.captured')).toContainText('A1418');await expect(page.locator('#default-description')).toHaveValue('All-in-one computer');const state=await stored(page);expect(state.draft.serial).toBe('C17K352ZDNCR');expect(state.draft.asset).toBeUndefined();expect(state.draft.barcode).toBeUndefined();expect(state.items).toHaveLength(1);
});
test('reference fallback preserves a paused normal item and clears when the rescan identifier changes',async({page})=>{
 await seed(page);await page.locator('#scan').fill('PAUSED-UNSUBMITTED');await lookup(page,'C17K352ZDNCR');await expect(page.getByRole('button',{name:'Record this item',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Return to paused scan',exact:true}).click();await expect(page.locator('#scan')).toHaveValue('PAUSED-UNSUBMITTED');
 await page.locator('#scan').fill('');await lookup(page,'C17K352ZDNCR');await expect(page.locator('.rescan-reference')).toBeVisible();await page.locator('#rescan-serial').fill('UNKNOWN');await expect(page.locator('.rescan-reference')).toHaveCount(0);expect((await stored(page)).items).toHaveLength(1);
});
test('saved C17K352ZDNCR inventory takes priority over recognition references and remains movable',async({page})=>{
 const {target}=await seed(page);await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));state.items[0].serial='C17K352ZDNCR';localStorage.setItem('decompro.v1',JSON.stringify(state));});await page.reload();await lookup(page,'C17K352ZDNCR');await expect(page.locator('.rescan-reference')).toHaveCount(0);await expect(page.locator('#station .captured')).toContainText('Checked maker');await expect(page.locator('#station .captured')).toContainText('A0042');await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Existing item moved');const state=await stored(page);expect(state.items).toHaveLength(1);expect(state.items[0].trolleyId).toBe(target.id);expect(state.items[0].serial).toBe('C17K352ZDNCR');
});
