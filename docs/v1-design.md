# aix V1 Design

`aix` is a CLI-first handoff tool for moving a local AI coding session and workspace state to a long-running remote tmux session.

## V1 Goal

```text
Mac local Codex / Claude Code session
+ current workspace snapshot
+ dirty and untracked files
-> rsync to a new server workspace
-> install migrated session files on the server
-> start tmux with codex/claude resume
-> continue from phone via SSH + tmux attach
```

Same-host tmuxization is useful, but the core V1 path is cross-machine migration from a local laptop to a server.

## Non-goals

- Do not migrate a live Unix process or PTY.
- Do not automatically install `tmux`, `rsync`, `codex`, or `claude` on the target.
- Do not silently overwrite remote workspaces or remote session files.
- Do not solve browser state, IDE state, Mac-only credentials, or local MCP state.
- Do not implement custom SSH password handling. Use system `ssh` and `rsync`.

## Commands

```bash
aix doctor <target>
aix send <target>
aix send <target> --dry-run
aix send <target> --tool codex --session <id>
aix send <target> --tool claude --session <id>
aix send <target> --attach
aix send <target> --continue-prompt "..."
aix send <target> --fork
aix attach <target> <tmux-session>
aix status <target> [tmux-session]
aix list <target>
```

Targets support:

- `dkqdev`
- `user@host`
- `user@host:2222`
- `ssh://user@host:2222`

## Workspace Strategy

Each handoff creates a new remote workspace:

```text
~/aix/workspaces/<tool>-<short-session>-<timestamp>/
~/aix/manifests/<task-id>.json
```

The snapshot includes dirty and untracked files. Default excludes cover large regenerable content:

```text
node_modules
dist
build
.next/cache
.turbo
.vite
.cache
.pnpm-store
```

V1 uses `rsync + manifest`, not a single bundle format.

## Manifest

Every transfer writes `.aix/manifest.json` in the target workspace and stores a copy under `~/aix/manifests/`.

The manifest records:

- task id
- tool
- session id
- source host/cwd/session file
- target ssh/cwd/tmux session
- git branch/head/dirty state
- rsync excludes
- resume command

## Codex Adapter

Codex local state:

```text
~/.codex/sessions/.../*.jsonl
~/.codex/session_index.jsonl
```

Discovery reads `session_meta.payload.id`, `session_meta.payload.cwd`, and the session index title/update time.

Remote install will:

1. Copy the original session into `.aix/session-original/`.
2. Install a migrated session under remote `~/.codex/sessions/...`.
3. Update remote `~/.codex/session_index.jsonl`.
4. Start tmux from the target workspace.

Resume command:

```bash
codex resume --all --cd <target-workspace> <session-id>
```

Fork command:

```bash
codex fork --all <session-id>
```

## Claude Adapter

Claude Code local state:

```text
~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
```

Discovery reads the project directory, `sessionId`, top-level `cwd`, and file mtime.

Remote install will:

1. Copy the original session into `.aix/session-original/`.
2. Compute the remote encoded project directory from the target cwd.
3. Install a migrated session under remote `~/.claude/projects/<encoded-target-cwd>/<session-id>.jsonl`.
4. Rewrite top-level `cwd` fields from source cwd to target cwd in the migrated copy.

Resume command:

```bash
cd <target-workspace> && claude --resume <session-id>
```

Fork command:

```bash
cd <target-workspace> && claude --resume <session-id> --fork-session
```

## Conflict Policy

- Remote workspace exists: fail.
- Remote session id exists: fail.
- No silent overwrite.
- `--fork` uses official Codex/Claude fork behavior.
- `--force` only bypasses soft warnings; it does not overwrite data.

## Implementation Milestones

1. `aix doctor <target>` checks remote prerequisites.
2. `aix send <target> --dry-run` emits a real manifest.
3. `aix send` performs rsync to a new workspace and writes `.aix/manifest.json` plus `.aix/HANDOFF.md`.
4. Install Codex sessions remotely.
5. Install Claude sessions remotely.
6. Start remote tmux and print attach command.
7. Add `aix attach`, `aix status`, `aix list`.
8. Add Codex skill and Claude slash command wrappers.
