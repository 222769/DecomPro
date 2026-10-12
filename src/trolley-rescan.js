import {normalizeSerial} from './recognition.js';
export function findRescanItem(items,value) {
 const identifier=normalizeSerial(value);if(!identifier||/^(n\/?a|unknown|none|-|not known)$/i.test(identifier)||identifier.length>1000)throw Error('Scan a saved serial number, barcode, security etch or asset number. N/A or other unknown values cannot identify an item.');
 const matches=items.filter(item=>['serial','barcode','etch','asset'].some(field=>normalizeSerial(item[field])===identifier));
 if(!matches.length){const error=Error(`This identifier is not in the equipment register. No saved item matches ${identifier}. To rescan equipment from an Excel sheet, use Collection register → Import equipment Excel first. Import reference spreadsheet only teaches recognition; it does not add asset numbers or inventory records. You can also record the item using normal scanning.`);error.code='rescan/not-found';throw error;}
 if(matches.length!==1)throw Error('More than one equipment record matches this serial, barcode, security etch or asset number. Resolve the duplicate or conflicting identifiers in the register before rescanning.');
 return structuredClone(matches[0]);
}
