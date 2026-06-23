import { parseTarget } from "../core/target.js";
import { attachRemoteTmux } from "../core/tmux.js";

export async function attachCommand(targetRaw: string, sessionName: string): Promise<void> {
  const target = parseTarget(targetRaw);
  await attachRemoteTmux(target, sessionName);
}
