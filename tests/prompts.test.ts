import { describe, test, expect } from "bun:test";
import {
  STORY_SYSTEM_PROMPT,
  DIGEST_SYSTEM_PROMPT,
  renderStoryUserPrompt,
  renderDigestUserPrompt,
  estimateTokens,
} from "../src/prompts/story.ts";
import type { CommitMeta, StoryInput, DigestInput } from "../src/types.ts";

const sampleCommit = (i: number): CommitMeta => ({
  sha: `${i}`.padStart(40, "a"),
  shortSha: `${i}`.padStart(7, "a"),
  author: i % 2 === 0 ? "Alice" : "Bob",
  date: `2026-05-${String(i % 28 + 1).padStart(2, "0")}T12:00:00Z`,
  message: `commit number ${i} doing thing ${i}`,
  filesChanged: 2,
  insertions: 10 + i,
  deletions: 5,
  files: [`src/file${i}.ts`, `tests/file${i}.test.ts`],
});

describe("prompt rendering", () => {
  test("story prompt includes scope, since, and commit data", () => {
    const input: StoryInput = {
      source: "local",
      repoIdentifier: "/tmp/my-repo",
      scopePath: "src/auth",
      since: "30d",
      commits: [sampleCommit(1), sampleCommit(2), sampleCommit(3)],
    };
    const rendered = renderStoryUserPrompt(input);
    expect(rendered).toContain("/tmp/my-repo");
    expect(rendered).toContain("src/auth");
    expect(rendered).toContain("30d");
    expect(rendered).toContain("commit number 1");
    expect(rendered).toContain("Alice");
    expect(rendered).toContain("Bob");
    expect(rendered).toContain("3 commits");
  });

  test("story prompt notes truncation when set", () => {
    const input: StoryInput = {
      source: "remote",
      repoIdentifier: "owner/repo",
      commits: [sampleCommit(1)],
      truncated: { kept: 200, total: 847 },
    };
    const rendered = renderStoryUserPrompt(input);
    expect(rendered).toContain("200 of 847");
  });

  test("digest prompt includes since and author", () => {
    const input: DigestInput = {
      source: "remote-events",
      identifier: "octocat",
      author: "octocat",
      since: "7d",
      commits: [sampleCommit(1), sampleCommit(2)],
    };
    const rendered = renderDigestUserPrompt(input);
    expect(rendered).toContain("octocat");
    expect(rendered).toContain("7d");
    expect(rendered).toContain("2 commits");
  });

  test("commits are sorted oldest-first inside the prompt", () => {
    const newer: CommitMeta = { ...sampleCommit(1), date: "2026-05-10T00:00:00Z", message: "newer" };
    const older: CommitMeta = { ...sampleCommit(2), date: "2026-05-01T00:00:00Z", message: "older" };
    const input: StoryInput = {
      source: "local",
      repoIdentifier: ".",
      commits: [newer, older],
    };
    const rendered = renderStoryUserPrompt(input);
    expect(rendered.indexOf("older")).toBeLessThan(rendered.indexOf("newer"));
  });

  test("system prompts ban bullets and headings explicitly", () => {
    expect(STORY_SYSTEM_PROMPT).toContain("No bullet lists");
    expect(STORY_SYSTEM_PROMPT).toContain("No headings");
    expect(DIGEST_SYSTEM_PROMPT).toContain("No bullet lists");
  });

  test("token estimator is roughly chars/3.5", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a".repeat(35))).toBe(10);
    expect(estimateTokens("a".repeat(350))).toBe(100);
  });
});
