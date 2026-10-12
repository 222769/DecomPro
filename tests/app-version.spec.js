import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
test('footer and Settings show the loaded app version and consistent build metadata',async({page})=>{
 await page.goto('/#collection-history');const footer=page.locator('footer .app-version');await expect(footer).toContainText(`v${version}`);const label=await footer.textContent();expect(label).toMatch(/Build \d+|Local build/);await page.getByRole('button',{name:'Open settings',exact:true}).click();await expect(page.locator('#settings-dialog .app-version')).toContainText(label);await expect(page.locator('#app-build-info')).toContainText(version);await expect(page.locator('#app-build-info')).toContainText('Commit');await expect(page.locator('#app-build-info')).toContainText('(London)');await expect(page.locator('#app-build-info')).toContainText('loaded on this device');
 if(process.env.DECOMPRO_TEST_BUILD_NUMBER)await expect(footer).toContainText(`Build ${process.env.DECOMPRO_TEST_BUILD_NUMBER}`);
});
test('version remains visible when a shared workspace is locked before sign-in',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('decompro.mode','shared'));await page.goto('/');await expect(page.locator('.workspace-lock')).toBeVisible();await expect(page.locator('.workspace-lock .app-version')).toContainText(`v${version}`);
});
