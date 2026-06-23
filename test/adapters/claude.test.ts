import assert from "node:assert/strict";
import test from "node:test";
import { encodeClaudeCwd } from "../../src/adapters/claude.js";

test("encodeClaudeCwd matches Claude project directory encoding", () => {
  assert.equal(
    encodeClaudeCwd("/data00/home/dingkaiqiang.xh/aix/workspaces/claude-123"),
    "-data00-home-dingkaiqiang-xh-aix-workspaces-claude-123",
  );
});
