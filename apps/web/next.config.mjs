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
  // Single-container deploys (Dockerfile) serve the API behind the web app's
  // own origin: /api/* is proxied to the API process inside the container.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    return target ? [{ source: '/api/:path*', destination: `${target}/:path*` }] : [];
  },
};

export default nextConfig;
