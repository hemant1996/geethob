import { simpleGit, type SimpleGit } from "simple-git";
import type { CommitMeta } from "../types.ts";

const SEP = "GEETHOB";
const REC = "REC";

export class LocalGit {
  private git: SimpleGit;

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async commits(opts: { since?: string; path?: string; maxCount: number }): Promise<CommitMeta[]> {
    const format = ["%H", "%h", "%an", "%aI", "%s"].join(SEP) + REC;
    const args = ["log", `--pretty=format:${format}`, "--numstat", `-n${opts.maxCount}`];
    if (opts.since) {
      if (/^\d+[dwmy]$/.test(opts.since) || /^\d{4}-\d{2}-\d{2}$/.test(opts.since)) {
        args.push(`--since=${humanSince(opts.since)}`);
      } else {
        args.push(`${opts.since}..HEAD`);
      }
    }
    if (opts.path) {
      args.push("--", opts.path);
    }

    const raw = await this.git.raw(args);
    return parseLog(raw);
  }
}

function humanSince(s: string): string {
  const m = s.match(/^(\d+)([dwmy])$/);
  if (!m) return s;
  const [, n, unit] = m;
  const map: Record<string, string> = { d: "days", w: "weeks", m: "months", y: "years" };
  return `${n} ${map[unit!]} ago`;
}

function parseLog(raw: string): CommitMeta[] {
  if (!raw.trim()) return [];
  const records = raw.split(REC).map(r => r.trim()).filter(Boolean);
  const commits: CommitMeta[] = [];
  for (const rec of records) {
    const lines = rec.split("\n");
    const headerLine = lines.shift();
    if (!headerLine) continue;
    const parts = headerLine.split(SEP);
    if (parts.length < 5) continue;
    const [sha, shortSha, author, date, message] = parts;
    let insertions = 0, deletions = 0;
    const files: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const [insStr, delStr, ...fileParts] = t.split(/\s+/);
      const ins = insStr === "-" ? 0 : parseInt(insStr ?? "0", 10) || 0;
      const del = delStr === "-" ? 0 : parseInt(delStr ?? "0", 10) || 0;
      insertions += ins;
      deletions += del;
      if (fileParts.length) files.push(fileParts.join(" "));
    }
    commits.push({
      sha: sha!,
      shortSha: shortSha!,
      author: author!,
      date: date!,
      message: message!,
      filesChanged: files.length,
      insertions,
      deletions,
      files,
    });
  }
  return commits;
}
