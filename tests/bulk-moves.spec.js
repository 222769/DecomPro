import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';
import {defaultSettings,parseBackup} from '../src/workspace.js';
import {readFile} from 'node:fs/promises';

async function seed(page) {
 const source=createTrolley('Source trolley'),destination=createTrolley('Destination trolley'),locked={...createTrolley('Locked trolley'),status:'ready',readyAt:new Date().toISOString(),readyBy:'JA'};
 const defaults={date:'2026-10-10',description:'Monitor',manufacturer:'Dell',source:'Storage',reason:'EOL',trolley:source.name};
 const items=['MOVE-001','MOVE-002','MOVE-LOCKED'].map((serial,i)=>({...defaults,id:`move-${i}`,serial,model:'P2419H',barcode:'N/A',etch:'N/A',asset:`A000${i}`,technician:'JA',trolleyId:i===2?locked.id:source.id,trolley:i===2?locked.name:source.name}));
 const state={captureOrder:'serial-first',activeTrolleyId:source.id,trolleys:[source,destination,locked],profiles:[{name:'Ali',code:'MA'},{name:'Jawad',code:'JA'}],active:'MA',defaults,items,draft:{serial:'UNFINISHED'},step:1,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]};
 await page.addInitScript(state=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(state));},state);await page.goto('/');return {source,destination,locked,state};
}

test('bulk selection survives filters, moves together, preserves attribution and backs up mover history',async({page})=>{
 const {destination}=await seed(page);
 await page.getByLabel('Select item MOVE-001',{exact:true}).check();
 await page.getByLabel('Search collection register').fill('MOVE-002');await page.getByLabel('Select visible equipment').check();
 await expect(page.locator('#bulk-move-tools')).toContainText('2 selected');
 await page.getByRole('button',{name:'Move to trolley'}).click();await page.getByLabel('Destination trolley').selectOption(destination.id);
 await expect(page.locator('#move-preview')).toContainText('2 items to move');await page.getByRole('button',{name:'Confirm move',exact:true}).click();
 await expect(page.locator('.alert[role=status]')).toContainText('2 items moved');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));
 expect(saved.items.slice(0,2).map(item=>item.trolleyId)).toEqual([destination.id,destination.id]);expect(saved.items.map(item=>item.technician)).toEqual(['JA','JA','JA']);expect(saved.draft.serial).toBe('UNFINISHED');expect(saved.trolleyMoves.map(row=>row.actor.code)).toEqual(['MA','MA']);
 await page.getByLabel('Search collection register').fill('');await page.getByRole('button',{name:'Move history for MOVE-001',exact:true}).click();
 await expect(page.locator('#move-history-results')).toContainText('Source trolley → Destination trolley');await expect(page.locator('#move-history-results')).toContainText('Ali');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Backup',exact:true}).click();const backup=await download;
 const contents=await readFile(await backup.path(),'utf8');expect(parseBackup(contents).trolleyMoves).toEqual(saved.trolleyMoves);
 await page.reload();await page.getByRole('button',{name:'Move history for MOVE-001',exact:true}).click();await expect(page.locator('#move-history-results')).toContainText('Ali');
});

test('ready sources are rejected and locked destinations are unavailable without changing records',async({page})=>{
 const {destination,locked}=await seed(page);const before=await page.evaluate(()=>localStorage.getItem('decompro.v1'));
 await page.getByLabel('Select item MOVE-LOCKED',{exact:true}).check();await page.getByRole('button',{name:'Move to trolley'}).click();
 expect(await page.getByLabel('Destination trolley').locator('option').evaluateAll(options=>options.map(o=>o.value))).not.toContain(locked.id);
 await page.getByLabel('Destination trolley').selectOption(destination.id);await expect(page.locator('#bulk-move-error')).toContainText('ready or collected');await expect(page.getByRole('button',{name:'Confirm move'})).toBeDisabled();
 expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(before);
});

test('failed browser storage leaves the entire selected batch and scan intact',async({page})=>{
 const {destination}=await seed(page);const before=await page.evaluate(()=>localStorage.getItem('decompro.v1'));
 await page.getByLabel('Select item MOVE-001',{exact:true}).check();await page.getByLabel('Select item MOVE-002',{exact:true}).check();await page.getByRole('button',{name:'Move to trolley'}).click();await page.getByLabel('Destination trolley').selectOption(destination.id);
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Storage full','QuotaExceededError');};});
 await page.getByRole('button',{name:'Confirm move'}).click();await expect(page.locator('#bulk-move-error')).toContainText('Items not moved');
 expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(before);await expect(page.locator('#bulk-move-tools')).toContainText('2 selected');
});

test('shared moves show partial confirmation, retry only remaining selections and retrieve saved history',async({page})=>{
 const {destination,state}=await seed(page);
 await page.evaluate(state=>{window.sharedFixture={items:state.items,trolleys:state.trolleys,examples:[],corrections:[]};window.moveCalls=[];window.moveFailOnce=true;window.sharedMoves=[];},state);
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectFirebase(){return {uid:'ali-user',profile:{name:'Ali',code:'MA'},role:'technician',email:'ali@example.invalid',teamId:'college-it',stop(){},listen(a,b,c,d,connection){connection('connected');},versionFor(){return 1;},async load(){return structuredClone(window.sharedFixture);},async moveHistory(id){return window.sharedMoves.filter(row=>row.itemId===id);},async write(item,version){window.moveCalls.push({id:item.id,version});if(item.serial==='MOVE-002'&&window.moveFailOnce){window.moveFailOnce=false;throw Error('Another technician changed this record');}const before=window.sharedFixture.items.find(row=>row.id===item.id);window.sharedMoves.push({id:item.id,itemId:item.id,from:{name:before.trolley},to:{name:item.trolley},actor:{name:'Ali',code:'ali-user'},at:new Date().toISOString()});window.sharedFixture.items=window.sharedFixture.items.map(row=>row.id===item.id?structuredClone(item):row);}};}
 `}));
 await page.getByRole('button',{name:'Shared database'}).click();await page.getByLabel('Team account email').fill('ali@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in & connect'}).click();
 await page.getByLabel('Select item MOVE-001',{exact:true}).check();await page.getByLabel('Select item MOVE-002',{exact:true}).check();
 await page.getByRole('button',{name:'Move to trolley'}).click();await page.getByLabel('Destination trolley').selectOption(destination.id);await page.getByRole('button',{name:'Confirm move'}).click();
 await expect(page.locator('#bulk-move-error')).toContainText('1 move confirmed');await expect(page.locator('#bulk-move-error')).toContainText('Another technician changed');await expect(page.locator('#bulk-move-tools')).toContainText('1 selected');
 await page.locator('#cancel-bulk-move').click();await page.getByRole('button',{name:'Move to trolley'}).click();await page.getByLabel('Destination trolley').selectOption(destination.id);await page.getByRole('button',{name:'Confirm move'}).click();
 await expect(page.locator('.alert[role=status]')).toContainText('1 item moved');expect(await page.evaluate(()=>window.moveCalls.map(row=>row.id))).toEqual(['move-0','move-1','move-1']);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('UNFINISHED');
 await page.getByRole('button',{name:'Move history for MOVE-002',exact:true}).click();await expect(page.locator('#move-history-results')).toContainText('Source trolley → Destination trolley');await expect(page.locator('#move-history-results')).toContainText('Ali');
});
