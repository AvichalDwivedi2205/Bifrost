import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type {
  LaunchMissionConfig,
  MissionDeliverables,
  MissionFileManifestEntry,
  MissionRecord,
} from "@bifrost/shared";
import { MissionWorkspace } from "../services/workspace/mission-workspace";
import { searchExa, ExaError, type ExaResult } from "./exa-client";
import type { LaunchScoutAgent, ScoutBrief } from "../agents/launch-scout-agent";
import type {
  LandingPageCopy,
  LaunchCopywriterAgent,
} from "../agents/launch-copywriter-agent";

export interface LaunchArtifacts {
  research?: {
    summary: string;
    competitors: string[];
    messagingPatterns: string[];
    artifactRef: string;
    sources?: Array<{ title: string; url: string; snippet: string; publishedDate?: string }>;
    promises?: string[];
    objections?: string[];
    fallback?: "template" | "llm";
  };
  landingContent?: LandingPageContentForApi;
  disputeRerun?: boolean;
  positioning?: {
    options: string[];
    artifactRef: string;
  };
  selectedDirection?: string;
  copy?: {
    hero: string;
    subhead: string;
    sections: Array<{ heading: string; body: string }>;
    faq: Array<{ question: string; answer: string }>;
    cta: string;
    artifactRef: string;
  };
  site?: {
    files: MissionFileManifestEntry[];
    artifactRef: string;
  };
}

export function getLaunchConfig(record: MissionRecord): LaunchMissionConfig {
  const raw = record.input.templateConfig ?? {};
  return {
    productName: readString(raw, "productName", "RecallReady AI"),
    oneLineIdea: readString(
      raw,
      "oneLineIdea",
      record.input.description || "An AI SDR that helps dentists convert missed calls into booked consults.",
    ),
    targetAudience: readString(raw, "targetAudience", "independent dental practices"),
    primaryCTA: readString(raw, "primaryCTA", "Join the waitlist"),
    brandTone: readString(raw, "brandTone", "confident, clinical, helpful"),
    mustHaveSections: readStringArray(raw, "mustHaveSections", [
      "hero",
      "problem",
      "workflow",
      "benefits",
      "faq",
      "waitlist",
    ]),
    domainBudgetCap: readNumber(raw, "domainBudgetCap", 15),
    allowDomainPurchase: readBoolean(raw, "allowDomainPurchase", false),
    launchChannels: readStringArray(raw, "launchChannels", [
      "LinkedIn",
      "X",
      "Founder community",
    ]),
    referenceSites: readStringArray(raw, "referenceSites", []),
    assetsProvided: readStringArray(raw, "assetsProvided", []),
  };
}

export function researchLaunchMarket(record: MissionRecord): NonNullable<LaunchArtifacts["research"]> {
  const config = getLaunchConfig(record);
  const competitors = [
    "NexHealth",
    "Weave",
    "RevenueWell",
    "Pearl AI",
    "Dental Intelligence",
  ];
  const messagingPatterns = [
    "Lead with missed-call recovery and booked appointments, not generic AI.",
    "Show practice-owner outcomes: fewer empty chair slots, faster response, cleaner handoff.",
    "Keep compliance language calm: human review, patient-friendly tone, opt-out-safe outreach.",
  ];
  return {
    summary: `${config.productName} competes in dental patient acquisition and retention. Best wedge: ${config.targetAudience} need after-hours follow-up, recall reactivation, and consult booking without adding front-desk load.`,
    competitors,
    messagingPatterns,
    artifactRef: `workspace://${record.id}/research.md`,
    fallback: "template",
  };
}

/**
 * Real-LLM scout: runs Exa web searches for competitors, CTA patterns, and trust objections,
 * then synthesizes via OpenRouter through LaunchScoutAgent. Falls back to the deterministic
 * template if any step fails (Exa rate-limit, LLM JSON parse, etc.).
 */
