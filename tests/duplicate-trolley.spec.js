import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';
import {defaultSettings} from '../src/workspace.js';
async function team(page,{duplicate=true,stale=false}={}){
 const a=createTrolley('Trolley 1.1'),b=createTrolley('Trolley 1.1'),fixture={items:[],trolleys:duplicate?[a,b]:[a],examples:[],corrections:[]};
 const state={captureOrder:'serial-first',activeTrolleyId:'',trolleys:[],profiles:[{name:'Local',code:'LO'}],active:'LO',defaults:{date:'2026-10-12',description:'Monitor',manufacturer:'Dell',source:'Storage',reason:'EOL',trolley:'Trolley 1.1'},items:[],draft:{},step:0,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]};
 await page.addInitScript(({state,fixture,stale})=>{localStorage.setItem('decompro.v1',JSON.stringify(state));window.fixture=fixture;window.loadCount=0;window.staleFirst=stale;window.trolleyCreates=0;}, {state,fixture,stale});
 await page.route(/\/(?:src\/firebase-db[^/]*|assets\/firebase-db-[^/]+\.js)(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`export async function connectFirebase(){return {uid:'jawad',profile:{name:'Jawad Ahmed',code:'JA'},role:'technician',projectId:'decompro-236e9',teamId:'college-it',email:'jawad@example.invalid',stop(){},async logout(){},listen(a,b,c,d,phase){phase('connected')},async load(){window.loadCount++;return window.staleFirst&&window.loadCount===1?{...window.fixture,trolleys:[]}:structuredClone(window.fixture)},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]}},async write(item){window.savedItem=item;window.fixture.items.push(item)},async writeTrolley(trolley){window.trolleyCreates++;window.fixture.trolleys.push(trolley)}}}` }));
 await page.goto('/');await page.getByRole('button',{name:'Shared database',exact:true}).click();await page.getByLabel('Team account email').fill('jawad@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#database-dialog')).not.toBeVisible();return {a,b};
}
async function complete(page){for(const value of ['QA-DUPLICATE-TROLLEY','N/A','N/A','N/A','A8844']){await page.locator('#scan').fill(value);await page.locator('#scan').press('Enter');}}

test('Jawad can choose a permanent reference when names repeat and save without creating another trolley',async({page})=>{
 const {b}=await team(page);await complete(page);await page.locator('#save').click();await expect(page.locator('#save-feedback')).toContainText('Duplicated trolley name');await page.getByRole('button',{name:'Choose trolley reference',exact:true}).click();await expect(page.locator('#trolley-reference-choice')).toContainText(b.reference);await page.locator('#trolley-reference-choice').selectOption(b.id);await page.getByRole('button',{name:'Use trolley',exact:true}).click();await expect(page.locator('#trolley-dialog')).not.toBeVisible();await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>window.savedItem?.trolleyId)).toBe(b.id);expect(await page.evaluate(()=>window.savedItem.technician)).toBe('JA');expect(await page.evaluate(()=>window.trolleyCreates)).toBe(0);
});

test('save refreshes a stale shared trolley cache and uses the canonical name',async({page})=>{
 const {a}=await team(page,{duplicate:false,stale:true});await expect(page.locator('#default-trolley')).toHaveAttribute('readonly','');await complete(page);await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>window.savedItem?.trolleyId)).toBe(a.id);expect(await page.evaluate(()=>window.savedItem.trolley)).toBe('Trolley 1.1');expect(await page.evaluate(()=>window.trolleyCreates)).toBe(0);
});

test('a stale or programmatically changed read-only trolley input cannot override the selected shared reference',async({page})=>{
 const {a}=await team(page,{duplicate:false});await page.locator('#default-trolley').evaluate(input=>{input.value='UNKNOWN TROLLEY';input.dispatchEvent(new Event('input',{bubbles:true}));});await complete(page);await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>window.savedItem?.trolleyId)).toBe(a.id);expect(await page.evaluate(()=>window.trolleyCreates)).toBe(0);expect(await page.evaluate(()=>window.savedItem.trolley)).toBe(a.name);
});

test('choosing the existing reference survives a real timeout and Jawad can finish his captured item',async({page})=>{
 await page.clock.install();const {b}=await team(page);await page.getByRole('button',{name:'Change trolley',exact:true}).click();await page.locator('#trolley-reference-choice').selectOption(b.id);await page.getByRole('button',{name:'Use trolley',exact:true}).click();await complete(page);await page.clock.fastForward('05:01');await expect(page.locator('.workspace-lock')).toBeVisible();
 await page.locator('#unlock-workspace').click();await page.getByLabel('Team account email').fill('jawad@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#connection-status')).toContainText('Database connected');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).activeTrolleyId)).toBe(b.id);await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>window.savedItem?.trolleyId)).toBe(b.id);expect(await page.evaluate(()=>window.fixture.trolleys.length)).toBe(2);expect(await page.evaluate(()=>window.trolleyCreates)).toBe(0);
});

test('read-only caged trolley follows its selected permanent reference when another technician renames it',async({page})=>{
 const {a}=await team(page,{duplicate:false});await page.evaluate(()=>window.fixture.trolleys[0].name='Renamed by Jawad');await complete(page);await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>window.savedItem?.trolleyId)).toBe(a.id);expect(await page.evaluate(()=>window.savedItem.trolley)).toBe('Renamed by Jawad');await expect(page.locator('#default-trolley')).toHaveValue('Renamed by Jawad');expect(await page.evaluate(()=>window.trolleyCreates)).toBe(0);
});
