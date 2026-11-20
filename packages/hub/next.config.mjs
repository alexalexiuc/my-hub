import 'dotenv-mono/load';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // `next dev` writes an AGENTS.md when it detects an AI agent. Agent guidance lives in CLAUDE.md only.
  agentRules: false,
  serverExternalPackages: ['@my-hub/shared'],
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/favicon.svg',
      },
    ];
  },
};

export default nextConfig;
