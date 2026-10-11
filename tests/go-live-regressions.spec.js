import {test,expect} from '@playwright/test';
import {createTestWorkspace} from '../src/test-workspace.js';
const demo='/?workspace=demo#station';
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')));
async function scan(page,value){await page.locator('#scan').fill(value);await page.locator('#scan').press('Enter');}

test('a second local tab cannot overwrite records and can reopen the latest workspace after the first closes',async({page,context})=>{
 await page.goto(demo);await expect(page.locator('.test-workspace-banner')).toBeVisible();const initial=await stored(page);
 const other=await context.newPage();await other.goto(demo);await expect(other.getByRole('heading',{name:'Workspace open in another tab'})).toBeVisible();await expect(other.locator('#scan')).toHaveCount(0);
 await page.getByRole('link',{name:/Collection register/}).click();await page.getByRole('button',{name:`Edit item ${initial.items[5].serial}`,exact:true}).click();await page.locator('#edit-model').fill('RETAIN FIRST TAB');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.locator('#edit-dialog')).not.toBeVisible();
 const saved=await stored(page);await other.getByRole('button',{name:'Retry workspace',exact:true}).click();await expect(other.getByRole('heading',{name:'Workspace open in another tab'})).toBeVisible();expect(await stored(other)).toEqual(saved);
 await page.close();await other.getByRole('button',{name:'Retry workspace',exact:true}).click();await expect(other.locator('#station')).toBeVisible();expect((await stored(other)).items[5].model).toBe('RETAIN FIRST TAB');
});

test('real and demo workspaces have independent editing locks',async({page,context})=>{
 await page.goto('/');await expect(page.locator('#station')).toBeVisible();const other=await context.newPage();await other.goto(demo);await expect(other.locator('#station')).toBeVisible();await scan(page,'REAL-LOCK-INDEPENDENT');await scan(other,'DEMO-LOCK-INDEPENDENT');expect((await stored(other)).draft.serial).toBe('DEMO-LOCK-INDEPENDENT');
});

test('local editing fails safely when browser coordination is unavailable',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));await page.goto(demo);await expect(page.locator('.workspace-lock')).toContainText('cannot safely coordinate');await expect(page.locator('#scan')).toHaveCount(0);
});

for(const width of [1440,390])test(`unsubmitted input survives redraws at ${width}px without being accepted early`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto(demo);await page.locator('#scan').fill('UNSUBMITTED-VOICE');await page.locator('#voice').click();await expect(page.locator('#scan')).toHaveValue('UNSUBMITTED-VOICE');expect((await stored(page)).step).toBe(0);expect((await stored(page)).draft).toEqual({});
 await page.locator('#profile').selectOption('T2');await expect(page.locator('#scan')).toHaveValue('UNSUBMITTED-VOICE');await page.locator('#scan').press('Enter');await page.locator('#scan').fill('Pending & model');await page.locator('#voice').click();await expect(page.locator('#scan')).toHaveValue('Pending & model');await page.locator('#scan').press('Enter');await expect(page.locator('#scan')).toHaveValue('');expect((await stored(page)).draft.model).toBe('Pending & model');
});

