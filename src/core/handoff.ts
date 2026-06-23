import type { AixManifest } from "./types.js";

export function createHandoffMarkdown(input: {
  manifest: AixManifest;
  continuePrompt?: string;
  attachCommand?: string;
  installedSession?: {
    originalPath: string;
    migratedPath: string;
  };
}): string {
  const { manifest, continuePrompt } = input;
  const lines = [
    "# aix handoff",
    "",
    `Task: ${manifest.taskId}`,
    `Tool: ${manifest.tool}`,
    `Session: ${manifest.sessionId}`,
    `Source: ${manifest.source.host}:${manifest.source.cwd}`,
    `Target: ${manifest.target.sshTarget}:${manifest.target.cwd}`,
    "",
    "## Status",
    "",
    "The workspace snapshot has been copied to the remote target.",
    "The AI session has been installed on the remote target.",
    "The remote tmux session uses the resume command recorded below.",
    "",
    "## Resume Command",
    "",
    "The remote tmux session was started with:",
    "",
    "```bash",
    manifest.resume.command,
    "```",
    "",
    "## Git",
    "",
    `Repository: ${manifest.git.isRepo ? "yes" : "no"}`,
  ];

  if (manifest.git.branch) {
    lines.push(`Branch: ${manifest.git.branch}`);
  }
  if (manifest.git.head) {
    lines.push(`HEAD: ${manifest.git.head}`);
  }
  if (typeof manifest.git.dirty === "boolean") {
    lines.push(`Dirty: ${manifest.git.dirty ? "yes" : "no"}`);
  }
  if (manifest.git.statusPorcelain) {
    lines.push("", "```text", manifest.git.statusPorcelain, "```");
  }

  if (input.attachCommand) {
    lines.push("", "## Attach", "", "```bash", input.attachCommand, "```");
  }

  if (input.installedSession) {
    lines.push(
      "",
      "## Installed Session",
      "",
      `Original copy: ${input.installedSession.originalPath}`,
      `Migrated session: ${input.installedSession.migratedPath}`,
    );
  }

  if (continuePrompt) {
    lines.push("", "## Continue Prompt", "", "```text", continuePrompt.trimEnd(), "```");
  }

  lines.push("");
  return lines.join("\n");
}
