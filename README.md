# aix

> AI execution handoff: move a local Codex or Claude Code session to a remote tmux workspace.

`aix` 是一个面向长任务的 AI 会话迁移 CLI。它把本机正在进行或已存在的 Codex / Claude Code 会话，以及当前工作区快照，迁移到远端服务器的新 workspace，并在远端 `tmux` 里执行官方 resume 命令。这样你可以在 Mac 上发起任务，然后用手机 SSH 到服务器继续控制。

当前 npm 包名是 `aix-handoff`，安装后提供的命令是 `aix`。

## 目录

- [特性](#特性)
- [安装](#安装)
- [Codex / Claude Code skill 和 plugin](#codex--claude-code-skill-和-plugin)
- [前置条件](#前置条件)
- [快速开始](#快速开始)
- [命令](#命令)
- [迁移内容](#迁移内容)
- [安全边界](#安全边界)
- [发布到 npm](#发布到-npm)
- [开发](#开发)
- [English](#english)

## 特性

- 支持 Codex 和 Claude Code。
- 支持 `ssh alias`、`user@host`、`user@host:port`、`ssh://user@host:port`。
- 使用系统 `ssh`、`rsync`、`tmux`，不重新实现 SSH 登录。
- 默认复制 dirty working tree 和 untracked files。
- 默认排除 `node_modules`、`dist`、`build`、`.next/cache`、`.turbo`、`.vite`、`.cache`、`.pnpm-store` 等可再生成目录。
- 每次迁移创建新的远端 workspace：`~/aix/workspaces/<tool>-<short-session>-<timestamp>/`。
- 远端写入 `.aix/manifest.json` 和 `.aix/HANDOFF.md`。
- 远端 session 或 tmux 冲突默认 fail fast，不覆盖。
- `--fork` 使用 Codex / Claude Code 官方 fork 能力，不伪造会话文件。

## 安装

```bash
npm install -g aix-handoff
aix --help
```

也可以直接使用 `npx`：

```bash
npx --package aix-handoff aix --help
```

本地开发版本：

```bash
# 克隆仓库后
cd aix
npm install
npm run build
node dist/cli.js --help
```

## Codex / Claude Code skill 和 plugin

`npm install -g aix-handoff` 只安装 `aix` CLI，不会自动把 Codex 或 Claude Code 的 skill 安装到你的个人配置里。

Codex 的标准 skill 目录是 `.agents/skills/<skill-name>/SKILL.md` 或用户级 `~/.agents/skills/<skill-name>/SKILL.md`。本仓库提供的 repo-local skill 是：

```text
.agents/skills/aix-send/SKILL.md
```

如果你在 Codex 里打开这个仓库，可以通过 `/skills` 选择 `aix-send`，也可以显式提到 `$aix-send`。安装为插件后，也可以直接说：

```text
用 aix 把当前 Codex 会话发到 dkqdev
```

面向复用分发时，Codex 推荐用 plugin，而不是把一个裸 skill 文件夹塞进任意目录。本仓库的 Codex plugin 位于：

```text
plugins/aix/.codex-plugin/plugin.json
plugins/aix/skills/aix-send/SKILL.md
.agents/plugins/marketplace.json
```

Claude Code 的项目级 skill 目录是 `.claude/skills/<skill-name>/SKILL.md`。本仓库提供的 Claude Code skill 是：

```text
.claude/skills/aix-send/SKILL.md
```

作为项目级 skill 时，可在 Claude Code 里用 slash command 触发：

```text
/aix-send dkqdev
```

Claude Code 的 plugin 分发入口是：

```text
.claude-plugin/marketplace.json
plugins/aix/.claude-plugin/plugin.json
plugins/aix/skills/aix-send/SKILL.md
```

作为已安装 plugin 的 skill 时，Claude Code 使用命名空间触发：

```text
/aix:aix-send dkqdev
```

## 前置条件

本机需要：

- Node.js `>=20`
- `ssh`
- `rsync`
- 本机已有 Codex 或 Claude Code session

远端机器需要：

- `ssh` 可登录
- `rsync`
- `tmux`
- 对应工具：`codex` 或 `claude`
- 可写目录：`~/aix`

先用 `doctor` 检查：

```bash
aix doctor dkqdev --tool codex
aix doctor user@example.com:2222 --tool claude
```

## 快速开始

先查看将要迁移什么，不做任何远端写入：

```bash
aix send dkqdev --tool codex --dry-run
```

真实迁移当前工作区和 Codex 会话：

```bash
aix send dkqdev --tool codex
```

指定 session：

```bash
aix send dkqdev --tool codex --session 019ef37d-048a-75f2-b347-3f3f0d73dcc0
aix send dkqdev --tool claude --session 552e89a4-2eaf-4d15-a6e1-2c9df8fd0cdd
```

迁移成功后，`aix` 会打印 attach 命令：

```bash
ssh -t -- 'dkqdev' 'tmux attach -t '\''=aix-codex-019ef37d'\'''
```

检查远端状态：

```bash
aix list dkqdev
aix status dkqdev aix-codex-019ef37d
```

## 命令

```bash
aix doctor <target> [--tool codex|claude]
aix send <target> [--tool codex|claude] [--session <id>] [--dry-run]
aix send <target> [--name <task-name>] [--fork]
aix send <target> [--continue-prompt "..."] [--prompt-file <path>]
aix attach <target> <tmux-session>
aix status <target> [tmux-session]
aix list <target>
```

`target` 支持：

```text
dkqdev
user@example.com
user@example.com:2222
ssh://user@example.com:2222
```

## 迁移内容

`aix send` 会执行以下步骤：

1. 探测本地 Codex / Claude Code session。
2. 读取 git 状态，生成 manifest。
3. 在远端创建新的 workspace。
4. 使用 `rsync` 复制当前工作区快照。
5. 安装迁移后的 AI session。
6. 写入 `.aix/manifest.json` 和 `.aix/HANDOFF.md`。
7. 启动远端 detached `tmux` session，运行官方 resume 命令。

Codex 会安装到远端 `~/.codex/sessions/...`，并更新 `~/.codex/session_index.jsonl`。

Claude Code 会安装到远端 `~/.claude/projects/<encoded-cwd>/...`，并追加 `~/.claude/history.jsonl`，以便 `claude --resume` 能找到会话。

## 安全边界

`aix` 故意保持 V1 行为简单：

- 不处理 SSH 密码，也不保存远端凭据。
- 不自动安装远端依赖。
- 不覆盖已存在的远端 workspace、session 文件或 tmux session。
- 不默认 attach 到远端 tmux。
- 不默认发送继续 prompt。
- 不把 workspace 打包成单文件 bundle，直接使用 `rsync + manifest`。

如果你需要继续 prompt，建议使用文件：

```bash
aix send dkqdev --tool codex --prompt-file ./handoff-prompt.txt
```

## 发布到 npm

这个项目通过 GitHub Actions 自动发布到 npm。正常流程不需要本地执行 `npm version`，也不需要手动创建 tag：

```bash
git push origin main
```

推荐使用 npm Trusted Publishing。它通过 GitHub Actions 的 OIDC 身份发布，不需要在 GitHub Secrets 里长期保存 `NPM_TOKEN`。

npm Trusted Publishing 要求 GitHub-hosted runner、Node.js `>=22.14.0`、npm CLI `>=11.5.1`。本仓库的 publish workflow 使用 Node.js 24，并在发布前升级 npm。

发布前需要：

1. 在 npmjs.com 创建或拥有 `aix-handoff` 包名。
2. 在 npm 包设置里配置 Trusted Publisher，绑定这个 GitHub 仓库和 workflow。
3. 推送到 `main`。

本仓库包含 `.github/workflows/publish.yml`。每次 `main` 更新后，它会运行测试、类型检查、自动递增 patch 版本、写回 `package.json` / `package-lock.json`、创建 `v*` tag、构建、打包 dry-run，然后执行：

```bash
npm publish --access public --provenance
```

如果首次发布时 npm 还不能为未发布包配置 Trusted Publisher，可以先手动发布一次，或临时使用带 publish 权限并允许 bypass 2FA 的 npm granular token bootstrap；后续建议切回 Trusted Publishing。账号开启 2FA 时，普通登录态发布会要求 OTP：

```bash
npm publish --access public --registry=https://registry.npmjs.org/ --otp <one-time-code>
```

## 开发

```bash
npm install
npm test
npm run check
npm run build
npm pack --dry-run --json
```

本地运行：

```bash
npm run dev -- --help
node dist/cli.js send dkqdev --tool codex --dry-run
```

## English

`aix` is an AI execution handoff CLI. It moves a local Codex or Claude Code session, plus the current workspace snapshot, to a fresh remote workspace and starts the official resume command inside a detached remote `tmux` session.

The npm package name is `aix-handoff`; the installed binary is `aix`.

### Install

```bash
npm install -g aix-handoff
aix --help
```

### Codex / Claude Code Skill and Plugin

The npm package installs the `aix` CLI only. It does not automatically install Codex or Claude Code skills.

The repo-local Codex skill is:

```text
.agents/skills/aix-send/SKILL.md
```

For reusable Codex distribution, this repository also includes a plugin and marketplace entry:

```text
plugins/aix/.codex-plugin/plugin.json
plugins/aix/skills/aix-send/SKILL.md
.agents/plugins/marketplace.json
```

After the skill or plugin is available in Codex, trigger it explicitly with `$aix-send` or `/skills`, or ask Codex to hand off the current session with `aix`.

The repo-local Claude Code skill is:

```text
.claude/skills/aix-send/SKILL.md
```

After the project skill is available in Claude Code, trigger it with:

```text
/aix-send dkqdev
```

The Claude Code plugin entry is:

```text
.claude-plugin/marketplace.json
plugins/aix/.claude-plugin/plugin.json
plugins/aix/skills/aix-send/SKILL.md
```

After the plugin is installed, Claude Code uses the plugin namespace:

```text
/aix:aix-send dkqdev
```

### Requirements

Local machine:

- Node.js `>=20`
- `ssh`
- `rsync`
- an existing Codex or Claude Code session

Remote machine:

- SSH access
- `rsync`
- `tmux`
- `codex` or `claude`
- writable `~/aix`

### Quick Start

```bash
aix doctor dkqdev --tool codex
aix send dkqdev --tool codex --dry-run
aix send dkqdev --tool codex
aix list dkqdev
aix status dkqdev aix-codex-019ef37d
```

Send a specific session:

```bash
aix send dkqdev --tool codex --session <session-id>
aix send dkqdev --tool claude --session <session-id>
```

### What It Does

`aix send`:

1. discovers the local AI session,
2. inspects git state,
3. creates a fresh remote workspace,
4. copies the current working tree with `rsync`,
5. installs the migrated Codex or Claude Code session,
6. writes `.aix/manifest.json` and `.aix/HANDOFF.md`,
7. starts a detached remote `tmux` session with the official resume command.

### Release

The npm release path is fully automated through GitHub Actions plus npm Trusted Publishing. A push to `main` runs tests, bumps the patch version, writes the release commit and tag, then publishes to npm:

```bash
git push origin main
```

The included `.github/workflows/publish.yml` publishes with npm provenance and does not require a long-lived `NPM_TOKEN` secret.

## License

MIT
