# Design: geethob — narrative-from-git for humans and agents

## Problem Statement

AI now writes code faster than humans can review it. A typical AI-assisted PR can be 500–2000 lines of diff that a reviewer has to read at the line-grain — but the value is at the *story* grain: what was attempted, what changed in approach mid-flight, what got abandoned. Diff-grained review is the wrong altitude for AI-generated work.

geethob is an open-source CLI + AI-harness skill that turns git history into prose narrative. V1 narrates the *past* (repo origin stories, team/personal weekly digests). V2 attacks the harder problem (per-PR review narrative) once the engine is trusted. The deliverable is fully local: bring-your-own model key, bring-your-own GitHub auth, no server.

## What Makes This Cool

Three things, in order:

1. **Prose, not bullet points.** Every existing tool in this space (Lumen, git-cliff, AI-Changelog-Generator, Gitmore, Changeish) produces structured summaries — categorized bullets, conventional-commit tables, Slack-ready lists. geethob produces *prose someone would actually forward*. The launch screenshot is a paragraph, not a table.

2. **Dual audience, same output.** The CLI is for humans at a terminal. The skill (Claude Code / Hermes / OpenClaw / Cursor / generic MCP) is for AI agents grounding themselves before extending a feature. Same engine, same output, two readers. Every other tool in this space assumed the reader was human; geethob ships expecting that half the readers will be agents.

3. **Runs anywhere with zero infra.** `bun add -g geethob` (or download the single-binary release). Configure once. Works on your laptop, in a devcontainer, in CI, or invoked through any AI harness that can run shell tools. No SaaS dependency.

## Constraints

- **Local only.** No server, no telemetry, no hosted backend. All compute (git reading, GitHub API calls, model calls) happens on the user's machine.
- **BYO keys.** User provides their own model API key (Anthropic, OpenAI, Google, local Ollama) and their own GitHub auth (PAT or `gh auth` session). geethob never sees, stores, or proxies credentials.
- **Two modes only in V1.** `geethob story <scope>` and `geethob digest --since <duration>`. Personal/single-repo digest only; team/multi-repo, mcp-anchored output, named voices, and MCP server mode are all V2+.
- **Prose-grade output is non-negotiable.** If V1 ships with bullet-shaped output, the whole thesis collapses; we'd be a worse Lumen.
- **Skill-distributable.** A `SKILL.md` ships alongside the CLI so any compatible harness can invoke geethob as a tool with one line of config.

## Design Principles

1. **V1 is a local CLI that ALSO ships as a skill for AI harnesses.** Same binary, dual audience: human at the terminal, agent calling the tool.
2. **V1 ships two modes only:** `geethob story <repo>` (origin-narrative of a feature/module) and `geethob digest --since 7d` (personal/single-repo weekly digest). PR-review-narrative is explicitly V2 — we don't ship it half-baked.
3. **BYO model key, BYO GitHub auth.** No server, no telemetry, no hosted backend. Config via `~/.config/geethob/config.toml` or env vars (`ANTHROPIC_API_KEY`, `GH_TOKEN`). Works fully offline against a local clone for `story`; calls GitHub API for `digest`.
4. **Output is narrative prose, not bullet lists.** The differentiation against Lumen / Gitmore / git-cliff IS the prose quality. The launch screenshot has to read like prose someone would forward.

## Approaches Considered

### Approach A: Weekend MVP — Bun TypeScript CLI, single-pass engine (CHOSEN)
Bun TypeScript CLI. Engine: gather commits via `simple-git` (local) or `@octokit/rest` (remote), stuff into one model call, prompt asks for narrative prose. Skill wrapper is a thin `SKILL.md` that shells out to the CLI. Realistic V1 scope: 2–3 weekends, ~1.5K LOC. Risk: prose quality is whatever the model gives you; token windows cap repo size.

### Approach B: Real engine — Rust/Go binary, two-pass extract-then-compose
Single static binary shipped via cargo/brew/npm wrapper. Pass 1 extracts semantic events from commit messages + diff shape (refactor / feature add / bugfix / migration) into a JSON event timeline. Pass 2 composes prose from the timeline with templated prompts. Configurable "voices." MCP server mode built in. 3–4 weekends, ~3K LOC. Higher ceiling, much bigger pre-user investment.

### Approach C: Skill-native — MCP server first, CLI is the wrapper
Lean into the agent-reader thesis. Primary deliverable is an MCP server exposing `geethob.story` and `geethob.digest` as tools. Output is structured narrative — prose with embedded anchors (commit SHAs, file:line, semantic spans) that agents can dereference. CLI is a thin client. GTM is skill marketplace listings, not CLI installs. 2–3 weekends. Bold bet on the agent-reader thesis being correct.

