import type { Metadata } from "next";
import Link from "next/link";
import { authConfig } from "@/lib/auth/session";
import { Logo } from "./Logo";
import { LogoutButton } from "./LogoutButton";
import { NavLinks } from "./NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "HuntPin",
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
            <Logo />
            HuntPin
          </Link>
          <NavLinks />
          {authConfig(process.env).kind === "on" && <LogoutButton />}
        </header>
        {children}
      </body>
    </html>
  );
}
