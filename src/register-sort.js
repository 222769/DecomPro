export const registerColumns=[['scan','No.'],['equipment','Equipment / model'],['serial','Serial number'],['asset','Asset number'],['trolley','Trolley'],['technician','Technician'],['date','Disposal date']];
const collator=new Intl.Collator('en-GB',{numeric:true,sensitivity:'base'});
export function sortRegister(items,allItems,{key='scan',direction='ascending'}={}){
 const order=new Map(allItems.map((item,index)=>[item.id,index]));
 const value=item=>key==='equipment'?[item.description,item.manufacturer,item.model].join(' '):item[key]||'';
 const sign=direction==='descending'?-1:1;
 return [...items].sort((a,b)=>{
  const comparison=key==='scan'?(order.get(a.id)??0)-(order.get(b.id)??0):collator.compare(value(a),value(b));
  return comparison*sign||((order.get(a.id)??0)-(order.get(b.id)??0));
 });
}
