import { discoverSession } from "../adapters/index.js";
import { getToolAdapter, type ToolAdapter } from "../adapters/tool-adapter.js";
import { inspectGit } from "./git.js";
import { createHandoffMarkdown } from "./handoff.js";
import { createManifest } from "./manifest.js";
import { ensureRemoteCommands, readRemoteHome } from "./remote.js";
import { createRemoteLayout, type RemoteLayout } from "./remote-layout.js";
import { assertRemoteSessionAvailable, installRemoteSession, type InstalledSession } from "./session-install.js";
import { parseTarget } from "./target.js";
import { assertRemoteTmuxAvailable, attachCommand, sendPromptToTmux, startRemoteTmux } from "./tmux.js";
import { prepareRemoteWorkspace, resolveRemoteWorkspacePhysicalPath, writeRemoteHandoffFiles } from "./transfer.js";
import type { AixManifest, SessionInfo, SshTarget, ToolName } from "./types.js";

export interface HandoffPlanInput {
  targetRaw: string;
  cwd: string;
  tool?: ToolName;
  sessionId?: string;
  name?: string;
  fork?: boolean;
  continuePrompt?: string;
}

export interface HandoffPlan {
  target: SshTarget;
  cwd: string;
  adapter: ToolAdapter;
  session: SessionInfo;
  manifest: AixManifest;
  layout: RemoteLayout;
  continuePrompt?: string;
}

export interface HandoffResult {
  manifest: AixManifest;
  attachCommand: string;
  installedSession: InstalledSession;
}

export type HandoffStep =
  | "read-remote-environment"
  | "create-remote-workspace"
  | "install-remote-session"
  | "run-tool-post-install"
  | "start-remote-tmux"
  | "send-continue-prompt"
  | "write-handoff-files";

export async function createHandoffPlan(input: HandoffPlanInput): Promise<HandoffPlan> {
  const target = parseTarget(input.targetRaw);
  const session = await discoverSession({
    cwd: input.cwd,
    tool: input.tool,
    sessionId: input.sessionId,
  });
  const adapter = getToolAdapter(session.tool);
  const git = await inspectGit(input.cwd);
  const manifest = createManifest({
    target,
    session,
    git,
    cwd: input.cwd,
    name: input.name,
    fork: input.fork,
  });

  return {
    target,
    cwd: input.cwd,
    adapter,
    session,
    manifest,
    layout: createRemoteLayout(manifest.taskId),
    continuePrompt: input.continuePrompt,
  };
}

export async function executeHandoffPlan(
  plan: HandoffPlan,
  options: { onStep?: (step: HandoffStep) => void } = {},
): Promise<HandoffResult> {
  options.onStep?.("read-remote-environment");
  await readRemoteHome(plan.target);
  await ensureRemoteCommands(plan.target, ["rsync", "tmux", plan.adapter.requiredRemoteCommand]);
  const remoteCwd = await resolveRemoteWorkspacePhysicalPath(plan.target, plan.layout);
  await assertRemoteSessionAvailable({
    target: plan.target,
    session: plan.session,
    remoteCwd,
  });
  await assertRemoteTmuxAvailable(plan.target, plan.manifest.target.tmuxSession);

  options.onStep?.("create-remote-workspace");
  await prepareRemoteWorkspace({
    cwd: plan.cwd,
    target: plan.target,
    manifest: plan.manifest,
    layout: plan.layout,
  });

  options.onStep?.("install-remote-session");
  const installedSession = await installRemoteSession({
    target: plan.target,
    manifest: plan.manifest,
    session: plan.session,
    remoteCwd,
  });

  if (plan.adapter.afterInstall) {
    options.onStep?.("run-tool-post-install");
    await plan.adapter.afterInstall({ target: plan.target, remoteCwd, session: plan.session });
  }

  const attach = attachCommand(plan.target, plan.manifest.target.tmuxSession);
  const handoffMarkdown = createHandoffMarkdown({
    manifest: plan.manifest,
    continuePrompt: plan.continuePrompt,
    attachCommand: attach,
    installedSession,
  });

  options.onStep?.("write-handoff-files");
  await writeRemoteHandoffFiles({
    target: plan.target,
    manifest: plan.manifest,
    layout: plan.layout,
    handoffMarkdown,
  });

  options.onStep?.("start-remote-tmux");
  await startRemoteTmux({
    target: plan.target,
    sessionName: plan.manifest.target.tmuxSession,
    cwd: remoteCwd,
    command: plan.manifest.resume.command,
  });

  if (plan.continuePrompt) {
    options.onStep?.("send-continue-prompt");
    await sendPromptToTmux({
      target: plan.target,
      sessionName: plan.manifest.target.tmuxSession,
      prompt: plan.continuePrompt,
    });
  }

  return {
    manifest: plan.manifest,
    attachCommand: attach,
    installedSession,
  };
}
