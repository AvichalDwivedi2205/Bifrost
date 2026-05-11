import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-launch",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dental AI SDR — Books consults while you drill",
  description:
    "The AI SDR your dental practice doesn't have to manage. Books consults, follows up no-shows, syncs to your PMS. HIPAA-aware. Bilingual. Live in 48 hours.",
  openGraph: {
    title: "Dental AI SDR — Books consults while you drill",
    description:
      "AI SDR for dental practices. Voice + SMS + email. PMS-native. Built by Bifrost, governed on Solana.",
  },
};

export default function DentalSdrLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}
      data-launch-theme="amber"
    >
      {children}
    </div>
  );
}
