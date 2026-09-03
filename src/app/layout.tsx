import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// Design System CSS registered BEFORE globals.css so our own `tokens.css`
// + `globals.css` can override any DS defaults that conflict with the
// app's token model. Loose CSS cascade — later wins.
import "@navanta-ai/design-system/styles.css";
import "./globals.css";
import { BRAND } from "@/data/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: BRAND.appTitle,
  description: BRAND.description,
};

/**
 * The company's colours enter here and nowhere else.
 *
 * The rail, the badge numerals and the page ground all read custom properties
 * (`--nav-brand`, `--rail-gradient`, `--gradient-page-bg`). Setting them on
 * <body> from the active pack's brand overrides the :root defaults for every
 * descendant, so swapping the company pack repaints the chrome without a
 * stylesheet edit — the CSS files describe the shape of the chrome, the pack
 * describes its colour.
 */
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
      <body
        className="min-h-full flex flex-col"
        style={
          {
            "--nav-brand": BRAND.navBrand,
            "--rail-gradient": BRAND.railGradient,
            "--gradient-page-bg": BRAND.pageGradient,
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
