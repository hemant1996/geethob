import Anthropic from "@anthropic-ai/sdk";
import type { ModelProvider } from "../types.ts";

export class AnthropicProvider implements ModelProvider {
  name = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    opts: { stream: boolean; model: string },
  ): Promise<void> {
    const params = {
      model: opts.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user" as const, content: userPrompt }],
    };

    if (opts.stream) {
      const stream = this.client.messages.stream(params);
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          process.stdout.write(event.delta.text);
        }
      }
      process.stdout.write("\n");
      return;
    }

    const res = await this.client.messages.create(params);
    const text = res.content
      .filter(b => b.type === "text")
      .map(b => (b as { text: string }).text)
      .join("");
    process.stdout.write(text + "\n");
  }
}
