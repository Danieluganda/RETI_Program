import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: ["192.168.100.43"],
  reactStrictMode: true,
};

export default nextConfig;
