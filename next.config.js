/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  async rewrites() {
    return [
      {
        source: '/artifacts/:path*',
        destination: '/api/artifacts/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Ignore optional canvas dependency in linkedom for browser builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;