import { createReadStream } from "node:fs";
import readline from "node:readline";
import { getToolAdapter } from "../adapters/tool-adapter.js";
import { shellQuote } from "./process.js";
import { pipeRemoteStdin, rsyncFileToRemote, runRemoteOrThrow } from "./remote-shell.js";
import { createRemoteLayout, homePath, type RemoteHomePath } from "./remote-layout.js";
import { assertRemotePathSegment } from "./remote-paths.js";
import type { AixManifest, SessionInfo, SshTarget } from "./types.js";

export interface InstalledSession {
  originalPath: string;
  migratedPath: string;
}

export async function installRemoteSession(input: {
  target: SshTarget;
  manifest: AixManifest;
  session: SessionInfo;
  remoteCwd: string;
}): Promise<InstalledSession> {
  const adapter = getToolAdapter(input.session.tool);
  const migratedSegments = adapter.migratedSessionSegments(input.session, input.remoteCwd);
  const layout = createRemoteLayout(input.manifest.taskId);
  const originalSession = layout.originalSession(input.session.sessionFile);

  await prepareInstallPath(input.target, migratedSegments, {
    codexSessionId: adapter.conflictSessionId?.(input.session),
  });
  await copyOriginalSession(input.target, input.session.sessionFile, originalSession);
  await writeTransformedJsonl(input.target, migratedSegments, input.session.sessionFile, (record) => {
    return adapter.transformSessionRecord(record, input.remoteCwd);
  });
  const indexEntry = adapter.sessionIndexEntry?.(input.session);
  if (indexEntry) {
    await appendCodexIndex(input.target, indexEntry);
  }

  return {
    originalPath: originalSession.display,
    migratedPath: homePath(migratedSegments).display,
  };
}

export async function assertRemoteSessionAvailable(input: {
  target: SshTarget;
  session: SessionInfo;
  remoteCwd: string;
}): Promise<void> {
  const adapter = getToolAdapter(input.session.tool);
  const migratedSegments = adapter.migratedSessionSegments(input.session, input.remoteCwd);
  await checkInstallPath(input.target, migratedSegments, {
    codexSessionId: adapter.conflictSessionId?.(input.session),
  });
}

async function prepareInstallPath(
  target: SshTarget,
  migratedSegments: string[],
  options: { codexSessionId?: string } = {},
): Promise<void> {
  await checkInstallPath(target, migratedSegments, options);
  const migratedDir = homePath(migratedSegments.slice(0, -1)).expression;
  await runRemoteOrThrow(target, `mkdir -p ${migratedDir}`, "Failed to create remote session directory");
}

async function checkInstallPath(
  target: SshTarget,
  migratedSegments: string[],
  options: { codexSessionId?: string } = {},
): Promise<void> {
  for (const segment of migratedSegments) {
    assertRemotePathSegment(segment);
  }
  const migratedPath = homePath(migratedSegments).expression;
  const codexIndexConflict = options.codexSessionId
    ? `
if [ -f "$HOME/.codex/session_index.jsonl" ] && grep -E ${shellQuote(codexSessionIndexIdPattern(options.codexSessionId))} "$HOME/.codex/session_index.jsonl" >/dev/null 2>&1; then
  printf "Remote Codex session id already exists: %s\\n" ${shellQuote(options.codexSessionId)} >&2
  exit 19
fi
`.trim()
    : "";
  const command = `
set -eu
if [ -e ${migratedPath} ]; then
  printf "Remote session file already exists: %s\\n" ${migratedPath} >&2
  exit 18
fi
${codexIndexConflict}
`.trim();
  await runRemoteOrThrow(target, command, "Remote session path is not available");
}

async function copyOriginalSession(
  target: SshTarget,
  sourceFile: string,
  originalSession: RemoteHomePath,
): Promise<void> {
  await rsyncFileToRemote({
    sourceFile,
    target,
    destination: originalSession,
    errorMessage: "Failed to copy original session",
  });
}

async function appendCodexIndex(target: SshTarget, entry: Record<string, unknown>): Promise<void> {
  const sessionId = typeof entry.id === "string" ? entry.id : undefined;
  if (!sessionId) {
    throw new Error("Codex session index entry is missing id");
  }
  const command = `
set -eu
mkdir -p "$HOME/.codex"
lock="$HOME/.codex/.aix-session-index.lock"
attempt=0
while ! mkdir "$lock" 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 100 ]; then
    printf "Timed out waiting for Codex session index lock\\n" >&2
    exit 21
  fi
  sleep 0.1
done
trap 'rmdir "$lock"' EXIT
index="$HOME/.codex/session_index.jsonl"
touch "$index"
if grep -E ${shellQuote(codexSessionIndexIdPattern(sessionId))} "$index" >/dev/null 2>&1; then
  printf "Remote Codex session id already exists: %s\\n" ${shellQuote(sessionId)} >&2
  exit 19
fi
cat >> "$index"
`.trim();
  await runRemoteOrThrow(target, command, "Failed to append Codex session index", {
    input: `${JSON.stringify(entry)}\n`,
  });
}

export function codexSessionIndexIdPattern(sessionId: string): string {
  return `"id"[[:space:]]*:[[:space:]]*"${escapeExtendedRegex(sessionId)}"`;
}

async function writeTransformedJsonl(
  target: SshTarget,
  migratedSegments: string[],
  sourceFile: string,
  transform: (record: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const migratedSession = homePath(migratedSegments);
  const command = `
set -eu
final=${migratedSession.expression}
dir=$(dirname "$final")
base=$(basename "$final")
tmp="$dir/.aix-\${base}.$$.tmp"
trap 'rm -f "$tmp"' EXIT
if [ -e "$final" ]; then
  printf "Remote session file already exists: %s\\n" "$final" >&2
  exit 18
fi
umask 077
cat > "$tmp"
if ! ln "$tmp" "$final" 2>/dev/null; then
  printf "Remote session file already exists: %s\\n" "$final" >&2
  exit 18
fi
rm -f "$tmp"
trap - EXIT
`.trim();
  await pipeRemoteStdin({
    target,
    remoteCommand: command,
    errorMessage: `Failed to write migrated session to ${migratedSession.display}`,
    async write(stdin) {
      const rl = readline.createInterface({
        input: createReadStream(sourceFile, { encoding: "utf8" }),
        crlfDelay: Infinity,
      });

      try {
        for await (const line of rl) {
          const output = transformJsonLine(line, transform);
          if (!(await stdin.write(`${output}\n`))) {
            break;
          }
        }
      } finally {
        rl.close();
      }
    },
  });
}

function transformJsonLine(
  line: string,
  transform: (record: Record<string, unknown>) => Record<string, unknown>,
): string {
  if (!line) {
    return line;
  }
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isObject(parsed)) {
      return line;
    }
    return JSON.stringify(transform(parsed));
  } catch {
    return line;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeExtendedRegex(value: string): string {
  return value.replace(/[\\.^$*+?()[\]{}|]/g, "\\$&");
}
