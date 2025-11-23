'use client';

import { getDefaultConfig, TantoProvider } from '@sky-mavis/tanto-widget';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { useState, type ReactNode } from 'react';

const config = getDefaultConfig({
  appMetadata: {
    appName: 'Juego',
    appDescription: 'A learning game powered by Web3',
  },
  // Disable Ronin Waypoint (keyless wallet) unless client ID is configured
  // To enable: get a client ID from https://developers.skymavis.com/console/
  // Then set NEXT_PUBLIC_RONIN_CLIENT_ID in your .env.local
  keylessWalletConfig: process.env.NEXT_PUBLIC_RONIN_CLIENT_ID
    ? {
        clientId: process.env.NEXT_PUBLIC_RONIN_CLIENT_ID,
      }
    : { enable: false },
});

interface WalletProviderProps {
  children: ReactNode;
}

export default function WalletProvider({ children }: WalletProviderProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TantoProvider theme="dark">
          {children}
        </TantoProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
