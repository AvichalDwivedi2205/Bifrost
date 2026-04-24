import { MockLLMProvider } from "./mock";
import { OpenRouterProvider } from "./openrouter";
import type { LLMRequest, LLMTextResponse } from "./types";
import { VertexProvider } from "./vertex";

function stripCodeFence(text: string): string {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
}

export class LLMRouter {
  private readonly openRouter = new OpenRouterProvider();
  private readonly vertex = new VertexProvider();
  private readonly mock = new MockLLMProvider();

  async generateText(request: LLMRequest): Promise<LLMTextResponse> {
    const providers = [this.openRouter, this.vertex, this.mock];

    let lastError: unknown;
    for (const provider of providers) {
      if (!provider.isConfigured() && provider.provider !== "mock") {
        continue;
      }

      try {
        return await provider.generateText(request);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Unable to generate completion");
  }

  async generateObject<T>(request: LLMRequest): Promise<T> {
    const response = await this.generateText(request);
    return JSON.parse(stripCodeFence(response.text)) as T;
  }
}

