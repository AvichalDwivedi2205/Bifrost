import { env } from "../env";

export interface ExaResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  author?: string;
}

export interface ExaSearchOptions {
  numResults?: number;
  type?: "neural" | "keyword" | "auto";
  useAutoprompt?: boolean;
  category?: string;
  startPublishedDate?: string;
  timeoutMs?: number;
}

export class ExaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "ExaError";
  }
}

const EXA_BASE = "https://api.exa.ai";

export async function searchExa(query: string, options: ExaSearchOptions = {}): Promise<ExaResult[]> {
  const apiKey = env.EXA_API_KEY;
  if (!apiKey) {
    throw new ExaError("EXA_API_KEY not configured", 401, false);
  }

  const numResults = options.numResults ?? 5;
  const timeoutMs = options.timeoutMs ?? 8000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${EXA_BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        numResults,
        type: options.type ?? "auto",
        useAutoprompt: options.useAutoprompt ?? true,
        contents: { text: { maxCharacters: 600 } },
        ...(options.category ? { category: options.category } : {}),
        ...(options.startPublishedDate ? { startPublishedDate: options.startPublishedDate } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new ExaError(
        `Exa search failed (${response.status}) for "${query}"`,
        response.status,
        retryable,
      );
    }

    const body = (await response.json()) as { results?: Array<{ title?: string; url?: string; text?: string; publishedDate?: string; author?: string }> };
    const results: ExaResult[] = (body.results ?? []).map((row) => ({
      title: row.title ?? "(untitled)",
      url: row.url ?? "",
      snippet: (row.text ?? "").slice(0, 600),
      publishedDate: row.publishedDate,
      author: row.author,
    }));
    return results;
  } catch (err) {
    if (err instanceof ExaError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ExaError(`Exa search timed out after ${timeoutMs}ms`, undefined, true);
    }
    throw new ExaError(`Exa request error: ${err instanceof Error ? err.message : String(err)}`, undefined, true);
  } finally {
    clearTimeout(timeout);
  }
}
