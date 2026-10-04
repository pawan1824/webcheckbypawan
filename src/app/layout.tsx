import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Activity } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebCheck AI — Full Spectrum Website Health & Security Audit",
  description:
    "Production-grade website auditor analyzing security headers, SEO hierarchy, accessibility compliance, performance metrics, and broken links with actionable AI-ready recommendations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden">
          {/* Subtle ambient lighting */}
          <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full" />
            <div className="absolute top-1/3 -right-40 w-[450px] h-[300px] bg-purple-600/10 blur-[140px] rounded-full" />
          </div>

          {/* Navigation Header */}
          <header className="relative z-10 border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-extrabold text-lg text-white tracking-tight">
                    WebCheck
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">
                    AI
                  </span>
                </div>
              </Link>

              <div className="flex items-center gap-4 text-xs">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  SSRF Protected Engine
                </div>
                <div className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span className="font-medium">Active Auditor</span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Body */}
          <main className="relative z-10 flex-grow max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="relative z-10 border-t border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md py-6 text-center text-xs text-zinc-400">
            <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p>WebCheck AI &copy; {new Date().getFullYear()} — Production Website Health, Security & SEO Auditor.</p>
              <p className="text-zinc-400">DNS Verified &bull; Strict SSRF Guard &bull; Hop-Checked Redirects</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

