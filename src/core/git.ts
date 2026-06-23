import { run } from "./process.js";
import type { GitInfo } from "./types.js";

export async function inspectGit(cwd: string): Promise<GitInfo> {
  const root = await gitOutput(cwd, ["rev-parse", "--show-toplevel"]);
  if (!root) {
    return { isRepo: false };
  }

  const branch = await gitOutput(cwd, ["branch", "--show-current"]);
  const head = await gitOutput(cwd, ["rev-parse", "HEAD"]);
  const statusPorcelain = await gitOutput(cwd, ["status", "--porcelain=v1"]);
  const remote = branch
    ? await gitOutput(cwd, ["config", `branch.${branch}.remote`])
    : "";

  return {
    isRepo: true,
    root,
    branch: branch || undefined,
    head: head || undefined,
    remote: remote || undefined,
    dirty: statusPorcelain.length > 0,
    statusPorcelain,
  };
}

async function gitOutput(cwd: string, args: string[]): Promise<string> {
  const result = await run("git", args, { cwd });
  return result.code === 0 ? result.stdout.trim() : "";
}
