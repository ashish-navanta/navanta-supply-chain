import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// Design System CSS registered BEFORE globals.css so our own `tokens.css`
// + `globals.css` can override any DS defaults that conflict with the
// app's token model. Loose CSS cascade — later wins.
import "@navanta-ai/design-system/styles.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Navanta · Supply Chain",
  description:
    "The seats in a retail supply chain — buyer, planner, service rep and logistics coordinator — run on Navanta.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
