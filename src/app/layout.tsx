import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { Footer } from "@/components/Footer";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

// next/font downloads these at build time and serves them from the app itself: no
// visitor's browser ever requests fonts.googleapis.com (docs/design.md, "Typographie").
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
