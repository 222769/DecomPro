import {jsPDF} from 'jspdf';
import {trolleyManifest} from './trolley-manifest.js';
import {trolleyForItem} from './trolleys.js';
import {handoverReference,validateHandoverLink} from './handover-data.js';

export async function handoverPdf(pack,trolleys,items,baseUrl,{cached=false}={}) {
 validateHandoverLink({id:pack.id,trolleyIds:pack.trolleyIds});
 const selected=pack.trolleyIds.map(id=>trolleys.find(t=>t.id===id));
 if(selected.some(t=>!t))throw Error('Some trolley details are missing. Reconnect before printing this pack.');
 const reference=handoverReference(pack.id),pdf=new jsPDF({unit:'mm',format:'a4'});
 const time=new Date(pack.collectedAt).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'});
 const collected=selected.every(t=>t.status==='collected');
 pdf.setProperties({title:`Collection handover - ${reference}`,author:'TSU - Helpdesk (Calderdale College)',subject:'Decommissioning collection inventory'});
 let y,coverPages=0;
 function header(){pdf.setFillColor(20,38,62);pdf.rect(0,0,210,14,'F');pdf.setTextColor(255);pdf.setFontSize(10);pdf.text('DECOMPRO / COLLECTION HANDOVER',16,9);pdf.setTextColor(20,38,62);y=27;}
 function line(value,size=10,bold=false){pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);for(const part of pdf.splitTextToSize(String(value).replace(/\s+/g,' ').trim(),178)){if(y>264){pdf.addPage();header();}pdf.text(part,16,y);y+=size*.45+2;}y+=3;}
 header();line('Collection handover pack',22,true);line(reference,11,true);
 line(`Company: ${pack.company}`);line(`${collected?'Collected':'Planned collection'}: ${time} (UK time)`);
 line(`${selected.length} trolleys / ${items.filter(item=>selected.some(t=>trolleyForItem(item,t))).length} items`,12,true);
 line(collected?`Collection recorded by: ${pack.collectedBy}`:'Prepared for handover. Printing does not mark these trolleys collected.',9);
 if(cached)line('CACHED SNAPSHOT - reconnect to confirm the latest inventory.',10,true);
 line('Trolleys included',13,true);
 for(const trolley of selected){line(`${trolley.name} / ${items.filter(item=>trolleyForItem(item,trolley)).length} items`,11,true);line(trolley.reference,9);line(`Property of TSU - ${trolley.department}`,9);}
 if(y>197){pdf.addPage();header();}
 line('Handover confirmation',13,true);line('Check all trolleys, equipment and recorded exceptions before signing.',9);
 for(const label of ['Released by (name / signature)','Received by (name / signature)','Actual handover date / time']){y+=9;line(`${label}: ________________________________________`,9);}
 coverPages=pdf.getNumberOfPages();
 for(const trolley of selected){const url=new URL(baseUrl);url.hash=`trolley/${trolley.id}`;await trolleyManifest(trolley,items,url.href,{document:pdf,cached,handover:{...pack,reference}});}
 const pages=pdf.getNumberOfPages();
 for(let page=1;page<=coverPages;page++){pdf.setPage(page);pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.text(reference,16,285);pdf.text(`Pack overview ${page} / ${coverPages} | ${pages} pages in pack`,194,285,{align:'right'});}
 return pdf.output('arraybuffer');
}
