import 'dotenv-mono/load';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverExternalPackages: ['@my-hub/shared'],
  },
};

export default nextConfig;
