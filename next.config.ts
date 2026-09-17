import type { NextConfig } from "next";
import { CMS_UPLOAD_REQUEST_MAX_BYTES } from "./src/lib/config/cms/media";

const IS_DEV = process.env.NODE_ENV === "development";

const GOOGLE_TAG_HOSTS = "https://www.googletagmanager.com";
const GOOGLE_BEACON_HOSTS =
  "https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com";

const GOOGLE_MAPS_HOST = "https://www.google.com";

function supabaseMediaPatterns(): URL[] {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) return [];

  try {
    return [new URL("/storage/v1/object/public/cms-media/**", projectUrl)];
  } catch {
    return [];
  }
}

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline' ${GOOGLE_TAG_HOSTS}${IS_DEV ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self' https://*.supabase.co ${GOOGLE_BEACON_HOSTS}${IS_DEV ? " ws://localhost:* http://localhost:*" : ""}`,
  `frame-src 'self' ${GOOGLE_TAG_HOSTS} ${GOOGLE_MAPS_HOST}`,
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    globalNotFound: true,
    serverActions: { bodySizeLimit: CMS_UPLOAD_REQUEST_MAX_BYTES },
    proxyClientMaxBodySize: CMS_UPLOAD_REQUEST_MAX_BYTES,
  },

  images: {
    remotePatterns: supabaseMediaPatterns(),
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        source: "/brand/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/email/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
