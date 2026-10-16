async function startBarcodeCamera(video, onResult) {
 const {BrowserMultiFormatReader} = await import('@zxing/browser');
 const reader = new BrowserMultiFormatReader();
 return reader.decodeFromConstraints(
  {audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}},
  video,
  result => { if(result) onResult(result.getText()); }
 );
}

function cameraError(error) {
 if(!window.isSecureContext)return 'Camera scanning needs HTTPS. Open the secure DecomPro address, or enter the code manually.';
 if(error?.name==='NotAllowedError'||error?.name==='PermissionDeniedError')return 'Camera access was blocked. Allow camera access for this website in your browser settings, then try again.';
 if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return 'No camera was found on this device. You can still type or use a barcode scanner.';
 return 'The camera could not start. Check that another app is not using it, then try again or enter the code manually.';
}

export async function openCameraScanner({onScan,startScanner=startBarcodeCamera}) {
 const dialog=document.createElement('dialog');
 dialog.className='camera-dialog';
 dialog.setAttribute('aria-label','Scan a barcode with your camera');
 dialog.innerHTML='<div class="camera-header"><div><span class="eyebrow">PHONE CAMERA</span><h2>Scan a barcode</h2></div><button class="secondary camera-close" type="button" aria-label="Close camera">Close</button></div><p>Point your camera at the label. The code will be captured when it comes into focus.</p><div class="camera-preview"><video autoplay muted playsinline aria-label="Camera preview"></video><span class="camera-target" aria-hidden="true"></span></div><p class="camera-status" role="status">Starting camera…</p><p class="camera-help">Keep the barcode flat and well lit. You can close this and type the code instead.</p>';
 document.body.append(dialog);
 const video=dialog.querySelector('video'),status=dialog.querySelector('.camera-status');
 let controls,closed=false,accepted=false;
 function close() {
  if(closed)return;
  closed=true;
  controls?.stop();
  video.srcObject?.getTracks().forEach(track=>track.stop());
  if(dialog.open)dialog.close();
  dialog.remove();
 }
 dialog.querySelector('.camera-close').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.showModal();
 try {
  controls=await startScanner(video,value=>{
   if(closed||accepted||!value?.trim())return;
   accepted=true;
   const scanned=value.trim();
   close();
   onScan(scanned);
  });
  if(closed){controls?.stop();video.srcObject?.getTracks().forEach(track=>track.stop());}
  else status.textContent='Camera ready. Hold a barcode inside the frame.';
 } catch(error) {
  if(!closed){video.srcObject?.getTracks().forEach(track=>track.stop());status.textContent=cameraError(error);status.setAttribute('role','alert');}
 }
}
