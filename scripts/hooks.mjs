#!/usr/bin/env node
// Installs only this app's post-tool handlers. Merges existing JSON and removes only exact owned handlers.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
export const dataFolder=home=>path.join(home,'Library','Application Support','Ragnarok Timeline');
export const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
const specs={
  claude:{config:'.claude/settings.json',actor:'Claude Code',events:['PostToolUse','PostToolUseFailure']},
  codex:{config:'.codex/hooks.json',actor:'Codex',events:['PostToolUse']},
  gemini:{config:'.gemini/settings.json',actor:'Gemini CLI',events:['AfterTool']}
};
function read(p){if(!fs.existsSync(p))return {};if(fs.lstatSync(p).isSymbolicLink())throw new Error('Refusing symlink configuration');return JSON.parse(fs.readFileSync(p,'utf8'));}
function write(p,d){fs.mkdirSync(path.dirname(p),{recursive:true,mode:0o700});const tmp=p+'.timeline-'+process.pid;fs.writeFileSync(tmp,JSON.stringify(d,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,p);fs.chmodSync(p,0o600);}
export function install({home=os.homedir(),agents=['claude','codex'],source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),node=process.execPath}={}) {
  for(const agent of agents)if(!specs[agent])throw new Error('Unknown agent: '+agent);
  const folder=dataFolder(home),dest=path.join(folder,'hooks');
  if(fs.existsSync(folder)&&fs.lstatSync(folder).isSymbolicLink())throw new Error('Unsafe data directory');
  const planned=agents.map(agent=>({agent,spec:specs[agent],config:path.join(home,specs[agent].config)}));
  // Parse every config before any mutation; an invalid JSON file must not be overwritten.
  for(const plan of planned){plan.data=read(plan.config);if(plan.data.hooks && (typeof plan.data.hooks!=='object'||Array.isArray(plan.data.hooks)))throw new Error('Invalid hooks object');}
  for(const plan of planned)for(const event of plan.spec.events) {
    const groups=plan.data.hooks?.[event];
    if(groups!==undefined&&(!Array.isArray(groups)||groups.some(g=>!g||!Array.isArray(g.hooks))))throw new Error('Invalid event handler groups; configuration unchanged');
  }
  if(fs.existsSync(dest)&&fs.lstatSync(dest).isSymbolicLink())throw new Error('Unsafe hook directory');
  fs.mkdirSync(dest,{recursive:true,mode:0o700});fs.chmodSync(folder,0o700);
  for(const file of ['receipt.mjs','classify.mjs','redact.mjs']) {
    const target=path.join(dest,file);if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw new Error('Unsafe hook path');
    fs.copyFileSync(path.join(source,'hooks',file),target);fs.chmodSync(target,0o600);
  }
  const manifestFile=path.join(folder,'install.json'),manifest=read(manifestFile);
  manifest.handlers ||= [];
  for(const {agent,spec,config,data} of planned) {
    const command=quote(node)+' '+quote(path.join(dest,'receipt.mjs'))+' --actor '+quote(spec.actor);
    data.hooks ||= {};
    const owned={type:'command',command,timeout:10};
    for(const event of spec.events) {
      data.hooks[event] ||= [];
      if(!Array.isArray(data.hooks[event]))throw new Error('Invalid event handlers');
      const already=data.hooks[event].some(group=>group.hooks?.some(h=>h.command===command));
      if(!already)data.hooks[event].push({matcher:'.*',hooks:[owned]});
      if(!manifest.handlers.some(h=>h.config===config&&h.event===event&&h.command===command))manifest.handlers.push({config,event,command});
    }
    if(fs.existsSync(config)){const backup=config+'.before-timeline-'+Date.now()+'.json';fs.copyFileSync(config,backup);fs.chmodSync(backup,0o600);}
    write(config,data);
  }
  write(manifestFile,manifest);
  return {agents,folder};
}
export function uninstall({home=os.homedir()}={}) {
  const folder=dataFolder(home),manifestFile=path.join(folder,'install.json'),manifest=read(manifestFile);
  for(const config of new Set((manifest.handlers||[]).map(h=>h.config))) {
    // A modified manifest cannot direct the uninstaller to arbitrary files.
    if(!Object.values(specs).some(spec=>config===path.join(home,spec.config)))throw new Error('Unexpected config path');
    if(!fs.existsSync(config))continue;
    const data=read(config);
    for(const owned of manifest.handlers.filter(h=>h.config===config)) {
      if(!Array.isArray(data.hooks?.[owned.event]))continue;
      data.hooks[owned.event]=data.hooks[owned.event].map(group=>({...group,hooks:(group.hooks||[]).filter(h=>h.command!==owned.command)})).filter(group=>group.hooks.length);
      if(!data.hooks[owned.event].length)delete data.hooks[owned.event];
    }
    write(config,data);
  }
  // Keep logs, backups and hook scripts: a running client may still have cached its old handler.
  write(manifestFile,{handlers:[]});
  return {folder,message:'Hooks removed from configuration. Restart agents. Local records, backups and scripts retained.'};
}
if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const mode=process.argv[2];
    if(mode==='install')console.log(JSON.stringify(install({agents:process.argv.slice(3).length?process.argv.slice(3):['claude','codex']}),null,2));
    else if(mode==='uninstall')console.log(uninstall().message);
    else throw new Error('Usage: node scripts/hooks.mjs install [claude codex gemini] | uninstall');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
