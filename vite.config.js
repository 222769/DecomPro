import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const {version}=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8'));
let revision=process.env.GITHUB_SHA||'';
if(!revision){try{revision=execFileSync('git',['rev-parse','--short=7','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{revision='';}}
const buildNumber=/^\d+$/.test(process.env.GITHUB_RUN_NUMBER||'')?process.env.GITHUB_RUN_NUMBER:'local';
const builtAt=new Date().toISOString();

// Relative URLs support a custom domain and the GitHub Pages project path.
// Pin the two inline startup scripts to their exact content, keeping arbitrary
// inline JavaScript blocked while recovery needs no additional network request.
export default defineConfig({ base: './', define:{__APP_VERSION__:JSON.stringify(version),__APP_BUILD_NUMBER__:JSON.stringify(buildNumber),__APP_REVISION__:JSON.stringify(/^[0-9a-f]{7,40}$/i.test(revision)?revision.slice(0,7):'unknown'),__APP_BUILT_AT__:JSON.stringify(builtAt)}, plugins: [{
 name:'startup-script-policy',
 transformIndexHtml:{order:'post',handler(html){
  const hashes=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
   .filter(match=>match[1].trim())
   .map(match=>`'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
  return html.replace("script-src 'self';",`script-src 'self' ${hashes.join(' ')};`);
 }}
}] });
