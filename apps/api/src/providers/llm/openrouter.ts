import { env } from "../../env";
import type { LLMProvider, LLMRequest, LLMTextResponse } from "./types";

export class OpenRouterProvider implements LLMProvider {
  public readonly provider = "openrouter" as const;

  isConfigured(): boolean {
    return Boolean(env.OPENROUTER_API_KEY);
  }

  async generateText(request: LLMRequest): Promise<LLMTextResponse> {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model ?? env.OPENROUTER_MODEL,
        temperature: request.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: request.system },
          {
            role: "user",
            content: `${request.prompt}\n\nReturn valid JSON only.\n${request.schemaHint ?? ""}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };

    const text = json.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("OpenRouter returned an empty completion");
    }

    return {
      provider: this.provider,
      model: json.model ?? request.model ?? env.OPENROUTER_MODEL,
      text,
    };
  }
}

