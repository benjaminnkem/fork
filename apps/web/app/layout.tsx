import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { Providers } from "@/app/providers";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";
import "./globals.css";

const spaceGroteskHeading = Space_Grotesk({subsets:['latin'],variable:'--font-heading'});

const ibmPlexSans = IBM_Plex_Sans({subsets:['latin'],variable:'--font-sans'});

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Fork",
  description: "Pre-execution DeFi risk agent. The model proposes. The EVM proves.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable, "font-sans", ibmPlexSans.variable, spaceGroteskHeading.variable)}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
