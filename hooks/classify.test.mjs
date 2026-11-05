// node --test hooks/mac-receipts/classify.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "./classify.mjs";

const c = (cmd) => { const r = classify(cmd, "/w"); return `${r.kind}/${r.action}${r.target ? " " + r.target : ""}`; };
test("read-only commands are Read", () => {
  for (const cmd of ["ls -la /tmp | head -3", "grep -q x /etc/hosts", "export PATH=$PATH:/x; cd ~/y && git status",
    "git -C /tmp log --oneline -3", "echo 'rm -rf /'", "curl -s https://x/y", "docker ps", "cat a | sort | uniq -c"])
    assert.equal(c(cmd), "Read/Read", cmd);
});
test("changes carry action and clean target", () => {
  assert.equal(c("touch /tmp/a"), "Change/Created /tmp/a");
  assert.equal(c("rm /tmp/a"), "Change/Deleted /tmp/a");
  assert.equal(c("mkdir x"), "Change/Created /w/x");
  assert.equal(c("echo hi > out.txt"), "Change/Updated /w/out.txt");
  assert.equal(c("sed -i s/a/b/ f.txt"), "Change/Updated /w/f.txt");
  assert.equal(c("chmod 600 /etc/x"), "Change/Updated /etc/x");
  assert.equal(c("node build.js"), "Change/Updated");
  assert.equal(c("ls; rm -rf /tmp/zz"), "Change/Deleted /tmp/zz");
  assert.equal(c("curl -X POST https://api/x -d a=1"), "Change/Updated https://api/x");
});
