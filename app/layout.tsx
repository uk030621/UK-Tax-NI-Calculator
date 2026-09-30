import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "UK Tax & NI Calculator",
  description:
    "Calculate UK income tax, National Insurance, and Capital Gains Tax across employment, pension, self-employment, rental, savings, dividend, and capital gains income.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#3454d1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gradient-to-b from-brand-50 to-white font-sans text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
