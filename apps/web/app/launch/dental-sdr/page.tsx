import type { Metadata } from "next";
import LaunchPageClient from "./LaunchPageClient";
import defaultContent from "./default.json";
import type { LaunchPageContent } from "./types";

interface PageProps {
  searchParams: Promise<{ missionId?: string }>;
}

async function loadMissionContent(missionId: string): Promise<LaunchPageContent | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  if (!apiBase) return null;
  try {
    const res = await fetch(`${apiBase}/api/missions/${missionId}/artifacts`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const generated = json?.artifacts?.launch?.landingContent ?? json?.artifacts?.launch?.copy;
    if (!generated) return null;
    return { ...defaultContent, ...(generated as Partial<LaunchPageContent>) } as LaunchPageContent;
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  if (!params.missionId) return {};
  return {
    other: {
      "bifrost-mission-id": params.missionId,
    },
  };
}

export default async function DentalSdrLandingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const missionId = params.missionId;
  const dynamicContent = missionId ? await loadMissionContent(missionId) : null;
  const content: LaunchPageContent = dynamicContent ?? (defaultContent as LaunchPageContent);
  return <LaunchPageClient content={content} missionId={missionId} />;
}
