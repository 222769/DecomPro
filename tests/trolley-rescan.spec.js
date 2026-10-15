import {test,expect} from '@playwright/test';import {createTrolley} from '../src/trolleys.js';import {defaultSettings} from '../src/workspace.js';
async function seed(page,{status='open',duplicates=false}={}){
 const source={...createTrolley('Source'),...(status==='ready'?{status,readyAt:new Date().toISOString(),readyBy:'JA'}:{}),...(status==='collected'?{status,collectedAt:new Date().toISOString(),collectedBy:'JA',company:'Collector'}:{})},target=createTrolley('Target');
 const item={id:'rescan-existing',date:'2026-02-16',description:'Monitor',model:'Checked model',manufacturer:'Checked maker',source:'Storage',serial:'EXISTING-0001',barcode:'0000123000',etch:'ORIGINAL-ETCH',asset:'A0042',reason:'EOL',technician:'JA',trolley:source.name,trolleyId:source.id};
 const state={captureOrder:'serial-first',activeTrolleyId:target.id,trolleys:[source,target],profiles:[{name:'Ali',code:'MA'}],active:'MA',defaults:{date:'2026-10-12',description:'Desktop',manufacturer:'Batch maker',source:'New location',reason:'Different reason',trolley:target.name},items:duplicates?[item,{...item,id:'ambiguous-record'}]:[item],draft:{},step:0,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]};
 await page.addInitScript(state=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(state));},state);await page.goto('/#station');await expect(page.locator('#station')).toBeVisible();return {source,target,item,state};
}
async function lookup(page,serial='existing-0001'){await page.locator('#rescan-mode').check();await page.getByLabel('Rescan equipment identifier',{exact:true}).fill(serial);await page.getByRole('button',{name:'Find saved item',exact:true}).click();}
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));

test('rescan auto-fills exact saved fields and moves the same item with original attribution and move history',async({page})=>{
 const {item,target}=await seed(page);await lookup(page);for(const value of [item.model,item.manufacturer,item.asset,item.barcode,item.etch])await expect(page.locator('#station .captured')).toContainText(value);await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Existing item moved');const state=await stored(page);expect(state.items).toEqual([{...item,trolley:target.name,trolleyId:target.id}]);expect(state.trolleyMoves).toHaveLength(1);expect(state.trolleyMoves[0].actor.code).toBe('MA');
 await page.getByLabel('Rescan equipment identifier',{exact:true}).fill(item.serial);await page.getByRole('button',{name:'Find saved item',exact:true}).click();await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Already recorded');expect((await stored(page)).items).toHaveLength(1);expect((await stored(page)).trolleyMoves).toHaveLength(1);await page.reload();await expect(page.locator('#rescan-mode')).not.toBeChecked();
});

test('normal scanning does not fill asset/barcode and switching modes preserves its captured and typed progress',async({page})=>{
 await seed(page);await page.locator('#scan').fill('EXISTING-0001');await page.locator('#scan').press('Enter');const before=await stored(page);expect(before.draft.asset).toBeUndefined();expect(before.draft.barcode).toBeUndefined();await page.locator('#scan').fill('NORMAL-UNSUBMITTED');await lookup(page);await page.locator('#rescan-mode').uncheck();await expect(page.locator('#scan')).toHaveValue('NORMAL-UNSUBMITTED');expect((await stored(page)).draft).toEqual(before.draft);expect((await stored(page)).step).toBe(before.step);
});

