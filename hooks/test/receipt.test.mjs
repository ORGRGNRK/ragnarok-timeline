import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {normalize,sanitize,append} from '../receipt.mjs';import {redact} from '../redact.mjs';
test('explicit actor and real exit; missing exit stays unknown',()=>{
 const event={tool_name:'Bash',session_id:'s',tool_input:{command:'pwd'},tool_response:{exit_code:2}};
 const result=normalize(event,'Codex');assert.equal(result.actor,'Codex');assert.equal(result.exit_code,2);assert.equal(result.kind,'Read');
 assert.equal(normalize({...event,tool_response:{}},'Codex').exit_code,null);assert.throws(()=>normalize(event,''));
});
test('file patches store paths but not source',()=>{
 const event={tool_name:'apply_patch',tool_input:{command:'*** Begin Patch\n*** Add File: demo.swift\n+PRIVATE SOURCE\n*** End Patch'}};
 const r=normalize(event,'Codex');assert.deepEqual(r.paths,['demo.swift']);assert.doesNotMatch(JSON.stringify(r),/PRIVATE SOURCE/);
});
test('MCP UI reads and unknown tools exclude arguments and results',()=>{
 for(const tool_name of ['mcp__cua_repl__js','Read','some_unknown_tool']) {
  const r=normalize({tool_name,tool_input:{code:'PRIVATE INPUT'},tool_response:{content:'PRIVATE OUTPUT'}},'Claude Code');
  assert.equal(r.tool,tool_name);assert.doesNotMatch(JSON.stringify(r),/PRIVATE INPUT|PRIVATE OUTPUT/);assert.equal(r.exit_code,null);
 }
});
test('Gemini and Antigravity shapes',()=>{
 const gem=normalize({hook_event_name:'AfterTool',tool_name:'run_shell_command',tool_input:{command:'ls'}},'Gemini CLI');assert.equal(gem.kind,'Read');
 const agy=normalize({toolCall:{name:'run_command',args:{CommandLine:'false'}},conversationId:'a',error:'FAILED'},'Antigravity');assert.equal(agy.session,'a');assert.equal(agy.status,'Failed');
});
test('redact before truncation and recursive values',()=>{
 const key='sk-proj-'+'A'.repeat(32);const r=sanitize({command:'echo '+key,nested:['secret_value']},{API_KEY:'secret_value'});
 assert.doesNotMatch(JSON.stringify(r),new RegExp(key+'|secret_value'));assert.equal(redact('password=abcdef',{}),'[redacted]');
});
test('collector private storage and fail-open malformed input',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'timeline-hook-'));
 try {
  append(sanitize(normalize({tool_name:'Bash',tool_input:{command:'pwd'},tool_response:{exit_code:0}},'Codex')),folder);
  const file=path.join(folder,'events.jsonl');assert.equal(fs.statSync(file).mode&0o777,0o600);assert.equal(fs.statSync(folder).mode&0o777,0o700);
  const p=spawnSync(process.execPath,[path.resolve('hooks/receipt.mjs'),'--actor','Codex'],{input:'invalid',env:{...process.env,TIMELINE_DATA_DIR:folder},encoding:'utf8'});
  assert.equal(p.status,0);assert.equal(p.stdout,'');assert.equal(p.stderr,'');assert.ok(fs.existsSync(path.join(folder,'hook-error.json')));
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('collector rejects symlink event file',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'timeline-link-'));
 try{const other=path.join(folder,'outside');fs.writeFileSync(other,'unchanged');fs.symlinkSync(other,path.join(folder,'events.jsonl'));assert.throws(()=>append({},folder));assert.equal(fs.readFileSync(other,'utf8'),'unchanged');}
 finally{fs.rmSync(folder,{recursive:true,force:true});}
});
