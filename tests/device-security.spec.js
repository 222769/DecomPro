import {test,expect} from '@playwright/test';

async function mockTeam(page) {
 await page.route('**/src/firebase-db*',route=>route.fulfill({contentType:'application/javascript',body:`
 export async function connectFirebase(config,teamId,email,password,options){
  sessionStorage.setItem('test.signins',String(Number(sessionStorage.getItem('test.signins')||0)+1));window.lastTrustChoice=options?.remember;
  const saved=JSON.parse(localStorage.getItem('decompro.v1'))||{items:[],trolleys:[]};
  return {uid:'test-user',projectId:config.projectId,profile:{name:'Team Technician',code:'TT'},role:'technician',email:'tech@example.invalid',teamId,
   async load(){return {items:saved.items,trolleys:saved.trolleys,examples:[],corrections:[]};},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]};},
   listen(a,b,c,d,onConnection){onConnection('connected');},stop(){},async logout(){sessionStorage.setItem('test.signouts',String(Number(sessionStorage.getItem('test.signouts')||0)+1));},async rememberDevice(value){window.savedTrustChoice=value;}};
 }
 export async function disconnectFirebaseAuth(){}
 `}));
}
async function signin(page,remember=false){
 await page.locator('#station,.workspace-lock').first().waitFor({state:'attached'});
 const gate=page.getByRole('button',{name:'Sign in to DecomPro',exact:true});if(await gate.count())await gate.click();else await page.getByRole('button',{name:'Shared database',exact:true}).click();
 await page.getByLabel('Team account email').fill('tech@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only-password');if(remember)await page.getByRole('checkbox',{name:'Remember me on this trusted device',exact:true}).check();
 await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.locator('#connection-status')).toContainText('Database connected');
}

test('manual lock signs out, preserves an unfinished input and remains locked after refresh even on a trusted device',async({page})=>{
 await mockTeam(page);await page.goto('/');await signin(page,true);expect(await page.evaluate(()=>window.lastTrustChoice)).toBe(true);
 await page.locator('#scan').fill('PARTIAL-SERIAL');await page.getByRole('button',{name:'Lock workspace',exact:true}).click();await expect(page.locator('.workspace-lock')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('test.signouts'))).toBe('1');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('PARTIAL-SERIAL');
 await page.reload();await expect(page.locator('.workspace-lock')).toBeVisible();expect(await page.evaluate(()=>sessionStorage.getItem('test.signins'))).toBe('1');await signin(page,true);await expect(page.locator('#scan')).toHaveValue('PARTIAL-SERIAL');
});

test('inactivity locks at the configured threshold while scanner activity extends the session',async({page})=>{
 await page.clock.install();await mockTeam(page);await page.goto('/');await signin(page);expect(await page.evaluate(()=>window.lastTrustChoice)).toBe(false);
 await page.clock.fastForward('04:00');await page.locator('#scan').fill('STILL-WORKING');await page.locator('#scan').press('Enter');
 await page.clock.fastForward('04:00');await expect(page.locator('#station')).toBeVisible();await page.clock.fastForward('01:01');await expect(page.locator('.workspace-lock')).toBeVisible();await expect(page.locator('.workspace-lock')).toContainText('after inactivity');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('STILL-WORKING');
});

test('compact overview and Settings control layout, inactivity and trusted-device persistence',async({page})=>{
 await mockTeam(page);await page.goto('/');await signin(page);
 await page.locator('a[href="#overview"]').click();await expect(page.locator('#station')).toBeHidden();
 await expect(page.locator('#collections')).toBeHidden();await expect(page.locator('#session-summary')).toBeHidden();await expect(page.locator('.dashboard-trolley-details')).not.toHaveAttribute('open','');
 expect(await page.locator('#connection-status').evaluate(node=>node.getBoundingClientRect().height)).toBeLessThan(60);
 await page.getByRole('button',{name:'Open settings',exact:true}).click();await page.getByLabel('Lock after inactivity').selectOption('15');await page.getByRole('checkbox',{name:'Remember me on this trusted device',exact:true}).check();await page.getByRole('checkbox',{name:'Show daily progress on the overview',exact:true}).check();await page.getByRole('checkbox',{name:'Show collection management on the overview',exact:true}).check();await page.getByRole('button',{name:'Save settings',exact:true}).click();
 await expect(page.locator('#collections')).toBeVisible();await expect(page.locator('#session-summary')).toBeVisible();expect(await page.evaluate(()=>window.savedTrustChoice)).toBe(true);
 await page.getByRole('button',{name:'Open settings',exact:true}).click();await expect(page.getByLabel('Lock after inactivity')).toHaveValue('15');await page.getByRole('button',{name:'Cancel',exact:true}).click();
});

test('locking one team tab also locks another open tab without clearing its scan',async({page,context})=>{
 await mockTeam(page);await page.goto('/');await signin(page);
 const other=await context.newPage();await mockTeam(other);await other.goto('/');await expect(other.locator('#connection-status')).toContainText('Database connected');
 await other.locator('#scan').fill('OTHER-TAB-DRAFT');await page.getByRole('button',{name:'Lock workspace',exact:true}).click();
 await expect(other.locator('.workspace-lock')).toBeVisible();await expect(other.locator('.workspace-lock')).toContainText('another tab');expect(await other.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('OTHER-TAB-DRAFT');
});

test('empty scan locks reconnect safely and legacy blank drafts recover without losing equipment or accepted serials',async({page})=>{
 await mockTeam(page);await page.goto('/');await page.locator('#voice').click();
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));state.items=[{...state.defaults,id:'recovery-item',serial:'SAVED-EQUIPMENT',model:'Known model',manufacturer:'Dell',asset:'N/A',barcode:'N/A',etch:'N/A',technician:state.active,trolleyId:state.trolleys[0].id}];localStorage.setItem('decompro.v1',JSON.stringify(state));});
 await signin(page);await page.getByRole('button',{name:'Lock workspace',exact:true}).click();await expect(page.locator('.workspace-lock')).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBeUndefined();await signin(page);await page.locator('#scan').fill('UNFINISHED-SERIAL');await page.locator('#scan').press('Enter');await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Lock workspace',exact:true}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.model)).toBeUndefined();
 await signin(page);await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();await expect(page.locator('#inventory tbody')).toContainText('SAVED-EQUIPMENT');
 await page.getByRole('button',{name:'Lock workspace',exact:true}).click();
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));state.draft.model='';localStorage.setItem('decompro.v1',JSON.stringify(state));});
 await page.reload();await signin(page);await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();await expect(page.locator('#inventory tbody')).toContainText('SAVED-EQUIPMENT');
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(restored.draft.serial).toBe('UNFINISHED-SERIAL');expect(restored.draft.model).toBeUndefined();expect(restored.items).toHaveLength(1);
});
