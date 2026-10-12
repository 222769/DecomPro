import {normalizeSerial} from './recognition.js';
export function findRescanItem(items,value) {
 const serial=normalizeSerial(value);if(!serial||serial==='N/A'||serial.length>1000)throw Error('Scan a real serial number to identify an existing equipment item. N/A cannot identify an item.');
 const matches=items.filter(item=>normalizeSerial(item.serial)===serial);
 if(!matches.length)throw Error('This serial is not in the equipment register. Import the equipment spreadsheet or use normal scanning first. Reference-training sheets do not contain a full inventory record.');
 if(matches.length!==1)throw Error('More than one equipment record has this serial. Resolve the duplicate records in the register before rescanning.');
 return structuredClone(matches[0]);
}
