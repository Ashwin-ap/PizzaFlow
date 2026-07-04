import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/ThemeToggle";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "SliceMatic — Pizza Ordering",
  description:
    "SliceMatic Stage 3 — fast pizza ordering. Built on Next.js 16 + Supabase.",
};

// Runs before paint: applies the saved (or system) theme so there is no flash.
const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
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
            <ThemeToggle />
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
