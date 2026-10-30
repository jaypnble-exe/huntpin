import type { Metadata } from "next";
import Link from "next/link";
import { IconRadar } from "@/components/ui";
import { NavLinks } from "./NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadRadar",
  description: "Map of local businesses that appear to have no website listed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="sticky top-0 z-40 flex h-12 items-center gap-4 border-b border-border bg-surface/90 px-4 backdrop-blur">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <IconRadar className="h-4 w-4" />
            </span>
            LeadRadar
          </Link>
          <NavLinks />
        </header>
        {children}
      </body>
    </html>
  );
}
