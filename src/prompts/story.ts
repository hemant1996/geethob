import type { CommitMeta, StoryInput, DigestInput } from "../types.ts";

export const STORY_SYSTEM_PROMPT = `You are geethob, a tool that turns git history into prose narrative for code reviewers and AI agents.

Write 3 to 5 paragraphs. Strict rules:

- Prose only. No bullet lists. No headings. No tables. No bold lead-ins like "Summary:".
- Past tense for completed work. Present tense only if commits clearly describe in-progress threads.
- Name files, modules, and identifiers by their actual names from the commit data. Do not invent paths.
- Do not invent rationale that isn't in the commit messages. If a commit's intent is unclear, say so plainly rather than guessing.
- Focus on the arc: what was the goal, what changed about the approach, what got abandoned or replaced, what shipped.
- Avoid filler. Avoid "this commit adds" / "this PR" framing. Speak about the work, not the commits.
- Reference notable commits by short SHA in square brackets like [abc1234] sparingly — at most one per paragraph.
- Author attribution only when meaningful (multiple distinct authors, or one author's pattern stands out). Skip "Author X did Y" recitations.
- 200 to 600 words total. Calibrate to the amount of real signal in the input.`;

export const DIGEST_SYSTEM_PROMPT = `You are geethob, a tool that turns a developer's recent git activity into a short prose digest suitable for a Slack channel or a Monday-morning standup.

Write 2 to 4 paragraphs. Strict rules:

- Prose only. No bullet lists. No headings. No tables.
- Past tense. Lead with the most significant work, not the most recent.
- Name repos, files, and identifiers by their actual names. Do not invent paths.
- Do not invent rationale. If intent is unclear, say "the messages don't make the goal explicit" instead of guessing.
- Be specific. "Refactored authentication" is weak. "Replaced the session-cookie middleware with a JWT verifier in auth.ts" is strong.
- 120 to 300 words. Tighter than a story; longer than a tweet.
- No square-bracket SHA references; this is for humans skimming Slack.`;

export function renderStoryUserPrompt(input: StoryInput): string {
  const lines: string[] = [];
  lines.push(`Repository: ${input.repoIdentifier} (${input.source})`);
  if (input.scopePath) lines.push(`Scope path: ${input.scopePath}`);
  if (input.since) lines.push(`Since: ${input.since}`);
  if (input.truncated) lines.push(`Note: truncated to most recent ${input.truncated.kept} of ${input.truncated.total} commits.`);
  if (input.tokenTruncated) lines.push(`Note: shed oldest commits to fit context window (kept ${input.tokenTruncated.kept} of ${input.tokenTruncated.original}).`);
  lines.push("");
  lines.push(`${input.commits.length} commits, oldest first:`);
  lines.push("");
  lines.push(renderCommits(input.commits));
  lines.push("");
  lines.push("Write the narrative now.");
  return lines.join("\n");
}

export function renderDigestUserPrompt(input: DigestInput): string {
  const lines: string[] = [];
  lines.push(`Scope: ${input.identifier} (${input.source})`);
  if (input.author) lines.push(`Author: ${input.author}`);
  lines.push(`Since: ${input.since}`);
  if (input.truncated) lines.push(`Note: truncated to most recent ${input.truncated.kept} of ${input.truncated.total} commits.`);
  if (input.tokenTruncated) lines.push(`Note: shed oldest commits to fit context window (kept ${input.tokenTruncated.kept} of ${input.tokenTruncated.original}).`);
  lines.push("");
  lines.push(`${input.commits.length} commits, oldest first:`);
  lines.push("");
  lines.push(renderCommits(input.commits));
  lines.push("");
  lines.push("Write the digest now.");
  return lines.join("\n");
}

function renderCommits(commits: CommitMeta[]): string {
  const sorted = [...commits].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map(c => {
    const stats = c.filesChanged ? ` (+${c.insertions}/-${c.deletions} across ${c.filesChanged} files)` : "";
    const files = c.files.length ? `\n    files: ${c.files.slice(0, 8).join(", ")}${c.files.length > 8 ? ` … +${c.files.length - 8}` : ""}` : "";
    return `[${c.shortSha}] ${c.date.slice(0, 10)} ${c.author}: ${c.message}${stats}${files}`;
  }).join("\n\n");
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
