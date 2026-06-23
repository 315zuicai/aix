---
name: aix-send
description: "Hand off the current Codex or Claude Code session and workspace to a remote aix tmux workspace. Use when the user asks to send, move, migrate, resume, or continue an AI coding task on an SSH target."
argument-hint: "<target>"
---

# aix-send

Use this skill when the user wants to hand off the current Codex or Claude Code session to a remote server with `aix`.

## Requirements

- `aix` is installed and available on `PATH`.
- The user provides an SSH target such as `dkqdev`, `user@host`, `user@host:2222`, or `ssh://user@host:2222`.

## Workflow

1. Write a concise continuation prompt summarizing the user's active task and next expected action to a temp file.
2. Choose the source tool from the current environment:
   - Codex: use `--tool codex`.
   - Claude Code: use `--tool claude`.
3. Run:

```bash
aix send <target> --tool <codex-or-claude> --prompt-file <temp-prompt-file>
```

For a preview without copying files or starting tmux:

```bash
aix send <target> --tool <codex-or-claude> --dry-run
```

Do not edit Codex or Claude Code session JSONL by hand. If the user asks to fork, pass `--fork` and let the source tool handle the fork on the remote host.
