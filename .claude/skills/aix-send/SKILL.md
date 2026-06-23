---
name: aix-send
description: "Hand off the current Claude Code session and workspace to a remote aix tmux workspace."
argument-hint: "<target>"
disable-model-invocation: true
---

# aix-send

Hand off the current Claude Code session to a remote server with `aix`.

## Requirements

- `aix` is installed and available on `PATH`.
- The user provides an SSH target such as `dkqdev`, `user@host`, `user@host:2222`, or `ssh://user@host:2222`.

## Workflow

1. Write a concise continuation prompt summarizing the user's active task and next expected action to a temp file.
2. Run:

```bash
aix send $ARGUMENTS --tool claude --prompt-file <temp-prompt-file>
```

For a preview without copying files or starting tmux:

```bash
aix send $ARGUMENTS --tool claude --dry-run
```

Do not edit Claude Code session JSONL by hand. If the user asks to fork, pass `--fork` and let Claude Code handle the fork on the remote host.
