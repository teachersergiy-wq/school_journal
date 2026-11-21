import{cp,mkdir,readFile,rm,writeFile}from'node:fs/promises';
import{loadEnv}from'./env.mjs';

const root=new URL('../',import.meta.url);
const out=new URL('../dist/',import.meta.url);
const config=await loadEnv();

if(!['mock','supabase'].includes(config.dataSource))throw Error('SJ_DATA_SOURCE must be mock or supabase');
if(config.dataSource==='supabase'){
  if(!config.supabaseUrl||!config.supabaseAnonKey)throw Error('SJ_SUPABASE_URL and SJ_SUPABASE_ANON_KEY are required when SJ_DATA_SOURCE=supabase.');
  let apiUrl;
  try{apiUrl=new URL(config.supabaseUrl);}catch{throw Error('SJ_SUPABASE_URL must be a valid HTTPS URL.');}
  if(apiUrl.protocol!=='https:'||apiUrl.username||apiUrl.password||apiUrl.pathname!=='/'||apiUrl.search||apiUrl.hash)throw Error('SJ_SUPABASE_URL must be the HTTPS project origin without a path.');
  config.supabaseUrl=apiUrl.origin;
}else{
  config.supabaseUrl='';
  config.supabaseAnonKey='';
}

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const entry of['index.html','app-config.js','manifest.webmanifest','service-worker.js','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','src'])await cp(new URL(entry,root),new URL(entry,out),{recursive:true});

const indexUrl=new URL('index.html',out);
let builtIndex=await readFile(indexUrl,'utf8');
if(config.dataSource==='supabase')builtIndex=builtIndex.replace("connect-src 'self'", "connect-src 'self' "+config.supabaseUrl);
await writeFile(indexUrl,builtIndex);
await writeFile(new URL('app-config.js',out), 'window.SCHOOL_JOURNAL_CONFIG = '+JSON.stringify(config,null,2)+String.fromCharCode(10));
console.log('Static PWA built in dist/ ('+config.dataSource+' data).');