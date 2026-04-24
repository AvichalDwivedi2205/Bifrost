import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

import { Sidebar } from "@/components/sidebar";
import { WalletProviderClient } from "@/components/wallet-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "MissionMesh",
  description: "Solana-native mission OS for governed multi-agent execution.",
};

const offlineFontVars = {
  "--font-serif":
    '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  "--font-sans":
    '"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
  "--font-mono":
    '"SFMono-Regular", "IBM Plex Mono", "Menlo", "Monaco", "Courier New", monospace',
} as CSSProperties;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={offlineFontVars}>
        <WalletProviderClient>
          <div className="shell">
            <Sidebar />
            <main className="main">{children}</main>
          </div>
        </WalletProviderClient>
      </body>
    </html>
  );
}
