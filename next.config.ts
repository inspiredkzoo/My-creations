import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // googleapis uses Node.js crypto APIs not available in the Edge runtime
  serverExternalPackages: ['googleapis'],
};

export default nextConfig;