for(const serial of ['N/A','UNREGISTERED-SERIAL','C17K3520DNCR'])test(`rescan rejects ${serial} rather than creating or guessing a record`,async({page})=>{
 await seed(page);const before=await stored(page);await lookup(page,serial);await expect(page.locator('#rescan-message')).toContainText('Rescan stopped');await expect(page.locator('#confirm-rescan')).toHaveCount(0);expect((await stored(page)).items).toEqual(before.items);
});
for(const [kind,identifier] of [['serial','NEW-SERIAL-01'],['barcode','0000090011'],['etch','ETCH-NEW-01'],['asset','A0803']])test(`unknown ${kind} can be reviewed and added to the selected trolley`,async({page})=>{
 const {target}=await seed(page);await lookup(page,identifier);await expect(page.locator('#rescan-new-form')).toBeVisible();await page.locator('#rescan-new-kind').selectOption(kind);
 await page.locator('#rescan-new-description').fill('Laptop');await page.locator('#rescan-new-model').fill('Reviewed model');await page.locator('#rescan-new-manufacturer').fill('Reviewed maker');
 await page.locator('#rescan-new-checked').check();await page.getByRole('button',{name:'Add new item to current trolley'}).click();
 await expect(page.locator('#rescan-message')).toContainText('Item added');const saved=(await stored(page)).items.at(-1);expect(saved).toMatchObject({[kind]:identifier,description:'Laptop',model:'Reviewed model',manufacturer:'Reviewed maker',trolleyId:target.id,technician:'MA'});
 await expect(page.locator('#rescan-serial')).toHaveValue('');await lookup(page,identifier);await expect(page.locator('#confirm-rescan')).toBeVisible();await expect(page.locator('#rescan-new-form')).toHaveCount(0);
});
test('new rescan item requires review and refuses a duplicate appearing after lookup',async({page})=>{
 await seed(page);await lookup(page,'NEW-ONE');await page.locator('#rescan-new-description').fill('Laptop');await page.locator('#rescan-new-model').fill('Model');await page.locator('#rescan-new-manufacturer').fill('Maker');
 await page.getByRole('button',{name:'Add new item to current trolley'}).click();await expect(page.locator('#rescan-message')).toContainText('tick the confirmation');
 await page.locator('#rescan-new-barcode').fill('0000123000');await page.locator('#rescan-new-checked').check();
 await page.getByRole('button',{name:'Add new item to current trolley'}).click();await expect(page.locator('#rescan-message')).toContainText('Item not added');await expect(page.locator('#rescan-new-form')).toBeVisible();expect((await stored(page)).items).toHaveLength(1);
});
test('Enter adds a reviewed unknown item and keeps the next rescan ready on a phone',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);await page.locator('#rescan-mode').check();await page.locator('#rescan-serial').fill('SCAN-NEW-01');await page.locator('#rescan-serial').press('Enter');await expect(page.locator('#rescan-new-form')).toBeVisible();
 await page.locator('#rescan-new-description').fill('Laptop');await page.locator('#rescan-new-model').fill('L13');await page.locator('#rescan-new-manufacturer').fill('Lenovo');await page.locator('#rescan-serial').press('Enter');
 await expect(page.locator('#rescan-message')).toContainText('Item added');await expect(page.locator('#rescan-serial')).toBeFocused();expect((await stored(page)).items.at(-1).serial).toBe('SCAN-NEW-01');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
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
 await page.route(/\/(?:src\/firebase-db[^/]*|assets\/firebase-db-[^/]+\.js)(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`export async function connectFirebase(){return {uid:'rescan-tech',profile:{name:'Ali',code:'MA'},role:'technician',teamId:'college-it',email:'qa@example.invalid',stop(){},async logout(){},listen(a,b,c,d,phase){phase('connected')},versionFor(){return window.version},async load(){return structuredClone(window.remote)},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]}},async write(item,version,options){window.moveWrites.push({item,version,options});if(window.failOnce){window.failOnce=false;throw Error('Temporary move failure');}if(window.remote.items.some(row=>row.id===item.id))window.remote.items=window.remote.items.map(row=>row.id===item.id?item:row);else window.remote.items.push(item);window.version++}}}` }));
 await page.getByRole('button',{name:'Shared database',exact:true}).click();await page.getByLabel('Team account email').fill('qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#database-dialog')).not.toBeVisible();return seeded;
}
test('shared rescan adds a new item with current technician after checking the latest register',async({page})=>{
 const {target}=await connectRescanTeam(page);await lookup(page,'TEAM-NEW-01');await page.locator('#rescan-new-description').fill('Tablet');await page.locator('#rescan-new-model').fill('T14');await page.locator('#rescan-new-manufacturer').fill('Lenovo');await page.locator('#rescan-new-checked').check();
 await page.getByRole('button',{name:'Add new item to current trolley'}).click();await expect(page.locator('#rescan-message')).toContainText('saved to Firebase');const writes=await page.evaluate(()=>window.moveWrites);expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({version:0,item:{serial:'TEAM-NEW-01',technician:'MA',trolleyId:target.id}});expect((await stored(page)).items).toHaveLength(2);
});

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
for(const identifier of ['0000123000','ORIGINAL-ETCH'])test(`rescan identifier ${identifier} retrieves full details and moves the original record`,async({page})=>{
 const {item,target}=await seed(page);await lookup(page,identifier);for(const value of [item.serial,item.asset,item.barcode,item.etch])await expect(page.locator('#station .captured')).toContainText(value);await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('Existing item moved');expect((await stored(page)).items).toEqual([{...item,trolley:target.name,trolleyId:target.id}]);
});
test('shared barcode rescan blocks a new cross-field collision discovered at confirmation',async({page})=>{
 await connectRescanTeam(page);await lookup(page,'0000123000');await page.evaluate(()=>window.remote.items.push({...window.remote.items[0],id:'cross-field-collision',serial:'0000123000',barcode:'DIFFERENT',asset:'A9999',etch:'OTHER'}));await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();await expect(page.locator('#rescan-message')).toContainText('More than one');expect(await page.evaluate(()=>window.moveWrites.length)).toBe(0);
});

