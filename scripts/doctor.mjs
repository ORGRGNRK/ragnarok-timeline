#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {dataFolder} from './hooks.mjs';
const folder=dataFolder(os.homedir()),manifest=path.join(folder,'install.json'),events=path.join(folder,'events.jsonl');
console.log('Ragnarok Timeline setup check (local only; no network or agent requests)');
console.log('Node:',process.versions.node);
if(!fs.existsSync(manifest)){console.log('No installed hooks. Run ./install.sh with the desired agents.');process.exitCode=1;}
else {
 const data=JSON.parse(fs.readFileSync(manifest,'utf8'));
 console.log('Owned hook handlers:',data.handlers?.length||0);
 for(const h of data.handlers||[]) {
  let found=false;try{const d=JSON.parse(fs.readFileSync(h.config,'utf8'));found=d.hooks?.[h.event]?.some(g=>g.hooks?.some(x=>x.command===h.command));}catch{}
  console.log(path.basename(path.dirname(h.config))+' '+h.event+': '+(found?'configured (agent review/load not verified)':'MISSING'));if(!found)process.exitCode=1;
 }
}
if(fs.existsSync(events)) {
 const st=fs.statSync(events);console.log('Event file bytes:',st.size,'permissions:',(st.mode&0o777).toString(8));
 if(st.size>=20*1024*1024){console.log('CAPACITY REACHED: stop agents, archive events.jsonl, then restart. Hooks fail open.');process.exitCode=1;}
 const rows=fs.readFileSync(events,'utf8').trim().split('\n');let last;try{last=JSON.parse(rows.at(-1))}catch{}
 console.log('Last event:',last?.at??'none','actor:',last?.actor??'unknown');
}else console.log('No events yet. Run a command through a supported agent after restarting it.');
const error=path.join(folder,'hook-error.json');
if(fs.existsSync(error)){console.log('A hook failure was recorded. Inspect hook-error.json; no raw payloads were saved.');process.exitCode=1;}
const hook=path.join(folder,'hooks/receipt.mjs');
if(fs.existsSync(hook)) {
 const p=spawnSync(process.execPath,['--check',hook],{encoding:'utf8'});
 console.log('Installed hook syntax:',p.status===0?'valid':'INVALID');if(p.status!==0)process.exitCode=1;
}
