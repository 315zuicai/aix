import type { SshTarget } from "./types.js";

export function parseTarget(raw: string): SshTarget {
  if (!raw || raw !== raw.trim()) {
    throw new Error("Target is required");
  }
  assertSafeTargetText(raw);

  if (raw.startsWith("ssh://")) {
    const url = new URL(raw);
    const user = decodeURIComponent(url.username || "");
    const host = url.hostname;
    const port = parsePort(url.port || undefined, raw);
    if (!host || (url.pathname && url.pathname !== "/") || url.search || url.hash) {
      throw new Error(`Invalid SSH target: ${raw}`);
    }
    if (user) {
      assertSafeTargetPart(user, "SSH user");
    }
    assertSafeTargetPart(host, "SSH host");
    return {
      raw,
      user: user || undefined,
      host,
      port,
      sshDestination: user ? `${user}@${host}` : host,
    };
  }

  const portMatch = raw.match(/^(.+):(\d+)$/);
  const withoutPort = portMatch ? portMatch[1] : raw;
  const port = parsePort(portMatch?.[2], raw);

  const userHost = withoutPort.match(/^([^@]+)@(.+)$/);
  if (userHost) {
    assertSafeTargetPart(userHost[1], "SSH user");
    assertSafeTargetPart(userHost[2], "SSH host");
    return {
      raw,
      user: userHost[1],
      host: userHost[2],
      port,
      sshDestination: `${userHost[1]}@${userHost[2]}`,
    };
  }

  assertSafeTargetPart(withoutPort, "SSH alias");
  return {
    raw,
    host: withoutPort,
    port,
    sshDestination: withoutPort,
  };
}

export function sshArgs(target: SshTarget, remoteCommand: string): string[] {
  const args: string[] = [];
  if (target.port) {
    args.push("-p", String(target.port));
  }
  args.push("--", target.sshDestination, remoteCommand);
  return args;
}

export function rsyncSshArgs(target: SshTarget): string[] {
  if (!target.port) {
    return [];
  }
  return ["-e", `ssh -p ${target.port} --`];
}

function parsePort(value: string | undefined, raw: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid SSH target port: ${raw}`);
  }
  return port;
}

function assertSafeTargetText(value: string): void {
  if (value.startsWith("-") || /[\s\x00-\x1F\x7F]/.test(value)) {
    throw new Error(`Invalid SSH target: ${value}`);
  }
}

function assertSafeTargetPart(value: string, label: string): void {
  if (!/^[A-Za-z0-9_.-]+$/.test(value) || value.startsWith("-")) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}
