export function assertRemotePathSegment(value: string): void {
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error(`Unsafe remote path segment: ${value}`);
  }
}

export function homePathExpression(segments: string[]): string {
  for (const segment of segments) {
    assertRemotePathSegment(segment);
  }
  return `"$HOME/${segments.join("/")}"`;
}

export function homePathDisplay(segments: string[]): string {
  for (const segment of segments) {
    assertRemotePathSegment(segment);
  }
  return `~/${segments.join("/")}`;
}
