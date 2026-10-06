import type { NextConfig } from 'next';

// NEXT_PUBLIC_* values are inlined into the browser bundle. Stop the build if
// one is named like a server secret, or holds a Supabase secret key, so a
// mistake in an env file can never reach visitors.
const leaks = Object.entries(process.env).filter(([name, value]) =>
  name.startsWith('NEXT_PUBLIC_') && Boolean(value) && (
    /SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|YOUTUBE_API_KEY/i.test(name) ||
    value!.startsWith('sb_secret_')
  ));
if (leaks.length) {
  throw new Error(
    `Refusing to start: ${leaks.map(([name]) => name).join(', ')} would expose a server secret to the browser. ` +
    'Remove the NEXT_PUBLIC_ prefix and read it from server code only. See .env.example.',
  );
}

const nextConfig: NextConfig = {
  // No floating dev badge over the world UI.
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // World photos are requested as file?v=<content hash> (see
        // components/world/WorldImage.tsx), so a given URL never changes.
        source: '/worlds/:path*',
        has: [{ type: 'query', key: 'v' }],
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
