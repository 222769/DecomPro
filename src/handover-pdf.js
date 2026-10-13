import {jsPDF} from 'jspdf';
import {trolleyManifest} from './trolley-manifest.js';
import {trolleyForItem} from './trolleys.js';
import {handoverReference,validateHandoverLink} from './handover-data.js';
import {drawPdfFooter,drawPdfLogo} from './pdf-brand.js';

const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const london=value=>new Date(value).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'});

export async function handoverPdf(pack,trolleys,items,baseUrl,{cached=false}={}){
 validateHandoverLink({id:pack.id,trolleyIds:pack.trolleyIds});
 const selected=pack.trolleyIds.map(id=>trolleys.find(t=>t.id===id));
 if(selected.some(t=>!t))throw Error('Some trolley details are missing. Reconnect before printing this pack.');
 const reference=handoverReference(pack.id),pdf=new jsPDF({unit:'mm',format:'a4'}),left=16,right=194;
 const count=items.filter(item=>selected.some(t=>trolleyForItem(item,t))).length;
 const collected=selected.every(t=>t.status==='collected');
 pdf.setProperties({title:`Collection handover - ${reference}`,author:'TSU - Helpdesk (Calderdale College)',subject:'Decommissioning collection inventory'});
 // The cover is a concise receipt and contents page. Item details follow by trolley.
 pdf.setFillColor(19,35,59);pdf.rect(0,0,210,96,'F');
 pdf.setFillColor(67,108,238);pdf.rect(0,0,5,96,'F');
 pdf.setFillColor(39,60,92);pdf.roundedRect(151,15,43,25,4,4,'F');
 if(!drawPdfLogo(pdf,155,18,35,19)){pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.setTextColor(255);pdf.text('DecomPro',194,29,{align:'right'});}
 pdf.setTextColor(141,182,255);pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.text('TSU  /  HELP DESK  /  EQUIPMENT RELEASE',left,23);
 pdf.setTextColor(255);pdf.setFontSize(26);pdf.text('Collection',left,46);pdf.text('handover pack',left,58);
 pdf.setFont('helvetica','normal');pdf.setFontSize(9.5);pdf.setTextColor(204,217,238);pdf.text(reference,left,76);
 pdf.setFillColor(collected?44:61,collected?137:102,collected?116:208);pdf.roundedRect(left,82,49,8,2,2,'F');
 pdf.setFont('helvetica','bold');pdf.setFontSize(7);pdf.setTextColor(255);pdf.text(collected?'COLLECTED':'PREPARED FOR HANDOVER',left+4,87.3);
 let y=107;
 pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(84,104,139);pdf.text('COLLECTION COMPANY',left,y);pdf.text('DATE / TIME',111,y);
 pdf.setFontSize(12);pdf.setTextColor(24,42,69);pdf.text(pdf.splitTextToSize(clean(pack.company),88).slice(0,2),left,y+8);
 pdf.setFontSize(9);pdf.text(`${london(pack.collectedAt)} (UK time)`,111,y+8);y+=29;
 pdf.setFillColor(237,244,255);pdf.roundedRect(left,y,178,26,3,3,'F');
 pdf.setFont('helvetica','bold');pdf.setFontSize(17);pdf.setTextColor(44,80,180);pdf.text(String(selected.length),left+8,y+13);pdf.text(String(count),left+90,y+13);
 pdf.setFontSize(7);pdf.setTextColor(74,99,141);pdf.text('TROLLEYS',left+8,y+20);pdf.text('EQUIPMENT ITEMS',left+90,y+20);y+=37;
 pdf.setFontSize(10);pdf.setTextColor(24,42,69);pdf.text('Included trolleys',left,y);y+=8;
 for(const [index,trolley] of selected.entries()){
  pdf.setDrawColor(225,232,243);pdf.line(left,y+8,right,y+8);
  pdf.setFillColor(61,98,213);pdf.roundedRect(left,y-1,9,8,2,2,'F');pdf.setFontSize(6.5);pdf.setTextColor(255);pdf.text(String(index+1).padStart(2,'0'),left+4.5,y+4.3,{align:'center'});
  pdf.setFont('helvetica','bold');pdf.setFontSize(8.3);pdf.setTextColor(29,46,71);pdf.text(pdf.splitTextToSize(clean(trolley.name),73)[0],left+14,y+4);
  pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(91,107,131);pdf.text(clean(trolley.reference),right,y+4,{align:'right'});
  y+=12;
 }
 y=Math.max(y+8,211);
 if(y+52>271){pdf.addPage();y=30;}
 pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(24,42,69);pdf.text('Handover confirmation',left,y);y+=7;
 pdf.setFont('helvetica','normal');pdf.setFontSize(7.5);pdf.setTextColor(79,94,119);pdf.text('Check each trolley, item list and recorded exception before signing.',left,y);y+=9;
 for(const label of ['Released by (name / signature)','Received by (name / signature)','Actual handover date / time']){pdf.setTextColor(32,50,75);pdf.setFontSize(8);pdf.text(`${label}: ________________________________________`,left,y);y+=9;}
 if(collected){pdf.setFontSize(7.5);pdf.text(`Collection recorded by: ${clean(pack.collectedBy)}`,left,y+1);}
 if(cached){pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(154,80,27);pdf.text('CACHED SNAPSHOT - reconnect to confirm the latest inventory.',left,274);}
 const coverPages=pdf.getNumberOfPages();
 for(const trolley of selected){const url=new URL(baseUrl);url.hash=`trolley/${trolley.id}`;await trolleyManifest(trolley,items,url.href,{document:pdf,cached,handover:{...pack,reference}});}
 const pages=pdf.getNumberOfPages();
 for(let page=1;page<=coverPages;page++){pdf.setPage(page);drawPdfFooter(pdf,left,right,reference,`Pack overview ${page} / ${coverPages}  |  ${pages} pages`);}
 return pdf.output('arraybuffer');
}