## Recommended Approach

**Approach A: Weekend MVP.** Rationale: we don't yet know whether the eventual prose-quality ceiling is a model-capability problem (improves on its own as Claude/GPT get better) or an engineering problem (needs B's two-pass extraction). A answers that question in 2–3 weekends. If A's output is praised, the engine is fine and we invest in distribution. If A's output is hated for being inconsistent, that's the signal to invest in B's structured engine.

Concrete V1 plan:

**Language: Bun + TypeScript.** Single binary via `bun build --compile`, fast iteration, no virtualenv pain for installers, official SDKs for every model provider, mature ecosystem (`@octokit/rest`, `simple-git`, `@anthropic-ai/sdk`). Locks Distribution Plan to npm + GitHub Releases.

**Model provider (V1 ships ONE): Anthropic only.** Use `@anthropic-ai/sdk`. Default model: `claude-sonnet-4-6` with a documented fallback (`claude-sonnet-4-5`) for accounts that don't yet have access. Model ID is overridable via `--model <id>` or `GEETHOB_MODEL`. Build a `ModelProvider` interface so OpenAI / Google / Ollama can be added in V2 without refactoring.

**Auth: `gh` CLI session or `GH_TOKEN` env var only.** No OAuth device flow in V1 — `gh auth status` already covers >95% of the target audience and adds zero credential-handling code.

**CLI surface (V1):**
- `geethob story <repo-path> [--path <subpath>] [--since <git-ref>] [--max-commits N]` — narrate the history of a feature/module. Default scope: all commits touching `<repo-path>` (or `<subpath>` if given), most recent 200 commits. `--since v1.2.0` or `--since 30d` overrides.
- `geethob digest [--since 7d] [--author <user>] [--repo <owner/name>]` — narrate a developer's recent activity. Resolution rules: if `--repo` is given, walks that repo only. If `--repo` is omitted but a `git` working tree exists in `cwd`, defaults to that repo. If neither, requires `--author <user>` and walks that user's recent public events via the GitHub Events API (capped at 100 events to stay well under rate limits — same truncation principle as `story`). Output format: GitHub-flavored markdown (pastes into Slack with light fidelity loss, into GitHub PR comments at full fidelity, readable as plain text in a terminal). Multi-repo team digest is V2.
- `geethob configure` — V1 behavior: prompts once for an Anthropic API key, writes `~/.config/geethob/config.toml`, exits. If `ANTHROPIC_API_KEY` is already in env, prints confirmation that no config is needed and exits. No multi-step wizard, no provider selection — that's V1.1.

