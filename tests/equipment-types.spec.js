import {test,expect} from '@playwright/test';
import {createTrolley} from '../src/trolleys.js';
async function scan(page,value){await page.locator('#scan').fill(value);await page.locator('#scan').press('Enter');}
async function seed(page,facts){await page.goto('/');await page.locator('#voice').click();await page.evaluate(({facts,trolley})=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));state.referenceExamples=facts;state.defaults={date:'2026-10-12',description:'Monitor',manufacturer:'',source:'Storage',reason:'EOL',trolley:trolley.name};state.trolleys=[trolley];state.activeTrolleyId=trolley.id;state.settings.keepBatchDefaults=true;localStorage.setItem('decompro.v1',JSON.stringify(state));},{facts,trolley:createTrolley('Trolley 01')});await page.reload();}
const refs=[{serial:'QA-LAPTOP-001',model:'G15',manufacturer:'Lenovo',description:'Laptop',source:'Excel'},{serial:'QA-SCREEN-001',model:'QA Display',manufacturer:'Other maker',description:'Monitor',source:'Excel'}];
test('an iPad serial fills and saves Tablet even when the same Apple model appears with another category',async({page})=>{
 await seed(page,[{serial:'QA-IPAD-001',model:'A1822',manufacturer:'Apple',description:'iPad',source:'Excel'},{serial:'QA-IMAC-001',model:'A1822',manufacturer:'Apple',description:'All-in-one computer',source:'Excel'}]);
 await scan(page,'QA-IPAD-001');await expect(page.locator('#default-description')).toHaveValue('Tablet');
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A',exact:true}).click();await page.locator('#save').click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items[0]?.description)).toBe('Tablet');
 await scan(page,'QA-IMAC-001');await expect(page.locator('#default-description')).toHaveValue('All-in-one computer');
});
test('a checked model choice fills the matching reference category',async({page})=>{
 await seed(page,[{serial:'QA-CHOICE-001',model:'A1822',manufacturer:'Apple',description:'Tablet',source:'Excel'},{serial:'QA-CHOICE-001',model:'A1823',manufacturer:'Apple',description:'Monitor',source:'Excel'},{serial:'QA-OTHER-001',model:'A1822',manufacturer:'Apple',description:'Monitor',source:'Excel'}]);
 await scan(page,'QA-CHOICE-001');await expect(page.locator('#model-candidate')).toBeVisible();
 const choice=await page.locator('#model-candidate option').evaluateAll(options=>options.find(option=>option.textContent.includes('A1822')).value);
 await page.locator('#model-candidate').selectOption(choice);await page.getByRole('button',{name:'Use selected model'}).click();
 await expect(page.locator('#default-description')).toHaveValue('Tablet');
});
test('recognition sets this item description, saves it, and keeps the checked description for the next scan',async({page})=>{
 await seed(page,refs);await scan(page,refs[0].serial);await expect(page.locator('#default-description')).toHaveValue('Laptop');await page.reload();await expect(page.locator('#default-description')).toHaveValue('Laptop');
 await page.getByRole('button',{name:'Apply batch defaults',exact:true}).click();for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A',exact:true}).click();await page.locator('#save').click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items.length)).toBe(1);
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')));expect(state.items[0].description).toBe('Laptop');expect(state.defaults.description).toBe('Laptop');await expect(page.locator('#default-description')).toHaveValue('Laptop');
 await scan(page,refs[1].serial);await expect(page.locator('#default-description')).toHaveValue('Monitor');
});
test('physical-label correction stays editable through reload and saves without changing the batch default',async({page})=>{
 await seed(page,refs);await scan(page,refs[0].serial);await page.locator('#default-description').fill('Laptop with dock');await page.reload();await expect(page.locator('#default-description')).toHaveValue('Laptop with dock');
 await page.locator('[data-step="1"]').click();await scan(page,'ThinkPad T450');await expect(page.locator('#default-description')).toHaveValue('Laptop with dock');for(let i=0;i<3;i++)await page.getByRole('button',{name:'Skip · N/A',exact:true}).click();await page.locator('#save').click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items[0]?.description)).toBe('Laptop with dock');
 await scan(page,'QA-UNKNOWN-123');await expect(page.locator('#default-description')).toHaveValue('Laptop with dock');
});
test('changing a recognised model recalculates the category instead of keeping the old suggestion',async({page})=>{
 await seed(page,refs);await scan(page,refs[0].serial);await page.locator('[data-step="1"]').click();await scan(page,'ThinkCentre M700');await expect(page.locator('#default-description')).toHaveValue('Desktop');
 await page.locator('[data-step="1"]').click();await scan(page,'Unknown hardware');await expect(page.locator('#default-description')).toHaveValue('Monitor');
});
for(const [serial,type] of [['8F020669H','Laptop'],['C17K3999DNCR','All-in-one computer'],['TG22681204','Monitor']])test(`bundled serial-family recognition ${serial} also updates equipment type`,async({page})=>{
 await page.goto('/');await scan(page,serial);await expect(page.locator('#default-description')).toHaveValue(type);await page.reload();await expect(page.locator('#default-description')).toHaveValue(type);
});
test('manufacturer-only family with conflicting equipment types waits for a checked model choice',async({page})=>{
 await seed(page,[{serial:'QATYPE1001',model:'G15',manufacturer:'Lenovo',description:'Laptop',source:'Excel'},{serial:'QATYPE1002',model:'TIO24D',manufacturer:'Lenovo',description:'Monitor',source:'Excel'}]);
 await scan(page,'QATYPE1003');await expect(page.locator('#default-description')).toHaveValue('Monitor');await expect(page.locator('#model-candidate')).toBeVisible();
 const value=await page.locator('#model-candidate option').evaluateAll(options=>options.find(o=>o.textContent.includes('G15')).value);await page.locator('#model-candidate').selectOption(value);await page.locator('#use-model-candidate').click();await expect(page.locator('#default-description')).toHaveValue('Laptop');
});
