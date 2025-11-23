import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Recommended for Railway deployment - uses standalone output for better performance
  output: 'standalone',

  // Empty turbopack config to silence the warning about having webpack config
  turbopack: {},

  // Exclude problematic server-side modules in SSR
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],

  // Fix for WalletConnect packages that have optional dependencies not available in browser
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push(
      'pino-pretty',
      'lokijs',
      'encoding',
      'pino',
      'thread-stream',
      'tap',
      'why-is-node-running'
    );

    // Ignore optional wallet connector dependencies that aren't needed
    config.resolve.alias = {
      ...config.resolve.alias,
      // '@coinbase/wallet-sdk' is now installed, so don't ignore it
      '@gemini-wallet/core': false,
      '@metamask/sdk': false,
      '@base-org/account': false,
      '@safe-global/safe-apps-sdk': false,
      '@safe-global/safe-apps-provider': false,
      'porto': false,
    };

    return config;
  },
};

export default nextConfig;
