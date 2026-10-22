import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

// The faces, self-hosted through next/font as minty-web and minty-payment-request-web do
// (2026-10-12). This replaced a Google Fonts <link>: next/font also generates a metric-matched
// fallback @font-face (src: local(Arial) with size-adjust / ascent-override), so the page no
// longer reflows when the webfont lands. Inter with no `weight` is the variable font, covering
// the 400/500/600/700 this app's CSS asks for.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

// The brand face, for the "Minty" name alone - .topbar .brand in app/globals.css, drawn by
// components/OnboardingApp.tsx. Weight 700 only, the one weight the mark is drawn at, exactly as
// minty-web's app/layout.tsx sets it.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["700"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Getting Started — Onboarding",
  description: "Entity creation onboarding flow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} antialiased`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
