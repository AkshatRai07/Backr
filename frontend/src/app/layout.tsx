import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Backr - Vouching-Based Credit Protocol",
  description: "Build your on-chain credit through trusted vouches. Borrow without traditional collateral.",
  keywords: ["DeFi", "credit", "vouching", "blockchain", "lending"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-[#0a0a0f] text-slate-100`}
      >
        <Providers>
          {/* Background decoration */}
          <div className="fixed inset-0 bg-grid pointer-events-none opacity-50" />
          <div className="fixed top-0 left-1/4 w-96 h-96 orb orb-cyan" />
          <div className="fixed bottom-0 right-1/4 w-96 h-96 orb orb-violet" />
          
          {/* Main layout */}
          <div className="relative min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 pt-20">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
