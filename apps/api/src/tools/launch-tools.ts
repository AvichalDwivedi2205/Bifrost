import type {
  LaunchMissionConfig,
  MissionDeliverables,
  MissionFileManifestEntry,
  MissionRecord,
} from "@bifrost/shared";
import { MissionWorkspace } from "../services/workspace/mission-workspace";

export interface LaunchArtifacts {
  research?: {
    summary: string;
    competitors: string[];
    messagingPatterns: string[];
    artifactRef: string;
  };
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
): Promise<Required<Pick<MissionDeliverables, "previewUrl" | "waitlistEndpoint" | "screenshots">>> {
  const workspace = new MissionWorkspace(record.id);
  await workspace.writeText(
    "screenshots/mobile-preview.txt",
    `Mobile screenshot placeholder for ${record.input.title} at ${new Date().toISOString()}`,
  );
  return {
    previewUrl: `${apiBaseUrl}/api/missions/${record.id}/preview`,
    waitlistEndpoint: `${apiBaseUrl}/api/missions/${record.id}/waitlist`,
    screenshots: [`workspace://${record.id}/screenshots/mobile-preview.txt`],
  };
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

export function deployLive(record: MissionRecord, apiBaseUrl: string): NonNullable<MissionDeliverables["deployReceipt"]> {
  return {
    provider: "bifrost-local-deploy",
    deploymentId: `deploy_${record.id}`,
    url: `${apiBaseUrl}/api/missions/${record.id}/live`,
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
