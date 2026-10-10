export const handoverLimit=6;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export const handoverReference=id=>`COL-${id.replaceAll('-','').toUpperCase()}`;
export function validateHandoverLink(value) {
 if(!value||Object.keys(value).some(key=>!['id','trolleyIds'].includes(key))||!uuid(value.id)||!Array.isArray(value.trolleyIds)||!value.trolleyIds.length||value.trolleyIds.length>handoverLimit||value.trolleyIds.some(id=>!uuid(id))||value.id!==value.trolleyIds[0]||new Set(value.trolleyIds).size!==value.trolleyIds.length)throw Error('Invalid collection handover reference.');
 return {id:value.id,trolleyIds:[...value.trolleyIds]};
}
export function createHandover(trolleyIds,company,collectedAt) {
 if(typeof company!=='string'||!company.trim()||company.trim().length>100||typeof collectedAt!=='string'||!Number.isFinite(Date.parse(collectedAt)))throw Error('Enter the collection company and a valid collection date and time.');
 // A trolley can be collected once. Anchoring the pack to its first trolley
 // prevents reusing that reference for a different collection group.
 const link=validateHandoverLink({id:trolleyIds[0],trolleyIds});
 return {...link,company:company.trim(),collectedAt:new Date(collectedAt).toISOString()};
}
export function handoverGroups(trolleys) {
 const groups=new Map();
 for(const trolley of trolleys)if(trolley.handover){
  const {id,trolleyIds}=validateHandoverLink(trolley.handover);
  if(!groups.has(id))groups.set(id,{id,reference:handoverReference(id),trolleyIds,company:trolley.company,collectedAt:trolley.collectedAt,collectedBy:trolley.collectedBy,trolleys:[]});
  groups.get(id).trolleys.push(trolley);
 }
 return [...groups.values()].map(group=>({...group,complete:group.trolleyIds.length===group.trolleys.length&&group.trolleys.every(t=>t.status==='collected'&&t.company===group.company&&t.collectedAt===group.collectedAt&&t.collectedBy===group.collectedBy&&JSON.stringify(t.handover.trolleyIds)===JSON.stringify(group.trolleyIds))})).sort((a,b)=>b.collectedAt.localeCompare(a.collectedAt));
}
