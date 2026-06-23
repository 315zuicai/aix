import { spawn } from "node:child_process";
import path from "node:path";
import { run, type RunResult } from "./process.js";
import type { RemoteHomePath } from "./remote-layout.js";
import { rsyncSshArgs, sshArgs } from "./target.js";
import type { SshTarget } from "./types.js";

export interface RemoteStdin {
  isClosed(): boolean;
  write(chunk: string): Promise<boolean>;
}

export async function runRemote(
  target: SshTarget,
  remoteCommand: string,
  options: { input?: string } = {},
): Promise<RunResult> {
  return run("ssh", sshArgs(target, remoteCommand), options);
}

export async function runRemoteOrThrow(
  target: SshTarget,
  remoteCommand: string,
  errorMessage: string,
  options: { input?: string } = {},
): Promise<RunResult> {
  const result = await runRemote(target, remoteCommand, options);
  assertSuccess(result, errorMessage);
  return result;
}

export async function pipeRemoteStdin(input: {
  target: SshTarget;
  remoteCommand: string;
  write(stdin: RemoteStdin): Promise<void>;
  errorMessage: string;
}): Promise<void> {
  const child = spawn("ssh", sshArgs(input.target, input.remoteCommand), {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let childError: Error | undefined;
  let stdinError: Error | undefined;
  let closed = false;
  const closePromise = new Promise<number | null>((resolve) => {
    child.on("close", (code) => {
      closed = true;
      resolve(code);
    });
  });
  const childErrorPromise = new Promise<never>((_, reject) => {
    child.on("error", (error) => {
      childError = toError(error);
      closed = true;
      reject(childError);
    });
  });
  childErrorPromise.catch(() => undefined);

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.on("error", (error) => {
    stdinError = toError(error);
    closed = true;
  });

  const remoteStdin: RemoteStdin = {
    isClosed() {
      return closed || Boolean(childError) || Boolean(stdinError);
    },
    async write(chunk) {
      if (this.isClosed()) {
        return false;
      }

      try {
        if (child.stdin.write(chunk)) {
          return !this.isClosed();
        }
      } catch (error) {
        stdinError = toError(error);
        closed = true;
        return false;
      }

      return Promise.race([
        new Promise<boolean>((resolve) => {
          const onDrain = () => {
            cleanup();
            resolve(!this.isClosed());
          };
          const onError = (error: Error) => {
            cleanup();
            stdinError = toError(error);
            closed = true;
            resolve(false);
          };
          const cleanup = () => {
            child.stdin.off("drain", onDrain);
            child.stdin.off("error", onError);
          };
          child.stdin.once("drain", onDrain);
          child.stdin.once("error", onError);
        }),
        closePromise.then(() => false),
        childErrorPromise.catch(() => false),
      ]);
    },
  };

  try {
    await Promise.race([
      input.write(remoteStdin),
      closePromise.then(() => undefined),
      childErrorPromise,
    ]);
  } finally {
    try {
      if (!child.stdin.destroyed && !child.stdin.writableEnded) {
        child.stdin.end();
      }
    } catch (error) {
      stdinError = toError(error);
      child.stdin.destroy();
    }
  }

  const code = await Promise.race([closePromise, childErrorPromise]);
  if (childError) {
    throw childError;
  }
  if (stdinError) {
    throw new Error(stderr.trim() || `${input.errorMessage}: ${stdinError.message}`);
  }
  if (code !== 0) {
    throw new Error(stderr.trim() || input.errorMessage);
  }
}

export async function rsyncDirectoryToRemote(input: {
  sourceDir: string;
  target: SshTarget;
  destination: RemoteHomePath;
  excludes: string[];
  errorMessage: string;
}): Promise<void> {
  const source = input.sourceDir.endsWith(path.sep) ? input.sourceDir : `${input.sourceDir}${path.sep}`;
  await runRsyncOrThrow(
    [
      "-a",
      ...rsyncSshArgs(input.target),
      ...input.excludes.map((pattern) => `--exclude=${pattern}`),
      source,
      remoteRsyncDestination(input.target, input.destination, { trailingSlash: true }),
    ],
    input.errorMessage,
  );
}

export async function rsyncFileToRemote(input: {
  sourceFile: string;
  target: SshTarget;
  destination: RemoteHomePath;
  errorMessage: string;
}): Promise<void> {
  await runRsyncOrThrow(
    [
      "-a",
      ...rsyncSshArgs(input.target),
      input.sourceFile,
      remoteRsyncDestination(input.target, input.destination),
    ],
    input.errorMessage,
  );
}

export async function attachRemoteCommand(target: SshTarget, remoteCommand: string): Promise<void> {
  const args: string[] = [];
  if (target.port) {
    args.push("-p", String(target.port));
  }
  args.push("-t", "--", target.sshDestination, remoteCommand);
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ssh", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ssh attach exited with code ${code ?? 1}`));
      }
    });
  });
}

function remoteRsyncDestination(
  target: SshTarget,
  remotePath: RemoteHomePath,
  options: { trailingSlash?: boolean } = {},
): string {
  return `${target.sshDestination}:${remotePath.display}${options.trailingSlash ? "/" : ""}`;
}

async function runRsyncOrThrow(args: string[], errorMessage: string): Promise<void> {
  const result = await run("rsync", args);
  assertSuccess(result, errorMessage);
}

function assertSuccess(result: RunResult, errorMessage: string): void {
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || errorMessage);
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
