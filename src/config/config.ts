import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import type { GeethobConfig } from "../types.ts";

const CONFIG_DIR = join(homedir(), ".config", "geethob");
const CONFIG_PATH = join(CONFIG_DIR, "config.toml");

export function loadConfig(): GeethobConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    return parseToml(raw) as GeethobConfig;
  } catch {
    return {};
  }
}

export function saveConfig(cfg: GeethobConfig): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, stringifyToml(cfg as Record<string, unknown>), { mode: 0o600 });
}

export function resolveAnthropicKey(cfg: GeethobConfig): string | undefined {
  return process.env.ANTHROPIC_API_KEY ?? cfg.model?.apiKey;
}

export function resolveModel(cfg: GeethobConfig, override?: string): string {
  return override ?? process.env.GEETHOB_MODEL ?? cfg.model?.model ?? "claude-sonnet-4-6";
}

export function configPath(): string {
  return CONFIG_PATH;
}
