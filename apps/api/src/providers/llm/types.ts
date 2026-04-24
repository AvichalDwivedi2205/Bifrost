export interface LLMRequest {
  task: string;
  system: string;
  prompt: string;
  temperature?: number;
  model?: string;
  schemaHint?: string;
}

export interface LLMTextResponse {
  provider: "openrouter" | "vertex" | "mock";
  model: string;
  text: string;
}

export interface LLMProvider {
  readonly provider: "openrouter" | "vertex" | "mock";
  isConfigured(): boolean;
  generateText(request: LLMRequest): Promise<LLMTextResponse>;
}

