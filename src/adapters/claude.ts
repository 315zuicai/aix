import path from "node:path";
import { fileMtimeMs, listFiles, pathExists, readJsonLinesPrefix } from "../core/files.js";
import { homePath } from "../core/paths.js";
import type { SessionInfo } from "../core/types.js";

export async function discoverClaudeSession(options: {
  cwd: string;
  sessionId?: string;
}): Promise<SessionInfo | undefined> {
  const projectsRoot = homePath(".claude", "projects");
  if (!(await pathExists(projectsRoot))) {
    return undefined;
  }

  const searchRoot = options.sessionId
    ? projectsRoot
    : path.join(projectsRoot, encodeClaudeCwd(options.cwd));
  if (!(await pathExists(searchRoot))) {
    return undefined;
  }

  const files = await listFiles(searchRoot, (filePath) => filePath.endsWith(".jsonl"));
  const candidates: SessionInfo[] = [];

  for (const file of files) {
    const fileSessionId = path.basename(file, ".jsonl");
    if (options.sessionId && fileSessionId !== options.sessionId) {
      continue;
    }

    const meta = await readClaudeSessionMeta(file);
    const sessionId = meta.sessionId || fileSessionId;
    if (options.sessionId && sessionId !== options.sessionId) {
      continue;
    }
    if (!options.sessionId && meta.cwd && meta.cwd !== options.cwd) {
      continue;
    }

    candidates.push({
      tool: "claude",
      id: sessionId,
      cwd: meta.cwd,
      sessionFile: file,
      mtimeMs: await fileMtimeMs(file),
    });
  }

  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
}

export function encodeClaudeCwd(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, "-");
}

async function readClaudeSessionMeta(filePath: string): Promise<{ sessionId?: string; cwd?: string }> {
  const records = await readJsonLinesPrefix(filePath, 100);
  let sessionId: string | undefined;
  let cwd: string | undefined;

  for (const record of records) {
    if (!isObject(record)) {
      continue;
    }
    if (!sessionId && typeof record.sessionId === "string") {
      sessionId = record.sessionId;
    }
    if (!cwd && typeof record.cwd === "string") {
      cwd = record.cwd;
    }
    if (sessionId && cwd) {
      break;
    }
  }

  return { sessionId, cwd };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
