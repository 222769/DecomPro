import {jsPDF} from 'jspdf';
import {trolleyForItem} from './trolleys.js';
import {drawPdfFooter,drawPdfLogo} from './pdf-brand.js';
import {sustainabilitySummary} from './sustainability.js';

const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const shown=value=>clean(value)||'N/A';

export async function collectionReportPdf({title,reference,items,trolleys,cached=false,includeSustainability=true,printedAt=new Date().toISOString()}){
 if(!items.length)throw Error('Save equipment before creating a collection PDF.');
 const selected=trolleys.filter(trolley=>items.some(item=>trolleyForItem(item,trolley)));
 const covered=new Set(selected.flatMap(trolley=>items.filter(item=>trolleyForItem(item,trolley)).map(item=>item.id)));
 if(covered.size!==items.length)throw Error('Some saved items have no matching trolley. Assign them to a trolley before exporting the collection PDF.');

 const pdf=new jsPDF({unit:'mm',format:'a4'}),left=16,right=194,bottom=271;
 const columns=[{x:left,width:57},{x:75,width:57},{x:134,width:60}];
 pdf.setProperties({title:`DecomPro collection report - ${clean(title)}`,author:'TSU - Helpdesk (Calderdale College)',subject:'Complete decommissioning inventory snapshot'});
 let y=0;

 function pageHeader(continued=false){
  const height=continued?31:53;
  pdf.setFillColor(19,35,59);pdf.rect(0,0,210,height,'F');
  pdf.setFillColor(65,111,239);pdf.rect(0,0,4,height,'F');
  pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(160,196,246);
  pdf.text('TSU  /  HELPDESK  /  DECOMMISSIONING',left,13);
  if(!drawPdfLogo(pdf,157,7,37,16)){pdf.setFontSize(10);pdf.setTextColor(255);pdf.text('DecomPro',right,13,{align:'right'});}
  pdf.setFont('helvetica','bold');pdf.setTextColor(255);
  if(continued){pdf.setFontSize(13);pdf.text('Collection inventory / continued',left,24);y=40;}
  else{
   pdf.setFontSize(17);pdf.text(pdf.splitTextToSize(shown(title),165).slice(0,2),left,28);
   pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(209,224,244);
   pdf.text(pdf.splitTextToSize(shown(reference),right-left).slice(0,1),left,47);
   y=63;
   pdf.setFillColor(235,243,255);pdf.roundedRect(left,y-5,right-left,23,3,3,'F');
   pdf.setFont('helvetica','bold');pdf.setFontSize(14);pdf.setTextColor(49,86,183);
   pdf.text(String(selected.length),left+7,y+6);pdf.text(String(items.length),left+65,y+6);
   pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(79,103,145);
   pdf.text('TROLLEYS',left+7,y+12);pdf.text('EQUIPMENT ITEMS',left+65,y+12);
   pdf.text(new Date(printedAt).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}),right-6,y+7,{align:'right'});
   y+=29;
  }
  pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(25,43,70);
  pdf.text(continued?'Equipment list / continued':'Equipment list',left,y);
  y+=6;
  if(cached){pdf.setFont('helvetica','bold');pdf.setFontSize(7);pdf.setTextColor(158,88,29);pdf.text('CACHED SNAPSHOT - reconnect to confirm the latest team inventory.',left,y);y+=6;}
 }
 function nextPage(){pdf.addPage();pageHeader(true);}
 function itemHeading(item,index,continued=false){
  if(y+10>bottom)nextPage();
  pdf.setFillColor(index%2?232:240,index%2?239:245,253);
  pdf.roundedRect(left,y-1,right-left,6,1.5,1.5,'F');
  pdf.setFont('helvetica','bold');pdf.setFontSize(7.8);pdf.setTextColor(29,53,86);
  const previewWidth=continued?110:123;
  pdf.text(`${String(index+1).padStart(3,'0')}  ${pdf.splitTextToSize(shown(item.description),previewWidth)[0]}${continued?' / continued':''}`,left+3,y+3);
  pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(72,96,127);
  pdf.text(shown(item.asset).slice(0,24),right-3,y+3,{align:'right'});
  y+=8;
 }
 function fields(item){
  return [
   [['DESCRIPTION',item.description],['MODEL',item.model],['MANUFACTURER',item.manufacturer]],
   [['SERIAL',item.serial],['BARCODE',item.barcode],['SECURITY ETCH',item.etch]],
   [['ASSET',item.asset],['DISPOSAL DATE',item.date],['DISPOSED BY',item.technician]],
   [['TAKEN FROM',item.source],['REASON',item.reason],['TROLLEY',selected.find(trolley=>trolleyForItem(item,trolley))?.name]]
  ];
 }
 pageHeader();
 for(const [index,item] of items.entries()){
  const groups=fields(item).map(group=>group.map(([label,value],cell)=>{
   pdf.setFont('helvetica','normal');pdf.setFontSize(7.2);
   return pdf.splitTextToSize(`${label}:  ${shown(value)}`,columns[cell].width-2);
  }));
  const height=8+groups.reduce((sum,group)=>sum+Math.max(...group.map(lines=>lines.length))*3.4+1,0)+3;
  if(height<=bottom-45&&y+height>bottom)nextPage();
  itemHeading(item,index);
  for(const group of groups){
   const lines=Math.max(...group.map(cell=>cell.length));
   for(let line=0;line<lines;line++){
    if(y+3.4>bottom){nextPage();itemHeading(item,index,true);}
    pdf.setFont('helvetica','normal');pdf.setFontSize(7.2);pdf.setTextColor(34,54,78);
    group.forEach((cell,index)=>{if(cell[line])pdf.text(cell[line],columns[index].x+1,y);});
    y+=3.4;
   }
   y+=1;
  }
  pdf.setDrawColor(222,231,242);pdf.line(left,y-1,right,y-1);y+=3;
 }

 if(includeSustainability){
  const impact=sustainabilitySummary(items,selected);
  if(y+34>bottom)nextPage();
  pdf.setFillColor(234,247,241);pdf.roundedRect(left,y-3,right-left,31,3,3,'F');
  pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(25,91,70);
  pdf.text('Environmental record',left+5,y+3);
  pdf.setFontSize(8);pdf.text(`${impact.total} items tracked  ·  ${impact.collected} pickup confirmed  ·  ${impact.pendingPickup} awaiting pickup`,left+5,y+10);
  pdf.setFontSize(7.2);pdf.text('Carbon impact: awaiting verified evidence',left+5,y+17);
  pdf.setFont('helvetica','normal');pdf.setTextColor(63,86,78);
  pdf.text(pdf.splitTextToSize('Reuse, recycling and CO2 savings require a processor report or certificate; collection alone does not prove them.',165),left+5,y+23);
 }

 const total=pdf.getNumberOfPages();
 for(let page=1;page<=total;page++){pdf.setPage(page);drawPdfFooter(pdf,left,right,clean(reference),`Page ${page} / ${total}`);}
 return pdf.output('arraybuffer');
}
