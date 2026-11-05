// Command classification, same rules as Alexus's grok-receipt-log:
//   read-only allowlist           -> Kind=Read,   Action=Read,  Status=Observed (even on a nonzero exit)
//   anything else                 -> Kind=Change, Action=Created|Deleted|Updated,
//                                    Status=Failed only when the exit code is nonzero, else Observed
//   Record Ref                    -> host:<clean path of the target>, or host:<cwd>
// Change verbs / sub-verbs are the ones ~/scripts/ragnarok-change-hook.py already uses.
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();

const VERBS = new Set(["rm", "rmdir", "unlink", "shred", "mv", "cp", "chmod", "chown", "chgrp", "chattr", "setfacl", "ln",
  "mkdir", "touch", "truncate", "dd", "tee", "install", "kill", "pkill", "killall", "crontab", "rsync", "scp", "useradd",
  "usermod", "userdel", "groupadd", "passwd", "chsh", "dnf", "apt", "apt-get", "flatpak", "nmcli", "firewall-cmd",
  "restorecon", "ssh-keygen", "sudoedit", "ditto", "srm", "trash", "mktemp", "patch", "xattr", "pmset", "scutil",
  "networksetup", "diskutil", "hdiutil", "softwareupdate", "dscl", "osascript", "open"]);
const CONTAINER = new Set(["run", "rm", "rmi", "stop", "start", "restart", "kill", "create", "pull", "build", "update",
  "rename", "pause", "unpause", "commit", "tag", "push", "load", "import", "up", "down", "exec", "cp"]);
const SUBVERBS = {
  systemctl: new Set(["start", "stop", "restart", "try-restart", "reload", "reload-or-restart", "enable", "disable",
    "reenable", "mask", "unmask", "daemon-reload", "kill", "set-property", "edit", "reset-failed", "link", "preset",
    "isolate", "revert"]),
  launchctl: new Set(["load", "unload", "bootstrap", "bootout", "enable", "disable", "kickstart", "kill", "start", "stop",
    "remove", "submit"]),
  podman: CONTAINER, docker: CONTAINER, orb: new Set(["start", "stop", "restart", "create", "delete", "push", "pull"]),
  git: new Set(["commit", "push", "reset", "checkout", "switch", "rebase", "merge", "clean", "rm", "mv", "stash", "tag",
    "branch", "restore", "pull", "am", "apply", "cherry-pick", "revert", "init", "clone", "add", "fetch", "gc", "worktree"]),
  brew: new Set(["install", "uninstall", "upgrade", "reinstall", "tap", "untap", "services", "link", "unlink", "cleanup"]),
  npm: new Set(["install", "i", "uninstall", "ci", "update", "link", "publish"]),
  pip: new Set(["install", "uninstall"]), pip3: new Set(["install", "uninstall"]),
  tailscale: new Set(["up", "down", "set", "serve", "funnel", "logout"]),
  defaults: new Set(["write", "delete", "import"]),
  sed: new Set(["-i"]), perl: new Set(["-i", "-pi"]),
};
const DELETE = new Set(["rm", "rmdir", "unlink", "shred", "srm", "trash", "userdel", "git rm", "git clean", "brew uninstall",
  "npm uninstall", "pip uninstall", "pip3 uninstall", "defaults delete", "docker rm", "docker rmi", "orb delete",
  "curl DELETE", "find -delete"]);
const CREATE = new Set(["mkdir", "touch", "useradd", "groupadd", "git init", "git clone", "mktemp"]);
// Verbs whose plain (non-flag) arguments are file paths, even without a slash.
const PATH_VERBS = new Set(["rm", "rmdir", "unlink", "shred", "srm", "trash", "mv", "cp", "ln", "mkdir", "touch",
  "truncate", "tee", "install", "chattr", "setfacl", "ditto", "patch", "xattr", "rsync", "scp", "open"]);
const WRAPPERS = new Set(["sudo", "exec", "time", "nohup", "env", "command", "builtin", "nice", "caffeinate", "timeout", "noglob"]);
const SUDO_ARG_FLAGS = new Set(["-u", "-g", "-C", "-D", "-h", "-p", "-r", "-t", "-U"]);

