import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MissionFileManifestEntry } from "@bifrost/shared";

const WORKSPACE_ROOT = path.resolve(
  process.cwd(),
  process.cwd().endsWith(path.join("apps", "api"))
    ? "../../.bifrost-workspaces"
    : ".bifrost-workspaces",
);

export class MissionWorkspace {
  constructor(private readonly missionId: string) {}

  get root(): string {
    return path.join(WORKSPACE_ROOT, this.missionId);
  }

  get siteDir(): string {
    return path.join(this.root, "site");
  }

  async ensure(): Promise<void> {
    await mkdir(this.siteDir, { recursive: true });
    await mkdir(path.join(this.root, "screenshots"), { recursive: true });
  }

  async writeText(relativePath: string, content: string): Promise<string> {
    await this.ensure();
    const target = path.join(this.root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    return target;
  }

  async readText(relativePath: string): Promise<string> {
    return await readFile(path.join(this.root, relativePath), "utf8");
  }

  async manifest(files: string[]): Promise<MissionFileManifestEntry[]> {
    const entries: MissionFileManifestEntry[] = [];
    for (const relativePath of files) {
      const fullPath = path.join(this.root, relativePath);
      const [content, info] = await Promise.all([readFile(fullPath), stat(fullPath)]);
      entries.push({
        path: relativePath,
        hash: createHash("sha256").update(content).digest("hex"),
        bytes: info.size,
        kind: inferKind(relativePath),
      });
    }
    return entries;
  }
}

function inferKind(filePath: string): MissionFileManifestEntry["kind"] {
  if (filePath.endsWith(".html")) return "html";
  if (filePath.endsWith(".css")) return "css";
  if (filePath.endsWith(".json")) return "json";
  if (filePath.endsWith(".md")) return "markdown";
  if (filePath.endsWith(".png") || filePath.endsWith(".jpg")) return "image";
  return "text";
}
