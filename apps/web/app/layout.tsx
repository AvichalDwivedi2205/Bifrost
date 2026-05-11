import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { WalletProviderClient } from "@/components/wallet-provider";
import RouteTransition from "@/components/RouteTransition";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Bifrost",
  description: "Solana-native mission OS for governed multi-agent execution.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" className={fraunces.variable}>
      <body>
        <ThemeProvider>
          <WalletProviderClient>
            <RouteTransition>{children}</RouteTransition>
          </WalletProviderClient>
        </ThemeProvider>
      </body>
    </html>
  );
}
