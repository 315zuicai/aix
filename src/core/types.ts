export type ToolName = "codex" | "claude";

export interface SshTarget {
  raw: string;
  sshDestination: string;
  user?: string;
  host?: string;
  port?: number;
}

export interface SessionInfo {
  tool: ToolName;
  id: string;
  cwd?: string;
  title?: string;
  sessionFile: string;
  updatedAt?: string;
  mtimeMs: number;
}

export interface GitInfo {
  isRepo: boolean;
  root?: string;
  branch?: string;
  head?: string;
  remote?: string;
  dirty?: boolean;
  statusPorcelain?: string;
}

export interface AixManifest {
  schemaVersion: 1;
  taskId: string;
  tool: ToolName;
  sessionId: string;
  source: {
    host: string;
    cwd: string;
    sessionFile: string;
    timestamp: string;
  };
  target: {
    sshTarget: string;
    cwd: string;
    tmuxSession: string;
  };
  git: GitInfo;
  rsync: {
    excludes: string[];
  };
  resume: {
    command: string;
  };
}
