import {test,expect} from '@playwright/test';

test('deep dark previews and saves separately from the existing dark theme',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?workspace=demo#station');
 await page.evaluate(()=>localStorage.setItem('decompro.appearance','dark'));
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(page.locator('html')).not.toHaveAttribute('data-theme-variant','deep');
 const oldInput=await page.locator('#scan').evaluate(node=>getComputedStyle(node).backgroundColor);
 await page.locator('#settings').click();
 await page.locator('#appearance-theme').selectOption('deep');
 await expect(page.locator('html')).toHaveAttribute('data-theme-variant','deep');
 expect(await page.locator('#scan').evaluate(node=>getComputedStyle(node).backgroundColor)).not.toBe(oldInput);
 await page.locator('#cancel-settings').click();
 await expect(page.locator('html')).not.toHaveAttribute('data-theme-variant','deep');
 expect(await page.locator('#scan').evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(oldInput);
 await page.locator('#settings').click();
 await page.locator('#appearance-theme').selectOption('deep');
 await page.getByRole('button',{name:'Save settings',exact:true}).click();
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme-variant','deep');
 await expect(page.locator('#scan')).toBeVisible();
 await page.locator('#settings').click();
 await expect(page.locator('#appearance-theme')).toHaveValue('deep');
 await page.locator('#appearance-theme').selectOption('dark');
 await page.getByRole('button',{name:'Save settings',exact:true}).click();
 await expect(page.locator('html')).not.toHaveAttribute('data-theme-variant','deep');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

test('deep dark emphasizes scan and navigation on phone without changing layout',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.addInitScript(()=>localStorage.setItem('decompro.appearance','deep'));
 await page.goto('/?workspace=demo#station');
 await expect(page.locator('html')).toHaveAttribute('data-theme-variant','deep');
 await expect(page.locator('#scan')).toBeVisible();
 const styles=await page.evaluate(()=>{
  const css=selector=>getComputedStyle(document.querySelector(selector));
  return {input:css('#scan').backgroundColor,button:css('#scan-form .primary').backgroundImage,active:css('.app-nav > a[href="#station"]').backgroundColor,body:css('body').backgroundColor};
 });
 expect(styles.input).toBe('rgb(7, 19, 31)');
 expect(styles.button).toContain('linear-gradient');
 expect(styles.active).toBe('rgb(23, 54, 78)');
 expect(styles.body).toBe('rgb(3, 7, 14)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(402);
});
