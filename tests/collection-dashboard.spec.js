import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';
import {createCollection} from '../src/collection-sessions.js';
import {defaultSettings} from '../src/workspace.js';

async function seed(page) {
 const now=new Date().toISOString(),summer=createCollection('Summer'),autumn=createCollection('Autumn');
 const trolleys=[createTrolley('Empty cage'),createTrolley('Needs details'),createTrolley('Physical check'),{...createTrolley('Pickup ready'),status:'ready',readyAt:now,readyBy:'MA'},{...createTrolley('Already collected'),status:'collected',collectedAt:now,collectedBy:'MA',company:'Collector'}];
 const defaults={date:'2026-10-11',description:'Monitor',manufacturer:'Dell',source:'Storage',reason:'EOL',trolley:trolleys[1].name};
 const items=trolleys.slice(1).map((trolley,index)=>({...defaults,id:`dashboard-${index}`,serial:`DASH-${index}`,model:index?'P2419H':'N/A',asset:'N/A',barcode:'N/A',etch:'N/A',technician:'MA',trolley:trolley.name,trolleyId:trolley.id}));
 const state={captureOrder:'serial-first',activeTrolleyId:trolleys[1].id,trolleys,profiles:[{name:'Muhammad Ali',code:'MA'}],active:'MA',defaults,items,draft:{serial:'KEEP-MY-SCAN'},step:1,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[],collectionSessions:[summer,autumn],collectionTrolleys:trolleys.map((trolley,i)=>({trolleyId:trolley.id,sessionId:i<3?summer.id:autumn.id})),activeCollectionId:summer.id};
 await page.addInitScript(state=>{if(!localStorage.getItem('decompro.v1'))localStorage.setItem('decompro.v1',JSON.stringify(state));},state);await page.goto('/');return {summer,autumn,trolleys};
}

test('dashboard separates unresolved records, physical checks, pickup and collection; filters preserve the active scan',async({page})=>{
 const {summer,autumn,trolleys}=await seed(page);const dashboard=page.getByRole('region',{name:'Collection dashboard',exact:true});
 await dashboard.locator('summary').click();
 await expect(dashboard.locator('.dashboard-metrics strong')).toHaveText(['4','5','1','1','1']);
 await expect(dashboard.locator('.dashboard-badge')).toHaveText(['Empty trolley','Needs review','Awaiting physical check','Ready for pickup','Collected']);
 await expect(dashboard).toContainText('1 of 4 items collected');
 await page.getByLabel('Collection overview',{exact:true}).selectOption(autumn.id);
 await expect(dashboard.locator('.dashboard-metrics strong')).toHaveText(['2','2','0','1','1']);
 await page.getByLabel('Trolleys to show',{exact:true}).selectOption('review');await expect(dashboard).toContainText('No trolleys match this status');
 await page.getByLabel('Collection overview',{exact:true}).selectOption(summer.id);await expect(dashboard.locator('.dashboard-trolley')).toHaveCount(1);
 await dashboard.getByRole('button',{name:'View inventory',exact:true}).click();await expect(page.locator('#inventory tbody')).toContainText('DASH-0');await expect(page.locator('#inventory tbody tr')).toHaveCount(1);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(saved.draft.serial).toBe('KEEP-MY-SCAN');expect(saved.activeCollectionId).toBe(summer.id);
 await page.locator('a[href="#overview"]').click();
 await dashboard.getByRole('button',{name:'Check trolley',exact:true}).click();await expect(page.locator('#trolley-manager')).toContainText('Model is unavailable');
});

test('correcting equipment refreshes dashboard counts without marking a physical trolley ready',async({page})=>{
 const {summer}=await seed(page);const dashboard=page.getByRole('region',{name:'Collection dashboard',exact:true});
 await page.getByRole('button',{name:'Edit item DASH-0',exact:true}).click();await page.locator('#edit-model').fill('P2419H');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(dashboard.locator('.dashboard-metrics strong')).toHaveText(['4','5','0','1','1']);await expect(dashboard.locator('.dashboard-trolley').filter({hasText:'Needs details'})).toContainText('Awaiting physical check');
 await page.reload();await expect(dashboard.locator('.dashboard-metrics strong')).toHaveText(['4','5','0','1','1']);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).activeCollectionId)).toBe(summer.id);
});

test('phone dark dashboard has readable filters and no page overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>localStorage.setItem('decompro.appearance','dark'));await seed(page);
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.getByLabel('Collection overview',{exact:true})).toBeVisible();
 await page.getByLabel('Trolleys to show',{exact:true}).selectOption('ready');await expect(page.locator('.dashboard-trolley')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
