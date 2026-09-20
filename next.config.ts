import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.117:3000", "192.168.1.117"],
  reactStrictMode: true,
  poweredByHeader: false,

  // Externalize chromium for Vercel serverless functions
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/@sparticuz/chromium-min/**/*'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.r2.cloudflarestorage.com https://api.telegram.org",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [375, 640, 768, 1024, 1280],
    imageSizes: [16, 32, 48, 64, 96],
  },

  // Compression
  compress: true,
};

export default nextConfig;
