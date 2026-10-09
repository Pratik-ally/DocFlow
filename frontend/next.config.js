/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,

  experimental: {
    externalDir: true,
    serverActions: {
      allowedOrigins: process.env.NODE_ENV === 'production'
        ? (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS || '')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
        : ['localhost:3000', 'localhost:5000', '127.0.0.1:3000'],
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

  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';
    const scriptPolicy = isProduction
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      scriptPolicy,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self'${isProduction ? '' : ' ws: wss: http://localhost:5000 http://127.0.0.1:5000'}`,
    ].join('; ');
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(process.env.NEXTAUTH_URL?.startsWith('https://')
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
        : []),
    ];

    return [{ source: '/:path*', headers: securityHeaders }];
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
