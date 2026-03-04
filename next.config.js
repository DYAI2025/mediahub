/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large file uploads via API routes (for metadata only, actual upload goes to S3)
  experimental: {},
}

module.exports = nextConfig
