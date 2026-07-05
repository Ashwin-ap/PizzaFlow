import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Lexend, JetBrains_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/ThemeToggle";

// Lexend — Zomato brand-book primary typeface. next/font self-hosts it (fetched at
// build, served from our own origin), so there's no runtime request to Google.
const lexend = Lexend({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lexend",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  // Absolute base for OG/canonical URLs. Sourced from the validated NEXT_PUBLIC_APP_URL
  // (set in Vercel to the public URL); falls back to localhost for dev/build.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "SliceMatic — Pizza Ordering",
  description:
    "SliceMatic Stage 3 — fast pizza ordering. Built on Next.js 16 + Supabase.",
};

// Runs before paint (no flash). Light is the default; dark applies ONLY when the
// user has explicitly toggled to it (saved in localStorage). System dark-mode is
// intentionally NOT honoured, so a first-time visitor always lands on the light
// brand theme.
const NO_FLASH_SCRIPT = `(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${lexend.variable} ${jetbrainsMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <header className="border-b border-hairline">
          <div className="container-x flex items-center justify-between h-16">
            <Link href="/" className="flex items-baseline gap-[2px] no-underline">
              <span className="text-[22px] font-semibold text-ink tracking-[-1.2px]">
                SliceMatic
              </span>
              <span className="inline-block w-[7px] h-[7px] rounded-full bg-primary" />
            </Link>
            <div className="flex items-center gap-1.5">
              <Link href="/admin" className="link-quiet">
                Admin
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-hairline">
          <div className="container-x h-14 flex items-center text-[13px] text-ink-mute">
            SliceMatic · New Ashok Nagar, Delhi · Stage 3
          </div>
        </footer>
      </body>
    </html>
  );
}
