import os from "node:os";
import { getToolAdapter } from "../adapters/tool-adapter.js";
import { DEFAULT_RSYNC_EXCLUDES } from "../config/excludes.js";
import { formatTimestamp, shortId } from "./paths.js";
import { createRemoteLayout } from "./remote-layout.js";
import type { AixManifest, GitInfo, SessionInfo, SshTarget } from "./types.js";

export function createManifest(input: {
  target: SshTarget;
  session: SessionInfo;
  git: GitInfo;
  cwd: string;
  name?: string;
  fork?: boolean;
}): AixManifest {
  const timestamp = formatTimestamp();
  const baseName = input.name || `${input.session.tool}-${shortId(input.session.id)}`;
  const taskId = sanitizeTaskId(`${baseName}-${timestamp}`);
  const layout = createRemoteLayout(taskId);
  const targetCwd = layout.workspace.display;
  const tmuxSession = sanitizeTaskId(`aix-${input.session.tool}-${shortId(input.session.id)}`);

  return {
    schemaVersion: 1,
    taskId,
    tool: input.session.tool,
    sessionId: input.session.id,
    source: {
      host: os.hostname(),
      cwd: input.cwd,
      sessionFile: input.session.sessionFile,
      timestamp: new Date().toISOString(),
    },
    target: {
      sshTarget: input.target.raw,
      cwd: targetCwd,
      tmuxSession,
    },
    git: input.git,
    rsync: {
      excludes: [...DEFAULT_RSYNC_EXCLUDES],
    },
    resume: {
      command: getToolAdapter(input.session.tool).resumeCommand(input.session, targetCwd, Boolean(input.fork)),
    },
  };
}

function sanitizeTaskId(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
