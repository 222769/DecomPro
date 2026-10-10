const methods=['exact','pattern','similar','conflict'];
const text=(value,max=1000)=>typeof value==='string'&&value.length<=max;
export function validateEvidence(value) {
 if(!value||!methods.includes(value.method)||!['exact','pattern','similar'].includes(value.basis)||!text(value.prefix,200)||!Number.isInteger(value.support)||value.support<1||!text(value.model)||!text(value.manufacturer)||!Array.isArray(value.sources)||value.sources.length>12||value.sources.some(s=>!text(s)||!s.trim())||!Number.isInteger(value.sourceCount)||value.sourceCount<value.sources.length||!Array.isArray(value.referenceSerials)||value.referenceSerials.length>8||value.referenceSerials.some(s=>!text(s,200)))throw Error('Invalid recognition evidence in captured progress.');
 return {method:value.method,basis:value.basis,prefix:value.prefix,support:value.support,model:value.model,manufacturer:value.manufacturer,sources:[...value.sources],sourceCount:value.sourceCount,referenceSerials:[...value.referenceSerials]};
}
export function snapshotEvidence(match) {
 const sources=[...new Set((match.sources||(match.source||'Reference library').split(' | ')).filter(Boolean))];
 return validateEvidence({method:match.method,basis:match.basis||match.method,prefix:match.prefix||'',support:match.support,model:match.model||'',manufacturer:match.manufacturer||'',sources:sources.slice(0,12).map(s=>s.slice(0,1000)),sourceCount:sources.length,referenceSerials:(match.referenceSerials||[]).slice(0,8)});
}
export function sourceKinds(sources) {
 const kinds=new Set();for(const source of sources){if(/reviewed reference correction/i.test(source))kinds.add('Reviewed correction');if(/saved equipment|confirmed record/i.test(source))kinds.add('Saved equipment');if(/summer 2026 reference/i.test(source))kinds.add('Built-in Excel');else if(/excel/i.test(source))kinds.add('Imported Excel');}
 return [...kinds].length?[...kinds]:['Reference library'];
}