test('A0803 identifies and moves its saved register record without duplicating it',async({page})=>{
 const {item,target}=await seed(page);await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));state.items[0].asset='A0803';localStorage.setItem('decompro.v1',JSON.stringify(state));});await page.reload();await lookup(page,'A0803');await expect(page.locator('#station .captured')).toContainText('A0803');await expect(page.locator('#station .captured')).toContainText(item.serial);await page.getByRole('button',{name:'Confirm trolley placement',exact:true}).click();expect((await stored(page)).items).toEqual([{...item,asset:'A0803',trolley:target.name,trolleyId:target.id}]);
});
test('an asset absent from inventory explains the separate equipment import without creating a record',async({page})=>{
 await seed(page);const before=await stored(page);await lookup(page,'A0803');await expect(page.locator('#rescan-message')).toContainText('No saved item matches A0803');await expect(page.locator('#rescan-message')).toContainText('Collection register → Import equipment Excel');await expect(page.locator('#confirm-rescan')).toHaveCount(0);expect((await stored(page)).items).toEqual(before.items);
});

async function mockSpeech(page){await page.addInitScript(()=>{window.spoken=[];Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},getVoices(){return []},speak(u){window.spoken.push(u.text)}}});});}
test('rescan speaks saved details after scanner Enter, repeats them and respects voice off',async({page})=>{
 await mockSpeech(page);await seed(page);await page.locator('#voice').click();await page.locator('#rescan-mode').check();await page.evaluate(()=>window.spoken=[]);
 await page.locator('#rescan-serial').fill('A0042');await page.locator('#rescan-serial').press('Enter');await expect.poll(()=>page.evaluate(()=>window.spoken.at(-1))).toContain('Item found. Checked maker Checked model');
 await page.locator('#repeat-rescan-prompt').click();expect(await page.evaluate(()=>window.spoken.length)).toBe(2);
 await page.locator('#voice').click();await page.evaluate(()=>window.spoken=[]);await page.locator('#rescan-serial').fill('ORIGINAL-ETCH');await page.locator('#rescan-serial').press('Enter');await expect(page.locator('#rescan-message')).toContainText('Saved details found');expect(await page.evaluate(()=>window.spoken)).toEqual([]);
 await page.locator('#voice').click();await expect.poll(()=>page.evaluate(()=>window.spoken.at(-1))).toContain('Item found');
});
test('rescan speaks unsuccessful lookup instead of silently stopping',async({page})=>{
 await mockSpeech(page);await seed(page);await page.locator('#voice').click();await lookup(page,'NO-SUCH-ITEM');await expect.poll(()=>page.evaluate(()=>window.spoken.at(-1))).toBe('Not in the register.');
});

test('Enter reviews then moves the existing record without adding a duplicate and accepts the next scan',async({page})=>{
 const {target}=await seed(page);await page.locator('#rescan-mode').check();await page.locator('#rescan-serial').fill('A0042');await page.locator('#rescan-serial').press('Enter');await expect(page.locator('#confirm-rescan')).toBeVisible();expect((await stored(page)).trolleyMoves||[]).toHaveLength(0);
 await page.locator('#rescan-serial').press('Enter');await expect(page.locator('#rescan-message')).toContainText('Existing item moved');const after=await stored(page);expect(after.items).toHaveLength(1);expect(after.items[0].trolleyId).toBe(target.id);await expect(page.locator('#rescan-serial')).toHaveValue('');await expect(page.locator('#rescan-serial')).toBeFocused();
 await page.keyboard.insertText('UNKNOWN');await page.keyboard.press('Enter');await expect(page.locator('#rescan-message')).toContainText('Rescan stopped');await page.keyboard.press('Enter');expect((await stored(page)).items).toHaveLength(1);
});
