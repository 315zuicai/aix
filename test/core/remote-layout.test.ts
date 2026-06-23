import assert from "node:assert/strict";
import test from "node:test";
import { createRemoteAixLayout, createRemoteLayout, homePath } from "../../src/core/remote-layout.js";

test("createRemoteLayout centralizes aix task paths", () => {
  const layout = createRemoteLayout("codex-123-20260623");

  assert.equal(layout.workspace.display, "~/aix/workspaces/codex-123-20260623");
  assert.equal(layout.workspace.expression, '"$HOME/aix/workspaces/codex-123-20260623"');
  assert.equal(layout.workspaceAixDir.display, "~/aix/workspaces/codex-123-20260623/.aix");
  assert.equal(layout.sessionOriginalDir.display, "~/aix/workspaces/codex-123-20260623/.aix/session-original");
  assert.equal(layout.workspaceManifest.display, "~/aix/workspaces/codex-123-20260623/.aix/manifest.json");
  assert.equal(layout.workspaceHandoff.display, "~/aix/workspaces/codex-123-20260623/.aix/HANDOFF.md");
  assert.equal(layout.manifestCopy.display, "~/aix/manifests/codex-123-20260623.json");
  assert.equal(layout.workspaceAbsolute("/home/aix-user"), "/home/aix-user/aix/workspaces/codex-123-20260623");
});

test("createRemoteLayout derives original session path from basename only", () => {
  const layout = createRemoteLayout("claude-abc");
  assert.equal(
    layout.originalSession("/Users/me/.claude/projects/source/session.jsonl").display,
    "~/aix/workspaces/claude-abc/.aix/session-original/session.jsonl",
  );
});

test("createRemoteAixLayout exposes task-independent aix paths", () => {
  const layout = createRemoteAixLayout();
  assert.equal(layout.aixDir.display, "~/aix");
  assert.equal(layout.workspacesDir.display, "~/aix/workspaces");
  assert.equal(layout.manifestsDir.expression, '"$HOME/aix/manifests"');
});

test("remote layout rejects unsafe path segments", () => {
  assert.throws(() => createRemoteLayout("../bad"), /Unsafe remote path segment/);
  assert.throws(() => homePath(["aix", "bad/slash"]), /Unsafe remote path segment/);
});
