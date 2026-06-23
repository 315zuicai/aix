import assert from "node:assert/strict";
import test from "node:test";
import { run } from "../../src/core/process.js";

test("run reports a controlled failure when child stdin closes early", async () => {
  const result = await run(
    process.execPath,
    ["-e", "process.stdin.destroy(); setTimeout(() => process.exit(0), 50);"],
    { input: "x".repeat(16 * 1024 * 1024) },
  );

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /stdin write failed|EPIPE|closed|write/i);
});
