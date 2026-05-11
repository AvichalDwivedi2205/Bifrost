import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
// Convex generated `api` types may not include `waitlist.join` until `bunx convex codegen`
// (or `convex dev`) regenerates schema typings. We dispatch by string at runtime to
// avoid blocking typecheck before that step runs.
import * as convexApi from "../../../../../../convex/_generated/api";

interface WaitlistBody {
  email?: string;
  practiceName?: string;
  role?: string;
  source?: string;
  missionId?: string;
}

const memoryStore: Array<{ email: string; createdAt: number; missionId?: string }> = [];

export async function POST(request: Request) {
  let body: WaitlistBody;
  try {
    body = (await request.json()) as WaitlistBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Email required" }, { status: 400 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl) {
    try {
      const client = new ConvexHttpClient(convexUrl);
      const apiAny = convexApi as unknown as { api: { waitlist?: { join?: unknown } } };
      const ref = apiAny.api?.waitlist?.join as Parameters<typeof client.mutation>[0] | undefined;
      if (ref) {
        const result = await client.mutation(ref, {
          email,
          practiceName: body.practiceName,
          role: body.role,
          source: body.source ?? "dental-sdr-landing",
          missionId: body.missionId,
        });
        return NextResponse.json(result);
      }
    } catch (err) {
      console.error("[waitlist] convex insert failed:", err);
    }
  }

  memoryStore.push({ email, createdAt: Date.now(), missionId: body.missionId });
  return NextResponse.json({ ok: true, duplicate: false, fallback: "memory" });
}

export async function GET() {
  return NextResponse.json({ count: memoryStore.length, items: memoryStore.slice(-25) });
}
