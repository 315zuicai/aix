import assert from "node:assert/strict";
import test from "node:test";
import { parseTarget, rsyncSshArgs, sshArgs } from "../../src/core/target.js";

test("parseTarget supports aliases and port forms", () => {
  assert.deepEqual(parseTarget("dkqdev"), {
    raw: "dkqdev",
    host: "dkqdev",
    port: undefined,
    sshDestination: "dkqdev",
  });
  assert.deepEqual(parseTarget("user@example.com:2222"), {
    raw: "user@example.com:2222",
    user: "user",
    host: "example.com",
    port: 2222,
    sshDestination: "user@example.com",
  });
  assert.deepEqual(parseTarget("ssh://user@example.com:2222"), {
    raw: "ssh://user@example.com:2222",
    user: "user",
    host: "example.com",
    port: 2222,
    sshDestination: "user@example.com",
  });
});

test("parseTarget rejects option-like and whitespace targets", () => {
  assert.throws(() => parseTarget("-oProxyCommand=bad"), /Invalid SSH target/);
  assert.throws(() => parseTarget(" dkqdev"), /Target is required/);
  assert.throws(() => parseTarget("dkqdev "), /Target is required/);
  assert.throws(() => parseTarget("user@bad host"), /Invalid SSH target/);
  assert.throws(() => parseTarget("user@bad;host"), /Invalid SSH host/);
  assert.throws(() => parseTarget("ssh://user@example.com/tmp"), /Invalid SSH target/);
  assert.throws(() => parseTarget("user@example.com:70000"), /Invalid SSH target port/);
});

test("ssh and rsync ssh args stop option parsing before the destination", () => {
  const target = parseTarget("user@example.com:2222");
  assert.deepEqual(sshArgs(target, "true"), ["-p", "2222", "--", "user@example.com", "true"]);
  assert.deepEqual(rsyncSshArgs(target), ["-e", "ssh -p 2222 --"]);
});