// Read-only allowlist. A verb here never changes state (subcommand-gated tools are below).
const READ = new Set(["ls", "cat", "head", "tail", "less", "more", "grep", "egrep", "fgrep", "rg", "ag", "wc", "echo",
  "printf", "print", "pwd", "date", "cal", "which", "whence", "where", "type", "stat", "file", "du", "df", "ps", "pgrep",
  "top", "uptime", "whoami", "id", "groups", "env", "printenv", "uname", "sw_vers", "hostname", "cut", "sort", "uniq",
  "tr", "awk", "sed", "jq", "yq", "diff", "cmp", "comm", "md5", "md5sum", "shasum", "sha1sum", "sha256sum", "cksum",
  "test", "[", "[[", "true", "false", "sleep", "cd", "pushd", "popd", "export", "unset", "set", "setopt", "unsetopt",
  "local", "typeset", "declare", "read", "shift", "return", "exit", "alias", "unalias", "hash", "rehash", "readlink",
  "realpath", "basename", "dirname", "tree", "find", "fd", "lsof", "netstat", "ping", "dig", "nslookup", "host",
  "traceroute", "ifconfig", "route", "arp", "nc", "column", "fold", "fmt", "nl", "rev", "tac", "paste", "join", "expand",
  "seq", "yes", "xxd", "hexdump", "od", "strings", "otool", "nm", "codesign", "spctl", "mdls", "mdfind", "plutil",
  "system_profiler", "sysctl", "vm_stat", "iostat", "log", "last", "w", "who", "locale", "tput", "clear", "history",
  "fc", "man", "help", "info", "apropos", "zcat", "gzcat", "bzcat", "xzcat", "base64", "bc", "expr", "getconf", "sips",
  "lipo", "pbpaste", "time", "wait", "jobs", "let", "do", "done", "then", "fi", "else", "elif", "if", "for", "while",
  "until", "case", "esac", "in", "function", "{", "}", "!", "xargs", "tee-not", "csrutil", "ioreg", "pmset-g", "scselect",
  "security-find", "openssl-x509", "curl", "wget-spider", "http", "ssh-keyscan", "ssh-add-l", "nvram-p"]);
// Tools that are read-only only for these subcommands.
const READ_SUB = {
  git: new Set(["status", "log", "diff", "show", "rev-parse", "ls-files", "ls-tree", "blame", "remote", "describe",
    "shortlog", "reflog", "cat-file", "grep", "config", "branch", "tag", "for-each-ref", "show-ref", "rev-list",
    "name-rev", "whatchanged", "version", "help", "count-objects", "check-ignore", "var", "merge-base", "fsck"]),
  docker: new Set(["ps", "logs", "inspect", "images", "version", "info", "stats", "top", "port", "history", "events",
    "context", "network", "volume", "compose"]),
  brew: new Set(["list", "ls", "info", "search", "--prefix", "--version", "--cellar", "--repository", "config", "doctor",
    "outdated", "deps", "uses", "leaves", "desc", "home", "shellenv", "commands"]),
  npm: new Set(["ls", "list", "view", "info", "outdated", "config", "prefix", "root", "bin", "help", "search", "-v", "--version", "doctor", "audit"]),
  pip: new Set(["list", "show", "freeze", "--version", "check"]), pip3: new Set(["list", "show", "freeze", "--version", "check"]),
  launchctl: new Set(["list", "print", "print-disabled", "getenv", "blame", "dumpstate", "version"]),
  systemctl: new Set(["status", "cat", "list-units", "list-timers", "list-unit-files", "is-active", "is-enabled", "show"]),
  defaults: new Set(["read", "domains", "read-type", "find", "export"]),
  tailscale: new Set(["status", "ip", "ping", "version", "netcheck", "whois", "dns"]),
  kubectl: new Set(["get", "describe", "logs", "version", "config", "explain", "top", "api-resources"]),
  orb: new Set(["list", "ls", "info", "status", "version", "logs"]), orbctl: new Set(["list", "ls", "info", "status", "version"]),
  node: new Set(["--version", "-v"]), python3: new Set(["--version", "-V"]), python: new Set(["--version", "-V"]),
  security: new Set(["find-certificate", "list-keychains", "show-keychain-info", "dump-trust-settings"]),
  pmset: new Set(["-g"]), ssh: new Set(["-V", "-G"]), claude: new Set(["--version"]), grok: new Set(["--version"]),
  pm2: new Set(["list", "ls", "status", "logs", "show", "describe", "jlist", "prettylist", "monit"]),
  lms: new Set(["ls", "ps", "status", "version"]), tmux: new Set(["ls", "list-sessions", "list-windows", "capture-pane", "show-options"]),
  ollama: new Set(["list", "ls", "ps", "show", "--version"]),
};
const CURL_SENDS = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode", "--json", "-F", "--form",
  "-T", "--upload-file", "-o", "--output", "-O", "--remote-name"]);

