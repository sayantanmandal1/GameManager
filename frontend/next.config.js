/** @type {import('next').NextConfig} */
const apiOrigin = new URL(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
).origin;
const configuredWsOrigin = new URL(
  process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
);
configuredWsOrigin.protocol = configuredWsOrigin.protocol === 'https:' ? 'wss:' : 'ws:';

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  `connect-src 'self' ${apiOrigin} ${configuredWsOrigin.origin}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'microphone=(self), camera=(self)',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
