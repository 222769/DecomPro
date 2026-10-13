import {checkReadiness} from './readiness.js';
import {jsPDF} from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import {trolleyForItem} from './trolleys.js';
import {drawPdfFooter,drawPdfLogo} from './pdf-brand.js';

const clean=value=>String(value??'').replace(/\s+/g,' ').trim()||'N/A';
const london=value=>new Date(value).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'});
const status=trolley=>trolley.status==='collected'?'COLLECTED':trolley.status==='ready'?'READY FOR COLLECTION':'AWAITING COLLECTION';

// One printable inventory snapshot. The same pages are used inside a combined handover.
export async function trolleyManifest(trolley,register,url,{cached=false,printedAt=new Date().toISOString(),document:existingPdf=null,handover=null}={}){
 const items=register.filter(item=>trolleyForItem(item,trolley)),review=checkReadiness(trolley,register);
 const pdf=existingPdf||new jsPDF({unit:'mm',format:'a4'}),left=16,right=194,bottom=270;
 if(existingPdf)pdf.addPage();
 const firstPage=pdf.getNumberOfPages();
 const qr=await QRCode.toDataURL(url,{width:300,margin:2,errorCorrectionLevel:'M'});
 let barcode=null;
 if(trolley.reference&&typeof document!=='undefined'){
  const canvas=document.createElement('canvas');JsBarcode(canvas,trolley.reference,{format:'CODE128',width:2,height:40,displayValue:false,margin:3});barcode=canvas.toDataURL('image/png');
 }
 if(!existingPdf)pdf.setProperties({title:`Trolley inventory - ${trolley.reference}`,author:'TSU - '+clean(trolley.department),subject:'Complete decommissioning equipment inventory'});
 let y=0;
 function pageHeader(continued=false){
  pdf.setFillColor(20,36,61);pdf.rect(0,0,210,19,'F');pdf.setFillColor(76,113,238);pdf.rect(0,0,4,19,'F');
  pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.setTextColor(255);pdf.text('DecomPro',left,12);
  if(!drawPdfLogo(pdf,158,3,36,13)){pdf.setFontSize(7);pdf.text('TSU / HELPDESK',194,11,{align:'right'});}
  pdf.setTextColor(26,42,68);pdf.setFontSize(17);pdf.text(continued?'Trolley inventory / continued':'Trolley inventory',left,32);
  pdf.setFontSize(11);pdf.text(pdf.splitTextToSize(clean(trolley.name),137).slice(0,2),left,41);
  pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(87,105,132);
  pdf.text(`Property of TSU - ${clean(trolley.department)}`,left,52);
  pdf.text(clean(trolley.reference),left,58);
  pdf.addImage(qr,'PNG',164,25,30,30);pdf.link(164,25,30,30,{url});
  pdf.setFillColor(236,243,255);pdf.roundedRect(left,63,178,10,2,2,'F');
  pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(51,83,177);
  pdf.text(`${items.length} ITEM${items.length===1?'':'S'}  /  ${status(trolley)}`,left+4,69.5);
  if(barcode&&!continued){pdf.addImage(barcode,'PNG',left,77,103,12);pdf.setFontSize(6.5);pdf.setTextColor(94,109,130);pdf.text('SCAN TROLLEY REFERENCE',left+109,84);y=96;}
  else y=82;
  if(cached){pdf.setTextColor(158,88,29);pdf.setFontSize(7);pdf.text('CACHED SNAPSHOT - reconnect to confirm the latest team inventory.',left,y);y+=7;}
 }
 function nextPage(){pdf.addPage();pageHeader(true);}
 function itemHeading(number,description,continued=false){
  if(y+15>bottom)nextPage();
  pdf.setFillColor(229,237,252);pdf.roundedRect(left,y,right-left,11,2,2,'F');
  pdf.setFillColor(54,95,237);pdf.roundedRect(left,y,13,11,2,2,'F');
  pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(255);pdf.text(String(number).padStart(2,'0'),left+6.5,y+7,{align:'center'});
  pdf.setTextColor(26,44,72);pdf.setFontSize(9.5);
  const title=pdf.splitTextToSize(clean(description)+(continued?' / continued':''),158);pdf.text(title[0],left+18,y+7);
  y+=15;
 }
 function fieldPair(aLabel,aValue,bLabel,bValue,number,description){
  const cells=[pdf.splitTextToSize(clean(aValue),80),pdf.splitTextToSize(clean(bValue),80)];
  const count=Math.max(cells[0].length,cells[1].length);let offset=0;
  do{
   if(y+11>bottom){nextPage();itemHeading(number,description,true);}
   const take=Math.max(1,Math.min(count-offset,Math.floor((bottom-y-8)/3.2)));
   const x2=107;
   pdf.setFont('helvetica','bold');pdf.setFontSize(6.3);pdf.setTextColor(92,115,152);
   pdf.text(aLabel.toUpperCase()+(offset?' / CONT.':''),left+2,y+3);
   pdf.text(bLabel.toUpperCase()+(offset?' / CONT.':''),x2,y+3);
   pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(31,47,72);
   const one=cells[0].slice(offset,offset+take),two=cells[1].slice(offset,offset+take);
   if(one.length)pdf.text(one,left+2,y+7);if(two.length)pdf.text(two,x2,y+7);
   y+=7+take*3.2;
   pdf.setDrawColor(226,232,241);pdf.line(left,y-1,right,y-1);
   offset+=take;
  }while(offset<count);
 }
 pageHeader();
 if(!items.length){pdf.setFontSize(11);pdf.setTextColor(70,83,104);pdf.text('No equipment recorded on this trolley.',left,y+8);y+=21;}
 for(const [index,item] of items.entries()){
  if(y+78>bottom)nextPage();
  itemHeading(index+1,item.description);
  fieldPair('Serial number',item.serial,'Asset number',item.asset,index+1,item.description);
  fieldPair('Barcode',item.barcode,'Security etch',item.etch,index+1,item.description);
  fieldPair('Manufacturer',item.manufacturer,'Model number',item.model,index+1,item.description);
  fieldPair('Equipment description',item.description,'Disposal date',item.date,index+1,item.description);
  fieldPair('Taken from',item.source,'Reason for disposal',item.reason,index+1,item.description);
  fieldPair('Disposed by',item.technician,'Trolley',item.trolley,index+1,item.description);
  y+=4;
 }
 const exceptions=review.issues.filter(issue=>issue.kind==='missing'&&issue.resolved);
 if(exceptions.length){
  if(y+26>bottom)nextPage();
  pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.setTextColor(26,44,72);pdf.text('Recorded exceptions',left,y+4);y+=10;
  for(const issue of exceptions){
   const index=items.findIndex(item=>item.id===issue.itemId),lines=pdf.splitTextToSize(`Item ${index+1} - ${issue.field}: ${clean(issue.note)}`,175);
   for(const line of lines){if(y+6>bottom)nextPage();pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);pdf.setTextColor(44,60,84);pdf.text(line,left,y);y+=4.5;}y+=3;
  }
 }
 if(y+62>bottom)nextPage();
 pdf.setDrawColor(159,181,217);pdf.line(left,y,right,y);y+=9;
 pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.setTextColor(26,44,72);pdf.text('Handover confirmation',left,y);y+=8;
 pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.text('Check equipment and item count before signing.',left,y);y+=10;
 if(trolley.readyAt){pdf.setFontSize(7.5);pdf.setTextColor(77,94,122);pdf.text(`Readiness checked: ${london(trolley.readyAt)} (UK time) by ${clean(trolley.readyBy)}`,left,y);y+=7;}
 for(const label of ['Released by (name / signature)','Received by (name / signature)','Handover date / time']){pdf.setFontSize(8);pdf.text(`${label}: ____________________________________`,left,y);y+=9;}
 if(trolley.status==='collected'||handover){if(y+7>bottom)nextPage();pdf.setFontSize(7.5);pdf.setTextColor(77,94,122);pdf.text(`Collection company: ${clean(trolley.status==='collected'?trolley.company:handover.company)}  /  ${trolley.status==='collected'?'Collected':'Planned'}: ${london(trolley.status==='collected'?trolley.collectedAt:handover.collectedAt)} (UK time)`,left,y);if(trolley.status==='collected')pdf.text(`Collection recorded by: ${clean(trolley.collectedBy)}`,left,y+5);}
 const lastPage=pdf.getNumberOfPages();
 for(let page=firstPage;page<=lastPage;page++){pdf.setPage(page);drawPdfFooter(pdf,left,right,clean(trolley.reference),`Trolley page ${page-firstPage+1} / ${lastPage-firstPage+1}`);}
 return existingPdf?pdf:pdf.output('arraybuffer');
}
