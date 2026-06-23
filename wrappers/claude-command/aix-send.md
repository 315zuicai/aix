# aix-send

Hand off the current Claude Code session and workspace to a remote aix tmux workspace.

Usage:

```bash
aix send $ARGUMENTS --tool claude --prompt-file <temp-prompt-file>
```

Write the continuation prompt to the temp file before running the command.

For a preview:

```bash
aix send $ARGUMENTS --tool claude --dry-run
```

Pass the target as `$ARGUMENTS`, for example:

```text
dkqdev
user@host
user@host:2222
ssh://user@host:2222
```

Do not edit Claude session JSONL by hand. If the user asks to fork, pass `--fork` and let Claude Code handle the fork on the remote host.
