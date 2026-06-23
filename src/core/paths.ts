import os from "node:os";
import path from "node:path";

export function homePath(...parts: string[]): string {
  return path.join(os.homedir(), ...parts);
}

export function formatTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "-",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
}

export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}
