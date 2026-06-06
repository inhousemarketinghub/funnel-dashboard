import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, Inter } from "next/font/google";
import "./globals.css";

// Headings: Cormorant Garamond (original serif). Numbers + body: Inter.
const heading = Cormorant_Garamond({
  weight: "600",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const label = DM_Sans({
  weight: "500",
  subsets: ["latin"],
  variable: "--font-label",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Funnel Dashboard",
  description: "Marketing agency funnel analytics dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${heading.variable} ${label.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--t1)]">
        {children}
      </body>
    </html>
  );
}
