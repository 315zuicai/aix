import { commandExists } from "../core/process.js";
import { runRemote } from "../core/remote-shell.js";
import { parseTarget } from "../core/target.js";
import type { ToolName } from "../core/types.js";

export interface DoctorOptions {
  tool?: ToolName;
}

interface CheckLine {
  status: "ok" | "missing";
  command: string;
  path?: string;
}

export async function doctorCommand(targetRaw: string, options: DoctorOptions): Promise<void> {
  const target = parseTarget(targetRaw);

  console.log(`Target: ${target.raw}`);
  console.log("");
  console.log("Local checks:");
  const localCommands = ["ssh", "rsync"];
  for (const command of localCommands) {
    const ok = await commandExists(command);
    console.log(`  ${ok ? "ok     " : "missing"} ${command}`);
    if (!ok) {
      throw new Error(`Missing local dependency: ${command}`);
    }
  }

  console.log("");
  console.log("Remote checks:");
  const remote = await runRemote(
    target,
    [
      "for c in rsync tmux codex claude; do",
      "if command -v \"$c\" >/dev/null 2>&1; then",
      "printf 'ok\\t%s\\t%s\\n' \"$c\" \"$(command -v \"$c\")\";",
      "else",
      "printf 'missing\\t%s\\n' \"$c\";",
      "fi;",
      "done",
      ";",
      "if mkdir -p \"$HOME/aix\" 2>/dev/null && test -w \"$HOME/aix\"; then",
      "printf 'ok\\t%s\\t%s\\n' aix-home \"$HOME/aix\";",
      "else",
      "printf 'missing\\t%s\\n' aix-home;",
      "fi",
    ].join(" "),
  );

  if (remote.code !== 0) {
    throw new Error(remote.stderr.trim() || remote.stdout.trim() || "Remote doctor failed");
  }

  const lines = parseCheckLines(remote.stdout);
  for (const line of lines) {
    console.log(`  ${line.status.padEnd(7)} ${line.command}${line.path ? ` ${line.path}` : ""}`);
  }

  const missing = new Set(lines.filter((line) => line.status === "missing").map((line) => line.command));
  const missingCore = ["rsync", "tmux", "aix-home"].filter((command) => missing.has(command));
  if (missingCore.length > 0) {
    throw new Error(`Missing remote dependency: ${missingCore.join(", ")}`);
  }

  if (options.tool && missing.has(options.tool)) {
    throw new Error(`Missing remote ${options.tool} binary`);
  }

  if (!options.tool && missing.has("codex") && missing.has("claude")) {
    throw new Error("Remote target has neither codex nor claude");
  }

  console.log("");
  console.log("Doctor passed.");
}

function parseCheckLines(stdout: string): CheckLine[] {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, command, path] = line.split("\t");
      return {
        status: status === "ok" ? "ok" : "missing",
        command,
        path,
      };
    });
}
