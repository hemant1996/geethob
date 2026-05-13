# Changelog

## v0.1.2

- New `geethob skill install` subcommand wires the bundled skill into Claude Code in one step. The full install is now `npm install -g geethob && geethob skill install` — no GitHub SSH key required (unlike the `/plugin install` path on current Claude Code versions).
- Renamed the bundled skill from `narrate` to `geethob` so the package name and the skill name match. Invocation slash form is now `/geethob:geethob` (or the agent auto-invokes via the Skill tool).
- Dropped the legacy `skill/` directory; `skills/geethob/SKILL.md` is the single source of truth.
- Fixed the hardcoded `0.1.0` version string in `--version` output.

## v0.1.1

- Slim the npm package from ~70 MB to ~700 KB by excluding the compiled Bun binary (`dist/geethob`) from the published tarball. The binary still ships via GitHub Releases for the single-binary install path; npm users only need the JS bundle.
- Ship the Claude Code plugin manifest (`.claude-plugin/`) and the bundled skill (`skills/narrate/`) inside the npm package, so a global install also lights up the plugin path once Claude Code's HTTPS-source bug lands a fix.
- Include `assets/logo.svg` in the package so README rendering doesn't 404 if viewed from the npm tarball.

## v0.1.0

Initial release.

- `geethob story <scope>` — narrate the history of a local path or a public GitHub repo (`<owner>/<name>` form).
- `geethob digest --since 7d` — narrate recent activity for the current working tree, a single remote repo (`--repo`), or a GitHub user (`--author`, falls back to public events when no local repo applies).
- `geethob configure` — write `~/.config/geethob/config.toml` (mode 0600) with an Anthropic API key. Skipped automatically when `ANTHROPIC_API_KEY` is in the environment.
- Single-binary builds for macOS arm64, macOS x64, Linux x64 via `bun build --compile`.
- npm package (`bun add -g geethob` or `npm install -g geethob`) for Node ≥20.
- Claude Code skill via `skill/install.sh` and `skill/SKILL.md`.
- Hard cap of 200 commits per invocation (`--max-commits` to override), plus a token-budget pass that sheds oldest commits when the assembled prompt would exceed 150K tokens.
- Six documented exit codes (0 success, 1 usage, 2 no-git, 3 no-key, 4 model error, 5 GitHub auth/rate).
