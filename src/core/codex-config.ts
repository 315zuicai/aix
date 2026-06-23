import { shellQuote } from "./process.js";
import { runRemoteOrThrow } from "./remote-shell.js";
import type { SshTarget } from "./types.js";

export async function trustRemoteCodexProject(target: SshTarget, remoteCwd: string): Promise<void> {
  const section = `[projects.${tomlString(remoteCwd)}]`;
  const block = `\n${section}\ntrust_level = "trusted"\n`;
  const command = `
set -eu
mkdir -p "$HOME/.codex"
config="$HOME/.codex/config.toml"
touch "$config"
if ! grep -F ${shellQuote(section)} "$config" >/dev/null 2>&1; then
  cat >> "$config"
fi
`.trim();
  await runRemoteOrThrow(target, command, "Failed to trust remote Codex workspace", { input: block });
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