test('reset clears trolley routes, search and selected inventory',async({page})=>{
 await page.goto(demo);await expect(page.locator('.test-workspace-banner')).toBeVisible();const before=await stored(page);
 await page.evaluate(id=>location.hash='trolley/'+id,before.trolleys[0].id);await expect(page.locator('#inventory-title')).toContainText('TEST Trolley 01');await page.getByLabel('Search collection register').fill('NONEXISTENT');
 await page.getByRole('button',{name:'Open settings',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reset synthetic data',exact:true}).click();
 await expect(page.locator('#search-count')).toHaveText('Showing 72 of 72 items');await expect(page.getByLabel('Search collection register')).toHaveValue('');await expect(page.locator('#trolley-inventory-banner')).toBeEmpty();expect(await page.evaluate(()=>location.hash)).toBe('#inventory');expect((await stored(page)).items).toHaveLength(96);
});

async function pendingSave(page,serial='QA-COLLECTION-PENDING'){
 const fixture=createTestWorkspace('2026-10-11');fixture.collectionWorkspace='decompro-236e9/college-it/audit';
 await page.addInitScript(fixture=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(fixture));window.fixture=fixture;},fixture);
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'application/javascript',body:`export async function connectFirebase(){return {uid:'audit',teamId:'college-it',email:'audit@example.invalid',role:'technician',profile:{name:'Test technician One',code:'T1'},stop(){},listen(a,b,c,d,phase){phase('connected')},async load(){return {items:window.fixture.items,trolleys:window.fixture.trolleys,examples:[],corrections:[]}},async loadCollections(){return {collectionSessions:window.fixture.collectionSessions,collectionTrolleys:window.fixture.collectionTrolleys}},async write(item,v,meta){window.sent={item,meta};await new Promise(r=>window.finishSave=r)}}}` }));
 await page.goto('/#station');await page.getByRole('button',{name:'Shared database',exact:true}).click();await page.getByLabel('Team account email').fill('audit@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#database-dialog')).not.toBeVisible();
 await page.getByRole('link',{name:'Collections',exact:true}).click();await page.getByRole('button',{name:'Resume TEST Current collection',exact:true}).click();for(const v of [serial,'Manual model','0000123','N/A','A9988'])await scan(page,v);
 await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>!!window.finishSave)).toBe(true);return fixture;
}
async function resume(page,name){await page.getByRole('link',{name:'Collections',exact:true}).click();await page.getByRole('button',{name:`Resume TEST ${name} collection`,exact:true}).click();}

test('delayed save clears the original collection checkpoint and preserves the other collection scan',async({page})=>{
 const fixture=await pendingSave(page);await resume(page,'Previous');await scan(page,'OTHER-COLLECTION-DRAFT');await page.evaluate(()=>window.finishSave());await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(97);
 expect(await page.evaluate(()=>window.sent.meta.collectionId)).toBe(fixture.activeCollectionId);await resume(page,'Current');await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();await expect(page.locator('#scan')).toHaveValue('');await resume(page,'Previous');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('OTHER-COLLECTION-DRAFT');
});

test('delayed confirmation keeps newer edits in the original collection',async({page})=>{
 await pendingSave(page);await resume(page,'Previous');await resume(page,'Current');await page.locator('#back').click();await scan(page,'A9989');await page.evaluate(()=>window.finishSave());await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(97);
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(state.draft.asset).toBe('A9989');expect(state.items.at(-1).asset).toBe('A9988');await resume(page,'Previous');await resume(page,'Current');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.asset)).toBe('A9989');
});

test('N/A serial save also clears its original checkpoint without relying on duplicate protection',async({page})=>{
 await pendingSave(page,'N/A');await resume(page,'Previous');await page.evaluate(()=>window.finishSave());await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(97);await resume(page,'Current');await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft)).toEqual({});
});

test('pausing during confirmation does not leave a completed item in the paused checkpoint',async({page})=>{
 await pendingSave(page);await page.getByRole('link',{name:'Collections',exact:true}).click();await page.getByRole('button',{name:'Pause session',exact:true}).click();await page.evaluate(()=>window.finishSave());await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(97);await resume(page,'Current');await expect(page.getByRole('heading',{name:'Serial number',exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft)).toEqual({});
});

test('simultaneous fresh local tabs elect exactly one editor without replacing the seeded workspace',async({page,context})=>{
 const other=await context.newPage();await Promise.all([page.goto(demo),other.goto(demo)]);await Promise.all([page.locator('#station,#retry-local-tab').first().waitFor(),other.locator('#station,#retry-local-tab').first().waitFor()]);
 const editors=await Promise.all([page.locator('#scan').count(),other.locator('#scan').count()]);expect(editors.reduce((a,b)=>a+b,0)).toBe(1);const editor=editors[0]?page:other;const before=await stored(editor);await scan(editor,'CONCURRENT-STARTUP');expect((await stored(editor)).trolleys.map(t=>t.id)).toEqual(before.trolleys.map(t=>t.id));expect((await stored(editor)).items).toHaveLength(96);
});
