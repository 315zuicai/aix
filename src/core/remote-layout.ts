import path from "node:path";
import { assertRemotePathSegment, homePathDisplay, homePathExpression } from "./remote-paths.js";

export interface RemoteHomePath {
  segments: string[];
  display: string;
  expression: string;
}

export interface RemoteLayout {
  taskId: string;
  workspace: RemoteHomePath;
  aixDir: RemoteHomePath;
  workspacesDir: RemoteHomePath;
  manifestsDir: RemoteHomePath;
  workspaceAixDir: RemoteHomePath;
  sessionOriginalDir: RemoteHomePath;
  workspaceManifest: RemoteHomePath;
  workspaceHandoff: RemoteHomePath;
  manifestCopy: RemoteHomePath;
  workspaceAbsolute(remoteHome: string): string;
  originalSession(sessionFile: string): RemoteHomePath;
}

export function createRemoteLayout(taskId: string): RemoteLayout {
  assertRemotePathSegment(taskId);
  const aixDir = homePath(["aix"]);
  const workspacesDir = homePath([...aixDir.segments, "workspaces"]);
  const manifestsDir = homePath([...aixDir.segments, "manifests"]);
  const workspace = homePath([...workspacesDir.segments, taskId]);
  const workspaceAixDir = homePath([...workspace.segments, ".aix"]);
  const sessionOriginalDir = homePath([...workspace.segments, ".aix", "session-original"]);

  return {
    taskId,
    workspace,
    aixDir,
    workspacesDir,
    manifestsDir,
    workspaceAixDir,
    sessionOriginalDir,
    workspaceManifest: homePath([...workspace.segments, ".aix", "manifest.json"]),
    workspaceHandoff: homePath([...workspace.segments, ".aix", "HANDOFF.md"]),
    manifestCopy: homePath([...manifestsDir.segments, `${taskId}.json`]),
    workspaceAbsolute(remoteHome) {
      if (!remoteHome.startsWith("/")) {
        throw new Error(`Remote HOME is not absolute: ${remoteHome}`);
      }
      return path.posix.join(remoteHome, "aix", "workspaces", taskId);
    },
    originalSession(sessionFile) {
      return homePath([...sessionOriginalDir.segments, path.basename(sessionFile)]);
    },
  };
}

export function createRemoteAixLayout(): Pick<RemoteLayout, "aixDir" | "workspacesDir" | "manifestsDir"> {
  const aixDir = homePath(["aix"]);
  return {
    aixDir,
    workspacesDir: homePath([...aixDir.segments, "workspaces"]),
    manifestsDir: homePath([...aixDir.segments, "manifests"]),
  };
}

export function homePath(segments: string[]): RemoteHomePath {
  return {
    segments: [...segments],
    display: homePathDisplay(segments),
    expression: homePathExpression(segments),
  };
}
