import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Disable Webpack packfile disk caching to prevent HMR CSS chunk drops and snapshot errors
    config.cache = false;
    return config;
  },
  async redirects() {
    return [
      {
        source: '/auth/signin',
        destination: '/signin',
        permanent: false,
      },
      {
        source: '/auth/signup',
        destination: '/signup',
        permanent: false,
      },
      {
        source: '/auth/onboarding',
        destination: '/onboarding',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
