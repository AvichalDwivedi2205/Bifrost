import { LLMRouter } from "../providers/llm/router";

export class BaseAgent {
  constructor(protected readonly llm: LLMRouter) {}

  protected async askJson<T>(task: string, system: string, prompt: string, schemaHint: string): Promise<T> {
    return this.llm.generateObject<T>({
      task,
      system,
      prompt,
      schemaHint,
      temperature: 0.2,
    });
  }
}

