import test from 'node:test';import assert from 'node:assert/strict';import {sortRegister} from '../../src/register-sort.js';
test('natural sorting handles equipment, serials, assets, trolleys, dates and scan order without mutating records',()=>{
 const items=[{id:'a',serial:'S10',asset:'A0010',trolley:'Trolley 10',date:'2026-01-02',description:'Monitor',manufacturer:'Dell',model:'P10'},{id:'b',serial:'S2',asset:'A0002',trolley:'Trolley 2',date:'2025-12-31',description:'Laptop',manufacturer:'Lenovo',model:'G15'}],original=JSON.stringify(items);
 for(const key of ['serial','asset','trolley','date','equipment']){assert.deepEqual(sortRegister(items,items,{key}).map(i=>i.id),['b','a']);assert.deepEqual(sortRegister(items,items,{key,direction:'descending'}).map(i=>i.id),['a','b']);}
 assert.deepEqual(sortRegister(items,items,{key:'scan',direction:'descending'}).map(i=>i.id),['b','a']);assert.equal(JSON.stringify(items),original);
});
test('equal values retain scan order and filtering retains original numbering',()=>{
 const items=[{id:'a',technician:'JA'},{id:'b',technician:'ja'},{id:'c',technician:'MA'}];assert.deepEqual(sortRegister(items,items,{key:'technician',direction:'descending'}).map(i=>i.id),['c','a','b']);assert.deepEqual(sortRegister([items[2],items[0]],items,{key:'scan'}).map(i=>i.id),['a','c']);
});
