import type { Metadata } from "next";
import Link from "next/link";
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
        <header className="flex h-12 items-center gap-6 border-b border-black/10 px-4 dark:border-white/15">
          <Link href="/" className="font-bold">
            LeadRadar
          </Link>
          <nav aria-label="Main" className="flex gap-4 text-sm">
            <Link href="/" className="hover:underline">
              Map
            </Link>
            <Link href="/google" className="hover:underline">
              Google search
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
