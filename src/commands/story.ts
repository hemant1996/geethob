import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { LocalGit } from "../git/local.ts";
import { GitHub, parseRepoSpec, resolveGitHubToken } from "../github/api.ts";
import { AnthropicProvider } from "../providers/anthropic.ts";
import { STORY_SYSTEM_PROMPT, renderStoryUserPrompt, estimateTokens } from "../prompts/story.ts";
import { loadConfig, resolveAnthropicKey, resolveModel } from "../config/config.ts";
import {
  EXIT_OK, EXIT_NO_GIT, EXIT_NO_KEY, EXIT_API_ERROR, EXIT_AUTH_OR_RATE,
} from "../types.ts";
import type { CommitMeta, StoryInput } from "../types.ts";

const TOKEN_BUDGET = 150_000;

export interface StoryOptions {
  scope: string;
  path?: string;
  since?: string;
  maxCommits: number;
  model?: string;
  noStream?: boolean;
}

export async function runStory(opts: StoryOptions): Promise<number> {
  const cfg = loadConfig();
  const apiKey = resolveAnthropicKey(cfg);
  if (!apiKey) {
    process.stderr.write("Set ANTHROPIC_API_KEY or run `geethob configure`.\n");
    return EXIT_NO_KEY;
  }

  let commits: CommitMeta[];
  let source: "local" | "remote";
  let repoIdentifier: string;

  const localPath = resolve(opts.scope);
  const looksLikeRepoSpec = parseRepoSpec(opts.scope) && !existsSync(localPath);

  if (looksLikeRepoSpec) {
    const spec = parseRepoSpec(opts.scope)!;
    const token = resolveGitHubToken();
    const gh = new GitHub(token);
    try {
      commits = await gh.repoCommits({
        owner: spec.owner, repo: spec.repo,
        path: opts.path,
        maxCount: opts.maxCommits,
      });
    } catch (e: unknown) {
      return handleGitHubError(e);
    }
    source = "remote";
    repoIdentifier = `${spec.owner}/${spec.repo}`;
  } else {
    if (!existsSync(localPath)) {
      process.stderr.write(`Path does not exist: ${localPath}\n`);
      return EXIT_NO_GIT;
    }
    const git = new LocalGit(localPath);
    if (!(await git.isRepo())) {
      process.stderr.write(`Not a git repository: ${localPath}\n`);
      return EXIT_NO_GIT;
    }
    commits = await git.commits({
      since: opts.since,
      path: opts.path,
      maxCount: opts.maxCommits,
    });
    source = "local";
    repoIdentifier = localPath;
  }

  if (!commits.length) {
    process.stdout.write("No commits in the given range.\n");
    return EXIT_OK;
  }

  const truncated = undefined;

  const input: StoryInput = {
    source,
    repoIdentifier,
    scopePath: opts.path,
    since: opts.since,
    commits,
    truncated,
  };

  let userPrompt = renderStoryUserPrompt(input);
  if (estimateTokens(STORY_SYSTEM_PROMPT + userPrompt) > TOKEN_BUDGET) {
    const original = commits.length;
    while (commits.length > 1 && estimateTokens(STORY_SYSTEM_PROMPT + renderStoryUserPrompt({ ...input, commits })) > TOKEN_BUDGET) {
      commits.shift();
    }
    input.commits = commits;
    input.tokenTruncated = { kept: commits.length, original };
    userPrompt = renderStoryUserPrompt(input);
    process.stderr.write(`# Note: shed oldest commits to fit context window (kept ${commits.length} of ${original}).\n`);
  }

  const provider = new AnthropicProvider(apiKey);
  const model = resolveModel(cfg, opts.model);
  try {
    await provider.generate(STORY_SYSTEM_PROMPT, userPrompt, { stream: !opts.noStream, model });
  } catch (e: unknown) {
    return handleAnthropicError(e, provider, STORY_SYSTEM_PROMPT, userPrompt, model, !opts.noStream);
  }
  return EXIT_OK;
}

async function handleAnthropicError(
  e: unknown,
  provider: AnthropicProvider,
  system: string,
  user: string,
  model: string,
  stream: boolean,
): Promise<number> {
  const msg = errorMessage(e);
  const status = (e as { status?: number })?.status;
  if (status === 401) {
    process.stderr.write(`Anthropic auth failed: ${msg}\n`);
    return EXIT_NO_KEY;
  }
  if (status && status >= 500) {
    await sleep(2000);
    try {
      await provider.generate(system, user, { stream, model });
      return EXIT_OK;
    } catch (e2: unknown) {
      process.stderr.write(`Anthropic API error after retry: ${errorMessage(e2)}\n`);
      return EXIT_API_ERROR;
    }
  }
  process.stderr.write(`Anthropic error: ${msg}\n`);
  return EXIT_API_ERROR;
}

function handleGitHubError(e: unknown): number {
  const status = (e as { status?: number })?.status;
  const msg = errorMessage(e);
  if (status === 401) {
    process.stderr.write("Auth required; run `gh auth login` or set GH_TOKEN.\n");
    return EXIT_AUTH_OR_RATE;
  }
  if (status === 403 || status === 429) {
    process.stderr.write(`Rate limited or forbidden: ${msg}\n`);
    return EXIT_AUTH_OR_RATE;
  }
  if (status === 404) {
    process.stderr.write(`Repository not found: ${msg}\n`);
    return EXIT_AUTH_OR_RATE;
  }
  process.stderr.write(`GitHub API error: ${msg}\n`);
  return EXIT_API_ERROR;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export { handleGitHubError, handleAnthropicError };
