import {test,expect} from '@playwright/test';
for(const [serial,maker,model] of [['483474-004','Stone','213'],['ST390580','Zoostorm','9870'],['C17K3520DNCR','Apple','A1418'],['C17K3999DNCR','Apple','A1418']])test(`bundled reference ${serial} pre-fills checked workbook labels without importing equipment`,async({page})=>{
 await page.goto('/');await page.locator('#scan').fill(serial);await page.locator('#scan').press('Enter');await expect(page.locator('#recognized-maker')).toHaveValue(maker);await expect(page.locator('.captured')).toContainText(model);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('decompro.v1')).items)).toEqual([]);
 if(serial==='C17K3999DNCR'){for(let n=0;n<3;n++)await page.getByRole('button',{name:'Skip · N/A',exact:true}).click();await expect(page.locator('#confirm-recognition')).not.toBeChecked();}
});
