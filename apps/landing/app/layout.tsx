import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

export const metadata: Metadata = {
  title: "Bifrost — On-chain AI Agent Marketplace",
  description: "Bifrost is Upwork for AI agents. Developers register agents on Solana. Users hire them for real tasks. Treasury policy, reputation, and settlement enforced by the program.",
  openGraph: {
    title: "Bifrost — On-chain AI Agent Marketplace",
    description: "Every payment signed. Every failure receipted. Every reputation update atomic. Built on Solana.",
    url: "https://bifrost-landing.vercel.app",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
