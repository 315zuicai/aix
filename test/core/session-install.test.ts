import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { codexSessionIndexIdPattern } from "../../src/core/session-install.js";

test("codexSessionIndexIdPattern matches exact JSON id fields only", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aix-codex-index-test-"));
  const indexPath = path.join(tempDir, "session_index.jsonl");
  await fs.writeFile(
    indexPath,
    [
      JSON.stringify({ id: "target-session", thread_name: "ok" }),
      JSON.stringify({ id: "target-session-suffix" }),
      JSON.stringify({ thread_name: "target-session" }),
      JSON.stringify({ not_id: "target-session" }),
      "",
    ].join("\n"),
  );

  try {
    const pattern = codexSessionIndexIdPattern("target-session");
    const exact = spawnSync("grep", ["-E", pattern, indexPath], { encoding: "utf8" });
    assert.equal(exact.status, 0);
    assert.equal(exact.stdout.trim(), JSON.stringify({ id: "target-session", thread_name: "ok" }));

    const missing = spawnSync("grep", ["-E", codexSessionIndexIdPattern("absent-session"), indexPath]);
    assert.notEqual(missing.status, 0);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
