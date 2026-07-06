const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large file uploads via API routes (for metadata only, actual upload goes to S3)
  experimental: {},
  output: "standalone",
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname, "src"),
    };
    return config;
  },
};

module.exports = nextConfig;
