<p align="center">
  <img src="assets/logo.svg" alt="geethob logo" width="160" height="160" />
</p>

<h1 align="center">geethob</h1>

<p align="center">Turn git history into prose narrative.</p>

AI now writes code faster than humans can review it. A 2,000-line AI-generated PR is hard to read at the diff grain — but the value is at the *story* grain: what was attempted, what changed mid-flight, what shipped. `geethob` reads a repository and produces prose someone would actually forward.

Two modes in v0.1:

- **`geethob story <repo>`** — narrate the history of a feature, module, or the whole repo.
- **`geethob digest --since 7d`** — narrate a developer's recent work, formatted to paste cleanly into Slack or a PR comment.

Local-only. Bring your own model key. No server. Same binary works as a CLI for humans and a skill for AI harnesses.

## Install

Two paths, by use case.

### Use from an AI harness (Claude Code, Cursor, Hermes, OpenClaw, etc.)

**No API key. No npm. No configuration.** The skill is self-contained — it uses whatever model your harness already has access to. You're not paying twice or configuring twice.

Curl the skill file straight into your harness's skills directory:

```bash
# Claude Code
mkdir -p ~/.claude/skills/geethob && curl -fsSL https://raw.githubusercontent.com/hemant1996/geethob/main/skills/geethob/SKILL.md -o ~/.claude/skills/geethob/SKILL.md
```

Restart your harness (or reload skills) and ask "what's the story of `<any-repo>`" or "what did `<somebody>` ship this week."

For other harnesses, use the same `SKILL.md` from `skills/geethob/SKILL.md` in this repo — drop it into the harness's skills directory.

> **Why this works without a key:** the skill instructs your harness on (1) how to fetch git data with `git log` and `gh api`, and (2) the exact prose-voice system prompt. Your harness runs the prompt with its own model. There is no separate API call. The "AI" in this product is the prompt, not a service.

### Use as a standalone CLI (terminal, CI, scripts)

This path **does** need an Anthropic API key — because no agent is in the loop, the binary calls Claude itself.

```bash
npm install -g geethob
export ANTHROPIC_API_KEY=sk-ant-...
geethob story <path-or-owner/repo>
```

Or single-binary, no runtime:

```bash
# macOS arm64
curl -L https://github.com/hemant1996/geethob/releases/latest/download/geethob-darwin-arm64 -o /usr/local/bin/geethob && chmod +x /usr/local/bin/geethob

# macOS x64
curl -L https://github.com/hemant1996/geethob/releases/latest/download/geethob-darwin-x64 -o /usr/local/bin/geethob && chmod +x /usr/local/bin/geethob

# Linux x64
curl -L https://github.com/hemant1996/geethob/releases/latest/download/geethob-linux-x64 -o /usr/local/bin/geethob && chmod +x /usr/local/bin/geethob
```

This path is for terminal users, CI pipelines, cron jobs, anything not driven by an agent. If you're using geethob from inside Claude Code or a similar harness, you don't need this — use the skill install above.

## Configure

```bash
export ANTHROPIC_API_KEY=sk-ant-…
```

Or persist it on disk (file mode 0600):

```bash
geethob configure
```

For private GitHub repos, geethob also reads `gh auth status` (the GitHub CLI) or `GH_TOKEN` from the environment.

## Use

```bash
# Narrate the history of a feature
geethob story . --path src/auth --since 30d

# Narrate a public repo
geethob story bun-sh/bun --max-commits 50

# Your week, as a story
geethob digest --since 7d

# Someone else's public activity
geethob digest --author tj --since 14d
```

`--max-commits` defaults to 200. If the prompt would overflow Claude Sonnet's context window, geethob sheds the oldest commits to fit and prints a warning.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success (including empty commit range — that's not an error) |
| 1 | Usage error (bad flags) |
| 2 | `git` not on `$PATH` or scope is not a git repository |
| 3 | Missing or invalid Anthropic API key |
| 4 | Model API error (after one retry on 5xx) |
| 5 | GitHub API auth required, rate-limited, or repository not found |

## Build from source

```bash
git clone https://github.com/hemant1996/geethob && cd geethob
bun install
bun run dev story .
```

To produce a single binary:

```bash
bun run build:bin  # current platform
bun run build:bin:darwin-arm64
bun run build:bin:darwin-x64
bun run build:bin:linux-x64
```

## Design

See [DESIGN.md](./DESIGN.md) for the full scope, premises, and rationale behind v0.1. The short version: v1 ships two modes (`story`, `digest`) because we want to validate the prose-quality thesis before building a structured two-pass engine. PR-review narrative, multi-provider, multi-format, named voices, and MCP server mode are all v0.2+.

## License

MIT.
