export async function openMobileMore(page){
 if(await page.locator('body.nav-condensed').count()){
  if(await page.locator('body.nav-dock-minimized').count())await page.locator('#scroll-dock-more').click();
  await page.locator('#scroll-dock-more').click();
 }else await page.locator('#mobile-nav-toggle').click();
}

export async function openMobileSection(page,hash){
 if(await page.locator('body.nav-condensed').count()){
  if(await page.locator('body.nav-dock-minimized').count())await page.locator('#scroll-dock-more').click();
  await page.locator(`#scroll-dock a[href="${hash}"]`).click();
 }else await page.locator(`aside a[href="${hash}"]`).click();
}
