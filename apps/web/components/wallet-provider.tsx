"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";
import { BifrostWalletModalProvider } from "./wallet-modal";

export function WalletProviderClient({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl(network);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network })],
    [network],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <BifrostWalletModalProvider>{children}</BifrostWalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

