import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.COMPOSER_DESKTOP_BUILD === "1" ? ".next-desktop" : ".next",
  output: process.env.COMPOSER_DESKTOP_BUILD === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: [],
  outputFileTracingIncludes: { "/*": ["./node_modules/@swc/helpers/**/*"] },
  outputFileTracingExcludes: {
    "/*": ["./.local/**/*", "./output/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ] }];
  },
};
export default config;
