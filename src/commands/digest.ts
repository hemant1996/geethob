import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { LocalGit } from "../git/local.ts";
import { GitHub, parseRepoSpec, resolveGitHubToken } from "../github/api.ts";
import { AnthropicProvider } from "../providers/anthropic.ts";
import { DIGEST_SYSTEM_PROMPT, renderDigestUserPrompt, estimateTokens } from "../prompts/story.ts";
import { loadConfig, resolveAnthropicKey, resolveModel } from "../config/config.ts";
import {
  EXIT_OK, EXIT_NO_GIT, EXIT_NO_KEY, EXIT_API_ERROR, EXIT_USAGE,
} from "../types.ts";
import { handleAnthropicError, handleGitHubError } from "./story.ts";
import type { CommitMeta, DigestInput } from "../types.ts";

const TOKEN_BUDGET = 150_000;

export interface DigestOptions {
  since: string;
  author?: string;
  repo?: string;
  maxCommits: number;
  model?: string;
  noStream?: boolean;
}

export async function runDigest(opts: DigestOptions): Promise<number> {
  const cfg = loadConfig();
  const apiKey = resolveAnthropicKey(cfg);
  if (!apiKey) {
    process.stderr.write("Set ANTHROPIC_API_KEY or run `geethob configure`.\n");
    return EXIT_NO_KEY;
  }

  let commits: CommitMeta[];
  let source: DigestInput["source"];
  let identifier: string;

  if (opts.repo) {
    const spec = parseRepoSpec(opts.repo);
    if (!spec) {
      process.stderr.write(`Invalid --repo: expected <owner>/<name>, got '${opts.repo}'.\n`);
      return EXIT_USAGE;
    }
    const token = resolveGitHubToken();
    const gh = new GitHub(token);
    try {
      commits = await gh.repoCommits({
        owner: spec.owner, repo: spec.repo,
        since: parseSince(opts.since),
        author: opts.author,
        maxCount: opts.maxCommits,
      });
    } catch (e: unknown) {
      return handleGitHubError(e);
    }
    source = "remote-repo";
    identifier = `${spec.owner}/${spec.repo}`;
  } else {
    const cwd = process.cwd();
    const git = new LocalGit(cwd);
    if (await git.isRepo()) {
      commits = await git.commits({
        since: opts.since,
        maxCount: opts.maxCommits,
      });
      if (opts.author) {
        commits = commits.filter(c => c.author.toLowerCase().includes(opts.author!.toLowerCase()));
      }
      source = "local";
      identifier = cwd;
    } else if (opts.author) {
      const token = resolveGitHubToken();
      const gh = new GitHub(token);
      try {
        commits = await gh.userEvents({
          username: opts.author,
          since: parseSince(opts.since),
          maxCount: Math.min(opts.maxCommits, 100),
        });
      } catch (e: unknown) {
        return handleGitHubError(e);
      }
      source = "remote-events";
      identifier = opts.author;
    } else {
      process.stderr.write("Not in a git repo. Pass --repo <owner>/<name> or --author <user>.\n");
      return EXIT_NO_GIT;
    }
  }

  if (!commits.length) {
    process.stdout.write(`No commits in the given range.\n`);
    return EXIT_OK;
  }

  const input: DigestInput = {
    source,
    identifier,
    since: opts.since,
    author: opts.author,
    commits,
  };

  let userPrompt = renderDigestUserPrompt(input);
  if (estimateTokens(DIGEST_SYSTEM_PROMPT + userPrompt) > TOKEN_BUDGET) {
    const original = commits.length;
    while (commits.length > 1 && estimateTokens(DIGEST_SYSTEM_PROMPT + renderDigestUserPrompt({ ...input, commits })) > TOKEN_BUDGET) {
      commits.shift();
    }
    input.commits = commits;
    input.tokenTruncated = { kept: commits.length, original };
    userPrompt = renderDigestUserPrompt(input);
  }

  const provider = new AnthropicProvider(apiKey);
  const model = resolveModel(cfg, opts.model);
  try {
    await provider.generate(DIGEST_SYSTEM_PROMPT, userPrompt, { stream: !opts.noStream, model });
  } catch (e: unknown) {
    return handleAnthropicError(e, provider, DIGEST_SYSTEM_PROMPT, userPrompt, model, !opts.noStream);
  }
  return EXIT_OK;
}

function parseSince(s: string): Date | undefined {
  const m = s.match(/^(\d+)([dwmy])$/);
  if (m) {
    const [, n, unit] = m;
    const ms: Record<string, number> = { d: 86400e3, w: 7 * 86400e3, m: 30 * 86400e3, y: 365 * 86400e3 };
    return new Date(Date.now() - Number(n) * ms[unit!]!);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s);
  return undefined;
}