/** Blank out quoted text so "echo 'rm -rf x'" is not a delete, but keep $( ... ) inside double quotes. */
function stripQuotes(cmd) {
  let out = "", i = 0;
  while (i < cmd.length) {
    const c = cmd[i];
    if (c === "\\" && i + 1 < cmd.length) { out += "__"; i += 2; continue; }
    if (c === "'") {
      const j = cmd.indexOf("'", i + 1);
      if (j < 0) { out += " Q "; break; }
      out += " Q "; i = j + 1; continue;
    }
    if (c === '"') {
      let j = i + 1, inner = "";
      while (j < cmd.length && cmd[j] !== '"') { if (cmd[j] === "\\") { inner += "__"; j += 2; continue; } inner += cmd[j]; j++; }
      const subs = inner.match(/\$\([^)]*\)|`[^`]*`/g);
      out += " Q " + (subs ? " ; " + subs.join(" ; ") + " ; " : "");
      i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

function words(seg) {
  let w = seg.trim().split(/\s+/).filter(Boolean);
  for (;;) {
    if (!w.length) return w;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0]) || w[0].startsWith("$") && !w[0].startsWith("$(")) { w = w.slice(1); continue; }
    if (WRAPPERS.has(w[0])) {
      const v = w[0];
      w = w.slice(1);
      if (v === "sudo") while (w.length && w[0].startsWith("-")) w = SUDO_ARG_FLAGS.has(w[0]) ? w.slice(2) : w.slice(1);
      else if (v === "env") while (w.length && (w[0].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0]))) w = w.slice(1);
      else if (v === "timeout" && w.length && /^[0-9.]+[smhd]?$/.test(w[0])) w = w.slice(1);
      else if (v === "nice" && w[0] === "-n") w = w.slice(2);
      continue;
    }
    return w;
  }
}

function cleanPath(t, cwd) {
  if (!t) return "";
  let p = t.replace(/^['"]|['"]$/g, "");
  if (p.startsWith("~/") || p === "~") p = HOME + p.slice(1);
  if (!p.startsWith("/") && !/^[a-z]+:\/\//i.test(p) && cwd) p = path.resolve(cwd, p);
  if (p.startsWith("/")) p = path.normalize(p);
  return p;
}

/**
 * @returns {{kind:'Read'|'Change', action:'Read'|'Created'|'Updated'|'Deleted', target:string}}
 * target is a clean absolute path / URL when one is known, else "".
 */
export function classify(cmd, cwd) {
  const text = String(cmd || "");
  const bare = stripQuotes(text);
  const hits = [];
  let allRead = true;
  const segs = bare.split(/\|\||&&|[;&|\n(){}`]|\$\(/);
  for (const seg of segs) {
    const w = words(seg.replace(/\d*>>?\s*&?\s*\S+|<\s*\S+/g, " "));
    if (!w.length) continue;
    const verb = path.basename(w[0]);
    let args = w.slice(1);
    if (verb === "git" || verb === "docker" || verb === "brew" || verb === "npm") {
      // global options before the subcommand: git -C dir / -c k=v / --no-pager, docker --context x, npm --prefix x
      while (args.length && args[0].startsWith("-")) {
        args = ["-C", "-c", "--context", "-H", "--host", "--prefix", "--git-dir", "--work-tree"].includes(args[0]) ? args.slice(2) : args.slice(1);
      }
    }
    // --- change detection
    if (verb === "curl" || verb === "wget") {
      const meth = /(?:-X|--request)\s*(POST|PUT|PATCH|DELETE)\b/.exec(seg);
      const sends = args.some((a) => CURL_SENDS.has(a) || /^--data|^-d./.test(a));
      if (meth || sends || verb === "wget") {
        const url = /https?:\/\/[^\s'"]+/.exec(text);
        hits.push([`curl ${meth ? meth[1] : "POST"}`, url ? [url[0]] : []]);
        allRead = false;
      }
      continue;
    }
    let name = null;
    if (VERBS.has(verb)) name = verb;
    else if (SUBVERBS[verb]) {
      const sub = args.slice(0, 5).find((a) => SUBVERBS[verb].has(a) && !(READ_SUB[verb] && READ_SUB[verb].has(a) && verb === "git" && a === "branch" && args.length === 1));
      if (sub && !(verb === "git" && (sub === "branch" || sub === "tag") && args.filter((a) => !a.startsWith("-")).length <= 1)) {
        name = sub.startsWith("-") ? `${verb} -i` : `${verb} ${sub}`;
      }
    }
    if (verb === "find" && args.some((a) => a === "-delete" || a === "-exec" || a === "-execdir" || a === "-ok")) {
      name = args.includes("-delete") ? "find -delete" : "find -exec";
    }
    if (verb === "ssh-keygen" && !args.includes("-R") && name === "ssh-keygen") name = args.length ? "ssh-keygen" : name;
    if (name) {
      const subs = SUBVERBS[verb] || new Set();
      let targets = args.filter((a) => !a.startsWith("-") && !subs.has(a) && a !== "Q");
      if (verb === "find") targets = args.filter((a) => a.startsWith("/") || a.startsWith("~") || a.startsWith(".")).slice(0, 1);
      else if (verb === "sed" || verb === "perl") targets = targets.slice(-1);
      else if (verb === "chmod" || verb === "chown" || verb === "chgrp") targets = targets.slice(1);
      else if (verb === "dd") targets = args.filter((a) => a.startsWith("of=")).map((a) => a.slice(3));
      else if (!PATH_VERBS.has(verb)) targets = targets.filter((a) => /^[~/.]/.test(a) || /^https?:\/\//.test(a));
      hits.push([name, targets]);
      allRead = false;
      continue;
    }
    // --- read-only check
    if (READ.has(verb)) {
      if (verb === "sed" && args.some((a) => /^-[a-zA-Z]*i/.test(a))) allRead = false;
      continue;
    }
    if (READ_SUB[verb] && args.length && READ_SUB[verb].has(args.find((a) => !a.startsWith("-") || READ_SUB[verb].has(a)) ?? "")) {
      continue;
    }
    if (verb === "Q" || verb === "__") continue; // a quoted word in command position (rare) or an escape
    allRead = false; // unknown program: counts as a change (Alexus rule)
  }
  // output redirected into a real file
  const m = /(?<![<0-9&>=-])(?:\d)?>>?\|?\s*(?!&|\/dev\/null|\/dev\/std|\/dev\/tty)([~/\w.$][^\s;|&'")]*)/.exec(bare);
  if (m) { hits.push(["redirect", [m[1]]]); allRead = false; }
  if (!hits.length && allRead) return { kind: "Read", action: "Read", target: "" };
  if (!hits.length) return { kind: "Change", action: "Updated", target: "" };
  const names = new Set(hits.map((h) => h[0]));
  let action = "Updated";
  if ([...names].some((n) => DELETE.has(n))) action = "Deleted";
  else if ([...names].every((n) => CREATE.has(n))) action = "Created";
  const first = hits.find((h) => DELETE.has(h[0])) || hits[0];
  const t = (first[1] || []).find((x) => x && x !== "Q") || "";
  return { kind: "Change", action, target: cleanPath(t, cwd) };
}
