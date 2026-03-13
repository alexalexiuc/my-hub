import "dotenv-mono/load";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@my-hub/shared"],
  },
};

export default nextConfig;
