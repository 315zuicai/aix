import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pipeRemoteStdin } from "../../src/core/remote-shell.js";
import { parseTarget } from "../../src/core/target.js";

test("pipeRemoteStdin reports a controlled failure when ssh stdin closes early", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aix-remote-shell-test-"));
  const fakeSsh = path.join(tempDir, "ssh");
  await fs.writeFile(
    fakeSsh,
    [
      "#!/usr/bin/env node",
      "process.stdin.destroy();",
      "setTimeout(() => process.exit(0), 50);",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );

  const originalPath = process.env.PATH || "";
  process.env.PATH = `${tempDir}${path.delimiter}${originalPath}`;
  try {
    await assert.rejects(
      pipeRemoteStdin({
        target: parseTarget("fakehost"),
        remoteCommand: "ignored",
        errorMessage: "remote write failed",
        async write(stdin) {
          const chunk = "x".repeat(1024 * 1024);
          for (let index = 0; index < 64 && !stdin.isClosed(); index += 1) {
            if (!(await stdin.write(chunk))) {
              break;
            }
          }
        },
      }),
      /remote write failed|EPIPE|closed|write/i,
    );
  } finally {
    process.env.PATH = originalPath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
