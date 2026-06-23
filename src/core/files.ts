import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import readline from "node:readline";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(root: string, predicate: (filePath: string) => boolean): Promise<string[]> {
  const output: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && predicate(fullPath)) {
        output.push(fullPath);
      }
    }
  }

  await walk(root);
  return output;
}

export async function readJsonLinesPrefix(filePath: string, maxLines: number): Promise<unknown[]> {
  const output: unknown[] = [];
  for await (const record of iterateJsonLines(filePath)) {
    if (output.length >= maxLines) {
      break;
    }
    output.push(record);
  }
  return output;
}

export async function readJsonLines(filePath: string): Promise<unknown[]> {
  const output: unknown[] = [];
  for await (const record of iterateJsonLines(filePath)) {
    output.push(record);
  }
  return output;
}

export async function* iterateJsonLines(filePath: string): AsyncGenerator<unknown> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      if (!line) {
        continue;
      }
      try {
        yield JSON.parse(line);
      } catch {
        // Ignore partial or non-JSON diagnostic lines in session files.
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }
}

export async function fileMtimeMs(filePath: string): Promise<number> {
  const stat = await fs.stat(filePath);
  return stat.mtimeMs;
}
