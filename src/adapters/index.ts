import { allToolAdapters, getToolAdapter } from "./tool-adapter.js";
import type { SessionInfo, ToolName } from "../core/types.js";

export async function discoverSession(options: {
  cwd: string;
  tool?: ToolName;
  sessionId?: string;
}): Promise<SessionInfo> {
  if (options.tool) {
    const session = await getToolAdapter(options.tool).discover(options);
    if (!session) {
      throw new Error(`No matching ${toolDisplayName(options.tool)} session found`);
    }
    return session;
  }

  const sessions = await Promise.all(allToolAdapters().map((adapter) => adapter.discover(options)));

  const candidates = sessions.filter((item): item is SessionInfo => Boolean(item));
  if (candidates.length === 0) {
    throw new Error("No Codex or Claude session found for the current directory");
  }

  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
}

function toolDisplayName(tool: ToolName): string {
  return tool === "codex" ? "Codex" : "Claude";
}
