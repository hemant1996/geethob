import { existsSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT_OK } from "../types.ts";

export interface SkillInstallOptions {
  target?: "claude-code" | "auto";
  force?: boolean;
}

const HARNESS_DIRS: Record<string, string> = {
  "claude-code": join(homedir(), ".claude", "skills"),
};

export async function runSkillInstall(opts: SkillInstallOptions): Promise<number> {
  const source = resolveBundledSkillPath();
  if (!source) {
    process.stderr.write(
      `Could not locate bundled skill file.\n` +
      `Expected: <package-root>/skills/geethob/SKILL.md\n` +
      `If you installed from source, re-run from the repo root.\n`,
    );
    return 1;
  }

  const target = opts.target ?? "claude-code";
  const baseDir = HARNESS_DIRS[target];
  if (!baseDir) {
    process.stderr.write(`Unknown target: ${target}. Supported: claude-code.\n`);
    return 1;
  }

  const dest = join(baseDir, "geethob");
  const destFile = join(dest, "SKILL.md");

  if (existsSync(destFile) && !opts.force) {
    process.stderr.write(
      `Skill already installed at ${destFile}.\n` +
      `Pass --force to overwrite.\n`,
    );
    return EXIT_OK;
  }

  mkdirSync(dest, { recursive: true });
  copyFileSync(source, destFile);

  process.stdout.write(
    `Installed geethob skill → ${destFile}\n` +
    `Restart Claude Code (or reload skills) and ask a story-grained question about any repo.\n`,
  );
  return EXIT_OK;
}

function resolveBundledSkillPath(): string | null {
  // When installed via npm, the package layout is:
  //   <prefix>/lib/node_modules/geethob/dist/cli.js   (this file)
  //   <prefix>/lib/node_modules/geethob/skills/geethob/SKILL.md
  // When run via `bun run dev`, __filename points into src/commands/.
  // Walk up looking for skills/geethob/SKILL.md.
  let dir: string;
  try {
    dir = dirname(fileURLToPath(import.meta.url));
  } catch {
    dir = process.cwd();
  }

  for (let i = 0; i < 6; i += 1) {
    const candidate = resolve(dir, "skills", "geethob", "SKILL.md");
    if (existsSync(candidate)) {
      // sanity-check it's actually a SKILL.md
      try {
        const head = readFileSync(candidate, "utf8").slice(0, 200);
        if (head.includes("name:") && head.includes("geethob")) return candidate;
      } catch { /* fall through */ }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
