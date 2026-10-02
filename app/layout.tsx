import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
// Used only for display headlines on the marketing/landing content shown
// to signed-out or not-yet-approved visitors (see components/LandingContent.tsx)
// — Inter remains the body font everywhere, including inside that same
// content, so the rest of the app's type system is untouched.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "UK Tax & NI Calculator",
  description:
    "Calculate UK income tax, National Insurance, and Capital Gains Tax across employment, pension, self-employment, rental, savings, dividend, and capital gains income.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#3454d1",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved once, here, for every page — each page that also calls
  // getServerSession() itself (app/page.tsx, the admin pages) still
  // does so for its own access-control logic, which is unrelated to
  // this: this copy exists purely to seed the client-side session
  // context below, so components like AuthButton never start from an
  // unknown "loading" state on first paint.
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-gradient-to-b from-brand-50 to-white font-sans text-slate-900">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
