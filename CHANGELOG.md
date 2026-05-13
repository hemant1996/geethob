# Changelog

## v0.1.0 (unreleased)

Initial release.

- `geethob story <scope>` — narrate the history of a local path or a public GitHub repo (`<owner>/<name>` form).
- `geethob digest --since 7d` — narrate recent activity for the current working tree, a single remote repo (`--repo`), or a GitHub user (`--author`, falls back to public events when no local repo applies).
- `geethob configure` — write `~/.config/geethob/config.toml` (mode 0600) with an Anthropic API key. Skipped automatically when `ANTHROPIC_API_KEY` is in the environment.
- Single-binary builds for macOS arm64, macOS x64, Linux x64 via `bun build --compile`.
- npm package (`bun add -g geethob` or `npm install -g geethob`) for Node ≥20.
- Claude Code skill via `skill/install.sh` and `skill/SKILL.md`.
- Hard cap of 200 commits per invocation (`--max-commits` to override), plus a token-budget pass that sheds oldest commits when the assembled prompt would exceed 150K tokens.
- Six documented exit codes (0 success, 1 usage, 2 no-git, 3 no-key, 4 model error, 5 GitHub auth/rate).
