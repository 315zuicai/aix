import path from "node:path";
import { fileMtimeMs, iterateJsonLines, listFiles, pathExists, readJsonLinesPrefix } from "../core/files.js";
import { homePath } from "../core/paths.js";
import type { SessionInfo } from "../core/types.js";

interface CodexSessionMeta {
  id?: string;
  cwd?: string;
}

interface CodexIndexEntry {
  id?: string;
  thread_name?: string;
  updated_at?: string;
}

export async function discoverCodexSession(options: {
  cwd: string;
  sessionId?: string;
}): Promise<SessionInfo | undefined> {
  const sessionsRoot = homePath(".codex", "sessions");
  if (!(await pathExists(sessionsRoot))) {
    return undefined;
  }

  const files = await listFiles(sessionsRoot, (filePath) => filePath.endsWith(".jsonl"));
  const candidates: SessionInfo[] = [];

  for (const file of files) {
    if (options.sessionId && !path.basename(file).includes(options.sessionId)) {
      continue;
    }

    const meta = await readCodexSessionMeta(file);
    if (!meta.id) {
      continue;
    }
    if (options.sessionId && meta.id !== options.sessionId) {
      continue;
    }
    if (!options.sessionId && meta.cwd !== options.cwd) {
      continue;
    }

    const indexEntry = await readCodexIndexEntry(meta.id);
    candidates.push({
      tool: "codex",
      id: meta.id,
      cwd: meta.cwd,
      title: indexEntry?.thread_name,
      updatedAt: indexEntry?.updated_at,
      sessionFile: file,
      mtimeMs: await fileMtimeMs(file),
    });
  }

  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
}

async function readCodexSessionMeta(filePath: string): Promise<CodexSessionMeta> {
  const records = await readJsonLinesPrefix(filePath, 25);
  for (const record of records) {
    if (!isObject(record) || record.type !== "session_meta" || !isObject(record.payload)) {
      continue;
    }
    return {
      id: typeof record.payload.id === "string" ? record.payload.id : undefined,
      cwd: typeof record.payload.cwd === "string" ? record.payload.cwd : undefined,
    };
  }
  return {};
}

async function readCodexIndexEntry(sessionId: string): Promise<CodexIndexEntry | undefined> {
  const indexPath = homePath(".codex", "session_index.jsonl");
  if (!(await pathExists(indexPath))) {
    return undefined;
  }

  let latest: CodexIndexEntry | undefined;
  for await (const record of iterateJsonLines(indexPath)) {
    if (isObject(record) && record.id === sessionId) {
      latest = {
        id: typeof record.id === "string" ? record.id : undefined,
        thread_name: typeof record.thread_name === "string" ? record.thread_name : undefined,
        updated_at: typeof record.updated_at === "string" ? record.updated_at : undefined,
      };
    }
  }
  return latest;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
