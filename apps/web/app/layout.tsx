import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fork",
  description: "Pre-execution DeFi risk agent. The model proposes. The EVM proves.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
