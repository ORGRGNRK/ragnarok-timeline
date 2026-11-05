import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {install,uninstall,dataFolder} from '../../scripts/hooks.mjs';
const source=path.resolve('.');
test('install twice, preserve existing hooks and remove only owned handlers',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'timeline-home-'));
 try{
  const config=path.join(home,'.codex/hooks.json');fs.mkdirSync(path.dirname(config),{recursive:true});
  fs.writeFileSync(config,JSON.stringify({other:'keep',hooks:{PostToolUse:[{matcher:'Bash',hooks:[{type:'command',command:'echo keep'}]}]}}));
  install({home,source,agents:['codex','claude']});install({home,source,agents:['codex','claude']});
  let d=JSON.parse(fs.readFileSync(config));assert.equal(d.other,'keep');assert.equal(d.hooks.PostToolUse.length,2);
  assert.match(d.hooks.PostToolUse[1].hooks[0].command,/--actor 'Codex'/);assert.equal(d.hooks.PostToolUse[1].matcher,'.*');
  d.hooks.Stop=[{hooks:[{type:'command',command:'new unrelated'}]}];fs.writeFileSync(config,JSON.stringify(d));
  fs.writeFileSync(path.join(dataFolder(home),'events.jsonl'),'retained');uninstall({home});
  d=JSON.parse(fs.readFileSync(config));assert.equal(d.hooks.PostToolUse.length,1);assert.equal(d.hooks.Stop[0].hooks[0].command,'new unrelated');
  assert.equal(fs.readFileSync(path.join(dataFolder(home),'events.jsonl'),'utf8'),'retained');
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('invalid existing config is left untouched',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'timeline-bad-'));
 try{const p=path.join(home,'.codex/hooks.json');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'bad');assert.throws(()=>install({home,source,agents:['codex']}));assert.equal(fs.readFileSync(p,'utf8'),'bad');}
 finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('paths with spaces and single quotes produce usable hook command',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),"timeline ' quote-"));
 try{install({home,source,agents:['codex']});const d=JSON.parse(fs.readFileSync(path.join(home,'.codex/hooks.json')));assert.match(d.hooks.PostToolUse[0].hooks[0].command,/'\\''/);
 const result=spawnSync('/bin/bash',['-c',d.hooks.PostToolUse[0].hooks[0].command],{input:JSON.stringify({tool_name:'Bash',tool_input:{command:'pwd'},tool_response:{exit_code:0},session_id:'fixture'}),env:{...process.env,TIMELINE_DATA_DIR:dataFolder(home)},encoding:'utf8'});
 assert.equal(result.status,0);assert.equal(JSON.parse(fs.readFileSync(path.join(dataFolder(home),'events.jsonl'),'utf8')).actor,'Codex');}
 finally{fs.rmSync(home,{recursive:true,force:true});}
});
