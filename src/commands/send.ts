import fs from "node:fs/promises";
import { createHandoffPlan, executeHandoffPlan, type HandoffStep } from "../core/handoff-pipeline.js";
import { attachRemoteTmux } from "../core/tmux.js";
import type { ToolName } from "../core/types.js";

export interface SendOptions {
  tool?: ToolName;
  session?: string;
  name?: string;
  attach?: boolean;
  continuePrompt?: string;
  promptFile?: string;
  fork?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export async function sendCommand(targetRaw: string, options: SendOptions): Promise<void> {
  const cwd = process.cwd();
  const continuePrompt = await readContinuePrompt(options);
  const plan = await createHandoffPlan({
    targetRaw,
    cwd,
    tool: options.tool,
    sessionId: options.session,
    name: options.name,
    fork: options.fork,
    continuePrompt,
  });

  if (options.dryRun) {
    console.log("Dry run only. No files were copied and no remote tmux session was started.");
    console.log("");
    console.log(JSON.stringify(plan.manifest, null, 2));

    if (options.attach || options.continuePrompt || options.promptFile || options.fork || options.force) {
      console.log("");
      console.log("Note: attach/continue-prompt/prompt-file/fork/force are accepted for interface shaping but not executed in dry-run.");
    }
    return;
  }

  if (options.force) {
    console.log("Note: --force has no effect in this slice; remote workspaces are never overwritten.");
  }

  const result = await executeHandoffPlan(plan, {
    onStep: (step) => logStep(step, plan),
  });

  console.log("");
  console.log("Handoff complete.");
  console.log(`Remote workspace: ${plan.target.raw}:${plan.layout.workspace.display}`);
  console.log(`Remote manifest: ${plan.target.raw}:${plan.layout.workspaceManifest.display}`);
  console.log(`Remote handoff: ${plan.target.raw}:${plan.layout.workspaceHandoff.display}`);
  console.log("");
  console.log(`Attach: ${result.attachCommand}`);

  if (options.attach) {
    await attachRemoteTmux(plan.target, result.manifest.target.tmuxSession);
  }
}

async function readContinuePrompt(options: SendOptions): Promise<string | undefined> {
  if (options.continuePrompt && options.promptFile) {
    throw new Error("Use either --continue-prompt or --prompt-file, not both");
  }
  if (options.promptFile) {
    return fs.readFile(options.promptFile, "utf8");
  }
  return options.continuePrompt;
}

function logStep(step: HandoffStep, plan: Awaited<ReturnType<typeof createHandoffPlan>>): void {
  switch (step) {
    case "read-remote-environment":
      console.log("Reading remote environment...");
      break;
    case "create-remote-workspace":
      console.log(`Creating remote workspace: ${plan.target.raw}:${plan.manifest.target.cwd}`);
      console.log("Copying workspace with rsync...");
      break;
    case "install-remote-session":
      console.log("Installing remote session...");
      break;
    case "run-tool-post-install":
      console.log(`Running ${plan.adapter.name} post-install step...`);
      break;
    case "start-remote-tmux":
      console.log("Starting remote tmux session...");
      break;
    case "send-continue-prompt":
      console.log("Sending continue prompt to tmux...");
      break;
    case "write-handoff-files":
      break;
  }
}
