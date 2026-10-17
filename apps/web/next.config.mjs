/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@easytrip/shared'],
  webpack: (config) => {
    // Keep the workspace package addressed through node_modules so the dev
    // refresh loader treats its compiled CommonJS output as a dependency.
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
