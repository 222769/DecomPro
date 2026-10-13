import {jsPDF} from 'jspdf';
import {trolleyForItem} from './trolleys.js';
import {trolleyManifest} from './trolley-manifest.js';
import {drawPdfFooter,drawPdfLogo} from './pdf-brand.js';

const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
export async function collectionReportPdf({title,reference,items,trolleys,baseUrl,cached=false,printedAt=new Date().toISOString()}){
 if(!items.length)throw Error('Save equipment before creating a collection PDF.');
 const selected=trolleys.filter(trolley=>items.some(item=>trolleyForItem(item,trolley)));
 const covered=new Set(selected.flatMap(trolley=>items.filter(item=>trolleyForItem(item,trolley)).map(item=>item.id)));
 if(covered.size!==items.length)throw Error('Some saved items have no matching trolley. Assign them to a trolley before exporting the collection PDF.');
 const pdf=new jsPDF({unit:'mm',format:'a4'}),left=16,right=194;
 pdf.setProperties({title:`DecomPro collection report - ${clean(title)}`,author:'TSU - Helpdesk (Calderdale College)',subject:'Complete decommissioning inventory snapshot'});
 pdf.setFillColor(19,35,59);pdf.rect(0,0,210,91,'F');pdf.setFillColor(65,111,239);pdf.rect(0,0,5,91,'F');
 pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(151,191,255);pdf.text('TSU  /  HELPDESK  /  DECOMMISSIONING',left,22);
 if(!drawPdfLogo(pdf,151,14,43,25)){pdf.setFontSize(12);pdf.setTextColor(255);pdf.text('DecomPro',194,26,{align:'right'});}
 pdf.setFontSize(27);pdf.setTextColor(255);pdf.text('Collection',left,47);pdf.text('inventory report',left,60);
 pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(207,221,242);pdf.text('A clear record of what is on each trolley.',left,77);
 let y=105;pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(86,107,143);pdf.text('COLLECTION',left,y);pdf.text('REPORT PREPARED',112,y);
 pdf.setFontSize(12);pdf.setTextColor(25,43,70);pdf.text(pdf.splitTextToSize(clean(title),90).slice(0,2),left,y+8);
 pdf.setFontSize(9);pdf.text(`${new Date(printedAt).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'})} (UK time)`,112,y+8);
 y+=31;pdf.setFillColor(235,243,255);pdf.roundedRect(left,y,178,27,3,3,'F');
 pdf.setFont('helvetica','bold');pdf.setFontSize(18);pdf.setTextColor(49,86,183);pdf.text(String(selected.length),left+8,y+14);pdf.text(String(items.length),left+92,y+14);
 pdf.setFontSize(7);pdf.setTextColor(79,103,145);pdf.text('TROLLEYS',left+8,y+21);pdf.text('EQUIPMENT ITEMS',left+92,y+21);y+=40;
 pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.setTextColor(25,43,70);pdf.text('Trolleys in this report',left,y);y+=8;
 const coverPages=[];
 for(const [index,trolley] of selected.entries()){
  if(y+17>267){coverPages.push(pdf.getNumberOfPages());pdf.addPage();y=27;}
  pdf.setFillColor(index%2?247:240,index%2?249:245,255);pdf.roundedRect(left,y-3,178,14,2,2,'F');
  pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(35,55,84);pdf.text(pdf.splitTextToSize(`${String(index+1).padStart(2,'0')}  ${clean(trolley.name)}`,83)[0],left+4,y+3);
  pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(84,105,136);pdf.text(clean(trolley.reference),right-3,y+3,{align:'right'});
  pdf.text(`${items.filter(item=>trolleyForItem(item,trolley)).length} item(s)  /  ${trolley.status.toUpperCase()}`,left+4,y+8);y+=17;
 }
 y+=9;if(y+28>269){coverPages.push(pdf.getNumberOfPages());pdf.addPage();y=29;}
 pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(25,43,70);pdf.text('What the inventory pages include',left,y);y+=8;
 pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(74,92,120);
 pdf.text(pdf.splitTextToSize('Every saved equipment description, serial, model, manufacturer, asset number, barcode, security etch, disposal date, source, disposal reason, technician and trolley, followed by recorded exceptions and a handover sign-off.',177),left,y);
 if(cached){pdf.setFont('helvetica','bold');pdf.setTextColor(158,88,29);pdf.text('CACHED SNAPSHOT - reconnect to confirm the latest team inventory.',left,273);}
 coverPages.push(pdf.getNumberOfPages());
 for(const trolley of selected){const url=new URL(baseUrl);url.hash=`trolley/${trolley.id}`;await trolleyManifest(trolley,items,url.href,{document:pdf,cached,printedAt});}
 const total=pdf.getNumberOfPages();
 for(const page of coverPages){pdf.setPage(page);drawPdfFooter(pdf,left,right,clean(reference),`Overview page ${coverPages.indexOf(page)+1} / ${coverPages.length}  |  ${total} pages`);}
 return pdf.output('arraybuffer');
}
