import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["10.211.55.3"],
  async rewrites() {
    return [
      { source: "/dex", destination: "/dex-runtime/index.html" },
      { source: "/dex/:path*", destination: "/dex-runtime/:path*" },
    ];
  },
};

export default nextConfig;
