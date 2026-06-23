import { spawn } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function run(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdinError: Error | undefined;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdin.on("error", (error) => {
      stdinError = toError(error);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (stdinError && !stderr.trim()) {
        stderr = `stdin write failed: ${stdinError.message}`;
      }
      resolve({
        code: stdinError && (code === 0 || code === null) ? 1 : (code ?? 1),
        stdout,
        stderr,
      });
    });

    try {
      if (options.input !== undefined) {
        child.stdin.end(options.input);
      } else {
        child.stdin.end();
      }
    } catch (error) {
      stdinError = toError(error);
      child.stdin.destroy();
    }
  });
}

export async function runText(
  command: string,
  args: string[],
  options: { cwd?: string; allowFailure?: boolean } = {},
): Promise<string> {
  const result = await run(command, args, { cwd: options.cwd });
  if (result.code !== 0 && !options.allowFailure) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
  return result.stdout.trim();
}

export async function commandExists(command: string): Promise<boolean> {
  const result = await run("sh", ["-lc", `command -v ${shellQuote(command)} >/dev/null 2>&1`]);
  return result.code === 0;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
