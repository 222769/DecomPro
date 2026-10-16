import {test,expect} from '@playwright/test';

test('phone camera scan feeds the current scan field',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.route('**/src/camera-scanner.js',route=>route.fulfill({contentType:'application/javascript',body:'export async function openCameraScanner({onScan}) { window.completeCameraScan = onScan; }'}));
 await page.goto('/?workspace=demo#station');
 await page.locator('#camera-scan').click();
 await page.waitForFunction(()=>typeof window.completeCameraScan==='function');
 await page.evaluate(()=>window.completeCameraScan('PHONE-SERIAL-001'));
 await expect(page.locator('#station h2')).toHaveText('Model number');
 await expect(page.locator('.captured')).toContainText('PHONE-SERIAL-001');
});

test('phone camera scan searches trolley rescan by its decoded identifier',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.route('**/src/camera-scanner.js',route=>route.fulfill({contentType:'application/javascript',body:'export async function openCameraScanner({onScan}) { window.completeCameraScan = onScan; }'}));
 await page.goto('/?workspace=demo#station');
 await page.locator('#rescan-mode').check({force:true});
 await page.locator('#camera-rescan').click();
 await page.waitForFunction(()=>typeof window.completeCameraScan==='function');
 await page.evaluate(()=>window.completeCameraScan('PHONE-ETCH-001'));
 await expect(page.locator('#rescan-serial')).toHaveValue('PHONE-ETCH-001');
 await expect(page.locator('#rescan-new-form')).toBeVisible();
});

test('camera dialog reports permission failure and leaves manual entry available',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(new Error('blocked'),{name:'NotAllowedError'});};});
 await page.goto('/?workspace=demo#station');
 await page.locator('#camera-scan').click();
 await expect(page.locator('.camera-dialog')).toBeVisible();
 await expect(page.locator('.camera-status')).toContainText('Camera access was blocked');
 await page.locator('.camera-close').click();
 await expect(page.locator('.camera-dialog')).toHaveCount(0);
 await page.locator('#scan').fill('MANUAL-SERIAL-001');
 await page.locator('#scan').press('Enter');
 await expect(page.locator('.captured')).toContainText('MANUAL-SERIAL-001');
});

test('camera dialog uses one scan and stops the video when closed',async({page})=>{
 await page.goto('/?workspace=demo#station');
 await page.evaluate(async()=>{
  const {openCameraScanner}=await import('/src/camera-scanner.js');
  window.cameraResults=[];window.cameraStops=0;
  await openCameraScanner({startScanner:async(_video,callback)=>{window.emitCameraResult=callback;return {stop:()=>window.cameraStops++};},onScan:value=>window.cameraResults.push(value)});
 });
 await expect(page.locator('.camera-dialog')).toBeVisible();
 await page.evaluate(()=>{window.emitCameraResult(' CODE128-123 ');window.emitCameraResult('DUPLICATE');});
 await expect(page.locator('.camera-dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>({results:window.cameraResults,stops:window.cameraStops}))).toEqual({results:['CODE128-123'],stops:1});
});

test('camera decoder reads a Code 128 label from a video stream',async({page})=>{
 await page.setViewportSize({width:402,height:874});
 await page.goto('/?workspace=demo#station');
 await page.evaluate(async()=>{
  const {default:JsBarcode}=await import('/node_modules/.vite/deps/jsbarcode.js');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  JsBarcode(svg,'PHONECAM123',{format:'CODE128',displayValue:false,width:4,height:150,margin:40});
  const image=new Image();image.src=`data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  await image.decode();
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=350;
  const context=canvas.getContext('2d');
  context.fillStyle='#fff';context.fillRect(0,0,800,350);context.drawImage(image,0,0,800,350);
  const stream=canvas.captureStream(20);
  navigator.mediaDevices.getUserMedia=async()=>stream;
 });
 await page.locator('#camera-scan').click();
 await expect(page.locator('.captured')).toContainText('PHONECAM123',{timeout:15000});
});
