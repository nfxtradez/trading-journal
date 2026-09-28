import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify has no persistent disk, so Netlify builds store data in Netlify Blobs (see src/lib/db.ts).
  env: {
    JOURNAL_STORAGE: process.env.JOURNAL_STORAGE ?? (process.env.NETLIFY === "true" ? "blobs" : "local"),
  },
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Allow screenshot uploads and CSV imports larger than the 1MB default.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
