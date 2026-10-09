/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,

  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:5000'],
    },
  },

  async rewrites() {
    return {
      // afterFiles runs AFTER Next.js internal routes (including /api/auth/*).
      // This guarantees Auth.js handlers (/api/auth/...) are matched first and
      // are never accidentally forwarded to the Express backend.
      afterFiles: [
        // Health probe — surfaces backend /health through the proxy
        {
          source: '/backend-api/health',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000'}/health`,
        },
        // All other backend routes
        {
          source: '/backend-api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000'}/api/:path*`,
        },
      ],
    };
  },

  webpack(config, { dev }) {
    if (dev) {
      // Use filesystem cache with gzip compression to avoid the
      // "Serializing big strings (130kiB)" warning in webpack cache strategy.
      config.cache = {
        type: 'filesystem',
        compression: 'gzip',
        maxMemoryGenerations: 1,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
