import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';

// Relative URLs support a custom domain and the GitHub Pages project path.
// Pin the two inline startup scripts to their exact content, keeping arbitrary
// inline JavaScript blocked while recovery needs no additional network request.
export default defineConfig({ base: './', plugins: [{
 name:'startup-script-policy',
 transformIndexHtml:{order:'post',handler(html){
  const hashes=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
   .filter(match=>match[1].trim())
   .map(match=>`'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
  return html.replace("script-src 'self';",`script-src 'self' ${hashes.join(' ')};`);
 }}
}] });
