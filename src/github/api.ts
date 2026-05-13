import { Octokit } from "@octokit/rest";
import { execSync } from "node:child_process";
import type { CommitMeta } from "../types.ts";

export function resolveGitHubToken(): string | undefined {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const out = execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim();
    if (out) return out;
  } catch { /* gh not installed or not logged in */ }
  return undefined;
}

export class GitHub {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async repoCommits(opts: { owner: string; repo: string; since?: Date; path?: string; maxCount: number; author?: string }): Promise<CommitMeta[]> {
    const params: Record<string, unknown> = {
      owner: opts.owner,
      repo: opts.repo,
      per_page: Math.min(100, opts.maxCount),
    };
    if (opts.since) params.since = opts.since.toISOString();
    if (opts.path) params.path = opts.path;
    if (opts.author) params.author = opts.author;

    const out: CommitMeta[] = [];
    let page = 1;
    while (out.length < opts.maxCount) {
      const { data } = await this.octokit.rest.repos.listCommits({ ...params, page } as never);
      if (!data.length) break;
      for (const c of data) {
        if (out.length >= opts.maxCount) break;
        const detail = await this.octokit.rest.repos.getCommit({
          owner: opts.owner, repo: opts.repo, ref: c.sha,
        });
        const stats = detail.data.stats ?? { additions: 0, deletions: 0, total: 0 };
        const files = (detail.data.files ?? []).map(f => f.filename);
        out.push({
          sha: c.sha,
          shortSha: c.sha.slice(0, 7),
          author: c.commit.author?.name ?? c.author?.login ?? "unknown",
          date: c.commit.author?.date ?? new Date().toISOString(),
          message: c.commit.message.split("\n")[0] ?? "",
          filesChanged: files.length,
          insertions: stats.additions ?? 0,
          deletions: stats.deletions ?? 0,
          files,
        });
      }
      if (data.length < (params.per_page as number)) break;
      page += 1;
    }
    return out;
  }

  async userEvents(opts: { username: string; since?: Date; maxCount: number }): Promise<CommitMeta[]> {
    const events = await this.octokit.paginate(
      this.octokit.rest.activity.listPublicEventsForUser,
      { username: opts.username, per_page: 100 },
      (res, done) => {
        if (opts.since) {
          const cutoff = opts.since.getTime();
          const filtered = res.data.filter(e => new Date(e.created_at ?? 0).getTime() >= cutoff);
          if (filtered.length < res.data.length) done();
          return filtered;
        }
        return res.data;
      }
    );

    const out: CommitMeta[] = [];
    for (const ev of events) {
      if (out.length >= opts.maxCount) break;
      if (ev.type !== "PushEvent") continue;
      const payload = ev.payload as { commits?: Array<{ sha: string; message: string; author?: { name: string } }> };
      const repoFullName = (ev.repo as { name: string }).name;
      for (const c of payload.commits ?? []) {
        if (out.length >= opts.maxCount) break;
        out.push({
          sha: c.sha,
          shortSha: c.sha.slice(0, 7),
          author: c.author?.name ?? opts.username,
          date: ev.created_at ?? new Date().toISOString(),
          message: c.message.split("\n")[0] ?? "",
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
          files: [`(${repoFullName})`],
        });
      }
    }
    return out;
  }
}

export function parseRepoSpec(s: string): { owner: string; repo: string } | undefined {
  const m = s.match(/^(?:https?:\/\/github\.com\/)?([^\/\s]+)\/([^\/\s]+?)(?:\.git)?(?:\/.*)?$/);
  if (!m) return undefined;
  return { owner: m[1]!, repo: m[2]! };
}
