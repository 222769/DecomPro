import {test,expect} from '@playwright/test';

test('deep dark previews and saves separately from the existing dark theme',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?workspace=demo#station');
 await page.evaluate(()=>localStorage.setItem('decompro.appearance','dark'));
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(page.locator('html')).not.toHaveAttribute('data-theme-variant','deep');
 expect(await page.evaluate(()=>getComputedStyle(document.body,'::after').animationName)).toBe('none');
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

test('Deep dark uses colourful depth and fits on phone',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.addInitScript(()=>localStorage.setItem('decompro.appearance','deep'));
 await page.goto('/?workspace=demo#station');
 await expect(page.locator('html')).toHaveAttribute('data-theme-variant','deep');
 await expect(page.locator('#scan')).toBeVisible();
 const styles=await page.evaluate(()=>{
  const css=selector=>getComputedStyle(document.querySelector(selector));
  return {input:css('#scan').backgroundColor,inputBorder:css('#scan').borderColor,button:css('#scan-form .primary').backgroundImage,active:css('.app-nav > a[href="#station"]').backgroundImage,currentStep:css('.step.current span').backgroundImage,body:css('body').backgroundImage,stats:[...document.querySelectorAll('.stats>div')].map(node=>getComputedStyle(node).backgroundImage),stationGrid:getComputedStyle(document.querySelector('.station'),'::before').backgroundImage,scanAnimation:css('.scan-icon').animationName,stationAnimation:css('.station').animationName,ambientAnimation:getComputedStyle(document.body,'::before').animationName,gridAnimation:getComputedStyle(document.body,'::after').animationName,stageAnimation:getComputedStyle(document.querySelector('.station'),'::before').animationName,iconAnimation:css('.scan-icon svg').animationName,navAnimation:getComputedStyle(document.querySelector('.app-nav > a[href="#station"]'),'::after').animationName};
 });
 expect(styles.input).toBe('rgb(10, 26, 43)');
 expect(styles.inputBorder).toBe('rgb(200, 168, 255)');
 expect(styles.button).toContain('linear-gradient');
 expect(styles.active).toContain('linear-gradient');
 expect(styles.currentStep).toContain('linear-gradient');
 expect(styles.body).toContain('radial-gradient');
 expect(new Set(styles.stats).size).toBe(3);
 expect(styles.stationGrid).toContain('repeating-linear-gradient');
 expect(styles.scanAnimation).toBe('deep-orbit');
 expect(styles.stationAnimation).toBe('deep-breathe');
 expect(styles.ambientAnimation).toBe('deep-ambient');
 expect(styles.gridAnimation).toBe('deep-grid-drift');
 expect(styles.stageAnimation).toBe('deep-stage-flow');
 expect(styles.iconAnimation).toBe('deep-scanner-float');
 expect(styles.navAnimation).toBe('deep-nav-sheen');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(402);
});

test('deep dark animations respect reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('decompro.appearance','deep'));
 await page.goto('/?workspace=demo#station');
 await expect(page.locator('.step.current span')).toBeVisible();
 const animations=await page.evaluate(()=>({station:getComputedStyle(document.querySelector('.station')).animationName,step:getComputedStyle(document.querySelector('.step.current span')).animationName,scan:getComputedStyle(document.querySelector('.scan-icon')).animationName,halo:getComputedStyle(document.querySelector('.station'),'::after').animationName,button:getComputedStyle(document.querySelector('#scan-form .primary'),'::before').animationName,ambient:getComputedStyle(document.body,'::before').animationName,grid:getComputedStyle(document.body,'::after').animationName,stage:getComputedStyle(document.querySelector('.station'),'::before').animationName,icon:getComputedStyle(document.querySelector('.scan-icon svg')).animationName,nav:getComputedStyle(document.querySelector('.app-nav > a[href="#station"]'),'::after').animationName}));
 expect(animations).toEqual({station:'none',step:'none',scan:'none',halo:'none',button:'none',ambient:'none',grid:'none',stage:'none',icon:'none',nav:'none'});
});

test('fine-pointer depth follows the pointer and clears when Deep dark is left',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(()=>localStorage.setItem('decompro.appearance','deep'));
 await page.goto('/?workspace=demo#station');
 const station=page.locator('section.station');
 await station.scrollIntoViewIfNeeded();
 const bounds=await station.boundingBox();
 await page.mouse.move(bounds.x+bounds.width*.75,bounds.y+bounds.height*.4);
 await expect(station).toHaveAttribute('data-deep-tilt','');
 await expect.poll(()=>station.evaluate(node=>node.style.getPropertyValue('--deep-spot-x'))).not.toBe('');
 await page.evaluate(()=>delete document.documentElement.dataset.themeVariant);
 await expect(station).not.toHaveAttribute('data-deep-tilt','');
 await page.evaluate(()=>document.documentElement.dataset.themeVariant='deep');
 await expect(page.locator('html')).toHaveAttribute('data-theme-variant','deep');
});

test('reduced motion prevents pointer depth',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('decompro.appearance','deep'));
 await page.goto('/?workspace=demo#station');
 const station=page.locator('section.station');
 await station.scrollIntoViewIfNeeded();
 const bounds=await station.boundingBox();
 await page.mouse.move(bounds.x+bounds.width*.75,bounds.y+bounds.height*.4);
 await expect(station).not.toHaveAttribute('data-deep-tilt','');
});

test('Deep dark phone keeps rounded panels and highlights the visible register',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.addInitScript(()=>localStorage.setItem('decompro.appearance','deep'));
 await page.goto('/?workspace=demo#station');
 await expect(page.locator('#scan')).toBeVisible();
 expect(await page.locator('main > header').evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 await page.locator('#register-search').scrollIntoViewIfNeeded();
 await expect(page.locator('#scroll-dock a[href="#inventory"]')).toHaveAttribute('aria-current','page');
 const search=page.locator('#register-search');
 expect(await search.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 await search.fill('TEST');
 await expect(search).toHaveValue('TEST');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(402);
});
