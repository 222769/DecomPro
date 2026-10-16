const key='decompro.appearance';
const choices=['light','dark','deep','system'];
let preference='light';
try {const stored=localStorage.getItem(key);if(choices.includes(stored))preference=stored;}catch{}
const media=window.matchMedia('(prefers-color-scheme: dark)');
let preview=null;
export const themePreference=()=>preference;
export function previewTheme(value=null) {
 preview=choices.includes(value)?value:null;
 const selected=preview||preference,dark=selected==='dark'||selected==='deep'||selected==='system'&&media.matches;
 document.documentElement.dataset.theme=dark?'dark':'light';
 if(selected==='deep')document.documentElement.dataset.themeVariant='deep';
 else delete document.documentElement.dataset.themeVariant;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',selected==='deep'?'#03070e':dark?'#0b1220':'#f4f6fa');
}
export function saveTheme(value) {
 if(!choices.includes(value))throw Error('Choose a valid appearance.');
 // Keep equipment records and backups separate from this device preference.
 localStorage.setItem(key,value);preference=value;previewTheme();
}
media.addEventListener('change',()=>previewTheme(preview));
previewTheme();