export async function researchLaunchMarketLLM(
  record: MissionRecord,
  scout: LaunchScoutAgent,
): Promise<NonNullable<LaunchArtifacts["research"]>> {
  const config = getLaunchConfig(record);
  const queries: Record<string, string> = {
    competitors: `${config.targetAudience} ${config.oneLineIdea} competitors landing pages`,
    cta_patterns: `SaaS landing page CTA copy waitlist book demo for ${config.targetAudience}`,
    trust_objections: `${config.targetAudience} buyer objections AI software adoption hesitation`,
  };

  const exaResults: Record<string, ExaResult[]> = {};
  let anyExaSuccess = false;
  for (const [label, query] of Object.entries(queries)) {
    try {
      const rows = await searchExa(query, { numResults: 5, type: "auto" });
      exaResults[label] = rows;
      if (rows.length > 0) anyExaSuccess = true;
    } catch (err) {
      const reason = err instanceof ExaError ? err.message : String(err);
      console.warn(`[launch-scout] Exa query "${label}" failed: ${reason}`);
      exaResults[label] = [];
    }
  }

  if (!anyExaSuccess) {
    throw new Error("All Exa queries returned zero results — falling back to template scout");
  }

  const brief: ScoutBrief = await scout.execute({
    productName: config.productName,
    oneLineIdea: config.oneLineIdea,
    targetAudience: config.targetAudience,
    brandTone: config.brandTone,
    exaResults,
  });

  const competitors = brief.competitors
    .map((c) => (c.url ? `${c.name} — ${c.angle}` : `${c.name} — ${c.angle}`))
    .slice(0, 6);
  const messagingPatterns = [...brief.promises.slice(0, 4), ...brief.ctaPatterns.slice(0, 2)].slice(0, 6);

  return {
    summary: brief.summary,
    competitors,
    messagingPatterns,
    sources: brief.sources,
    promises: brief.promises,
    objections: brief.objections,
    artifactRef: `workspace://${record.id}/research.md`,
    fallback: "llm",
  };
}

export function synthesizePositioning(
  record: MissionRecord,
  research: NonNullable<LaunchArtifacts["research"]>,
): NonNullable<LaunchArtifacts["positioning"]> {
  const config = getLaunchConfig(record);
  return {
    options: [
      `Missed-call recovery engine for ${config.targetAudience}: every inquiry gets a fast, human-safe follow-up.`,
      `Recall revenue autopilot: revive overdue patients and fill hygiene chairs without more admin work.`,
      `Front-desk copilot for growth-minded dentists: AI follow-up, booking prompts, and clean handoffs in one workflow.`,
    ],
    artifactRef: research.artifactRef.replace("research.md", "positioning.json"),
  };
}

/**
 * Full LaunchPageContent shape consumed by apps/web/app/launch/dental-sdr/page.tsx.
 * Mirrors apps/web/app/launch/dental-sdr/types.ts but kept loose for forward-compat
 * (the web side does shallow-spread merge with default.json).
 */
export interface LandingPageContentForApi extends LandingPageCopy {
  hero: LandingPageCopy["hero"] & { sideImage?: string };
  howItWorks: LandingPageCopy["howItWorks"] & {
    frames: Array<{ label: string; body: string; image?: string }>;
  };
  testimonials: Array<{ quote: string; author: string; location: string; avatar?: string }>;
}

interface DefaultLandingShape extends LandingPageContentForApi {}