**Engine (single-pass, with explicit budget):**
1. Resolve scope to commit set via `simple-git` (local) or `@octokit/rest` (remote).
2. Apply commit budget: hard cap at `--max-commits` (default 200). If the resolved set exceeds the cap, truncate to the most recent N and emit a warning line: `# Note: truncated to most recent 200 of 847 commits`. No sampling, no chunking in V1 — truncation is the explicit failure mode.
3. Token-budget check: after assembling the prompt input, count tokens with `@anthropic-ai/tokenizer`. If input exceeds 150K tokens (well under Sonnet's 200K context), shed commits oldest-first until under budget and emit a second warning line. This handles the rare case where 200 commits with long messages still overflow.
4. Fetch commit metadata (SHA, author, date, message) and **diffstat only**, not full diffs. Saves tokens, keeps prose at story-grain.
5. Two-part prompt: a **system prompt** that defines the prose style (3–5 paragraphs, narrative voice, no bullets, no headings, present-tense for current work and past-tense for completed work, name files and modules by their actual names, do not invent rationale that isn't in the commit messages), and a **user prompt** containing the rendered commit data. The system prompt is the load-bearing artifact for prose quality — it gets iterated, version-controlled in `src/prompts/`, and tuned against a fixture set of 5–10 real repos.
6. Stream output to stdout via SDK streaming API.

**Error and empty-state behavior (V1 must handle):**
- Empty commit range → exit 0, print one-line "No commits in <range>" — do not call the model.
- Missing `git` binary → exit 2, print "geethob requires git on PATH."
- Missing/invalid API key → exit 3, print "Set ANTHROPIC_API_KEY or run `geethob configure`."
- Model API 5xx / timeout → retry once with 2s backoff, then exit 4 with the upstream error.
- GitHub API 403 rate limit → exit 5 with "Rate limited; retry in <reset-time>." (V1 documents but does not auto-wait.)
- Private repo without auth → exit 5 with "Auth required; run `gh auth login` or set GH_TOKEN."

**Skill packaging.** Ship `SKILL.md` and an `install.sh` in `skill/` that copies the skill to `~/.claude/skills/geethob/` (Claude Code). Document Hermes / OpenClaw / Cursor install paths in README — `install.sh` only handles Claude Code in V1; other harnesses get docs, not automation. MCP server (`geethob serve`) is V2.

**Out of V1 scope (explicit):** OAuth device flow, Python distribution, multiple model providers, team digest with multi-author/multi-repo, multiple output formats, mcp-anchored output, named voices, interactive configure walkthrough, automatic rate-limit waiting.

## Open Questions

1. **Who is the named first user?** Before launch, we should be able to name one specific developer (myself counts) who wakes up next Monday and runs `geethob digest --since 7d` on their own activity. If we can't name one, the launch story is incomplete.
2. **What's the launch artifact?** A README screenshot, a Twitter thread with sample output, a Show HN, or a Claude Code marketplace listing? Pick one primary channel before V1 lands; the prose voice should be tuned for whichever audience reads it first.
3. **License.** MIT or Apache-2.0 are the obvious choices for OSS dev tools. AGPL would limit the audience for no clear gain here. Pick before pushing the first commit.

## Known Concerns

1. **Slack-fidelity markdown.** V1 emits GitHub-flavored markdown. Slack's `mrkdwn` is not CommonMark — paste will lose link formatting and any tables. Acceptable for V1. A `--format slack` flag that emits true `mrkdwn` is V2.
2. **Three-arch CI matrix is non-trivial.** Half a weekend of GitHub Actions yak-shaving. Necessary for the "users without Bun installed" install path; can be deferred behind shipping the npm-only V1.0 first if scope blows.

## Success Criteria

V1 ships when all of these are true:
- A user can run `bun add -g geethob` (or download the single-binary release) and have a working binary on their PATH
- `geethob configure` writes a working config file given an `ANTHROPIC_API_KEY`
- `geethob story <a-public-repo>` produces 3–5 paragraphs of readable narrative prose against a real repo in under 60 seconds (wall-clock, including model latency)
- `geethob digest --since 7d` produces a markdown-formatted story of the last week's activity that pastes cleanly into Slack and GitHub
- All six error/empty states listed in the Recommended Approach exit cleanly with the documented exit codes and messages
- The output, screenshotted, is something we'd be proud to post in a launch tweet
- A `SKILL.md` exists that lets Claude Code invoke geethob with one line of config; Hermes / OpenClaw / Cursor install paths are documented in README

Stretch (not blocking V1): 100 GitHub stars within 30 days of Show HN.

## Distribution Plan

- **Source:** Public GitHub repo. MIT or Apache-2.0 (decide before first push).
- **Primary install channel (V1):** Single-binary release via GitHub Releases. `bun build --compile --target=bun-darwin-arm64` / `bun-darwin-x64` / `bun-linux-x64`. CI matrix builds all three from GitHub-hosted runners. Users without Bun or Node installed are covered by this path. Windows is V2.
- **Secondary install (V1):** `npm install -g geethob` for users who already have a Node ≥20 or Bun ≥1.1 runtime. Same source, just shipped as a JS package. No PyPI track in V1.
- **AI-harness distribution (V1):**
  - `SKILL.md` in `skill/` directory of the repo
  - `skill/install.sh` installs into Claude Code's `~/.claude/skills/geethob/`
  - README has documented install paths for Hermes, OpenClaw, Cursor (one-paragraph each — manual copy, no automation in V1)
- **MCP server mode (V2):** `geethob serve` exposes `geethob.story` and `geethob.digest` as MCP tools.
- **CI/CD pipeline:** GitHub Actions. On tag push: build binaries for macOS-arm64 / macOS-x64 / linux-x64 from the matching runner, attach to GitHub Release, publish to npm. Release notes are hand-written for V1; the "use geethob to generate its own release notes" meta-moment is V1.1 polish.

## Dependencies

- **AI model:** Anthropic API key (`ANTHROPIC_API_KEY` env var or `~/.config/geethob/config.toml`). One provider in V1; others V2.
- **GitHub auth:** `gh auth status` session OR `GH_TOKEN` env var. Required for `digest` and for `story` against remote repos; optional for `story` against a local clone.
- **System:** `git` on PATH. Bun ≥1.1 if installing from npm; no runtime dependency if using the single-binary release.
