import {test,expect} from '@playwright/test';
import {createTestWorkspace} from '../src/test-workspace.js';
const read=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')));
const card=page=>page.locator('.collection-session-card').filter({hasText:'TEST Current collection'});
async function confirm(page){await page.getByLabel('Type DELETE to confirm').fill('DELETE');await page.locator('#delete-collection-understood').check();}

test('deleting a collection requires both exact DELETE and acknowledgement; cancel preserves data',async({page})=>{
 await page.goto('/?workspace=demo#collections');await expect(card(page)).toBeVisible();const before=await read(page);await card(page).getByRole('button',{name:'Delete collection',exact:true}).click();
 const button=page.locator('#confirm-delete-collection');await expect(button).toBeDisabled();await page.getByLabel('Type DELETE to confirm').fill('DELETE');await expect(button).toBeDisabled();await page.locator('#delete-collection-understood').check();await expect(button).toBeEnabled();await page.getByLabel('Type DELETE to confirm').fill('delete');await expect(button).toBeDisabled();await page.getByLabel('Type DELETE to confirm').fill(' DELETE ');await expect(button).toBeDisabled();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await read(page)).toEqual(before);
 await card(page).getByRole('button',{name:'Delete collection',exact:true}).click();await expect(button).toBeDisabled();await confirm(page);await button.click();await expect(card(page)).toHaveCount(0);const after=await read(page);expect(after.collectionSessions).toHaveLength(1);expect(after.collectionTrolleys).toHaveLength(2);expect(after.items).toEqual(before.items);expect(after.trolleys).toEqual(before.trolleys);expect(after.activeCollectionId).toBe('');await page.reload();await expect(page.locator('.test-workspace-banner')).toBeVisible();expect((await read(page)).items).toHaveLength(96);
});

test('failed local deletion leaves saved records and collection unchanged and allows retry',async({page})=>{
 await page.goto('/?workspace=demo#collections');await expect(card(page)).toBeVisible();const before=await read(page);await card(page).getByRole('button',{name:'Delete collection',exact:true}).click();await confirm(page);
 await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='decompro.demo.v1')throw new DOMException('Storage full','QuotaExceededError');return window.originalSet.call(this,key,value);};});await page.locator('#confirm-delete-collection').click();await expect(page.locator('#delete-collection-error')).toContainText('Storage full');expect(await read(page)).toEqual(before);
 await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);await page.locator('#confirm-delete-collection').click();await expect(card(page)).toHaveCount(0);
});

async function shared(page,role='admin'){
 const fixture=createTestWorkspace('2026-10-12');fixture.collectionWorkspace='decompro-236e9/college-it/delete-user';
 await page.addInitScript(f=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(f));window.fixture=f;window.groups={collectionSessions:f.collectionSessions,collectionTrolleys:f.collectionTrolleys};},fixture);
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'application/javascript',body:`export async function connectFirebase(){return {uid:'delete-user',profile:{name:'Technician',code:'T1'},role:'${role}',teamId:'college-it',email:'qa@example.invalid',stop(){},listen(a,b,c,d,phase){phase('connected')},sessionVersionFor(){return 3},async load(){return {items:window.fixture.items,trolleys:window.fixture.trolleys,examples:[],corrections:[]}},async loadCollections(){return window.groups},async deleteSession(id,version){window.deleteCalls=(window.deleteCalls||0)+1;window.deleteVersion=version;if(window.failDelete)throw Error('Permission denied');window.groups={collectionSessions:window.groups.collectionSessions.filter(s=>s.id!==id),collectionTrolleys:window.groups.collectionTrolleys.filter(t=>t.sessionId!==id)};return window.groups}}}` }));
 await page.goto('/#collections');await page.getByRole('button',{name:'Shared database',exact:true}).click();await page.getByLabel('Team account email').fill('qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in & connect'}).click();await expect(page.locator('#database-dialog')).not.toBeVisible();return fixture;
}

test('shared administrator retries failed deletion with the captured revision and equipment retained',async({page})=>{
 const fixture=await shared(page);await card(page).getByRole('button',{name:'Manage collection trolleys'}).click();await page.locator('#collection-manage-delete').click();await confirm(page);await page.evaluate(()=>window.failDelete=true);await page.locator('#confirm-delete-collection').click();await expect(page.locator('#delete-collection-error')).toContainText('Permission denied');await expect(card(page)).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items)).toEqual(fixture.items);
 await page.evaluate(()=>window.failDelete=false);await page.locator('#confirm-delete-collection').click();await expect(card(page)).toHaveCount(0);expect(await page.evaluate(()=>window.deleteVersion)).toBe(3);expect(await page.evaluate(()=>window.deleteCalls)).toBe(2);
});

test('ordinary shared technicians have no collection deletion control',async({page})=>{
 await shared(page,'technician');await expect(card(page)).toBeVisible();await expect(page.locator('[data-delete-collection]')).toHaveCount(0);
 await card(page).getByRole('button',{name:'Manage collection trolleys'}).click();
 await expect(page.locator('#collection-manage-delete')).toHaveCount(0);
});

test('refresh reconciles a collection deleted by another device without leaving an invalid saved workspace',async({page})=>{
 const fixture=await shared(page);await page.evaluate(id=>{window.groups={collectionSessions:window.groups.collectionSessions.filter(s=>s.id!==id),collectionTrolleys:window.groups.collectionTrolleys.filter(t=>t.sessionId!==id)};},fixture.activeCollectionId);await page.getByRole('button',{name:'Refresh collections',exact:true}).click();await expect(card(page)).toHaveCount(0);const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(state.activeCollectionId).toBe('');expect(state.items).toEqual(fixture.items);expect(state.collectionSessions).toHaveLength(1);
});


test('deleting another collection preserves the active collection and its unsubmitted scan input',async({page})=>{
 await page.goto('/?workspace=demo#station');await page.locator('#scan').fill('KEEP-ACTIVE-INPUT');const before=await read(page);await page.getByRole('link',{name:'Collections',exact:true}).click();const other=page.locator('.collection-session-card').filter({hasText:'TEST Previous collection'});await other.getByRole('button',{name:'Delete collection',exact:true}).click();await confirm(page);await page.locator('#confirm-delete-collection').click();await expect(other).toHaveCount(0);expect((await read(page)).activeCollectionId).toBe(before.activeCollectionId);await page.getByRole('link',{name:'Scan station',exact:true}).click();await expect(page.locator('#scan')).toHaveValue('KEEP-ACTIVE-INPUT');
});
