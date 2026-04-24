import { GoogleAuth } from "google-auth-library";

import { env } from "../../env";
import type { LLMProvider, LLMRequest, LLMTextResponse } from "./types";

export class VertexProvider implements LLMProvider {
  public readonly provider = "vertex" as const;
  private readonly auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  isConfigured(): boolean {
    return Boolean(env.VERTEX_PROJECT_ID);
  }

  async generateText(request: LLMRequest): Promise<LLMTextResponse> {
    if (!env.VERTEX_PROJECT_ID) {
      throw new Error("VERTEX_PROJECT_ID is not configured");
    }

    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();

    const endpoint = `https://${env.VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${env.VERTEX_PROJECT_ID}/locations/${env.VERTEX_LOCATION}/publishers/google/models/${request.model ?? env.VERTEX_MODEL}:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${request.system}\n\n${request.prompt}\n\nReturn valid JSON only.\n${request.schemaHint ?? ""}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Vertex request failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Vertex returned an empty completion");
    }

    return {
      provider: this.provider,
      model: request.model ?? env.VERTEX_MODEL,
      text,
    };
  }
}

