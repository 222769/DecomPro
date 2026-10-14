import test from 'node:test';
import assert from 'node:assert/strict';
import {readDevicePreferences,saveDevicePreferences,idleExpired} from '../../src/device-preferences.js';
test('device defaults reject unsupported lock periods and corrupt stored settings; no passwords are saved',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 assert.equal(readDevicePreferences(storage).remember,false);assert.equal(readDevicePreferences(storage).idleMinutes,5);
 assert.equal(readDevicePreferences(storage).showSustainability,true);
 const value=saveDevicePreferences({idleMinutes:15,remember:true,password:'do-not-store',showDailyProgress:true},storage);assert.equal(value.idleMinutes,15);assert.equal([...values.values()][0].includes('do-not-store'),false);
 assert.equal(saveDevicePreferences({idleMinutes:60,remember:'true'},storage).idleMinutes,5);assert.equal(readDevicePreferences(storage).remember,false);
 assert.equal(saveDevicePreferences({showSustainability:false},storage).showSustainability,false);assert.equal(readDevicePreferences(storage).showSustainability,false);
});
test('inactivity threshold includes the boundary and ignores future activity times',()=>{assert.equal(idleExpired(0,299999,5),false);assert.equal(idleExpired(0,300000,5),true);assert.equal(idleExpired(400000,300000,5),false);});

test('Never persists and never expires regardless of elapsed inactivity',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 assert.equal(saveDevicePreferences({idleMinutes:0},storage).idleMinutes,0);
 assert.equal(readDevicePreferences(storage).idleMinutes,0);
 assert.equal(idleExpired(0,0,0),false);assert.equal(idleExpired(0,30*24*60*60000,0),false);
});
