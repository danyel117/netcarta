import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextPublicConvexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://little-deer-503.convex.cloud";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CONVEX_URL: nextPublicConvexUrl,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "*.wikimedia.org",
      },
    ],
  },
};

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

export default nextConfig;
