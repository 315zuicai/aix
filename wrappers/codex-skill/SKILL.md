---
name: aix-send
description: "Move the current Codex session and workspace to a remote aix tmux workspace."
---

# aix-send

Use this skill when the user wants to hand off the current Codex session to a remote server with `aix`.

## Requirements

- `aix` is installed and available on `PATH`.
- The user provides an SSH target such as `dkqdev`, `user@host`, `user@host:2222`, or `ssh://user@host:2222`.

## Workflow

1. Write a concise continuation prompt summarizing the user's active task and next expected action to a temp file.
2. Run:

```bash
aix send <target> --tool codex --prompt-file <temp-prompt-file>
```

For a preview without copying files or starting tmux:

```bash
aix send <target> --tool codex --dry-run
```

Do not edit Codex session JSONL by hand. If the user asks to fork, pass `--fork` and let Codex handle the fork on the remote host.
