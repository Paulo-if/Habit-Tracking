import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/*": ["./scripts/**/*", "./tests/**/*", "./electron/**/*", "./Habitos-App/**/*"],
  },
};

export default nextConfig;
