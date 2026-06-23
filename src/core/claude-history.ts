import { runRemoteOrThrow } from "./remote-shell.js";
import type { SessionInfo, SshTarget } from "./types.js";

export interface ClaudeHistoryEntry {
  display: string;
  pastedContents: Record<string, never>;
  timestamp: number;
  project: string;
  sessionId: string;
}

export async function appendRemoteClaudeHistory(input: {
  target: SshTarget;
  session: SessionInfo;
  remoteCwd: string;
}): Promise<void> {
  const entry = createClaudeHistoryEntry(input.session, input.remoteCwd);
  const command = `
set -eu
mkdir -p "$HOME/.claude"
lock="$HOME/.claude/.aix-history.lock"
i=0
while ! mkdir "$lock" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 100 ]; then
    printf "Timed out waiting for Claude history lock\\n" >&2
    exit 17
  fi
  sleep 0.1
done
trap 'rmdir "$lock"' EXIT
umask 077
cat >> "$HOME/.claude/history.jsonl"
`.trim();
  await runRemoteOrThrow(input.target, command, "Failed to append Claude history", {
    input: `${JSON.stringify(entry)}\n`,
  });
}

export function createClaudeHistoryEntry(session: SessionInfo, remoteCwd: string): ClaudeHistoryEntry {
  return {
    display: session.title || `aix handoff ${session.id}`,
    pastedContents: {},
    timestamp: Date.now(),
    project: remoteCwd,
    sessionId: session.id,
  };
}
