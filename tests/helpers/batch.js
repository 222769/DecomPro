// Set up explicit batch details for scenarios that test other workflows.
export async function ensureTrolley(page){
 if(await page.locator('#default-trolley').inputValue())return;
 await page.getByRole('button',{name:'Change trolley',exact:true}).click();await page.locator('#trolley-name').fill('Trolley 01');await page.getByRole('button',{name:'Use trolley',exact:true}).click();
}
export async function configureBatch(page){
 for(const [key,value] of Object.entries({date:'2026-10-12',description:'Monitor',manufacturer:'Dell',source:'Storage',reason:'EOL'}))await page.locator(`#default-${key}`).fill(value);
 await page.locator('#keep-batch-defaults').check();await ensureTrolley(page);
}
