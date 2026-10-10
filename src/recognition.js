const meaningful = value => typeof value === 'string' && value.trim() && !/^(n\/?a|unknown|none|-|not known)$/i.test(value.trim());
export const normalizeSerial = value => String(value ?? '').trim().toUpperCase();
const labelKey = fact => `${fact.model.trim().toLowerCase()}\u0000${fact.manufacturer.trim().toLowerCase()}`;
const shape = serial => serial.replace(/[A-Z]/g,'A').replace(/[0-9]/g,'9');
export function cleanExamples(examples) {
 const unique=new Map();
 for(const row of examples) {
  if(!meaningful(row.serial)||!meaningful(row.model)||!meaningful(row.manufacturer))continue;
  const fact={serial:normalizeSerial(row.serial),model:row.model.trim(),manufacturer:row.manufacturer.trim(),source:typeof row.source==='string'?row.source:'Confirmed record'};
  unique.set(`${fact.serial}\u0000${labelKey(fact)}`,fact);
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
   return {method:'conflict',basis:method,support:new Set(matches.map(f=>f.serial)).size,prefix,source:[...new Set(matches.map(f=>f.source))].join(', '),...(manufacturers.size===1?{manufacturer:matches[0].manufacturer}:{}),candidates:[...grouped.values()].map(({serials,...candidate})=>({...candidate,support:serials.size})).sort((a,b)=>b.support-a.support)};
  }
  return {method,model:matches[0].model,manufacturer:matches[0].manufacturer,support:new Set(matches.map(f=>f.serial)).size,prefix,source:[...new Set(matches.map(f=>f.source))].join(', ')};
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
  conflict ||= result;
 }
 if(conflict)return conflict;
 // Conservative evidence: same complete shape, literal prefix, at least three
 // distinct examples and unanimous model/manufacturer. Never guess from brand alone.
 const compatible=facts.filter(f=>shape(f.serial)===shape(serial));
 for(let length=Math.min(8,serial.length-3);length>=3;length--) {
  const prefix=serial.slice(0,length),matches=compatible.filter(f=>f.serial.startsWith(prefix));
  if(new Set(matches.map(f=>f.serial)).size<3)continue;
  return describe(matches,'pattern',prefix);
 }
 // A single reference can suggest a neighbouring unit only when the serial is
 // long, has the same format, and differs in one suffix character. Require a
 // long literal prefix; this is a reviewed suggestion, never an exact match.
 if(serial.length>=10) {
  const length=Math.max(8,Math.ceil(serial.length*.75)),prefix=serial.slice(0,length);
  const neighbours=compatible.filter(f=>f.serial.startsWith(prefix)&&[...serial].filter((char,index)=>char!==f.serial[index]).length===1);
  if(neighbours.length)return {...describe(neighbours,'similar',prefix),referenceSerials:[...new Set(neighbours.map(f=>f.serial))]};
 }
 return null;
}
export async function examplesFromWorkbook(buffer) {
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
   const row=sheet.getRow(r);rows.push({serial:row.getCell(columns['serial number']).text,model:row.getCell(columns.model).text,manufacturer:row.getCell(columns.manufacturer).text,source:`Excel · ${sheet.name}`});
  }
 }
 if(!usableSheets)throw Error('No sheet has Serial Number, Model and Manufacturer headings.');
 return cleanExamples(rows);
}
