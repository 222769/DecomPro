import {normalizeSerial} from './recognition.js';
export function findRescanItem(items,value) {
 const identifier=normalizeSerial(value);if(!identifier||identifier==='N/A'||identifier.length>1000)throw Error('Scan a real serial number or asset number to identify an existing equipment item. N/A cannot identify an item.');
 const matches=items.filter(item=>normalizeSerial(item.serial)===identifier||normalizeSerial(item.asset)===identifier);
 if(!matches.length)throw Error('This serial or asset number is not in the equipment register. Import the equipment spreadsheet or use normal scanning first. Reference-training sheets do not contain a full inventory record.');
 if(matches.length!==1)throw Error('More than one equipment record matches this serial or asset number. Resolve the duplicate or conflicting identifiers in the register before rescanning.');
 return structuredClone(matches[0]);
}
