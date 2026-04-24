"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

function shortenAddress(value: string): string {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function WalletStatus() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();

  return (
    <div className="wallet-panel">
      <div className="wrow">
        <div className={connected ? "wpulse" : "wpulse muted"} />
        <div>
          <div className="wmeta">{connected ? "Connected" : "Wallet"}</div>
          <div className="waddr">
            {publicKey ? shortenAddress(publicKey.toBase58()) : "Not connected"}
          </div>
        </div>
        <div className="wbal">
          {connection.rpcEndpoint.includes("devnet") ? "◎ Devnet" : "◎ Custom"}
        </div>
      </div>
      <WalletMultiButton className="wallet-button" />
    </div>
  );
}

