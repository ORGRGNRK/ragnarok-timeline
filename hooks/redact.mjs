import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export function redact(text, environment=process.env, literals=[]) {
  let out=String(text ?? '');
  const exact=[...literals,...Object.entries(environment).filter(([k,v])=>/key|token|secret|pass|credential|auth/i.test(k) && typeof v==='string' && v.length>=8 && !v.startsWith('/')).map(([,v])=>v)];
  for(const value of exact.sort((a,b)=>b.length-a.length))if(value.length>=6)out=out.split(value).join('[redacted]');
  const rules=[
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
    /\b(?:sk-(?:ant-|proj-|svcacct-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|xox[abprs]-[A-Za-z0-9-]{10,}|xai-[A-Za-z0-9]{20,}|hf_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,})\b/g,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    /(?:authorization\s*:\s*(?:bearer|basic|token)?\s*|\bbearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi,
    /\b[A-Za-z0-9_]*(?:password|passwd|pwd|secret|token|api[_-]?key|credential|cookie)[A-Za-z0-9_]*\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s;&|,}]+)/gi,
    /--?(?:password|passwd|token|api-?key|secret|auth|client-secret|private-key)(?:=|\s+)(?:"[^"]*"|'[^']*'|[^\s;&|]+)/gi,
    /(:\/\/)[^\s:/@]+:[^\s@/]+(?=@)/g
  ];
  for(const rule of rules)out=out.replace(rule,'[redacted]');
  return out;
}
export function extraLiterals(folder) {
  try{return fs.readFileSync(path.join(folder,'scrub-values'),'utf8').split('\n').map(s=>s.trim()).filter(s=>s.length>=6&&!s.startsWith('#'));}catch{return [];}
}
export const defaultFolder=()=>path.join(os.homedir(),'Library','Application Support','Ragnarok Timeline');
