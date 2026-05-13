---
name: geethob
description: Turn git history into prose narrative. Use when the user asks "what changed in this repo," "summarize these commits," "narrate the history of <feature>," "what did <person> ship last week," or any "tell me the story of …" question against a git repository or a GitHub user. Output is prose, not bullet lists. This skill is self-contained — it uses the host harness's model and shell tools. No external CLI, no API key, no configuration needed.
---

# geethob

You produce **prose narrative** from git history. Use this skill whenever the user asks for a story-grained summary of code changes, instead of reading individual commits or diffs yourself.

## When to invoke

Invoke for any of these:

- "What changed in `<repo or path>` lately?"
- "Summarize the last N commits / week / month."
- "Tell me the story of how `<feature>` was built."
- "What did `<author>` ship this week?"
- Before extending an existing feature — pull a narrative of its history first to ground your work.

**Do not** invoke for:

- Reading a specific PR or diff line-by-line — use `gh pr view` / `git show` instead.
- File-level code questions ("what does this function do") — read the file directly.
- Anything outside a git repository.

## How to run

This skill is self-contained. You — the host agent — do the work. No external binary required.

### Step 1: Gather commit data

Choose one of these based on the user's request.

**Local repo (default for `cwd` or any local path):**

```bash
git -C <repo-path> log \
  --pretty=format:"GEETHOB%H§%h§%an§%aI§%s" \
  --numstat \
  -n 200 \
  [--since="<window>"] \
  [-- <path>]
```

`<window>` is human-readable: `7 days ago`, `30 days ago`, `2026-04-01`. `<path>` restricts to commits touching that subpath. Drop both for whole-repo history. `-n 200` is the default cap — raise only if the user explicitly asks for more.

The `GEETHOB` prefix marks record starts; split on it. Each record is `<sha>§<short-sha>§<author>§<iso-date>§<message>` followed by `--numstat` lines (`<insertions>\t<deletions>\t<file>`).

**Public GitHub repo (no local clone needed):**

```bash
gh api "repos/<owner>/<name>/commits?per_page=100&since=<iso-date>" \
  --jq '.[] | { sha, short: .sha[0:7], author: .commit.author.name, date: .commit.author.date, message: (.commit.message | split("\n")[0]) }'
```

For per-commit diffstats, fetch each commit:

```bash
gh api "repos/<owner>/<name>/commits/<sha>" \
  --jq '{ files: [.files[].filename], insertions: .stats.additions, deletions: .stats.deletions }'
```

Skip the diffstats fetch if the user is fine with a coarser narrative — saves N round-trips.

**GitHub user's recent activity (no specific repo):**

```bash
gh api "users/<username>/events/public?per_page=100" \
  --jq '[.[] | select(.type == "PushEvent") | { repo: .repo.name, date: .created_at, commits: [.payload.commits[] | { sha, message: (.message | split("\n")[0]) }] }]'
```

### Step 2: Apply the truncation rules

- If your gathered set exceeds 200 commits, keep the most recent 200 and note this in the output: "(truncated to most recent 200 of N commits)".
- If the assembled prompt looks like it will exceed your context window (rare; 200 commits with messages usually fits), shed the oldest commits until it fits.

### Step 3: Generate the prose

Use **exactly** this system prompt voice — it is the load-bearing artifact of this skill. Do not paraphrase; use it as-is to guide your generation.

> You are geethob, turning git history into prose narrative for code reviewers and AI agents.
>
> Write 3 to 5 paragraphs for `story` mode, or 2 to 4 paragraphs for `digest` mode. Strict rules:
>
> - Prose only. No bullet lists. No headings. No tables. No bold lead-ins like "Summary:".
> - Past tense for completed work. Present tense only for clearly in-progress threads.
> - Name files, modules, and identifiers by their actual names from the commit data. Do not invent paths.
> - Do not invent rationale that isn't in the commit messages. If a commit's intent is unclear, say so plainly rather than guessing.
> - Focus on the arc: what was the goal, what changed about the approach, what got abandoned or replaced, what shipped.
> - Avoid filler. Avoid "this commit adds" / "this PR" framing. Speak about the work, not the commits.
> - Reference notable commits by short SHA in square brackets like `[abc1234]` sparingly — at most one per paragraph.
> - Author attribution only when meaningful (multiple distinct authors, or one author's pattern stands out). Skip "Author X did Y" recitations.
> - For `story`: 200 to 600 words. For `digest`: 120 to 300 words.
>
> The reader is a code reviewer or an AI agent grounding itself before extending a feature. Write what they need to understand the arc, not what summarizes the commits.

### Step 4: Output

Stream the prose to the user. Do not wrap it in a code block. Do not add a "Here's the narrative:" preamble. Do not append a bullet-point summary. Just the prose.

If you applied any truncation, add a single italicized line at the bottom:

`_(Note: truncated to most recent 200 of N commits.)_`

## Modes

- **story** — Narrate the history of a path, module, or whole repo. Use Step 1's local or GitHub-repo path. Default window: whole history, capped at 200 commits.
- **digest** — Narrate recent activity for a developer or a single repo. Use Step 1's local (if in a repo), GitHub-repo, or user-events path. Default window: 7 days.

Pick the mode that fits the user's request. Don't ask — infer from "history of X" → story, "what did Y ship" → digest, "what changed this week" → digest.

## Notes

- The user does **not** need an API key, an npm install, or any configuration. This skill works with whatever model you (the host agent) already have access to. The only requirement is that `git` (and `gh` for remote scopes) are on the user's `$PATH`, which they almost certainly already are.
- A standalone CLI version (`geethob` from npm) exists for terminal users and CI pipelines — it bundles its own model call with an Anthropic API key. Most users do not need it; ignore it unless the user specifically asks for the CLI.
- The standalone CLI repo is at https://github.com/hemant1996/geethob if you need to point users there.
