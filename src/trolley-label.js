import {jsPDF} from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export async function trolleyLabel(trolley,count,url) {
 const pdf=new jsPDF({unit:'mm',format:'a4'}),width=210;
 pdf.setFillColor(20,38,62);pdf.rect(0,0,width,65,'F');
 pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(17);pdf.text('PROPERTY OF TSU',18,22);
 pdf.setFontSize(13);pdf.text(pdf.splitTextToSize(trolley.department,174),18,34);
 pdf.setFontSize(12);pdf.text('IT EQUIPMENT DECOMMISSIONING',18,56);
 pdf.setTextColor(20,38,62);pdf.setFontSize(22);const nameLines=pdf.splitTextToSize(trolley.name,174);if(nameLines.length>3){nameLines.length=3;nameLines[2]=nameLines[2].slice(0,-3)+'...';}pdf.text(nameLines,18,83);
 pdf.setFontSize(13);pdf.text(`${count} item${count===1?'':'s'}  |  ${trolley.status==='collected'?'COLLECTED':trolley.status==='ready'?'READY FOR COLLECTION':'AWAITING COLLECTION'}`,18,115);
 const canvas=document.createElement('canvas');
 JsBarcode(canvas,trolley.reference,{format:'CODE128',width:3,height:135,displayValue:false,margin:16});
 pdf.addImage(canvas.toDataURL('image/png'),'PNG',16,126,178,42);
 pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.text(trolley.reference,width/2,175,{align:'center'});
 pdf.setFontSize(12);pdf.text('Scan the barcode in DecomPro to view this trolley.',18,190);
 pdf.addImage(await QRCode.toDataURL(url,{width:300,margin:2,errorCorrectionLevel:'M'}),'PNG',18,201,48,48);
 pdf.setFontSize(11);pdf.text(['Or scan this QR code with a phone.','Sign in to the team workspace to view shared inventory.'],73,215);
 if(trolley.status==='collected'){pdf.text(pdf.splitTextToSize(`Collected by ${trolley.company} on ${new Date(trolley.collectedAt).toLocaleDateString('en-GB')}`,174),18,263);}
 pdf.setFontSize(9);pdf.text('DecomPro | Label contents reflect the time of printing.',18,284);
 return pdf.output('arraybuffer');
}
