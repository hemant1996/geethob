#!/usr/bin/env node
import { Command } from "commander";
import { runStory } from "./commands/story.ts";
import { runDigest } from "./commands/digest.ts";
import { runConfigure } from "./commands/configure.ts";
import { runSkillInstall } from "./commands/skill.ts";

const program = new Command();

program
  .name("geethob")
  .description("Turn git history into prose narrative. Open-source CLI + AI-harness skill.")
  .version("0.2.0");

program
  .command("story")
  .description("Narrate the history of a feature, module, or whole repo.")
  .argument("<scope>", "Local path, or '<owner>/<repo>' for a remote GitHub repository")
  .option("--path <subpath>", "Restrict to commits touching this path inside the repo")
  .option("--since <ref>", "Git ref (e.g. v1.2.0) or duration (e.g. 30d)")
  .option("--max-commits <n>", "Max commits to consider (default 200)", v => parseInt(v, 10), 200)
  .option("--model <id>", "Override default Anthropic model")
  .option("--no-stream", "Wait for the full response instead of streaming")
  .action(async (scope: string, opts: { path?: string; since?: string; maxCommits: number; model?: string; stream?: boolean }) => {
    const code = await runStory({
      scope,
      path: opts.path,
      since: opts.since,
      maxCommits: opts.maxCommits,
      model: opts.model,
      noStream: opts.stream === false,
    });
    process.exit(code);
  });

program
  .command("digest")
  .description("Narrate recent activity for a developer, repo, or current working tree.")
  .option("--since <window>", "Duration (e.g. 7d, 30d) or ISO date", "7d")
  .option("--author <user>", "Filter to a specific author (local) or GitHub user (remote)")
  .option("--repo <owner/name>", "Walk a single remote GitHub repository")
  .option("--max-commits <n>", "Max commits to consider (default 200)", v => parseInt(v, 10), 200)
  .option("--model <id>", "Override default Anthropic model")
  .option("--no-stream", "Wait for the full response instead of streaming")
  .action(async (opts: { since: string; author?: string; repo?: string; maxCommits: number; model?: string; stream?: boolean }) => {
    const code = await runDigest({
      since: opts.since,
      author: opts.author,
      repo: opts.repo,
      maxCommits: opts.maxCommits,
      model: opts.model,
      noStream: opts.stream === false,
    });
    process.exit(code);
  });

program
  .command("configure")
  .description("Write an Anthropic API key to ~/.config/geethob/config.toml.")
  .action(async () => {
    const code = await runConfigure();
    process.exit(code);
  });

const skill = program.command("skill").description("Manage the geethob AI-harness skill.");
skill
  .command("install")
  .description("Install the geethob skill into a local AI harness (Claude Code by default).")
  .option("--target <name>", "Harness to install into: claude-code (default).", "claude-code")
  .option("--force", "Overwrite an existing skill file.", false)
  .action(async (opts: { target?: "claude-code"; force?: boolean }) => {
    const code = await runSkillInstall({ target: opts.target, force: opts.force });
    process.exit(code);
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`Unhandled error: ${msg}\n`);
  process.exit(1);
});
