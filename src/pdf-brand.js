const key='decompro.pdfLogo.v1';
export const pdfCredit='© 2026 DecomPro · Developed by Muhammad Ali · Tested by Jawad Ahmed · Designed for the people who keep IT running.';

export function readPdfLogo(){
 try{const value=localStorage.getItem(key);return /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value||'')&&value.length<900000?value:null;}catch{return null;}
}
export function removePdfLogo(){localStorage.removeItem(key);}

export async function savePdfLogo(file){
 if(!file||file.size>5*1024*1024)throw Error('Choose a PNG or JPEG image smaller than 5 MB.');
 const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!png&&!jpeg)throw Error('Choose a PNG or JPEG logo.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('The logo image could not be opened.'));image.src=url;});
  if(!image.naturalWidth||!image.naturalHeight)throw Error('The logo image is empty.');
  const scale=Math.min(1,600/image.naturalWidth,240/image.naturalHeight),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('Image processing is unavailable in this browser.');
  context.drawImage(image,0,0,canvas.width,canvas.height);
  let data=canvas.toDataURL('image/png');
  if(data.length>=900000){context.globalCompositeOperation='destination-over';context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',.86);}
  if(data.length>=900000)throw Error('This logo is too detailed. Choose a simpler image.');
  try{localStorage.setItem(key,data);}catch{throw Error('The logo could not be saved on this device. Check available browser storage.');}
  return data;
 }finally{URL.revokeObjectURL(url);}
}

export function drawPdfLogo(pdf,x,y,width,height,logo=readPdfLogo()){
 if(!logo)return false;
 try{
  const image=pdf.getImageProperties(logo),ratio=Math.min(width/image.width,height/image.height);
  const drawnWidth=image.width*ratio,drawnHeight=image.height*ratio;
  pdf.addImage(logo,logo.startsWith('data:image/png')?'PNG':'JPEG',x+(width-drawnWidth)/2,y+(height-drawnHeight)/2,drawnWidth,drawnHeight);
  return true;
 }catch{return false;}
}

export function drawPdfFooter(pdf,left,right,reference,pageLabel){
 pdf.setDrawColor(215,224,238);pdf.line(left,279,right,279);
 pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(91,105,126);
 pdf.text(reference,left,284);pdf.text(pageLabel,right,284,{align:'right'});
 const lines=pdf.splitTextToSize(pdfCredit,right-left);
 pdf.setFontSize(6.4);pdf.text(lines,left,290);
}
