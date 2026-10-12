import test from 'node:test';import assert from 'node:assert/strict';import {findRescanItem} from '../../src/trolley-rescan.js';
test('rescan requires a unique exact saved serial and preserves its saved identifiers',()=>{const row={id:'original',serial:'ABC001',model:'Model',manufacturer:'Maker',asset:'A0042',barcode:'000001'};const match=findRescanItem([row],' abc001 ');assert.deepEqual(match,row);assert.notEqual(match,row);for(const serial of ['ABC002','N/A',''])assert.throws(()=>findRescanItem([row],serial));assert.throws(()=>findRescanItem([row,{...row,id:'duplicate'}],'ABC001'),/More than one/);});
test('rescan finds an exact asset, including an item without a serial, without changing saved identifiers',()=>{
 const row={id:'asset-item',serial:'N/A',asset:'A0042',model:'Original',manufacturer:'Maker',barcode:'0001'};assert.deepEqual(findRescanItem([row],' a0042 '),row);assert.throws(()=>findRescanItem([row],'A004'),/not in/);assert.throws(()=>findRescanItem([row],'0042'),/not in/);assert.throws(()=>findRescanItem([row],'N/A'));
});
test('duplicate assets and serial-versus-asset collisions cannot choose the wrong record',()=>{
 const row={id:'one',serial:'SERIAL1',asset:'A0042'};assert.throws(()=>findRescanItem([row,{...row,id:'two',serial:'SERIAL2'}],'A0042'),/More than one/);assert.throws(()=>findRescanItem([row,{id:'two',serial:'A0042',asset:'A9999'}],'A0042'),/More than one/);assert.equal(findRescanItem([{...row,serial:'A0042'}],'A0042').id,'one');
});
test('barcode and security etch identify the original item, preserving leading zeros and punctuation',()=>{
 const row={id:'one',serial:'N/A',asset:'N/A',barcode:'0000123000',etch:'TSU-ETCH/0042'};
 for(const value of [' 0000123000 ',' tsu-etch/0042 '])assert.deepEqual(findRescanItem([row],value),row);
 for(const value of ['123000','UNKNOWN','none','-','N/A'])assert.throws(()=>findRescanItem([row],value));
});
test('shared or cross-field identifiers reject ambiguous records, while matches within one record count once',()=>{
 const row={id:'one',serial:'S1',asset:'A0042',barcode:'BC42',etch:'ETCH42'};
 for(const other of [{...row,id:'two',serial:'S2'},{id:'two',serial:'BC42'},{id:'two',asset:'ETCH42'}])assert.throws(()=>findRescanItem([row,other],other.asset==='ETCH42'?'ETCH42':'BC42'),/More than one/);
 assert.equal(findRescanItem([{...row,serial:'SAME',barcode:'SAME',etch:'SAME',asset:'SAME'}],'SAME').id,'one');
});
