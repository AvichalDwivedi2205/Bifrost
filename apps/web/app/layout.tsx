import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { WalletProviderClient } from "@/components/wallet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bifrost",
  description: "Solana-native mission OS for governed multi-agent execution.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ThemeProvider>
          <WalletProviderClient>
            {children}
          </WalletProviderClient>
        </ThemeProvider>
      </body>
    </html>
  );
}