let cachedDefault: DefaultLandingShape | null = null;
function loadDefaultLandingContent(): DefaultLandingShape {
  if (cachedDefault) return cachedDefault;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const path = resolve(here, "../../../web/app/launch/dental-sdr/default.json");
    const raw = readFileSync(path, "utf8");
    cachedDefault = JSON.parse(raw) as DefaultLandingShape;
  } catch (err) {
    console.warn(
      `[launch-tools] could not load web/default.json — image stitching disabled: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    cachedDefault = {
      positioning: "solo",
      hero: { eyebrow: "", h1: "", sub: "", ctaPrimary: "", ctaSecondary: "" },
      problem: { title: "", stats: [] },
      howItWorks: { title: "", subtitle: "", frames: [] },
      features: [],
      testimonials: [],
      pricing: [],
      faq: [],
      waitlistCTA: { title: "", sub: "" },
      posts: [],
    };
  }
  return cachedDefault;
}

/**
 * Stitch image URLs from the committed default landing JSON onto the LLM's copy
 * by index. Preserves hero.sideImage, howItWorks.frames[i].image, testimonials[i].avatar
 * so mission-bound previews look fully populated even though the LLM doesn't emit URLs.
 */
function stitchLandingImages(copy: LandingPageCopy): LandingPageContentForApi {
  const def = loadDefaultLandingContent();
  return {
    ...copy,
    hero: { ...copy.hero, sideImage: def.hero.sideImage },
    howItWorks: {
      ...copy.howItWorks,
      frames: copy.howItWorks.frames.map((frame, idx) => ({
        ...frame,
        image: def.howItWorks.frames[idx]?.image,
      })),
    },
    testimonials: copy.testimonials.map((t, idx) => ({
      ...t,
      avatar: def.testimonials[idx]?.avatar,
    })),
  };
}

/** Adapt LLM landing copy to the legacy LaunchArtifacts.copy shape (still consumed
 *  by Verifier checks + Builder index.html generation). */
function landingCopyToLegacy(
  record: MissionRecord,
  copy: LandingPageCopy,
  primaryCTA: string,
): NonNullable<LaunchArtifacts["copy"]> {
  return {
    hero: copy.hero.h1,
    subhead: copy.hero.sub,
    sections: copy.howItWorks.frames.map((frame) => ({ heading: frame.label, body: frame.body })),
    faq: copy.faq.map((row) => ({ question: row.q, answer: row.a })),
    cta: copy.hero.ctaPrimary || primaryCTA,
    artifactRef: `workspace://${record.id}/site/copy.json`,
  };
}

/**
 * Real-LLM copywriter: calls LaunchCopywriterAgent with the scout brief +
 * selected positioning direction, stitches default image URLs back in, and
 * returns BOTH the legacy `copy` shape (for backward-compat with verifier/builder)
 * AND the full `landingContent` shape consumed by the dental-sdr page.
 */
export async function writeLaunchCopyLLM(
  record: MissionRecord,
  selectedDirection: string,
  copywriter: LaunchCopywriterAgent,
  scoutBrief?: ScoutBrief,
): Promise<{ copy: NonNullable<LaunchArtifacts["copy"]>; landingContent: LandingPageContentForApi }> {
  const config = getLaunchConfig(record);
  const llmCopy = await copywriter.execute({
    productName: config.productName,
    oneLineIdea: config.oneLineIdea,
    targetAudience: config.targetAudience,
    brandTone: config.brandTone,
    primaryCTA: config.primaryCTA,
    selectedDirection,
    scoutBrief,
  });
  const landingContent = stitchLandingImages(llmCopy);
  const legacyCopy = landingCopyToLegacy(record, llmCopy, config.primaryCTA);
  return { copy: legacyCopy, landingContent };
}

export function writeLaunchCopy(
  record: MissionRecord,
  selectedDirection: string,
): NonNullable<LaunchArtifacts["copy"]> {
  const config = getLaunchConfig(record);
  return {
    hero: `${config.productName} turns dental leads into booked visits`,
    subhead: `${selectedDirection} ${config.oneLineIdea}`,
    sections: [
      {
        heading: "Recover missed demand",
        body: "Capture missed calls, stale form fills, and overdue recall lists before patients drift to another practice.",
      },
      {
        heading: "Stay patient-friendly",
        body: "Use clear, warm follow-up scripts that keep the practice in control and make handoff easy for staff.",
      },
      {
        heading: "Book more chairs",
        body: "Route interested patients toward consults, hygiene appointments, and the next best front-desk action.",
      },
    ],
    faq: [
      {
        question: "Who is this for?",
        answer: `Growth-minded ${config.targetAudience} that want more booked visits from leads they already earned.`,
      },
      {
        question: "Does it replace staff?",
        answer: "No. It handles follow-up drafts, routing, and reminders so staff can focus on patient conversations.",
      },
    ],
    cta: config.primaryCTA,
    artifactRef: `workspace://${record.id}/site/copy.json`,
  };
}

