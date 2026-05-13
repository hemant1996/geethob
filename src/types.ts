export interface CommitMeta {
  sha: string;
  shortSha: string;
  author: string;
  date: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: string[];
}

export interface StoryInput {
  source: "local" | "remote";
  repoIdentifier: string;
  scopePath?: string;
  since?: string;
  commits: CommitMeta[];
  truncated?: { kept: number; total: number };
  tokenTruncated?: { kept: number; original: number };
}

export interface DigestInput {
  source: "local" | "remote-repo" | "remote-events";
  identifier: string;
  since: string;
  author?: string;
  commits: CommitMeta[];
  truncated?: { kept: number; total: number };
  tokenTruncated?: { kept: number; original: number };
}

export interface ModelProvider {
  name: string;
  generate(systemPrompt: string, userPrompt: string, opts: { stream: boolean; model: string }): Promise<void>;
}

export interface GeethobConfig {
  model?: {
    provider?: "anthropic";
    apiKey?: string;
    model?: string;
  };
}

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_NO_GIT = 2;
export const EXIT_NO_KEY = 3;
export const EXIT_API_ERROR = 4;
export const EXIT_AUTH_OR_RATE = 5;
