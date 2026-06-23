import { commandExists, shellQuote } from "./process.js";
import { rsyncDirectoryToRemote, runRemoteOrThrow } from "./remote-shell.js";
import type { RemoteHomePath, RemoteLayout } from "./remote-layout.js";
import type { AixManifest, SshTarget } from "./types.js";

export async function transferWorkspace(input: {
  cwd: string;
  target: SshTarget;
  manifest: AixManifest;
  layout: RemoteLayout;
  handoffMarkdown: string;
}): Promise<void> {
  await prepareRemoteWorkspace(input);
  await writeRemoteHandoffFiles(input);
}

export async function prepareRemoteWorkspace(input: {
  cwd: string;
  target: SshTarget;
  manifest: AixManifest;
  layout: RemoteLayout;
}): Promise<void> {
  await ensureLocalTransferCommands();
  await createRemoteWorkspace(input.target, input.layout);
  await rsyncWorkspace(input.cwd, input.target, input.manifest, input.layout);
}

export async function writeRemoteHandoffFiles(input: {
  target: SshTarget;
  manifest: AixManifest;
  layout: RemoteLayout;
  handoffMarkdown: string;
}): Promise<void> {
  await writeRemoteTextFile(
    input.target,
    input.layout.workspaceManifest,
    `${JSON.stringify(input.manifest, null, 2)}\n`,
  );
  await writeRemoteTextFile(
    input.target,
    input.layout.workspaceHandoff,
    input.handoffMarkdown,
  );
  await writeRemoteTextFile(
    input.target,
    input.layout.manifestCopy,
    `${JSON.stringify(input.manifest, null, 2)}\n`,
  );
}

export async function ensureLocalTransferCommands(): Promise<void> {
  for (const command of ["ssh", "rsync"]) {
    if (!(await commandExists(command))) {
      throw new Error(`Missing local dependency: ${command}`);
    }
  }
}

export async function resolveRemoteWorkspacePhysicalPath(target: SshTarget, layout: RemoteLayout): Promise<string> {
  const command = `
set -eu
mkdir -p ${layout.workspacesDir.expression}
cd ${layout.workspacesDir.expression}
parent=$(pwd -P)
printf "%s/%s\\n" "$parent" ${shellQuote(layout.taskId)}
`.trim();
  const result = await runRemoteOrThrow(target, command, "Failed to resolve remote workspace path");
  const remoteCwd = result.stdout.trim();
  if (!remoteCwd.startsWith("/")) {
    throw new Error(`Remote workspace path is not absolute: ${remoteCwd}`);
  }
  return remoteCwd;
}

async function createRemoteWorkspace(target: SshTarget, layout: RemoteLayout): Promise<void> {
  const command = `
set -eu
workspace=${layout.workspace.expression}
manifest_dir=${layout.manifestsDir.expression}
if [ -e "$workspace" ]; then
  printf "Remote workspace already exists: %s\\n" "$workspace" >&2
  exit 17
fi
mkdir -p ${layout.workspacesDir.expression} "$manifest_dir"
mkdir "$workspace"
mkdir ${layout.workspaceAixDir.expression}
mkdir ${layout.sessionOriginalDir.expression}
`.trim();
  await runRemoteOrThrow(target, command, "Failed to create remote workspace");
}

async function rsyncWorkspace(cwd: string, target: SshTarget, manifest: AixManifest, layout: RemoteLayout): Promise<void> {
  await rsyncDirectoryToRemote({
    sourceDir: cwd,
    target,
    destination: layout.workspace,
    excludes: manifest.rsync.excludes,
    errorMessage: "rsync failed",
  });
}

export async function writeRemoteTextFile(
  target: SshTarget,
  remotePath: RemoteHomePath,
  content: string,
): Promise<void> {
  await runRemoteOrThrow(target, `umask 077; cat > ${remotePath.expression}`, `Failed to write ${remotePath.display}`, {
    input: content,
  });
}
