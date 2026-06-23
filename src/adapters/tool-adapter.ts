import path from "node:path";
import { appendRemoteClaudeHistory } from "../core/claude-history.js";
import { trustRemoteCodexProject } from "../core/codex-config.js";
import { shellQuote } from "../core/process.js";
import type { SessionInfo, SshTarget, ToolName } from "../core/types.js";
import { discoverClaudeSession, encodeClaudeCwd } from "./claude.js";
import { discoverCodexSession } from "./codex.js";

export interface ToolAdapter {
  name: ToolName;
  requiredRemoteCommand: string;
  discover(options: { cwd: string; sessionId?: string }): Promise<SessionInfo | undefined>;
  resumeCommand(session: SessionInfo, targetCwd: string, fork: boolean): string;
  migratedSessionSegments(session: SessionInfo, remoteCwd: string): string[];
  transformSessionRecord(record: Record<string, unknown>, remoteCwd: string): Record<string, unknown>;
  conflictSessionId?(session: SessionInfo): string | undefined;
  sessionIndexEntry?(session: SessionInfo): Record<string, unknown>;
  afterInstall?(input: { target: SshTarget; remoteCwd: string; session: SessionInfo }): Promise<void>;
}

const CODEX_ADAPTER: ToolAdapter = {
  name: "codex",
  requiredRemoteCommand: "codex",
  discover: discoverCodexSession,
  resumeCommand(session, targetCwd, fork) {
    if (fork) {
      return `cd ${shellPath(targetCwd)} && codex fork --all ${shellQuote(session.id)}`;
    }
    return `codex resume --all --cd ${shellPath(targetCwd)} ${shellQuote(session.id)}`;
  },
  migratedSessionSegments(session) {
    return [".codex", "sessions", ...codexRelativeSessionPath(session.sessionFile)];
  },
  transformSessionRecord(record, remoteCwd) {
    if (record.type === "session_meta" && isObject(record.payload)) {
      return {
        ...record,
        payload: {
          ...record.payload,
          cwd: remoteCwd,
        },
      };
    }
    return record;
  },
  conflictSessionId(session) {
    return session.id;
  },
  sessionIndexEntry(session) {
    return {
      id: session.id,
      thread_name: session.title || `aix handoff ${session.id}`,
      updated_at: new Date().toISOString(),
    };
  },
  afterInstall({ target, remoteCwd }) {
    return trustRemoteCodexProject(target, remoteCwd);
  },
};

const CLAUDE_ADAPTER: ToolAdapter = {
  name: "claude",
  requiredRemoteCommand: "claude",
  discover: discoverClaudeSession,
  resumeCommand(session, targetCwd, fork) {
    if (fork) {
      return `cd ${shellPath(targetCwd)} && claude --resume ${shellQuote(session.id)} --fork-session`;
    }
    return `cd ${shellPath(targetCwd)} && claude --resume ${shellQuote(session.id)}`;
  },
  migratedSessionSegments(session, remoteCwd) {
    return [".claude", "projects", encodeClaudeCwd(remoteCwd), `${session.id}.jsonl`];
  },
  transformSessionRecord(record, remoteCwd) {
    if (typeof record.cwd === "string") {
      return {
        ...record,
        cwd: remoteCwd,
      };
    }
    return record;
  },
  afterInstall({ target, remoteCwd, session }) {
    return appendRemoteClaudeHistory({ target, remoteCwd, session });
  },
};

export function getToolAdapter(tool: ToolName): ToolAdapter {
  return tool === "codex" ? CODEX_ADAPTER : CLAUDE_ADAPTER;
}

export function allToolAdapters(): ToolAdapter[] {
  return [CODEX_ADAPTER, CLAUDE_ADAPTER];
}

function codexRelativeSessionPath(sessionFile: string): string[] {
  const sessionsRoot = path.join(process.env.HOME || "", ".codex", "sessions");
  const relative = path.relative(sessionsRoot, sessionFile);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return ["aix", path.basename(sessionFile)];
  }
  return relative.split(path.sep).filter(Boolean);
}

function shellPath(value: string): string {
  if (value.startsWith("~/") && /^[~/A-Za-z0-9_.-]+$/.test(value)) {
    return value;
  }
  return shellQuote(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
