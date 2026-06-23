import assert from "node:assert/strict";
import test from "node:test";
import { createClaudeHistoryEntry } from "../../src/core/claude-history.js";

test("createClaudeHistoryEntry records the remote project and session id", () => {
  const entry = createClaudeHistoryEntry(
    {
      tool: "claude",
      id: "session-123",
      title: "Smoke test",
      sessionFile: "/tmp/session-123.jsonl",
      mtimeMs: 0,
    },
    "/data00/home/user/aix/workspaces/claude-123",
  );

  assert.equal(entry.display, "Smoke test");
  assert.deepEqual(entry.pastedContents, {});
  assert.equal(entry.project, "/data00/home/user/aix/workspaces/claude-123");
  assert.equal(entry.sessionId, "session-123");
  assert.equal(typeof entry.timestamp, "number");
});
