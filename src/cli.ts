#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command, Option } from "commander";
import { attachCommand } from "./commands/attach.js";
import { doctorCommand } from "./commands/doctor.js";
import { listCommand } from "./commands/list.js";
import { sendCommand } from "./commands/send.js";
import { statusCommand } from "./commands/status.js";
import type { ToolName } from "./core/types.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

const program = new Command();

program
  .name("aix")
  .description("Move local Codex and Claude Code sessions to long-running remote tmux workspaces.")
  .version(packageJson.version);

program
  .command("doctor")
  .description("Check local and remote prerequisites for a handoff target.")
  .argument("<target>", "SSH alias, user@host, user@host:port, or ssh://user@host:port")
  .addOption(new Option("--tool <tool>", "required AI tool on the target").choices(["codex", "claude"]))
  .action(async (target: string, options: { tool?: ToolName }) => {
    await runMain(() => doctorCommand(target, options));
  });

program
  .command("send")
  .description("Prepare or perform a session handoff to a remote target.")
  .argument("<target>", "SSH alias, user@host, user@host:port, or ssh://user@host:port")
  .addOption(new Option("--tool <tool>", "source tool").choices(["codex", "claude"]))
  .option("--session <id>", "source session id")
  .option("--name <task-name>", "task name prefix")
  .option("--attach", "attach to remote tmux after handoff")
  .option("--continue-prompt <prompt>", "prompt to send after remote resume")
  .option("--prompt-file <path>", "file containing the remote continuation prompt")
  .option("--fork", "fork the session on the remote side")
  .option("--dry-run", "print the planned manifest without copying or starting tmux")
  .option("--force", "bypass soft warnings; never overwrites by itself")
  .action(async (target: string, options: Parameters<typeof sendCommand>[1]) => {
    await runMain(() => sendCommand(target, options));
  });

program
  .command("attach")
  .description("Attach to a remote aix tmux session.")
  .argument("<target>", "SSH alias, user@host, user@host:port, or ssh://user@host:port")
  .argument("<session>", "remote tmux session name")
  .action(async (target: string, session: string) => {
    await runMain(() => attachCommand(target, session));
  });

program
  .command("status")
  .description("Show remote aix tmux session status.")
  .argument("<target>", "SSH alias, user@host, user@host:port, or ssh://user@host:port")
  .argument("[session]", "remote tmux session name")
  .action(async (target: string, session?: string) => {
    await runMain(() => statusCommand(target, session));
  });

program
  .command("list")
  .description("List remote aix tmux sessions and handoff manifests.")
  .argument("<target>", "SSH alias, user@host, user@host:port, or ssh://user@host:port")
  .action(async (target: string) => {
    await runMain(() => listCommand(target));
  });

program.parseAsync(process.argv);

async function runMain(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`aix: ${message}`);
    process.exitCode = 1;
  }
}
