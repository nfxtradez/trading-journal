import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      // Allow screenshot uploads and CSV imports larger than the 1MB default.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
