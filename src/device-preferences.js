export const devicePreferenceKey='decompro.devicePreferences';
export const defaultDevicePreferences={idleMinutes:5,remember:false,showDailyProgress:false,showCollections:false};
export function validateDevicePreferences(value={}) {
 return {idleMinutes:[5,10,15,30].includes(value.idleMinutes)?value.idleMinutes:5,remember:value.remember===true,showDailyProgress:value.showDailyProgress===true,showCollections:value.showCollections===true};
}
export function readDevicePreferences(storage) {try{return validateDevicePreferences(JSON.parse((storage||localStorage).getItem(devicePreferenceKey)||'{}'));}catch{return {...defaultDevicePreferences};}}
export function saveDevicePreferences(value,storage=localStorage){const next=validateDevicePreferences(value);storage.setItem(devicePreferenceKey,JSON.stringify(next));return next;}
export function idleExpired(lastActivity,now,minutes){return Number.isFinite(lastActivity)&&now-lastActivity>=minutes*60000;}
