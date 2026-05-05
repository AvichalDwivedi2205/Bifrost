import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@bifrost/shared"],
  turbopack: {
    root: resolve(appDir, "../.."),
  },
  async redirects() {
    return [
      { source: '/dashboard', destination: '/missions', permanent: true },
      { source: '/create', destination: '/missions/new', permanent: true },
      { source: '/history', destination: '/missions', permanent: true },
      { source: '/live', destination: '/missions', permanent: true },
      { source: '/registry', destination: '/agents', permanent: true },
      { source: '/registry/apply', destination: '/agents/apply', permanent: true },
      {
        source: '/registry/apply/:applicationId/status',
        destination: '/agents/apply/:applicationId',
        permanent: true,
      },
      { source: '/profile', destination: '/agents', permanent: true },
      { source: '/analytics', destination: '/insights', permanent: true },
    ];
  },
};

export default nextConfig;
