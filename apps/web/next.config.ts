import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@bifrost/shared"],
  turbopack: {
    root: resolve(appDir, "../.."),
  },
};

export default nextConfig;
