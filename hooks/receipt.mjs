#!/usr/bin/env node
// Local post-tool observer. No network, database, subprocesses, file contents, or tool outputs are stored.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {classify} from './classify.mjs';
import {redact,extraLiterals,defaultFolder} from './redact.mjs';
const allowed=new Set(['Claude Code','Codex','Gemini CLI','Grok CLI','Antigravity']);
const shellTools=new Set(['Bash','Shell','run_shell_command','run_terminal_command','run_terminal_cmd','run_command','exec_command']);
const readTools=new Set(['Read','read_file','view_file','list_directory','Glob','Grep']);
const fileTools=new Set(['Write','Edit','MultiEdit','NotebookEdit','apply_patch','write_file','create_file','replace','write_to_file','replace_file_content','multi_replace_file_content','delete_file','edit_file','search_replace','StrReplace']);
export function normalize(event,actor,environment={}) {
  if(!allowed.has(actor))throw new Error('Explicit supported actor required');
  const agy=event.toolCall && typeof event.toolCall==='object';
  const name=(agy?event.toolCall.name:event.tool_name??event.toolName) || 'unknown';
  const input=(agy?event.toolCall.args:event.tool_input??event.toolInput) || {};
  const response=event.tool_response??event.toolResponse??event.tool_output??event.toolOutput;
  const failure=/failure/i.test(event.hook_event_name??event.hookEventName??'') || Boolean(event.error) || Boolean(response?.is_error||response?.isError||response?.interrupted);
  const cwd=event.cwd??input.cwd??input.working_directory??input.Cwd??event.workspacePaths?.[0]??null;
  let exit=null;
  if(response && typeof response==='object') {
    const candidate=response.exit_code??response.exitCode??response.returncode??response.return_code;
    if(typeof candidate==='number' && Number.isFinite(candidate))exit=candidate;
  }
  const result={rid:randomUUID(),at:new Date().toISOString(),actor,source:'timeline-posttooluse',tool:String(name),
    session:event.session_id??event.sessionId??event.conversationId??environment.CODEX_THREAD_ID??null,
    cwd,host:'mac',exit_code:exit,status:failure?'Failed':'Reported',attribution:'Installer-specified actor; not an authenticated identity',kind:'Tool',command:String(name)};
  if(shellTools.has(name)) {
    result.command=String(input.command??input.CommandLine??'');
    // A classifier estimate is not proof of a filesystem mutation or a read-only action.
    const guess=classify(result.command,cwd);
    result.kind=guess.kind;result.classification='Command heuristic, not enforcement or verified effects';
  } else if(name==='apply_patch') {
    const patch=String(input.patch??input.input??input.command??'');
    const paths=[...patch.matchAll(/^\*\*\*\s*(?:Update|Add|Delete) File:\s*(.+)$/gm)].map(m=>m[1]);
    result.kind='Change';result.command='apply_patch '+paths.length+' file(s) (patch contents not logged)';result.paths=paths;
  } else if(readTools.has(name)||fileTools.has(name)) {
    const target=input.file_path??input.path??input.target_file??input.filePath??input.TargetFile??input.AbsolutePath??input.FilePath??input.notebook_path??null;
    result.kind=readTools.has(name)?'Read':'Change';
    result.command=String(name)+(target?' '+String(target):'')+' (contents not logged)';
  }
  // MCP and unknown tools: retain only name + metadata, never arbitrary arguments/results.
  return result;
}
export function sanitize(record,environment={},literals=[]) {
  if(typeof record==='string') {
    const clean=redact(record,environment,literals);
    return clean.length>8000?clean.slice(0,8000)+' …[truncated]':clean;
  }
  if(Array.isArray(record))return record.slice(0,100).map(v=>sanitize(v,environment,literals));
  if(record && typeof record==='object')return Object.fromEntries(Object.entries(record).map(([k,v])=>[k,sanitize(v,environment,literals)]));
  return record;
}
export function append(record,folder=defaultFolder()) {
  if(fs.existsSync(folder) && fs.lstatSync(folder).isSymbolicLink())throw new Error('Unsafe data directory');
  fs.mkdirSync(folder,{recursive:true,mode:0o700});fs.chmodSync(folder,0o700);
  const file=path.join(folder,'events.jsonl');
  if(fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())throw new Error('Unsafe event file');
  // Keep a rolling tail in the viewer; logging stops at 20 MiB rather than racing concurrent rotations.
  // Doctor reports this limit. User can archive the file while agents are stopped.
  if(fs.existsSync(file) && fs.statSync(file).size>=20*1024*1024)throw new Error('Event file capacity reached');
  fs.appendFileSync(file,JSON.stringify(record)+'\n',{mode:0o600});fs.chmodSync(file,0o600);
}
async function main() {
  const actor=process.argv[process.argv.indexOf('--actor')+1];
  let size=0;const chunks=[];
  for await(const chunk of process.stdin){size+=chunk.length;if(size>1_048_576)throw new Error('Oversize hook input');chunks.push(chunk);}
  const folder=process.env.TIMELINE_DATA_DIR || defaultFolder();
  const event=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  append(sanitize(normalize(event,actor,process.env),process.env,extraLiterals(folder)),folder);
}
if(process.argv[1] && fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(()=>{
    // Fail open without exposing raw error payloads or interrupting an agent.
    // A small separate diagnostic file makes dropped observations discoverable.
    try {
      const folder=process.env.TIMELINE_DATA_DIR || defaultFolder();
      if(fs.existsSync(folder) && !fs.lstatSync(folder).isSymbolicLink()) {
        const file=path.join(folder,'hook-error.json');
        if(!fs.existsSync(file)||!fs.lstatSync(file).isSymbolicLink()) {
          fs.writeFileSync(file,JSON.stringify({at:new Date().toISOString(),message:'A hook record was not saved. Run the doctor and check storage/configuration.'})+'\n',{mode:0o600});
          fs.chmodSync(file,0o600);
        }
      }
    }catch{}
  });
}
