import { shellQuote } from "../core/process.js";
import { createRemoteAixLayout } from "../core/remote-layout.js";
import { runRemote } from "../core/remote-shell.js";
import { parseTarget } from "../core/target.js";

export async function statusCommand(targetRaw: string, sessionName?: string): Promise<void> {
  const target = parseTarget(targetRaw);
  const command = sessionName ? statusOneCommand(sessionName) : statusAllCommand();
  const result = await runRemote(target, command);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "Remote status failed");
  }
  console.log(result.stdout.trimEnd());
}

function statusOneCommand(sessionName: string): string {
  const quoted = shellQuote(sessionName);
  const target = shellQuote(`=${sessionName}`);
  return `
if tmux has-session -t ${target} >/dev/null 2>&1; then
  printf "tmux\\trunning\\t%s\\n" ${quoted}
else
  printf "tmux\\tmissing\\t%s\\n" ${quoted}
fi
`.trim();
}

function statusAllCommand(): string {
  const layout = createRemoteAixLayout();
  return `
printf "tmux\\n"
tmux list-sessions -F '#S attached=#{session_attached} command=#{pane_current_command}' 2>/dev/null | grep '^aix-' || true
printf "\\nmanifests\\n"
if [ -d ${layout.manifestsDir.expression} ]; then
  find ${layout.manifestsDir.expression} -maxdepth 1 -type f -name '*.json' -print | sed 's#.*/##; s#\\.json$##' | sort
fi
`.trim();
}
