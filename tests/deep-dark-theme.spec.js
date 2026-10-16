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

test('deep dark uses charcoal surfaces and selective highlights on phone',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.addInitScript(()=>localStorage.setItem('decompro.appearance','deep'));
 await page.goto('/?workspace=demo#station');
 await expect(page.locator('html')).toHaveAttribute('data-theme-variant','deep');
 await expect(page.locator('#scan')).toBeVisible();
 const styles=await page.evaluate(()=>{
  const css=selector=>getComputedStyle(document.querySelector(selector));
  return {input:css('#scan').backgroundColor,button:css('#scan-form .primary').backgroundColor,active:css('.app-nav > a[href="#station"]').backgroundColor,card:css('.station').backgroundColor,body:css('body').backgroundColor,rescan:css('.rescan-toggle').backgroundColor,step:css('.step:not(.current) span').backgroundColor,logo:css('.brand-mark').filter};
 });
 expect(styles.input).toBe('rgb(14, 20, 21)');
 expect(styles.button).toBe('rgb(226, 232, 228)');
 expect(styles.active).toBe('rgb(41, 46, 45)');
 expect(styles.card).toBe('rgb(17, 22, 23)');
 expect(styles.body).toBe('rgb(8, 10, 10)');
 expect(styles.rescan).toBe('rgb(40, 46, 44)');
 expect(styles.step).toBe('rgb(42, 48, 47)');
 expect(styles.logo).toContain('grayscale(1)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(402);
});