export async function generateLaunchSite(
  record: MissionRecord,
  copy: NonNullable<LaunchArtifacts["copy"]>,
): Promise<NonNullable<LaunchArtifacts["site"]>> {
  const config = getLaunchConfig(record);
  const workspace = new MissionWorkspace(record.id);
  const css = buildCss();
  const html = buildHtml(record.id, config, copy);
  const metadata = JSON.stringify(
    {
      missionId: record.id,
      productName: config.productName,
      generatedAt: new Date().toISOString(),
      sections: config.mustHaveSections,
    },
    null,
    2,
  );

  await workspace.writeText("site/index.html", html);
  await workspace.writeText("site/styles.css", css);
  await workspace.writeText("site/copy.json", JSON.stringify(copy, null, 2));
  await workspace.writeText("site/metadata.json", metadata);
  const files = await workspace.manifest([
    "site/index.html",
    "site/styles.css",
    "site/copy.json",
    "site/metadata.json",
  ]);
  return {
    files,
    artifactRef: `workspace://${record.id}/site/index.html`,
  };
}

export async function deployPreview(
  record: MissionRecord,
  apiBaseUrl: string,
  options: { webBaseUrl?: string; launchPath?: string } = {},
): Promise<Required<Pick<MissionDeliverables, "previewUrl" | "waitlistEndpoint" | "screenshots">>> {
  const workspace = new MissionWorkspace(record.id);
  await workspace.writeText(
    "screenshots/mobile-preview.txt",
    `Mobile screenshot placeholder for ${record.input.title} at ${new Date().toISOString()}`,
  );
  const webBase = options.webBaseUrl ?? process.env.WEB_BASE_URL ?? "http://localhost:3000";
  const launchPath = options.launchPath ?? process.env.LAUNCH_PREVIEW_PATH ?? "/launch/dental-sdr";
  const previewUrl = `${webBase.replace(/\/$/, "")}${launchPath}?missionId=${encodeURIComponent(record.id)}`;
  return {
    previewUrl,
    waitlistEndpoint: `${apiBaseUrl}/api/missions/${record.id}/waitlist`,
    screenshots: [`workspace://${record.id}/screenshots/mobile-preview.txt`],
  };
}

export interface LivePreviewVerification {
  reachable: boolean;
  httpStatus?: number;
  durationMs: number;
  hasWaitlistForm: boolean;
  hasMissionMeta: boolean;
  missionMetaMatches?: boolean;
  hasHeroH1: boolean;
  heroSnippet?: string;
  title?: string;
  fallbackReason?: string;
}

/**
 * Live HTTP fetch of the deployed preview URL; regex-extracts marker attributes
 * the Builder/Verifier contract requires. Returns structured booleans + a snippet
 * so the Verifier can grade real DOM, not just mission state shape.
 */
