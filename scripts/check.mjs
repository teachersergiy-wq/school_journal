import{readFile}from'node:fs/promises';
import{spawnSync}from'node:child_process';
const files=['src/main.js','src/data.js','src/data/supabase-client.js','src/data/supabase-repository.js','scripts/env.mjs','scripts/build.mjs','scripts/dev-server.mjs','scripts/preview-server.mjs'];
for(const f of files){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw Error(f+': '+(r.stderr||r.stdout));}
const data=await readFile('src/data.js','utf8');
for(const field of['not_done','hasNotebook','hasTextbook','notTakingNotes','boardRefused','behavior','exits','assessments','isAbsent'])if(!data.includes(field))throw Error('Missing lesson field: '+field);
const html=await readFile('index.html','utf8'),main=await readFile('src/main.js','utf8');
if(!html.includes('manifest.webmanifest')||!main.includes('serviceWorker.register'))throw Error('PWA references missing');
const csp=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1]??'';
for(const directive of["default-src 'self'","base-uri 'self'","form-action 'self'","img-src 'self' data:","connect-src 'self'"])if(!csp.includes(directive))throw Error('CSP directive missing: '+directive);
if(/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(html)||/\son[a-z]+\s*=/i.test(html))throw Error('Inline scripts and event handlers are not allowed.');
console.log('Syntax, contract, and CSP checks passed ('+files.length+' JS modules checked).');