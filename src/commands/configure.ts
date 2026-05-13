import { createInterface } from "node:readline/promises";
import { saveConfig, loadConfig, configPath } from "../config/config.ts";
import { EXIT_OK } from "../types.ts";

export async function runConfigure(): Promise<number> {
  if (process.env.ANTHROPIC_API_KEY) {
    process.stdout.write(
      `ANTHROPIC_API_KEY is already set in your environment.\n` +
      `No config file needed. geethob will use the env var.\n` +
      `(If you'd rather persist a key on disk, unset ANTHROPIC_API_KEY first and re-run.)\n`,
    );
    return EXIT_OK;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.stdout.write(`geethob configure — writing to ${configPath()}\n\n`);
    const key = (await rl.question("Anthropic API key: ")).trim();
    if (!key) {
      process.stderr.write("No key provided. Aborting.\n");
      return 1;
    }
    const cfg = loadConfig();
    cfg.model = { ...(cfg.model ?? {}), provider: "anthropic", apiKey: key };
    saveConfig(cfg);
    process.stdout.write(`\nSaved. File mode 0600. geethob will use this key.\n`);
    return EXIT_OK;
  } finally {
    rl.close();
  }
}
