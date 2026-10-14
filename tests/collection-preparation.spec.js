import {test,expect} from '@playwright/test';
import {createCollection} from '../src/collection-sessions.js';
import {createTrolley} from '../src/trolleys.js';
import {createId} from '../src/ids.js';
import {defaultSettings} from '../src/workspace.js';

test('desktop preparation takes a new collection from naming to trolley assignment',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/#overview');
 const guide=page.locator('#collection-preparation-overview');
 await expect(guide).toBeVisible();
 await expect(guide).toContainText('Step 1 of 4');
 await guide.getByRole('button',{name:'Name a collection'}).click();
 await page.getByLabel('Collection name').fill('November pickup');
 await page.getByRole('button',{name:'Save collection',exact:true}).click();
 await expect(page.locator('main')).toHaveAttribute('data-view','station');
 const stationGuide=page.locator('#collection-preparation-station');
 await expect(stationGuide).toContainText('Step 2 of 4');
 await expect(stationGuide.getByLabel('Collection to prepare')).toHaveValue(/.+/);
 await stationGuide.getByRole('button',{name:'Assign trolleys'}).click();
 await expect(page.getByRole('heading',{name:'Manage collection',exact:true})).toBeVisible();
});

test('desktop register leads to the guided physical check without changing trolley status',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?workspace=demo#inventory');
 await page.getByRole('button',{name:'Prepare collection',exact:false}).click();
 await expect(page.locator('main')).toHaveAttribute('data-view','station');
 const guide=page.locator('#collection-preparation-station');
 await expect(guide).toBeVisible();
 await expect(guide).toContainText('Step 3 of 4');
 await guide.getByRole('button',{name:/^Check TEST Trolley 01/}).click();
 await expect(page.locator('#trolley-manager')).toContainText('Collection readiness');
 await expect(page.locator('#trolley-manager')).toContainText('unresolved issue');
 const open=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.demo.v1')).trolleys[0].status);
 expect(open).toBe('open');
});

test('the next-step button is visible immediately after the desktop scan station',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?workspace=demo#station');
 await expect(page.locator('.station-next')).toContainText('96 items saved');
 await page.locator('#station-prepare-collection').click();
 await expect(page.locator('#collection-preparation-station')).toBeInViewport();
});

test('phone preparation stays inside the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?workspace=demo#overview');
 await expect(page.locator('#collection-preparation-overview')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('switching the preparation collection updates its trolley counts',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?workspace=demo#overview');
 const guide=page.locator('#collection-preparation-overview');
 await expect(guide).toContainText('72 saved items · 6 trolleys');
 await guide.getByLabel('Collection to prepare').selectOption({label:'TEST Previous collection'});
 await expect(guide).toContainText('24 saved items · 2 trolleys');
 await expect(guide).toContainText('0 open · 0 ready for pickup · 2 collected');
});

test('confirmed readiness advances the guide and locks the trolley for pickup',async({page})=>{
 const trolley=createTrolley('November cage'),session=createCollection('November collection');
 const defaults={date:'2026-10-14',description:'Monitor',manufacturer:'Dell',source:'Storage',reason:'EOL',trolley:trolley.name};
 const item={id:createId(),...defaults,serial:'GUIDE-001',model:'P2419H',barcode:'N/A',etch:'N/A',asset:'A1234',technician:'MA',trolleyId:trolley.id};
 const state={captureOrder:'serial-first',activeTrolleyId:trolley.id,trolleys:[trolley],profiles:[{name:'Muhammad Ali',code:'MA'}],active:'MA',defaults,items:[item],draft:{},step:0,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[],collectionSessions:[session],collectionTrolleys:[{trolleyId:trolley.id,sessionId:session.id}],activeCollectionId:session.id};
 await page.addInitScript(value=>localStorage.setItem('decompro.v1',JSON.stringify(value)),state);
 await page.goto('/#overview');
 const guide=page.locator('#collection-preparation-overview');
 await expect(guide).toContainText('Step 3 of 4');
 await guide.getByRole('button',{name:/^Check November cage/}).click();
 await expect(page.locator('.readiness-summary')).toContainText('0 unresolved issues');
 await page.getByLabel('I checked these items and any recorded exceptions before collection.').check();
 await page.getByRole('button',{name:'Mark ready for collection'}).click();
 await expect(guide).toContainText('Awaiting collection');
 await expect(guide).toContainText('Step 4 of 4');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).trolleys[0].status)).toBe('ready');
});
