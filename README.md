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

### Claude Code

```
/plugin marketplace add hemant1996/geethob
/plugin install geethob@hemant1996
```

The plugin bundles the `narrate` skill. Claude Code's Skill tool will invoke it automatically when you ask story-grained questions about a repo; you can also call it explicitly with `/geethob:narrate`.

### npm (CLI + every other harness)

```bash
npm install -g geethob
```

Requires Node ≥20 or Bun ≥1.1. After install, `geethob` is on your `$PATH` and any harness that can run shell tools (Cursor, Codex, Hermes, OpenClaw, plain terminal) can use it.

### Single-binary (no runtime needed)

Download from [the latest release](https://github.com/hemant1996/geethob/releases/latest), drop it on your `$PATH`, `chmod +x`:

```bash
# macOS arm64
curl -L https://github.com/hemant1996/geethob/releases/latest/download/geethob-darwin-arm64 -o /usr/local/bin/geethob && chmod +x /usr/local/bin/geethob

# macOS x64
curl -L https://github.com/hemant1996/geethob/releases/latest/download/geethob-darwin-x64 -o /usr/local/bin/geethob && chmod +x /usr/local/bin/geethob

# Linux x64
curl -L https://github.com/hemant1996/geethob/releases/latest/download/geethob-linux-x64 -o /usr/local/bin/geethob && chmod +x /usr/local/bin/geethob
```

### Hermes / OpenClaw / Cursor / Codex / MCP host

Run `npm install -g geethob` first, then drop the skill into your harness's skills directory. For Claude Code, the plugin install above does this for you. For others, copy `skills/narrate/SKILL.md` to your harness's skills path; the binary is already on `$PATH`. PRs welcome with one-line install snippets for any harness you've tested — see [`skills/narrate/SKILL.md`](./skills/narrate/SKILL.md).

`geethob serve` (MCP server mode) is on the v0.2 roadmap.

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
