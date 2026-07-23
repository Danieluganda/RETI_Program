/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: ["192.168.100.43"],
  reactStrictMode: true,
};

module.exports = nextConfig;
