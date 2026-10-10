import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';
import {defaultSettings} from '../src/workspace.js';

async function seed(page) {
 const first=createTrolley('Review trolley'),second=createTrolley('Other trolley'),collected={...createTrolley('Old collection'),status:'collected',company:'Collector',collectedAt:new Date().toISOString(),collectedBy:'MA'};
 const defaults={date:'2026-10-10',description:'Monitor',manufacturer:'Dell',source:'Basement',reason:'EOL',trolley:first.name};
 const items=[
  {...defaults,id:'missing',serial:'REVIEW-001',model:'N/A',manufacturer:'N/A',asset:'N/A',trolleyId:first.id},
  {...defaults,id:'duplicate',serial:'DUPLICATE-01',model:'P2419H',asset:'A0001',trolleyId:first.id},
  {...defaults,id:'other',serial:' duplicate-01 ',model:'P2419H',asset:'A0002',trolley:second.name,trolleyId:second.id},
  {...defaults,id:'old',serial:'OLD-01',model:'N/A',asset:'A0003',trolley:collected.name,trolleyId:collected.id}
 ].map(item=>({...item,barcode:'N/A',etch:'N/A',technician:'MA'}));
 await page.addInitScript(state=>localStorage.setItem('decompro.v1',JSON.stringify(state)),{captureOrder:'serial-first',activeTrolleyId:first.id,trolleys:[first,second,collected],profiles:[{name:'Muhammad Ali',code:'MA'}],active:'MA',defaults,items,draft:{serial:'KEEP-MY-SCAN'},step:1,voice:false,settings:defaultSettings,referenceExamples:[],referenceCorrections:[]});
 await page.goto('/#collection-review');return {first,second};
}

test('collection review finds cross-trolley duplicates, corrects flagged details and preserves the draft',async({page})=>{
 await page.setViewportSize({width:390,height:844});const {first}=await seed(page);
 const review=page.getByRole('region',{name:'Collection review'});
 await expect(review).toBeVisible();await expect(review.locator('.review-trolley-card')).toHaveCount(2);
 await expect(review.locator('.collection-review-item')).toHaveCount(3);
 await expect(review).not.toContainText('OLD-01');
 await review.getByLabel('Checks to show').selectOption('duplicate');
 await expect(review.locator('.collection-review-item')).toHaveCount(2);await expect(review).toContainText('Other trolley ( duplicate-01 )');
 await review.getByLabel('Trolley to review').selectOption(first.id);
 await expect(review.locator('.collection-review-item')).toHaveCount(1);
 await review.getByRole('button',{name:'Edit equipment DUPLICATE-01',exact:true}).click();
 await page.locator('#edit-serial').fill('REVIEW-002');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(review.locator('.collection-review-item')).toHaveCount(0);
 await review.getByLabel('Checks to show').selectOption('missing');
 await review.getByRole('button',{name:'Edit equipment REVIEW-001',exact:true}).click();
 await page.locator('#edit-model').fill('P2419H');await page.locator('#edit-manufacturer').fill('Dell');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(review.locator('.collection-review-item')).toHaveCount(0);
 await expect(review.locator('.review-trolley-card').first()).toContainText('Awaiting physical check');
 await review.getByLabel('Checks to show').selectOption('asset');await expect(review.locator('.collection-review-item')).toHaveCount(1);
 await expect(review).toContainText('N/A is permitted');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('KEEP-MY-SCAN');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/decompro-collection-review-phone.png',fullPage:true});
});

test('review keeps physical confirmation and recorded exceptions in the existing readiness gate',async({page})=>{
 const {first}=await seed(page);
 const review=page.getByRole('region',{name:'Collection review'});
 await review.locator('.review-trolley-card').first().getByRole('button',{name:'Run final readiness checks'}).click();
 await expect(page.getByRole('button',{name:'Mark ready for collection',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Back to trolleys'}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
 await review.getByLabel('Checks to show').selectOption('duplicate');
 await review.getByRole('button',{name:'Edit equipment DUPLICATE-01',exact:true}).click();await page.locator('#edit-serial').fill('REVIEW-002');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await review.locator('.review-trolley-card').first().getByRole('button',{name:'Run final readiness checks'}).click();
 await page.getByLabel('Why is model unavailable?').fill('Label missing; checked casing');
 await page.getByLabel('Why is manufacturer unavailable?').fill('No manufacturer markings');
 await page.getByRole('button',{name:'Save review notes',exact:true}).click();
 await expect(page.getByRole('button',{name:'Mark ready for collection',exact:true})).toBeEnabled();
 await page.locator('#ready-confirm').check();await page.getByRole('button',{name:'Mark ready for collection',exact:true}).click();
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(review.locator('.review-trolley-card').first()).toContainText('Ready for collection');
 await review.getByLabel('Trolley to review').selectOption(first.id);await review.getByLabel('Checks to show').selectOption('missing');
 await expect(review).toContainText('Recorded exception: Label missing');
 await expect(review.getByRole('button',{name:'Edit equipment REVIEW-001',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).draft.serial)).toBe('KEEP-MY-SCAN');
});
