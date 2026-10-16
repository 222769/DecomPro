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

test('deep dark uses midnight and cyan accents on phone',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.addInitScript(()=>localStorage.setItem('decompro.appearance','deep'));
 await page.goto('/?workspace=demo#station');
 await expect(page.locator('html')).toHaveAttribute('data-theme-variant','deep');
 await expect(page.locator('#scan')).toBeVisible();
 const styles=await page.evaluate(()=>{
  const css=selector=>getComputedStyle(document.querySelector(selector));
  return {input:css('#scan').backgroundColor,inputBorder:css('#scan').borderColor,button:css('#scan-form .primary').backgroundImage,active:css('.app-nav > a[href="#station"]').backgroundImage,currentStep:css('.step.current span').backgroundColor,body:css('body').backgroundColor,stationAnimation:css('.station').animationName,ambientAnimation:getComputedStyle(document.body,'::before').animationName};
 });
 expect(styles.input).toBe('rgb(10, 26, 43)');
 expect(styles.inputBorder).toBe('rgb(139, 217, 234)');
 expect(styles.button).toContain('linear-gradient');
 expect(styles.active).toContain('linear-gradient');
 expect(styles.currentStep).toBe('rgb(117, 225, 233)');
 expect(styles.body).toBe('rgb(5, 11, 24)');
 expect(styles.stationAnimation).toBe('deep-breathe');
 expect(styles.ambientAnimation).toBe('deep-ambient');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(402);
});

test('deep dark animations respect reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('decompro.appearance','deep'));
 await page.goto('/?workspace=demo#station');
 await expect(page.locator('.step.current span')).toBeVisible();
 const animations=await page.evaluate(()=>({station:getComputedStyle(document.querySelector('.station')).animationName,step:getComputedStyle(document.querySelector('.step.current span')).animationName,ambient:getComputedStyle(document.body,'::before').animationName}));
 expect(animations).toEqual({station:'none',step:'none',ambient:'none'});
});
