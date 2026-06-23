import { shellQuote } from "./process.js";
import { runRemote, runRemoteOrThrow } from "./remote-shell.js";
import type { SshTarget } from "./types.js";

export async function readRemoteHome(target: SshTarget): Promise<string> {
  const result = await runRemoteOrThrow(target, 'printf "%s\\n" "$HOME"', "Failed to read remote HOME");

  const remoteHome = result.stdout.trim();
  if (!remoteHome.startsWith("/")) {
    throw new Error(`Remote HOME is not absolute: ${remoteHome}`);
  }
  return remoteHome;
}

export async function ensureRemoteCommands(target: SshTarget, commands: string[]): Promise<void> {
  const checks = commands.map((command) => `command -v ${shellQuote(command)} >/dev/null 2>&1 || printf '%s\\n' ${shellQuote(command)}`);
  const result = await runRemote(target, checks.join("; "));
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "Failed to check remote commands");
  }
  const missing = result.stdout.split(/\r?\n/).filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Missing remote dependency: ${missing.join(", ")}`);
  }
}
