import {cleanExamples,normalizeSerial} from './recognition.js';
const factKey=f=>JSON.stringify([normalizeSerial(f.serial),f.model.trim().toLowerCase(),f.manufacturer.trim().toLowerCase()]);
const valid=value=>typeof value==='string'&&value.trim()&&!/^(n\/?a|unknown|none|-|not known)$/i.test(value.trim());
export function buildImportPreview(rows,existing,corrections=[]) {
 const known=cleanExamples([...existing,...corrections.filter(c=>c.mode==='corrected')]),knownKeys=new Set(known.map(factKey)),bySerial=new Map(),incoming=new Map(),seen=new Set();
 for(const f of known){const facts=bySerial.get(f.serial)||[];facts.push(f);bySerial.set(f.serial,facts);}
 const prepared=rows.map((row,id)=>{
  const fact={serial:normalizeSerial(row.serial),model:row.model.trim(),manufacturer:row.manufacturer.trim(),source:row.source};
  const missing=['serial','model','manufacturer'].filter(key=>!valid(fact[key]));
  const key=factKey(fact);if(!missing.length){const labels=incoming.get(fact.serial)||new Set();labels.add(key);incoming.set(fact.serial,labels);}
  return {id,fact,sheet:row.sheet,row:row.row,missing,key};
 });
 return prepared.map(row=>{
  const existingFacts=bySerial.get(row.fact.serial)||[],review=corrections.find(c=>c.serial===row.fact.serial&&c.mode!=='original');
  const evidence=JSON.stringify([existingFacts.map(factKey).sort(),review||null]);
  let status,reason;
  if(row.missing.length){status='incomplete';reason=`Missing or not applicable: ${row.missing.join(', ')}.`;}
  else if(knownKeys.has(row.key)||seen.has(row.key)){status='duplicate';reason=knownKeys.has(row.key)?'This serial/model/manufacturer combination is already known.':'Repeated combination in this spreadsheet.';}
  else if(existingFacts.length||incoming.get(row.fact.serial).size>1||review){status='conflict';reason=review?`This serial has a reviewed ${review.mode==='excluded'?'exclusion':'correction'}. Importing will not replace that review.`:existingFacts.length?'Different details are already known for this serial.':'This spreadsheet has different details for the same serial.';}
  else{status='new';reason='New serial/model/manufacturer reference.';}
  if(!row.missing.length)seen.add(row.key);
  return {...row,status,reason,existingFacts,review,evidence};
 });
}
export function importCounts(rows) {
 const counts={new:0,duplicate:0,conflict:0,incomplete:0};for(const row of rows)counts[row.status]++;return counts;
}
