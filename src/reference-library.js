import {cleanExamples,normalizeSerial,recognizeSerial} from './recognition.js';
const meaningful=value=>typeof value==='string'&&value.trim()&&!/^(n\/?a|unknown|none|-|not known)$/i.test(value.trim());
export const correctionKey=serial=>'s-'+normalizeSerial(serial).replaceAll('~','~~').replaceAll('/','~s');
export function validateCorrections(rows=[]) {
 if(!Array.isArray(rows))throw Error('Invalid reference corrections.');
 const seen=new Set();
 return rows.map(row=>{
  if(!row||!meaningful(row.serial)||row.serial.length>200||!['corrected','excluded','original'].includes(row.mode)||typeof row.model!=='string'||typeof row.manufacturer!=='string'||typeof row.note!=='string'||!row.note.trim()||row.note.length>500||row.model.length>1000||row.manufacturer.length>1000)throw Error('Invalid reference correction details.');
  const serial=normalizeSerial(row.serial);if(seen.has(serial))throw Error('Duplicate reference correction.');seen.add(serial);
  if(row.mode==='corrected'?(!meaningful(row.model)||!meaningful(row.manufacturer)):(row.model!==''||row.manufacturer!==''))throw Error('Supply a model and manufacturer for a corrected reference.');
  return {serial,mode:row.mode,model:row.model.trim(),manufacturer:row.manufacturer.trim(),note:row.note.trim()};
 });
}
export function effectiveReferences(examples,corrections=[]) {
 const overrides=new Map(corrections.filter(row=>row.mode!=='original').map(row=>[row.serial,row]));
 return cleanExamples([...examples.filter(row=>!overrides.has(normalizeSerial(row.serial))),...corrections.filter(row=>row.mode==='corrected').map(row=>({...row,source:'Reviewed reference correction'}))]);
}
export function libraryRows(examples,corrections=[]) {
 const rows=new Map();
 for(const fact of examples){const serial=normalizeSerial(fact.serial);if(!cleanExamples([fact]).length)continue;const row=rows.get(serial)||{serial,originals:[]};row.originals.push(fact);rows.set(serial,row);}
 for(const correction of corrections){const row=rows.get(correction.serial)||{serial:correction.serial,originals:[]};row.correction=correction;rows.set(row.serial,row);}
 return [...rows.values()].map(row=>{const originals=cleanExamples(row.originals),effective=effectiveReferences(originals,row.correction?[row.correction]:[]);return {...row,originals,effective,status:row.correction?.mode==='excluded'?'excluded':row.correction?.mode==='corrected'?'corrected':effective.length>1?'conflict':'ready'};}).sort((a,b)=>a.serial.localeCompare(b.serial));
}

export function lookupReference(serial,examples,corrections=[]) {
 if(corrections.some(row=>row.serial===normalizeSerial(serial)&&row.mode==='excluded'))return null;
 return recognizeSerial(serial,effectiveReferences(examples,corrections));
}
