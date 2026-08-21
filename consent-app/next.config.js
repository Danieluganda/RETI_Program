/** @type {import('next').NextConfig} */
const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

const nextConfig = (phase) => {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    outputFileTracingRoot: __dirname,
    distDir: isDevServer ? ".next-dev" : ".next",
    allowedDevOrigins: ["192.168.100.43"],
    reactStrictMode: true,
    webpack: (config, { dev }) => {
      if (dev) {
        config.cache = false;
      }

      return config;
    },
  };
};

module.exports = nextConfig;
