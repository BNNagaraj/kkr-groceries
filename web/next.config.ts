import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "out",
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

// Sentry wrapping — source-map upload only when SENTRY_AUTH_TOKEN is present.
// Without a token, the build still completes; symbolicated traces just won't
// appear in Sentry until you provision an org/project + auth token.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "kkr",
  project: process.env.SENTRY_PROJECT || "kkr-groceries-web",
  silent: !process.env.CI,
  widenClientFileUpload: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    automaticVercelMonitors: false,
    reactComponentAnnotation: { enabled: false },
    treeshake: { removeDebugLogging: true },
  },
});
