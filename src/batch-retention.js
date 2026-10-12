export const retentionFields=[['date','Disposal date'],['description','Equipment description'],['manufacturer','Manufacturer'],['source','Taken from'],['reason','Reason for disposal']];
export const defaultRetention={date:true,description:false,manufacturer:false,source:true,reason:true};
export function retentionSettings(settings={}){
 if(settings.keepFields===undefined)return settings.keepBatchDefaults===true?Object.fromEntries(retentionFields.map(([key])=>[key,true])):{...defaultRetention};
 const value=settings.keepFields;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==retentionFields.length||retentionFields.some(([key])=>typeof value[key]!=='boolean'))throw Error('Invalid batch retention configuration.');
 return Object.fromEntries(retentionFields.map(([key])=>[key,value[key]]));
}
export function nextBatchDefaults(batch,keep){return {...Object.fromEntries(retentionFields.map(([key])=>[key,keep[key]?batch[key]:''])),trolley:batch.trolley};}
