import {test,expect} from '@playwright/test';

test('security policy blocks inline executable markup and external script loads',async({page})=>{
 await page.goto('/');await expect(page.locator('#station')).toBeVisible();
 const violations=await page.evaluate(async()=>{
  const blocked=[];document.addEventListener('securitypolicyviolation',e=>blocked.push(e.effectiveDirective));
  const target=document.createElement('div');target.innerHTML='<img src="/missing-security-image" onerror="window.securityExecuted=true">';document.body.append(target);
  const script=document.createElement('script');script.src='https://example.com/exfiltrate.js';document.body.append(script);
  await new Promise(resolve=>setTimeout(resolve,150));return {blocked,executed:window.securityExecuted===true};
 });
 expect(violations.executed).toBe(false);expect(violations.blocked).toContain('script-src-attr');expect(violations.blocked).toContain('script-src-elem');
 await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content','no-referrer');
});
test('cached team equipment remains stored but is not displayed or exported before membership is verified',async({page})=>{
 await page.goto('/');await page.locator('#voice').click();
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('decompro.v1'));state.draft={serial:'PRIVATE-UNFINISHED'};state.step=1;localStorage.setItem('decompro.v1',JSON.stringify(state));localStorage.setItem('decompro.mode','shared');});
 const saved=await page.evaluate(()=>localStorage.getItem('decompro.v1'));
 await page.reload();await expect(page.locator('.workspace-lock')).toBeVisible();
 await expect(page.locator('#app')).not.toContainText('PRIVATE-UNFINISHED');await expect(page.locator('#export')).toHaveCount(0);await expect(page.locator('#inventory')).toHaveCount(0);
 await page.evaluate(()=>location.hash='inventory');await expect(page.locator('.workspace-lock')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('decompro.v1'))).toBe(saved);
 await page.getByRole('button',{name:'Sign in to DecomPro',exact:true}).click();await page.getByLabel('Password',{exact:true}).fill('never-store-this');await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.locator('#firebase-password')).toHaveValue('');expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).not.toContain('never-store-this');
});
