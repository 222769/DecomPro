import {createId} from './ids.js';
import {normalizeSerial} from './recognition.js';
import {normalizeAssetNumber,validAssetNumber} from './data.js';
import {sameRecord} from './local-import.js';
const headings={date:['date of disposal','disposal date'],description:['description','equipment description'],model:['model','model number'],manufacturer:['manufacturer'],source:['taken from'],serial:['serial number'],barcode:['barcode'],etch:['security etch'],asset:['asset number'],reason:['reason for disposal'],technician:['who disposed of it','technician']};
const heading=value=>String(value).toLowerCase().replace(/[?]/g,'').replace(/\s+/g,' ').trim();
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function equipmentDate(value,date1904=false) {
 if(value instanceof Date)return Number.isFinite(value.getTime())?value.toISOString().slice(0,10):'Invalid date';
 if(typeof value==='number') {if(!Number.isFinite(value)||value<1||value>2958465)return String(value);return new Date(Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30)+Math.floor(value)*86400000).toISOString().slice(0,10);}
 const input=String(value??'').trim();if(!input)return '';
 if(validDate(input))return input;
 const match=input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 return match?`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`:input;
}
export async function equipmentRowsFromWorkbook(buffer) {
 const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
 const rows=[];let found=false;
 for(const sheet of workbook.worksheets) {
  let columns=null,start=0;
  for(let r=1;r<=Math.min(30,sheet.rowCount);r++) {
   const mapping={};sheet.getRow(r).eachCell((cell,c)=>{const label=heading(cell.text);for(const [key,aliases] of Object.entries(headings))if(!mapping[key]&&aliases.includes(label))mapping[key]=c;});
   if(mapping.serial&&mapping.model){columns=mapping;start=r+1;found=true;break;}
  }
  if(!columns)continue;
  for(let r=start;r<=sheet.rowCount;r++) {
   const row=sheet.getRow(r),values={};for(const key of Object.keys(headings)) {
    const cell=columns[key]?row.getCell(columns[key]):null;values[key]=cell?.text.trim()||'';
    const number=cell?.value?.result??cell?.value;
    if(['serial','barcode','etch','asset'].includes(key)&&Number.isInteger(number)&&/^0{2,}$/.test(cell?.numFmt||''))values[key]=String(number).padStart(cell.numFmt.length,'0');
   }
   if(!['serial','model','manufacturer','description'].some(key=>values[key]))continue;
   const cell=columns.date?row.getCell(columns.date):null;
   if(cell)values.date=equipmentDate(cell.value?.result??cell.value,workbook.properties.date1904);
   rows.push({id:createId(),sheet:sheet.name,row:r,values});if(rows.length>5000)throw Error('Import up to 5,000 equipment rows at a time. Split this workbook into smaller files.');
  }
 }
 if(!found)throw Error('No sheet has Serial Number and Model headings. Choose your equipment register spreadsheet.');
 if(!rows.length)throw Error('The workbook has no equipment rows to import.');
 return rows;
}
export function equipmentImportPlan(rows,existing,trolley,{date='',technician=''}={}) {
 const serialCounts=new Map(),assetCounts=new Map();
 for(const row of rows){const serial=normalizeSerial(row.values.serial),asset=normalizeAssetNumber(row.values.asset);if(serial&&serial!=='N/A')serialCounts.set(serial,(serialCounts.get(serial)||0)+1);if(asset&&asset!=='N/A')assetCounts.set(asset,(assetCounts.get(asset)||0)+1);}
 return rows.map(row=>{
  const values=row.values,item={id:row.id,...Object.fromEntries(Object.keys(headings).map(key=>[key,values[key]||'N/A'])),date:values.date||date,technician:values.technician||technician,trolley:trolley?.name||'',trolleyId:trolley?.id||'',serial:normalizeSerial(values.serial)||'N/A',asset:normalizeAssetNumber(values.asset)||'N/A',recognitionNeedsReview:true,recognitionConfirmed:false};
  const warnings=Object.keys(headings).filter(key=>!values[key]).map(key=>`${key}: ${key==='date'?date||'date required':key==='technician'?technician||'technician required':'N/A'}`);
  if(!validAssetNumber(item.asset))warnings.push('Historical asset format retained; review before collection');
  if(item.serial==='N/A'&&item.asset==='N/A')warnings.push('No serial or asset: check manually for duplicates');
  const saved=existing.find(other=>other.id===item.id);let reason='',status='new';
  if(saved){status=sameRecord(saved,item)?'saved':'blocked';reason=status==='saved'?'Already imported':'Imported record has since changed';}
  else if(!trolley||trolley.status!=='open')reason='Choose an open trolley';
  else if(!validDate(item.date))reason='Missing or invalid disposal date (use DD/MM/YYYY or YYYY-MM-DD)';
  else if(!item.technician.trim()||item.technician==='N/A')reason='Enter disposal initials for rows missing a technician';
  else if(Object.values(item).some(value=>typeof value==='string'&&value.length>1000))reason='A field exceeds 1,000 characters';
  else if(serialCounts.get(item.serial)>1)reason='Duplicate serial in selected spreadsheet rows';
  else if(assetCounts.get(item.asset)>1)reason='Duplicate asset in selected spreadsheet rows';
  else if(item.serial!=='N/A'&&existing.some(other=>normalizeSerial(other.serial)===item.serial))reason='Serial already in the register';
  else if(item.asset!=='N/A'&&existing.some(other=>normalizeAssetNumber(other.asset)===item.asset))reason='Asset already in the register';
  if(reason&&status==='new')status='blocked';
  return {...row,item,status,reason:reason||'Ready to import',warnings};
 });
}
