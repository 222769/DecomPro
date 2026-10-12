// Reviewed worksheet layout corrections; workbook files stay outside the public repository.
import {readFile,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {referenceRowsFromWorkbook,cleanExamples} from '../src/recognition.js';
const files=process.argv.slice(2);if(!files.length)throw Error('Pass the six reviewed workbook paths.');
const aliases=new Map([
 ['hannsg','Hanns G'],['haansg','Hanns G'],['iyyamma','Iiyama'],['iiyama','Iiyama'],
 ['edge','Edgeio'],['edgeio','Edgeio'],['lenovo aio','Lenovo'],['lenovo thinkcenter','Lenovo'],
 ['mac','Apple'],['apple','Apple'],['hitatchi','Hitachi'],['cannon','Canon'],['panansonic','Panasonic'],['hisence','Hisense']
]);
const maker=value=>aliases.get(value.trim().toLowerCase().replace(/[-.]/g,'').replace(/\s/g,''))||aliases.get(value.trim().toLowerCase())||value.trim();
const original=JSON.parse(await readFile('src/reference-catalogue.json','utf8'));
const additions=[],summary=[];
for(const path of files){
 const name=basename(path).replace(/^\d+-/,'').replace(/\.xlsx$/i,''),swap=/Decom[- ]+(May|June)[- ]+25/i.test(name),rows=await referenceRowsFromWorkbook(await readFile(path));
 const reviewed=rows.map(row=>{const manufacturer=maker(swap?row.model:row.manufacturer),rawModel=(swap?row.manufacturer:row.model).trim(),model=manufacturer==='Lenovo'&&/^Think\s*TIO24D$/i.test(rawModel)?'TIO24D':rawModel;return {...row,manufacturer,model,source:`Excel · ${name}`};});
 const facts=cleanExamples(reviewed).filter(f=>!/^unbranded$/i.test(f.manufacturer));additions.push(...facts);
 summary.push({file:name,rows:rows.length,facts:facts.length,swappedColumns:swap,skippedOrRepeated:rows.length-facts.length});
}
const facts=cleanExamples([...original,...additions].map(f=>({...f,manufacturer:maker(f.manufacturer)})));
await writeFile('src/reference-catalogue.json',JSON.stringify(facts,null,2)+'\n');
const serials=new Map();for(const fact of facts){const group=serials.get(fact.serial)||[];group.push(fact);serials.set(fact.serial,group);}
const conflicts=[...serials].filter(([,group])=>group.length>1);
console.log(JSON.stringify({sources:summary,previousFacts:original.length,totalFacts:facts.length,addedFacts:facts.length-original.length,distinctSerials:serials.size,conflictingSerials:conflicts.length},null,2));
await writeFile('/tmp/decom-catalogue-review.json',JSON.stringify({summary,conflicts},null,2));
