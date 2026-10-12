import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Fail before publishing if a favicon, app icon or manifest was omitted.
const files=['decompro-icon.svg','decompro-icon-32.png','decompro-icon-180.png','decompro-icon-192.png','decompro-icon-512.png','manifest.webmanifest'];
for(const file of files){
 const [source,built]=await Promise.all(['public','dist'].map(folder=>readFile(new URL(`../${folder}/${file}`,import.meta.url))));
 assert(source.length>0,`${file} is empty`);
 assert(source.equals(built),`${file} is missing or differs from its source in dist`);
}
const manifest=JSON.parse(await readFile(new URL('../dist/manifest.webmanifest',import.meta.url),'utf8'));
for(const icon of manifest.icons)assert(files.includes(icon.src.replace(/^\.\//,'')),`Unverified app icon: ${icon.src}`);
console.log('Verified favicon, app icons and manifest in the deployment artifact.');
