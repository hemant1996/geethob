---
name: geethob
description: Turn git history into prose narrative via the geethob CLI. Use when the user asks "what changed in this repo," "summarize these commits," "narrate the history of <feature>," "what did <person> ship last week," or any "tell me the story of …" question against a git repository or a GitHub user. Two modes — `story` (history of a repo/path) and `digest` (a developer's recent activity). Output is prose, not bullet lists.
---

# geethob

You have access to the `geethob` CLI, which turns git history into prose narrative. Use it whenever the user asks for a story-grained summary of code changes, instead of reading individual commits or diffs yourself.

## When to invoke

Invoke geethob for any of these:

- "What changed in `<repo or path>` lately?"
- "Summarize the last N commits / week / month."
- "Tell me the story of how `<feature>` was built."
- "What did `<author>` ship this week?"
- Before extending an existing feature — pull a narrative of its history first to ground your work.

Do **not** invoke geethob for:

- Reading a specific PR or diff line-by-line — use `gh pr view` / `git show` instead.
- File-level code questions ("what does this function do") — read the file directly.
- Anything outside a git repository.

## Usage

The binary lives on the user's `$PATH` as `geethob`. Run it via shell tool.

### `geethob story <scope>`

Narrate the history of a path or repo.

```bash
# Local repo, whole history (capped at 200 commits)
geethob story /path/to/repo

# Local repo, restricted to a subpath
geethob story /path/to/repo --path src/auth --since 30d

# Public GitHub repo
geethob story bun-sh/bun --max-commits 50

# Stream off (one-shot, useful if you're capturing output)
geethob story . --no-stream
```

### `geethob digest`

Narrate a developer's recent work.

```bash
# Current working tree, last 7 days
geethob digest --since 7d

# A single remote repo
geethob digest --repo facebook/react --since 14d

# A specific developer's public activity (when no local repo applies)
geethob digest --author tj --since 7d
```

### `geethob configure`

Writes `~/.config/geethob/config.toml` with an Anthropic API key. Skip if `ANTHROPIC_API_KEY` is already in the environment.

## Auth

- **Model API:** `ANTHROPIC_API_KEY` env var, or the stored config file.
- **GitHub (for remote scopes):** `gh auth status` session OR `GH_TOKEN` env var. Optional for `story` against a local clone.

## Exit codes

- 0 — Success (including empty commit range, which is not an error)
- 1 — Usage error
- 2 — Not a git repo or `git` missing
- 3 — Missing/invalid Anthropic key
- 4 — Model API error after one retry
- 5 — GitHub auth required, rate limited, or repo not found

## Notes for the agent

- Output is **prose**, not structured data. Don't post-process it into bullet lists.
- For long histories, geethob truncates to the most recent N commits and prints a warning. If the user needs older history, they should pass `--since <ref>` or raise `--max-commits`.
- geethob never sees the full diff — only commit messages + diffstats. This keeps narratives at the story grain. If the user needs line-level analysis, read the diff yourself.
- The `geethob` binary must already be on `$PATH`. If it's not, suggest the user install it via `npm install -g geethob` or the single-binary download from https://github.com/hemant1996/geethob/releases.
