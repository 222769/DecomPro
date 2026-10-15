// Equipment categories are independent of serial matching: a maker alone is not a type.
export const epsonProjectorModel=(model,manufacturer)=>/^epson$/i.test(String(manufacturer||'').trim())&&/^(?:EB[-\s]?\d+[A-Z0-9-]*|455WI|H343B)$/i.test(String(model||'').trim());
export function normalizeEquipmentDescription(value) {
 const key=String(value||'').trim().toLowerCase().replace(/[-_]/g,' ').replace(/\s+/g,' ');
 const groups={Laptop:['laptop','notebook','chromebook'],Desktop:['desktop','pc','computer','workstation'],'All-in-one computer':['all in one','aio','all in one computer'],Monitor:['monitor','screen','display'],Tablet:['tablet','tablet pc','tablet computer','ipad','ipads','apple ipad'],Printer:['printer'],Scanner:['scanner'],Server:['server'],Switch:['switch','adls switch'],Router:['router'],Firewall:['firewall'],'Access point':['access point'],Projector:['projector'],TV:['tv','television'],UPS:['ups'],Battery:['battery'],'Hard drive':['hard drive','hdd'],'Tape drive':['tape drive'],'Backup tapes':['backup tapes'],CCTV:['cctv','camera'],Till:['till'],'Docking station':['docking station','dock'],'USB charging station':['usb charging station'],Fax:['fax']};
 for(const [type,aliases] of Object.entries(groups))if(aliases.includes(key))return type;
 if(/^(?:apple )?ipad(?:\s|$)/i.test(key))return 'Tablet';
 return null;
}
export function suggestEquipmentDescription(model,manufacturer,facts=[]) {
 const name=String(model||'').trim(),maker=String(manufacturer||'').trim();
 if(!name||/^n\/?a$/i.test(name))return null;
 if(/\bipad\b/i.test(name))return 'Tablet';
 if(epsonProjectorModel(name,maker))return 'Projector';
 // Distinct product families also correct old records saved with the Monitor default.
 if(/\b(thinkcentre|thinkstation|optiplex|prodesk|elitedesk|mac mini|mac pro|legion (tower|t[57]))\b/i.test(name))return 'Desktop';
 if(/\bimac\b/i.test(name)||(/apple/i.test(maker)&&/^A(1418|1419|1311|1312)$/i.test(name)))return 'All-in-one computer';
 if(/\b(thinkpad|ideapad|thinkbook|latitude|probook|elitebook|satellite|tecra|portege|lifebook|travelmate|vivobook|zenbook|macbook|chromebook)\b/i.test(name)||(/^(lenovo|dell)$/i.test(maker)&&/^G15\b/i.test(name)))return 'Laptop';
 if(/\b(thinkvision|TIO24D)\b/i.test(name))return 'Monitor';
 if(/\b(laserjet|officejet|deskjet|pixma)\b/i.test(name))return 'Printer';
 const matching=facts.filter(f=>String(f.model||'').trim().toLowerCase()===name.toLowerCase()&&String(f.manufacturer||'').trim().toLowerCase()===maker.toLowerCase()&&!(f.recognitionNeedsReview&&!f.recognitionConfirmed));
 const references=matching.filter(f=>f.source!=='Saved equipment');
 const types=new Set((references.length?references:matching).map(f=>normalizeEquipmentDescription(f.description)).filter(Boolean));
 return types.size===1?[...types][0]:null;
}

// Repairs use the saved model/maker; they never replace equipment identity with a serial guess.
export function equipmentDescriptionPlan(items,trolleys,facts=[]) {
 const changes=[],skipped={locked:0,unknown:0,unchanged:0};
 for(const item of items){
  const type=suggestEquipmentDescription(item.model,item.manufacturer,facts);
  if(!type){skipped.unknown++;continue;}
  if(normalizeEquipmentDescription(item.description)===type){skipped.unchanged++;continue;}
  const matches=item.trolleyId?trolleys.filter(t=>t.id===item.trolleyId):trolleys.filter(t=>t.name===item.trolley);
  if(matches.length!==1||matches[0].status!=='open'){skipped.locked++;continue;}
  changes.push({before:structuredClone(item),after:{...structuredClone(item),description:type},selected:/^monitor$/i.test(item.description.trim())});
 }
 return {changes,skipped};
}
