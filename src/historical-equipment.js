import {normalizeSerial} from './recognition.js';
export const historicalFields=[['date','Previous disposal date'],['description','Equipment description'],['model','Model number'],['manufacturer','Manufacturer'],['source','Taken from'],['serial','Serial number'],['barcode','Barcode'],['etch','Security etch'],['asset','Asset number'],['reason','Reason for disposal'],['technician','Previously recorded by']];
export function validateHistoricalEquipment(rows=[]){
 if(!Array.isArray(rows)||rows.length>20000)throw Error('Historical lookup supports up to 20,000 rows.');
 const ids=new Set();return rows.map(row=>{
  if(!row||typeof row.id!=='string'||!row.id||row.id.length>100||ids.has(row.id)||typeof row.file!=='string'||!row.file||row.file.length>255||typeof row.sheet!=='string'||row.sheet.length>255||!Number.isInteger(row.row)||row.row<1||!row.values||historicalFields.some(([key])=>typeof row.values[key]!=='string'||row.values[key].length>1000))throw Error('Invalid historical equipment lookup row.');
  ids.add(row.id);return {id:row.id,file:row.file,sheet:row.sheet,row:row.row,values:Object.fromEntries(historicalFields.map(([key])=>[key,row.values[key]]))};
 });
}
export function historicalWorkbookRows(rows,file){return validateHistoricalEquipment(rows.map(row=>({id:row.id,file,sheet:row.sheet,row:row.row,values:Object.fromEntries(historicalFields.map(([key])=>[key,String(row.values[key]??'')]))})));}
export function mergeHistoricalEquipment(existing,rows,file){return validateHistoricalEquipment([...existing.filter(row=>row.file!==file),...rows]);}
export const usableIdentifier=value=>{const id=normalizeSerial(value);return Boolean(id&&!/^(n\/?a|unknown|none|-|not known)$/i.test(id));};
export function historicalMatches(rows,value){const id=normalizeSerial(value);if(!usableIdentifier(id))return [];return rows.filter(row=>['serial','barcode','etch','asset'].some(key=>normalizeSerial(row.values[key])===id)).map(row=>structuredClone(row));}
export function assertHistoricalAddition(items,values,identifier){
 const wanted=normalizeSerial(identifier);
 if(items.some(item=>['serial','barcode','etch','asset'].some(key=>usableIdentifier(item[key])&&normalizeSerial(item[key])===wanted)))throw Error('This identifier is now in the register. Find the item again to move its existing record.');
 for(const key of ['serial','asset'])if(usableIdentifier(values[key])&&items.some(item=>normalizeSerial(item[key])===normalizeSerial(values[key])))throw Error(`An equipment record already uses this ${key==='asset'?'asset number':'serial number'}. Find that existing item instead of adding a duplicate.`);
}