export async function verifyLaunchPreviewLive(
  record: MissionRecord,
  previewUrl: string,
  options: { timeoutMs?: number } = {},
): Promise<LivePreviewVerification> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(previewUrl, {
      method: "GET",
      headers: { "user-agent": "Bifrost-Verifier/1.0" },
      signal: controller.signal,
    });
    const body = await response.text();
    const durationMs = Date.now() - start;
    if (!response.ok) {
      return {
        reachable: true,
        httpStatus: response.status,
        durationMs,
        hasWaitlistForm: false,
        hasMissionMeta: false,
        hasHeroH1: false,
        fallbackReason: `non-2xx status ${response.status}`,
      };
    }
    const hasWaitlistForm =
      /<form[^>]*data-bifrost\s*=\s*["']waitlist["']/i.test(body) ||
      /data-bifrost\s*=\s*["']waitlist["']/i.test(body);
    const metaMatch = body.match(/<meta[^>]*name\s*=\s*["']bifrost-mission-id["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    const hasMissionMeta = Boolean(metaMatch);
    const missionMetaMatches = metaMatch ? metaMatch[1] === record.id : undefined;
    const titleMatch = body.match(/<title>([^<]*)<\/title>/i);
    const h1Match = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const hasHeroH1 = Boolean(h1Match && h1Match[1] && h1Match[1].replace(/<[^>]+>/g, "").trim().length > 0);
    const heroSnippet = h1Match?.[1]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 160);
    return {
      reachable: true,
      httpStatus: response.status,
      durationMs,
      hasWaitlistForm,
      hasMissionMeta,
      missionMetaMatches,
      hasHeroH1,
      heroSnippet,
      title: titleMatch?.[1]?.trim().slice(0, 160),
    };
  } catch (err) {
    const reason =
      err instanceof Error
        ? err.name === "AbortError"
          ? `timeout after ${timeoutMs}ms`
          : err.message
        : String(err);
    return {
      reachable: false,
      durationMs: Date.now() - start,
      hasWaitlistForm: false,
      hasMissionMeta: false,
      hasHeroH1: false,
      fallbackReason: reason,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function searchDomains(record: MissionRecord): NonNullable<MissionDeliverables["domainOptions"]> {
  const config = getLaunchConfig(record);
  const slug = slugify(config.productName.replace(/\bAI\b/gi, ""));
  return [
    { domain: `${slug}.com`, priceUsd: 14.5, available: true },
    { domain: `${slug}ai.com`, priceUsd: 12.8, available: true },
    { domain: `get${slug}.com`, priceUsd: 10.2, available: true },
  ].filter((candidate) => candidate.priceUsd <= config.domainBudgetCap);
}

export function deployLive(
  record: MissionRecord,
  apiBaseUrl: string,
  options: { webBaseUrl?: string; launchPath?: string } = {},
): NonNullable<MissionDeliverables["deployReceipt"]> {
  const webBase = options.webBaseUrl ?? process.env.WEB_BASE_URL ?? "http://localhost:3000";
  const launchPath = options.launchPath ?? process.env.LAUNCH_PREVIEW_PATH ?? "/launch/dental-sdr";
  const url = `${webBase.replace(/\/$/, "")}${launchPath}?missionId=${encodeURIComponent(record.id)}&mode=live`;
  return {
    provider: "bifrost-local-deploy",
    deploymentId: `deploy_${record.id}`,
    url,
    createdAt: new Date().toISOString(),
  };
}

export function generateSocialPosts(record: MissionRecord): string[] {
  const config = getLaunchConfig(record);
  const liveUrl = record.deliverables?.liveUrl ?? "live URL pending";
  return [
    `${config.productName} is live: AI follow-up for dentists who want fewer missed leads and more booked visits. ${liveUrl}`,
    `Dental teams lose revenue in the gaps: missed calls, stale forms, overdue recalls. ${config.productName} helps recover that demand with patient-friendly AI SDR workflows. ${liveUrl}`,
    `Building for ${config.targetAudience}: fast lead follow-up, recall nudges, and clean front-desk handoff. Join the waitlist: ${liveUrl}`,
  ];
}

export function verifyLaunchDeliverables(record: MissionRecord): {
  passed: boolean;
  summary: string;
  checks: Array<{ id: string; label: string; passed: boolean; detail: string }>;
} {
  const deliverables = record.deliverables;
  const hasApproval = record.receipts.some((receipt) => receipt.purpose === "preview_deploy");
  const answeredCheckpoint = record.humanCheckpoints.some(
    (checkpoint) => checkpoint.blockingTaskId === "task-human-direction" && checkpoint.status === "answered",
  );
  const checks = [
    {
      id: "page_exists",
      label: "Page exists",
      passed: Boolean(deliverables?.previewUrl && deliverables.fileManifest?.some((file) => file.path === "site/index.html")),
      detail: deliverables?.previewUrl ?? "No preview URL",
    },
    {
      id: "cta_exists",
      label: "CTA and waitlist exist",
      passed: Boolean(deliverables?.waitlistEndpoint),
      detail: deliverables?.waitlistEndpoint ?? "No waitlist endpoint",
    },
    {
      id: "mobile_screenshot",
      label: "Mobile screenshot captured",
      passed: Boolean(deliverables?.screenshots?.length),
      detail: deliverables?.screenshots?.join(", ") ?? "No screenshot artifact",
    },
    {
      id: "positioning_matches",
      label: "Human positioning choice recorded",
      passed: answeredCheckpoint,
      detail: answeredCheckpoint ? "Signed direction checkpoint answered" : "Missing direction checkpoint",
    },
    {
      id: "paid_actions_approved",
      label: "Paid actions approved",
      passed: hasApproval,
      detail: hasApproval ? "Preview deploy receipt found" : "Missing preview deploy receipt",
    },
    {
      id: "live_url",
      label: "Live deploy URL exists",
      passed: Boolean(deliverables?.liveUrl),
      detail: deliverables?.liveUrl ?? "No live URL",
    },
    {
      id: "social_posts",
      label: "Three launch posts generated",
      passed: (deliverables?.socialPosts?.length ?? 0) >= 3,
      detail: `${deliverables?.socialPosts?.length ?? 0} posts`,
    },
  ];
  const passed = checks.every((check) => check.passed);
  return {
    passed,
    summary: passed
      ? "Launch mission deliverables verified: preview, live URL, waitlist, launch posts, human checkpoints, and spend approval are present."
      : "Launch mission is missing required deliverables.",
    checks,
  };
}

function buildHtml(
  missionId: string,
  config: LaunchMissionConfig,
  copy: NonNullable<LaunchArtifacts["copy"]>,
): string {
  const sections = copy.sections
    .map(
      (section) => `
        <section class="panel">
          <span class="kicker">${section.heading}</span>
          <p>${section.body}</p>
        </section>`,
    )
    .join("");
  const faq = copy.faq
    .map((item) => `<details><summary>${item.question}</summary><p>${item.answer}</p></details>`)
    .join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(config.productName)}</title>
    <link rel="stylesheet" href="/api/missions/${missionId}/asset/styles.css" />
  </head>
  <body>
    <main>
      <section class="hero">
        <div>
          <p class="eyebrow">AI SDR for dental practices</p>
          <h1>${escapeHtml(copy.hero)}</h1>
          <p class="subhead">${escapeHtml(copy.subhead)}</p>
          <form method="get" action="/api/missions/${missionId}/waitlist" class="waitlist">
            <input required type="email" name="email" placeholder="operator@practice.com" />
            <button>${escapeHtml(copy.cta)}</button>
          </form>
        </div>
      </section>
      <section class="grid">${sections}</section>
      <section class="faq">
        <p class="eyebrow">Questions</p>
        ${faq}
      </section>
    </main>
  </body>
</html>`;
}

function buildCss(): string {
  return `:root {
  color-scheme: dark;
  --bg: #06110f;
  --text: #effcf7;
  --muted: #a6bdb5;
  --line: rgba(190, 255, 230, 0.16);
  --accent: #58f2bd;
  --amber: #ffd166;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:
    linear-gradient(rgba(88, 242, 189, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(88, 242, 189, 0.08) 1px, transparent 1px),
    radial-gradient(circle at 20% 10%, rgba(255, 209, 102, 0.22), transparent 28rem),
    var(--bg);
  background-size: 36px 36px, 36px 36px, auto, auto;
  color: var(--text);
}
main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
.hero {
  min-height: 78vh;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--line);
}
.hero > div { max-width: 820px; }
.eyebrow, .kicker {
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: .08em;
  font-size: 12px;
  font-weight: 700;
}
h1 {
  font-size: clamp(42px, 8vw, 92px);
  line-height: .92;
  letter-spacing: 0;
  margin: 14px 0 20px;
}
.subhead { color: var(--muted); font-size: clamp(18px, 2vw, 24px); line-height: 1.45; max-width: 760px; }
.waitlist { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 30px; }
input, button {
  min-height: 48px;
  border-radius: 8px;
  border: 1px solid var(--line);
  font: inherit;
}
input { min-width: min(100%, 320px); padding: 0 14px; color: var(--text); background: rgba(255,255,255,.06); }
button { padding: 0 18px; background: var(--accent); color: #03110d; font-weight: 800; cursor: pointer; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 36px 0; }
.panel { border: 1px solid var(--line); border-radius: 8px; padding: 18px; background: rgba(255,255,255,.045); }
.panel p, details p { color: var(--muted); line-height: 1.55; }
.faq { padding: 20px 0 64px; max-width: 760px; }
details { border-top: 1px solid var(--line); padding: 16px 0; }
summary { cursor: pointer; font-weight: 700; }
@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr; }
  .hero { min-height: 84vh; }
  .waitlist { display: grid; }
  input, button { width: 100%; }
}`;
}

function readString(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readNumber(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  return typeof value === "boolean" ? value : fallback;
}

function readStringArray(
  source: Record<string, unknown>,
  key: string,
  fallback: string[],
): string[] {
  const value = source[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 28) || "launch";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
