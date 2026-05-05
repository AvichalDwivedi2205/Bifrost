import { ConvexHttpClient } from "convex/browser";

import { env } from "../env";

let client: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient {
  if (!env.CONVEX_URL) throw new Error("CONVEX_URL not set; cannot use ConvexMissionStore");
  if (!client) client = new ConvexHttpClient(env.CONVEX_URL);
  return client;
}
