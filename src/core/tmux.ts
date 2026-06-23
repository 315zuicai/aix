import { shellQuote } from "./process.js";
import { attachRemoteCommand, runRemoteOrThrow } from "./remote-shell.js";
import type { SshTarget } from "./types.js";

export async function startRemoteTmux(input: {
  target: SshTarget;
  sessionName: string;
  cwd: string;
  command: string;
}): Promise<void> {
  assertSafeTmuxSessionName(input.sessionName);
  await assertRemoteTmuxAvailable(input.target, input.sessionName);
  const script = `
set -eu
session=${shellQuote(input.sessionName)}
cwd=${shellQuote(input.cwd)}
command=${shellQuote(input.command)}
tmux new-session -d -s "$session" -c "$cwd" "$command"
`.trim();
  await runRemoteOrThrow(input.target, script, "Failed to start remote tmux session");
}

export async function assertRemoteTmuxAvailable(target: SshTarget, sessionName: string): Promise<void> {
  assertSafeTmuxSessionName(sessionName);
  const targetName = tmuxTarget(sessionName);
  const command = `
if tmux has-session -t ${targetName} >/dev/null 2>&1; then
  printf "Remote tmux session already exists: %s\\n" ${shellQuote(sessionName)} >&2
  exit 20
fi
`.trim();
  await runRemoteOrThrow(target, command, "Remote tmux session is not available");
}

export async function sendPromptToTmux(input: {
  target: SshTarget;
  sessionName: string;
  prompt: string;
}): Promise<void> {
  assertSafeTmuxSessionName(input.sessionName);
  const bufferName = `aix-${input.sessionName}-${Date.now()}`;
  const targetName = tmuxTarget(input.sessionName);
  const command = [
    "set -eu",
    `buffer=${shellQuote(bufferName)}`,
    "trap 'tmux delete-buffer -b \"$buffer\" >/dev/null 2>&1 || true' EXIT",
    "sleep 2",
    `tmux load-buffer -b "$buffer" -`,
    `tmux paste-buffer -b "$buffer" -t ${targetName}`,
    `tmux send-keys -t ${targetName} Enter`,
  ].join("; ");
  await runRemoteOrThrow(input.target, command, "Failed to send continue prompt to tmux", { input: input.prompt });
}

export function attachCommand(target: SshTarget, sessionName: string): string {
  assertSafeTmuxSessionName(sessionName);
  const args = ["ssh"];
  if (target.port) {
    args.push("-p", String(target.port));
  }
  args.push("-t", "--", shellQuote(target.sshDestination), shellQuote(`tmux attach -t ${tmuxTarget(sessionName)}`));
  return args.join(" ");
}

export async function attachRemoteTmux(target: SshTarget, sessionName: string): Promise<void> {
  assertSafeTmuxSessionName(sessionName);
  await attachRemoteCommand(target, `tmux attach -t ${tmuxTarget(sessionName)}`);
}

function assertSafeTmuxSessionName(sessionName: string): void {
  if (!/^[A-Za-z0-9_.:-]+$/.test(sessionName) || sessionName.startsWith("-")) {
    throw new Error(`Invalid tmux session name: ${sessionName}`);
  }
}

function tmuxTarget(sessionName: string): string {
  return shellQuote(`=${sessionName}`);
}
