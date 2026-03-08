import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/cutting-plan/generate": ["./lib/cutting-plan/fonts/**/*"],
  },
};

export default nextConfig;
