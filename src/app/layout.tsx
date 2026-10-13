import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import { Footer } from "@/components/Footer";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

// Self-hosted from src/fonts (Google Fonts' static files, latin + latin-ext in one file
// per weight) so the build never depends on reaching Google: next/font/google failed
// to download them during a Vercel build. No visitor's browser ever requests
// fonts.googleapis.com either (docs/design.md, "Typographie").
const bricolage = localFont({
  variable: "--font-bricolage",
  src: [
    { path: "../fonts/BricolageGrotesque-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/BricolageGrotesque-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

const figtree = localFont({
  variable: "--font-figtree",
  src: [
    { path: "../fonts/Figtree-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Figtree-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Figtree-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Electro Care",
  description: "Suivez les appareils de votre maison",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="fr"
      data-theme={theme}
      className={`${bricolage.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Footer />
      </body>
    </html>
  );
}
