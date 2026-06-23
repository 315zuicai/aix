import assert from "node:assert/strict";
import test from "node:test";
import { attachCommand } from "../../src/core/tmux.js";
import { parseTarget } from "../../src/core/target.js";

test("attachCommand renders a shell-safe remote tmux command", () => {
  const command = attachCommand(parseTarget("dkqdev"), "aix-codex-1234");
  assert.equal(command, "ssh -t -- 'dkqdev' 'tmux attach -t '\\''=aix-codex-1234'\\'''");
});

test("attachCommand rejects unsafe tmux session names", () => {
  assert.throws(() => attachCommand(parseTarget("dkqdev"), "x; touch /tmp/bad"), /Invalid tmux session name/);
  assert.throws(() => attachCommand(parseTarget("dkqdev"), "-bad"), /Invalid tmux session name/);
});
