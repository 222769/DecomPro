import {readFile} from 'node:fs/promises';
import {referenceRowsFromWorkbook,cleanExamples,recognizeSerial} from '../src/recognition.js';
const path=process.argv[2];if(!path)throw Error('Usage: node scripts/analyse-serial-patterns.mjs workbook.xlsx');
const rows=await referenceRowsFromWorkbook(await readFile(path)),facts=cleanExamples(rows);
const patterns=[];
for(const kind of ['prefix','suffix'])for(const length of [2,3,4]) {
 const groups=new Map();for(const fact of facts){if(fact.serial.length<length+3)continue;const key=kind==='prefix'?fact.serial.slice(0,length):fact.serial.slice(-length);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(fact);}
 for(const [value,group] of groups){const support=new Set(group.map(f=>f.serial)).size;if(support<2)continue;const manufacturers=[...new Set(group.map(f=>f.manufacturer.toLowerCase()))],models=[...new Set(group.map(f=>f.model.toLowerCase()))];patterns.push({kind,value,support,manufacturers,models,recommendation:manufacturers.length>1?'mixed manufacturers: manual check':models.length>1?'manufacturer only':'consistent labels; check support and structure before enabling'});}
}
const holdout={fullCorrect:0,makerCorrect:0,wrongModel:0,wrongMaker:0,none:0},mismatches=[];
for(const fact of facts){const result=recognizeSerial(fact.serial,facts.filter(other=>other.serial!==fact.serial));let outcome='none';if(result?.manufacturer){outcome=result.manufacturer.toLowerCase()!==fact.manufacturer.toLowerCase()?'wrongMaker':result.model?result.model.toLowerCase()===fact.model.toLowerCase()?'fullCorrect':'wrongModel':'makerCorrect';}holdout[outcome]++;if(outcome==='wrongMaker'||outcome==='wrongModel')mismatches.push({serial:fact.serial,recordedModel:fact.model,recordedManufacturer:fact.manufacturer,suggestedModel:result.model,suggestedManufacturer:result.manufacturer});}
const duplicates=[...new Set(facts.map(f=>f.serial))].filter(serial=>facts.filter(f=>f.serial===serial).length>1);
console.log(JSON.stringify({worksheetRows:rows.length,labelledFacts:facts.length,distinctSerials:new Set(facts.map(f=>f.serial)).size,unusableOrDuplicateRows:rows.length-facts.length,conflictingSerials:duplicates,holdout,mismatches,patterns},null,2));
