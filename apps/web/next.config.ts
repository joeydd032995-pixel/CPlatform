import type { NextConfig } from 'next';

// transpilePackages is only needed if a runtime workspace import is ever
// added (e.g. `@cplatform/games` or `@cplatform/core-rng` imported for
// values, not just types, from client/app code). We deliberately never do
// that here: core-rng imports Node's `crypto` and would break `next build`
// for any client bundle that pulled it in. Keep all `@cplatform/*` imports
// in this app `import type`-only.
const nextConfig: NextConfig = {
  async rewrites() {
    const apiProxyUrl = process.env.API_PROXY_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
