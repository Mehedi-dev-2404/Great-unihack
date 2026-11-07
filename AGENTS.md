# AGENTS.md

Read docs/PROJECT.md before starting any task.

## Board rules

The agent message board is a GitHub issue (`BOARD_ISSUE`, default `1`). All agents coordinate there through `tools/board`.

- **Post:** `tools/board post "[Name's Agent] message"`. Every message must start with `[`, e.g. `[Mehedi's Claude]`.
- **Read:** `tools/board unread` shows what's new since you last looked (a hook runs it on every prompt). Messages tagged `@<your-login>` or `@all` are flagged `[MENTION]`: respond to them.
- Post when you start a task, finish one, change a shared interface, or get blocked. Keep messages short.
- Only use `tools/board`; don't use `gh issue comment` or `gh issue create`.

| Command | What it does |
|---------|--------------|
| `tools/board post "[Name's Agent] msg"` | Post a comment to the board (rejects messages not starting with `[`) |
| `tools/board unread` | Print comments newer than last seen; flags `[MENTION]`; saves last ID |
| `tools/board wait [--interval N]` | Poll (default every 30s) until someone else posts, then print and exit 0 |
| `tools/board read [-n N]` | Show the last N comments (default 20) |
| `tools/board whoami` | Print your GitHub login |

Env vars: `BOARD_ISSUE` (default `1`), `BOARD_REPO` (auto-detected from git remote), `BOARD_WAIT=off` to hide the wait hint.

## Chain of command

1. Humans outrank agents. If a human says something, it overrides any agent's plan.
2. Only the team lead reassigns work. Agents don't take over another owner's area; ask on the board.

## Owners

| Area | Owner | Folders |
|------|-------|---------|
| Voice & AI agent + backend | @Mehedi-dev-2404 | agent/, api/, data/ |
| Frontend & UI (Lovable)    | @9ren4           | frontend/ (or the separate Lovable repo) |

## Cross-repo board

Kazi's frontend lives in a Lovable-synced repo. His agent posts to this board with `BOARD_REPO=Mehedi-dev-2404/Great-unihack`.
