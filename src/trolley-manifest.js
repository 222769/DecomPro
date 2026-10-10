import {jsPDF} from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import {trolleyForItem} from './trolleys.js';

const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const dateTime=value=>new Date(value).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'});

// This is a snapshot of the supplied register, not a write or a collection action.
export async function trolleyManifest(trolley,register,url,{cached=false,printedAt=new Date().toISOString()}={}) {
 const items=register.filter(item=>trolleyForItem(item,trolley));
 const pdf=new jsPDF({unit:'mm',format:'a4'}),left=16,right=194,bottom=273;
 const columns=[['#',8],['Serial number',42],['Asset',20],['Manufacturer',31],['Model',51],['Disposed by',26]];
 const barcode=document.createElement('canvas');
 JsBarcode(barcode,trolley.reference,{format:'CODE128',width:3,height:70,displayValue:false,margin:8});
 const barcodeImage=barcode.toDataURL('image/png'),qr=await QRCode.toDataURL(url,{width:300,margin:2,errorCorrectionLevel:'M'});
 pdf.setProperties({title:`Trolley inventory manifest - ${trolley.reference}`,author:'TSU - '+text(trolley.department),subject:'IT equipment collection handover'});
 let y;
 function line(value,size=9,bold=false,width=right-left) {
  pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);
  const lines=pdf.splitTextToSize(text(value),width);pdf.text(lines,left,y);y+=lines.length*size*0.4+3;
 }
 function header(first=false,heading='Inventory continued') {
  pdf.setFillColor(20,38,62);pdf.rect(0,0,210,12,'F');pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text('DECOMPRO  /  TROLLEY INVENTORY MANIFEST',left,8);
  pdf.setTextColor(20,38,62);y=23;
  line('Property of TSU - '+trolley.department,11,true,138);
  line(trolley.reference,9,true,138);
  line(`${items.length} item${items.length===1?'':'s'} | ${trolley.status==='collected'?'COLLECTED':'AWAITING COLLECTION'}`,9,false,138);
  pdf.addImage(qr,'PNG',159,16,35,35);pdf.link(159,16,35,35,{url});
  pdf.setFontSize(7);pdf.text('QR: live team inventory',176.5,54,{align:'center'});
  pdf.addImage(barcodeImage,'PNG',left,52,138,17);
  y=77;
  if(first) {
   line(trolley.name,11,true);
   line('Collection company: '+(trolley.status==='collected'?trolley.company:'________________________________________'));
   line('Collection date: '+(trolley.status==='collected'?dateTime(trolley.collectedAt)+' (UK time)':'________________________________________'));
   if(trolley.status==='collected')line('Collection recorded by: '+trolley.collectedBy);
   if(cached)line('CACHED WORKSPACE SNAPSHOT - reconnect to confirm the latest team inventory.',9,true);
  } else line(heading,10,true);
 }
 function tableHeader() {
  pdf.setFillColor(232,238,245);pdf.rect(left,y,right-left,9,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(8);
  let x=left;for(const [label,width] of columns){pdf.text(label,x+2,y+6);x+=width;}y+=9;
 }
 function nextPage(table=false) {pdf.addPage();header(false,table?'Inventory continued':'Collection handover');if(table)tableHeader();}
 header(true);tableHeader();
 if(!items.length){y+=9;line('No equipment recorded in this trolley.',10);}
 items.forEach((item,index)=>{
  pdf.setFont('helvetica','normal');pdf.setFontSize(8);
  const values=[String(index+1),item.serial||'N/A',item.asset||'N/A',item.manufacturer||'N/A',item.model||'N/A',item.technician||'N/A'];
  const cells=values.map((value,i)=>pdf.splitTextToSize(text(value),columns[i][1]-4));
  const height=Math.max(...cells.map(cell=>cell.length));let offset=0;
  // Split unusually long rows across pages rather than dropping or clipping fields.
  while(offset<height) {
   if(bottom-y<12)nextPage(true);
   const take=Math.min(height-offset,Math.floor((bottom-y-4)/4)),rowHeight=take*4+4;
   if(index%2===0){pdf.setFillColor(246,248,251);pdf.rect(left,y,right-left,rowHeight,'F');}
   pdf.setFont('helvetica','normal');pdf.setFontSize(8);let x=left;
   cells.forEach((cell,i)=>{const part=cell.slice(offset,offset+take);if(i===0&&offset>0)part.push('*');if(part.length)pdf.text(part,x+2,y+5);x+=columns[i][1];});
   pdf.setDrawColor(218,225,234);pdf.line(left,y+rowHeight,right,y+rowHeight);y+=rowHeight;offset+=take;
  }
 });
 // Keep signatures together and leave enough room for handwriting.
 if(bottom-y<66)nextPage();else y+=10;
 line('Handover confirmation',11,true);
 line('Check the equipment and item count before signing. * indicates a continued row.',8);
 for(const label of ['Released by (name / signature)','Received by (name / signature)','Handover date / time']){y+=8;line(label+': __________________________________________',9);}
 const pages=pdf.getNumberOfPages();
 for(let page=1;page<=pages;page++) {
  pdf.setPage(page);pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(80,92,110);
  pdf.text(trolley.reference,left,282);pdf.text(`Page ${page} of ${pages}`,right,282,{align:'right'});
  pdf.text(`Printed ${dateTime(printedAt)} (UK time) | ${cached?'Cached snapshot':'Register snapshot'} at printing`,left,287);
  pdf.text('QR viewers must sign in to the same team workspace. Local records stay in their browser.',left,292);
 }
 return pdf.output('arraybuffer');
}
