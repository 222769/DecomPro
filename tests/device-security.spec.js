import {configureBatch} from './helpers/batch.js';
import {test,expect} from '@playwright/test';

async function mockTeam(page) {
 await page.route(/\/(?:src\/firebase-db[^/]*|assets\/firebase-db-[^/]+\.js)(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`
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
 await expect(page.locator('#signed-in-technician')).toHaveText('Team Technician · TT');
 await expect(page.locator('.shared-profile .profile-email')).toHaveText('tech@example.invalid');
 await expect(page.locator('#profile,#add-profile')).toHaveCount(0);
 await page.locator('aside a[href="#overview"]').click();await expect(page.locator('#station')).toBeHidden();
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
 await mockTeam(page);await page.goto('/');await page.locator('#voice').click();await configureBatch(page);
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));state.items=[{...state.defaults,id:'recovery-item',serial:'SAVED-EQUIPMENT',model:'Known model',manufacturer:'Dell',asset:'N/A',barcode:'N/A',etch:'N/A',technician:state.active,trolleyId:state.trolleys[0].id}];localStorage.setItem('decompro.v1',JSON.stringify(state));});
 await signin(page);await page.getByRole('button',{name:'Lock workspace',exact:true}).click();await expect(page.locator('.workspace-lock')).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBeUndefined();await signin(page);await page.locator('#scan').fill('UNFINISHED-SERIAL');await page.locator('#scan').press('Enter');await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Lock workspace',exact:true}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.model)).toBeUndefined();
 await signin(page);await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();await expect(page.locator('#inventory tbody')).toContainText('SAVED-EQUIPMENT');
 await page.getByRole('button',{name:'Lock workspace',exact:true}).click();
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));state.draft.model='';localStorage.setItem('decompro.v1',JSON.stringify(state));});
 await page.reload();await signin(page);await expect(page.getByRole('heading',{name:'Model number',exact:true})).toBeVisible();await expect(page.locator('#inventory tbody')).toContainText('SAVED-EQUIPMENT');
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(restored.draft.serial).toBe('UNFINISHED-SERIAL');expect(restored.draft.model).toBeUndefined();expect(restored.items).toHaveLength(1);
});

test('Never disables inactivity locking across reload while manual locking still requires sign-in',async({page})=>{
 await page.clock.install();await mockTeam(page);await page.goto('/');await signin(page);
 await page.getByRole('button',{name:'Open settings',exact:true}).click();
 await page.getByLabel('Lock after inactivity').selectOption({label:'Never'});
 await page.getByRole('button',{name:'Save settings',exact:true}).click();
 await page.clock.fastForward('24:00:00');await expect(page.locator('#station')).toBeVisible();
 await expect(page.locator('.workspace-lock')).toHaveCount(0);
 expect(await page.evaluate(()=>sessionStorage.getItem('test.signouts'))).toBeNull();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.devicePreferences')).remember)).toBe(false);
 await page.reload();await expect(page.locator('#connection-status')).toContainText('Database connected');
 await page.getByRole('button',{name:'Open settings',exact:true}).click();
 await expect(page.getByLabel('Lock after inactivity')).toHaveValue('0');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Lock workspace',exact:true}).click();
 await expect(page.locator('.workspace-lock')).toBeVisible();
 const signins=await page.evaluate(()=>sessionStorage.getItem('test.signins'));
 await page.reload();await expect(page.locator('.workspace-lock')).toBeVisible();
 expect(await page.evaluate(()=>sessionStorage.getItem('test.signins'))).toBe(signins);
 await signin(page);await expect(page.locator('#station')).toBeVisible();
});

async function delayedSignoutTeam(page){
 await page.route(/\/(?:src\/firebase-db[^/]*|assets\/firebase-db-[^/]+\.js)(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`
 export async function connectFirebase(config,teamId,email,password){
  window.connectCalls=(window.connectCalls||0)+1;
  if(window.logoutPending||password!=='test-only-password')throw Object.assign(Error('Credential rejected'),{code:'auth/invalid-credential'});
  if(window.denyMembership){window.denyMembership=false;throw Object.assign(Error('Membership denied'),{code:'permission-denied'});}
  const saved=JSON.parse(localStorage.getItem('decompro.v1'))||{items:[],trolleys:[]};
  return {uid:'jawad-test',profile:{name:'Jawad test technician',code:'JA'},role:'technician',projectId:config.projectId,email:'tech@example.invalid',teamId,
   async load(){return {items:saved.items,trolleys:saved.trolleys,examples:[],corrections:[]}},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]}},listen(a,b,c,d,phase){phase('connected')},stop(){},
   async logout(){window.logoutPending=true;await new Promise((resolve,reject)=>{window.finishSignout=()=>{window.logoutPending=false;window.rejectSignout?reject(Error('Sign-out connection failed')):resolve()}})}
  };
 }
 export async function disconnectFirebaseAuth(){}
 `}));
}
for(const rejectSignout of [false,true])test(`timeout re-login waits for delayed sign-out (${rejectSignout?'failed':'successful'}) before checking the account`,async({page})=>{
 await page.clock.install();await delayedSignoutTeam(page);await page.goto('/');await signin(page);
 await page.locator('#scan').fill('TIMEOUT-UNFINISHED');await page.clock.fastForward('05:01');await expect(page.locator('.workspace-lock')).toBeVisible();expect(await page.evaluate(()=>window.logoutPending)).toBe(true);
 await page.getByRole('button',{name:'Sign in to DecomPro',exact:true}).click();await expect(page.getByLabel('Team account email')).toHaveValue('tech@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.getByRole('button',{name:'Finishing sign-out…',exact:true})).toBeDisabled();expect(await page.evaluate(()=>window.connectCalls)).toBe(1);
 await page.evaluate(()=>document.querySelector('#database-form').requestSubmit());expect(await page.evaluate(()=>window.connectCalls)).toBe(1);
 await page.evaluate(reject=>{window.rejectSignout=reject;window.finishSignout();},rejectSignout);
 await expect(page.locator('#connection-status')).toContainText('Database connected');await expect(page.locator('#scan')).toHaveValue('TIMEOUT-UNFINISHED');await expect(page.locator('#signed-in-technician')).toHaveText('Jawad test technician · JA');await expect(page.locator('#profile')).toHaveCount(0);expect(await page.evaluate(()=>window.connectCalls)).toBe(2);expect(await page.evaluate(()=>localStorage.getItem('decompro.workspaceLocked'))).toBeNull();
});

test('wrong password and membership errors after timeout remain distinct and allow retry without losing the scan',async({page})=>{
 await page.clock.install();await delayedSignoutTeam(page);await page.goto('/');await signin(page);await page.locator('#scan').fill('KEEP-AFTER-TIMEOUT');await page.clock.fastForward('05:01');await expect(page.locator('.workspace-lock')).toBeVisible();await page.evaluate(()=>window.finishSignout());
 await page.getByRole('button',{name:'Sign in to DecomPro',exact:true}).click();await page.getByLabel('Password',{exact:true}).fill('incorrect-test-password');await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.locator('#database-error')).toContainText('email or password was not accepted');await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');await expect(page.getByLabel('Team account email')).toHaveValue('tech@example.invalid');
 await page.evaluate(()=>window.denyMembership=true);await page.getByLabel('Password',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.locator('#database-error')).toContainText('Team access was denied');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('KEEP-AFTER-TIMEOUT');
 await page.getByLabel('Password',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.locator('#connection-status')).toContainText('Database connected');await expect(page.locator('#scan')).toHaveValue('KEEP-AFTER-TIMEOUT');
});

test('a stalled sign-out gives recovery guidance without trying credentials against the pending session',async({page})=>{
 await page.clock.install();await delayedSignoutTeam(page);await page.goto('/');await signin(page);await page.locator('#scan').fill('STALLED-SIGNOUT-DRAFT');await page.clock.fastForward('05:01');await expect(page.locator('.workspace-lock')).toBeVisible();await page.getByRole('button',{name:'Sign in to DecomPro',exact:true}).click();await page.getByLabel('Password',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.getByRole('button',{name:'Finishing sign-out…',exact:true})).toBeDisabled();
 await page.clock.fastForward('00:16');await expect(page.locator('#database-error')).toContainText('Refresh this page');expect(await page.evaluate(()=>window.connectCalls)).toBe(1);await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('STALLED-SIGNOUT-DRAFT');
 await page.reload();await expect(page.locator('.workspace-lock')).toBeVisible();await signin(page);await expect(page.locator('#scan')).toHaveValue('STALLED-SIGNOUT-DRAFT');
});

async function cachedAuthTeam(page){
 await page.route(/\/(?:src\/firebase-db[^/]*|assets\/firebase-db-[^/]+\.js)(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`
 export async function connectFirebase(config,teamId,email,password,options={}){
  if(options.freshSession&&!window.ignoreFreshReset){window.authResets=(window.authResets||0)+1;window.cachedAuth=false;}
  if((email&&window.cachedAuth)||password!=='test-only-password')throw Object.assign(Error('Cached credentials were rejected'),{code:'auth/invalid-credential'});
  window.cachedAuth=true;
  return {uid:'jawad-cached',profile:{name:'Jawad test technician',code:'JA'},role:'technician',projectId:config.projectId,email:'tech@example.invalid',teamId,
   async load(){return JSON.parse(sessionStorage.getItem('test.remote'))},async loadCollections(){return {collectionSessions:[],collectionTrolleys:[]}},listen(a,b,c,d,phase){phase('connected')},stop(){},async logout(){throw Error('Previous sign-out left cached authentication');}
  };
 }
 export async function disconnectFirebaseAuth(){window.cachedAuth=false;}
 `}));
 await page.goto('/');await page.locator('#station').waitFor({state:'attached'});await page.locator('#voice').click();await configureBatch(page);
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1')),trolley=state.trolleys[0];sessionStorage.setItem('test.remote',JSON.stringify({items:[{...state.defaults,id:'safe-record',trolleyId:trolley.id,trolley:trolley.name,serial:'SAFE-0001',model:'Known model',manufacturer:'Dell',asset:'A0001',barcode:'N/A',etch:'N/A',technician:'JA'}],trolleys:state.trolleys,examples:[],corrections:[]}));});
 await signin(page);await page.locator('#scan').fill('CACHED-SESSION-DRAFT');await page.clock.fastForward('05:01');await expect(page.locator('.workspace-lock')).toBeVisible();
}

test('timeout login resets cached authentication directly and retains the shared register without a local-mode switch',async({page})=>{
 await page.clock.install();await cachedAuthTeam(page);const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));await signin(page);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(after.items).toEqual(before.items);expect(after.trolleys).toEqual(before.trolleys);expect(await page.evaluate(()=>window.authResets)).toBe(1);await expect(page.locator('#scan')).toHaveValue('CACHED-SESSION-DRAFT');await expect(page.locator('#signed-in-technician')).toHaveText('Jawad test technician · JA');await expect(page.locator('#profile')).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('decompro.mode'))).toBe('shared');
});

test('the reported cached-credential error can recover through local mode while retaining the shared records',async({page})=>{
 await page.clock.install();await cachedAuthTeam(page);await page.evaluate(()=>window.ignoreFreshReset=true);await page.getByRole('button',{name:'Sign in to DecomPro',exact:true}).click();await page.getByLabel('Password',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.locator('#database-error')).toContainText('email or password was not accepted');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Sign out & return to local workspace',exact:true}).click();await expect(page.locator('#station')).toBeVisible();await signin(page);await expect(page.locator('#inventory tbody')).toContainText('SAFE-0001');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).trolleys.length)).toBe(1);
});

test('failed reauthentication after manually locking a connected account keeps its scan and allows correction',async({page})=>{
 await delayedSignoutTeam(page);await page.goto('/');await signin(page);await page.locator('#scan').fill('CONNECTED-REAUTH-DRAFT');await page.getByRole('button',{name:'Lock workspace',exact:true}).click();await expect.poll(()=>page.evaluate(()=>Boolean(window.finishSignout))).toBe(true);await page.evaluate(()=>window.finishSignout());await page.getByRole('button',{name:'Sign in to DecomPro',exact:true}).click();await page.getByLabel('Team account email').fill('tech@example.invalid');await page.getByLabel('Password',{exact:true}).fill('incorrect-test-password');await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.locator('.workspace-lock')).toBeVisible();await expect(page.locator('#database-error')).toContainText('email or password was not accepted');expect(await page.evaluate(()=>localStorage.getItem('decompro.workspaceLocked'))).toBe('true');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('CONNECTED-REAUTH-DRAFT');
 await page.getByLabel('Password',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Sign in & connect',exact:true}).click();await expect(page.locator('#connection-status')).toContainText('Database connected');await expect(page.locator('#scan')).toHaveValue('CONNECTED-REAUTH-DRAFT');
});

test('signed-in database panel shows account and Logout without a second login form',async({page})=>{
 await mockTeam(page);await page.goto('/');await signin(page);await page.getByRole('button',{name:'Shared database',exact:true}).click();
 await expect(page.locator('#database-dialog')).toContainText('Logged in to DecomPro');await expect(page.locator('#database-dialog')).toContainText('tech@example.invalid');await expect(page.locator('#database-form')).toHaveCount(0);await expect(page.getByLabel('Password',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Logout',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Check connection',exact:true}).click();await expect(page.locator('#connection-check-result')).toContainText('confirmed');
 await page.locator('#close-database').click();await page.getByRole('button',{name:'Shared database',exact:true}).click();await expect(page.locator('#database-form')).toHaveCount(0);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Logout',exact:true}).click();await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('test.signouts'))).toBe('1');await page.getByRole('button',{name:'Shared database',exact:true}).click();await expect(page.locator('#database-form')).toBeVisible();await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'Logout',exact:true})).toHaveCount(0);
});
