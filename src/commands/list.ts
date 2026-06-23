import { createRemoteAixLayout } from "../core/remote-layout.js";
import { runRemote } from "../core/remote-shell.js";
import { parseTarget } from "../core/target.js";

export async function listCommand(targetRaw: string): Promise<void> {
  const target = parseTarget(targetRaw);
  const layout = createRemoteAixLayout();
  const result = await runRemote(
    target,
    `
printf "tmux sessions\\n"
tmux list-sessions -F '#S attached=#{session_attached} command=#{pane_current_command}' 2>/dev/null | grep '^aix-' || true
printf "\\nmanifests\\n"
if [ -d ${layout.manifestsDir.expression} ]; then
  for f in ${layout.manifestsDir.expression}/*.json; do
    [ -e "$f" ] || continue
    basename "$f" .json
  done
fi
`.trim(),
  );
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "Remote list failed");
  }
  console.log(result.stdout.trimEnd());
}
