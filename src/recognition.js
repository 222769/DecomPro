const meaningful = value => typeof value === 'string' && value.trim() && !/^(n\/?a|unknown|none|-|not known)$/i.test(value.trim());
export const normalizeSerial = value => String(value ?? '').trim().toUpperCase();
const labelKey = fact => `${fact.model.trim().toLowerCase()}\u0000${fact.manufacturer.trim().toLowerCase()}`;
const shape = serial => serial.replace(/[A-Z]/g,'A').replace(/[0-9]/g,'9');
export function cleanExamples(examples) {
 const unique=new Map();
 for(const row of examples) {
  if(!meaningful(row.serial)||!meaningful(row.model)||!meaningful(row.manufacturer))continue;
  const fact={serial:normalizeSerial(row.serial),model:row.model.trim(),manufacturer:row.manufacturer.trim(),source:typeof row.source==='string'?row.source:'Confirmed record'};
  const key=`${fact.serial}\u0000${labelKey(fact)}`,previous=unique.get(key);
  if(previous)fact.source=[...new Set([...previous.source.split(' | '),...fact.source.split(' | ')])].join(' | ');
  unique.set(key,fact);
 }
 return [...unique.values()];
}
export function recognizeSerial(value,examples) {
 const serial=normalizeSerial(value);if(!meaningful(serial))return null;
 const facts=cleanExamples(examples),exact=facts.filter(f=>f.serial===serial);
 const describe=(matches,method,prefix='')=>{
  const labels=new Set(matches.map(labelKey));
  if(labels.size!==1){
   const grouped=new Map(),manufacturers=new Set(matches.map(f=>f.manufacturer.toLowerCase()));
   for(const fact of matches){const key=labelKey(fact),candidate=grouped.get(key)||{model:fact.model,manufacturer:fact.manufacturer,serials:new Set()};candidate.serials.add(fact.serial);grouped.set(key,candidate);}
   return {method:'conflict',basis:method,support:new Set(matches.map(f=>f.serial)).size,prefix,sources:[...new Set(matches.flatMap(f=>f.source.split(' | ')))],source:[...new Set(matches.map(f=>f.source))].join(', '),...(manufacturers.size===1?{manufacturer:matches[0].manufacturer}:{}),candidates:[...grouped.values()].map(({serials,...candidate})=>({...candidate,support:serials.size})).sort((a,b)=>b.support-a.support)};
  }
  return {method,model:matches[0].model,manufacturer:matches[0].manufacturer,support:new Set(matches.map(f=>f.serial)).size,prefix,sources:[...new Set(matches.flatMap(f=>f.source.split(' | ')))],source:[...new Set(matches.map(f=>f.source))].join(', ')};
 };
 if(exact.length)return describe(exact,'exact');
 // Try the most specific family first. A mixed broad prefix must not hide
 // a narrower unanimous family. Leave at least three variable suffix characters.
 let conflict=null;
 for(let length=serial.length>4?Math.max(4,Math.min(12,serial.length-3)):0;length>=4;length--) {
  const prefix=serial.slice(0,length),matches=facts.filter(f=>f.serial.length>=length+(length===4?1:3)&&f.serial.startsWith(prefix));
  if(new Set(matches.map(f=>f.serial)).size<(length>4?3:2))continue;
  const result=describe(matches,'pattern',prefix);
  if(result.method!=='conflict')return result;
  // Four characters can be a shared assembler numbering scheme. If models
  // already differ, inspect the parent family before suggesting its maker.
  if(length===4&&result.manufacturer) {
   const parent=prefix.slice(0,3),family=facts.filter(f=>f.serial.startsWith(parent));
   if(new Set(family.map(f=>f.manufacturer.toLowerCase())).size>1){conflict ||= describe(family,'pattern',parent);continue;}
  }
  conflict ||= result;
 }
 // Conflicting established families take priority over a sparse suffix match.
 // One similar unit must not hide the models already known in that family.
 if(conflict)return conflict;
 const compatible=facts.filter(f=>shape(f.serial)===shape(serial));
 // Conservative evidence: same complete shape, literal prefix, at least three
 // distinct examples and unanimous model/manufacturer. Never guess from brand alone.
 for(let length=Math.min(8,serial.length-3);length>=3;length--) {
  const prefix=serial.slice(0,length),matches=compatible.filter(f=>f.serial.startsWith(prefix));
  if(new Set(matches.map(f=>f.serial)).size<3)continue;
  return describe(matches,'pattern',prefix);
 }
 // Serial families can have several changing production-counter characters.
 // A long shared literal prefix plus the same complete format is evidence for
 // a tentative family suggestion, even when only one reference is available.
 // Consider every reference in that family, not just the closest unit: mixed
 // models keep the model uncertain and mixed brands prevent brand prefilling.
 if(serial.length>=10) {
  const length=Math.max(8,Math.ceil(serial.length*.75)),prefix=serial.slice(0,length);
  const family=compatible.filter(f=>f.serial.startsWith(prefix));
  if(family.length)return {...describe(family,'similar',prefix),referenceSerials:[...new Set(family.map(f=>f.serial))]};
 }
 // Literal suffix families mirror prefix families: longer endings first,
 // leaving a variable production prefix. Use independent serials and include
 // every matching fact so contradictory labels cannot be hidden by proximity.
 let suffixConflict=null;
 for(let length=Math.min(12,serial.length-3);length>=4;length--) {
  const suffix=serial.slice(-length),family=facts.filter(f=>f.serial.length>=length+3&&f.serial.endsWith(suffix));
  if(new Set(family.map(f=>f.serial)).size<3||new Set(family.map(f=>f.serial.slice(0,-length))).size<2)continue;
  const result={...describe(family,'pattern'),suffix,format:''};
  if(result.method!=='conflict')return result;
  suffixConflict ||= result;
 }
 if(suffixConflict)return suffixConflict;
 // A short terminal code plus a literal leading letter and fixed length can
 // identify a family even when the middle changes its letter/digit layout.
 const terminal=serial.match(/[A-Z]{3}$/)?.[0],head=serial[0];
 if(serial.length>=12&&terminal&&/^[A-Z]$/.test(head)) {
  const family=facts.filter(f=>f.serial.length===serial.length&&f.serial.startsWith(head)&&f.serial.endsWith(terminal));
  if(new Set(family.map(f=>f.serial)).size>=4&&new Set(family.map(f=>f.serial.slice(0,3))).size>=2) {
   return {...describe(family,'pattern',head),suffix:terminal,format:`Starts ${head}; ${serial.length} characters`};
  }
 }
 // Short prefixes identify makers, not models, when independent units agree
 // across different serial layouts. Keep pure numeric prefixes out of this rule.
 for(const length of [3,2]) {
  const prefix=serial.slice(0,length);if(serial.length<8||!/[A-Z]/.test(prefix))continue;
  const family=facts.filter(f=>f.serial.length===serial.length&&f.serial.startsWith(prefix));
  if(new Set(family.map(f=>f.serial)).size<(length===3?3:5)||new Set(family.map(f=>f.manufacturer.toLowerCase())).size!==1)continue;
  const result=describe(family,'pattern',prefix),candidates=result.candidates||[{model:result.model,manufacturer:result.manufacturer,support:result.support}];
  return {...result,method:'conflict',basis:'pattern',model:undefined,manufacturer:family[0].manufacturer,candidates};
 }
 // A terminal maker code can survive changing production prefixes. Require
 // the entire serial format, independent examples and varied leading families.
 // This evidence suggests only the maker; a suffix does not prove the model.
 const suffix=serial.match(/[A-Z]+$/)?.[0];
 if(serial.length>=8&&suffix&&suffix.length<=3) {
  const family=compatible.filter(f=>f.serial.endsWith(suffix));
  if(new Set(family.map(f=>f.serial)).size>=3&&new Set(family.map(f=>f.serial.slice(0,3))).size>=2&&new Set(family.map(f=>f.manufacturer.toLowerCase())).size===1) {
   const result=describe(family,'pattern');
   const candidates=result.candidates||[{model:result.model,manufacturer:result.manufacturer,support:result.support}];
   return {...result,method:'conflict',basis:'pattern',model:undefined,manufacturer:family[0].manufacturer,candidates,suffix,format:shape(serial)};
  }
 }
 // Small imported families can identify the maker before enough units exist
 // for a model prediction. Require a marker plus the full format, or a long
 // suffix family anchored by two leading characters and a fixed length;
 // check all same-length marker matches for contradictory makers first.
 // A pair is never enough to assert the model, even if its labels agree.
 if(serial.length>=8) {
  for(const kind of ['prefix','suffix']) {
   const length=kind==='prefix'?3:4,marker=kind==='prefix'?serial.slice(0,length):serial.slice(-length);
   if(!/[A-Z]/.test(marker))continue;
   const family=facts.filter(f=>f.serial.length===serial.length&&(kind==='prefix'?f.serial.startsWith(marker):f.serial.endsWith(marker)));
   if(new Set(family.map(f=>f.manufacturer.toLowerCase())).size!==1)continue;
   const formatted=family.filter(f=>shape(f.serial)===shape(serial));
   const matches=new Set(formatted.map(f=>f.serial)).size>=2?formatted:kind==='suffix'&&serial.length>=10?family.filter(f=>f.serial.startsWith(serial.slice(0,2))):[];
   if(new Set(matches.map(f=>f.serial)).size<2)continue;
   const result=describe(matches,'pattern',kind==='prefix'?marker:'');
   const candidates=result.candidates||[{model:result.model,manufacturer:result.manufacturer,support:result.support}];
   const format=matches.every(f=>shape(f.serial)===shape(serial))?shape(serial):`Starts ${serial.slice(0,2)}; ${serial.length} characters`;
   return {...result,method:'conflict',basis:'pattern',model:undefined,candidates,format,...(kind==='suffix'?{suffix:marker}:{})};
  }
 }
 return null;
}
export async function referenceRowsFromWorkbook(buffer) {
 const {default:ExcelJS}=await import('exceljs');
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
 const rows=[];let usableSheets=0;
 for(const sheet of workbook.worksheets) {
  let columns=null,start=0;
  for(let r=1;r<=Math.min(30,sheet.rowCount);r++) {
   const found={};sheet.getRow(r).eachCell((cell,c)=>{const label=cell.text.trim().toLowerCase().replace(/\s+/g,' ');if(['serial number','model','manufacturer'].includes(label))found[label]=c;});
   if(found['serial number']&&found.model&&found.manufacturer){columns=found;start=r+1;break;}
  }
  if(!columns)continue;usableSheets++;
  for(let r=start;r<=sheet.rowCount;r++) {
   const row=sheet.getRow(r),serial=row.getCell(columns['serial number']).text.trim(),model=row.getCell(columns.model).text.trim(),manufacturer=row.getCell(columns.manufacturer).text.trim();
   if(!serial&&!model&&!manufacturer)continue;
   rows.push({serial,model,manufacturer,source:`Excel · ${sheet.name}`,sheet:sheet.name,row:r});
  }
 }
 if(!usableSheets)throw Error('No sheet has Serial Number, Model and Manufacturer headings.');
 return rows;
}
export async function examplesFromWorkbook(buffer) {
 return cleanExamples(await referenceRowsFromWorkbook(buffer));
}
