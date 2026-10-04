import React from "react";
import { ScanInput } from "@/components/ScanInput";
import { HistoryList } from "@/components/HistoryList";
import { Shield, Search, Eye, Zap, Link2, Sparkles, Lock, ArrowUpRight } from "lucide-react";

export default function HomePage() {
  const pillars = [
    {
      icon: Shield,
      title: "Security & Headers",
      desc: "Detects missing HSTS, CSP vulnerabilities, clickjacking risks, MIME sniffing, and insecure server disclosure headers.",
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      icon: Search,
      title: "Technical SEO",
      desc: "Audits title tag lengths, meta descriptions, canonicalization, OpenGraph cards, heading hierarchy, and robots indexing.",
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    {
      icon: Eye,
      title: "Accessibility (a11y)",
      desc: "Validates HTML lang attributes, missing image alt text, ARIA landmarks, unlabelled form inputs, and viewport zooming.",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
    {
      icon: Zap,
      title: "Performance & CWV",
      desc: "Measures real server TTFB latency, transfer compression (Brotli/Gzip), render-blocking assets, and estimated FCP metrics.",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
    {
      icon: Link2,
      title: "Broken Links",
      desc: "Extracts internal and external page links and tests live HTTP response codes to uncover 404 dead ends and broken anchors.",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      icon: Lock,
      title: "Strict SSRF Defense",
      desc: "Validates pre-flight DNS, blocks loopback, RFC 1918, link-local, and cloud metadata targets with hop-by-hop redirect verification.",
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    },
  ];

  return (
    <div className="space-y-16 pb-8">
      {/* Hero Section */}
      <section className="text-center pt-8 md:pt-14 space-y-6 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-xs font-semibold text-zinc-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Full-Spectrum Production Website Auditor</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight">
          Audit Any Website for{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Security, SEO & Health
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Enter any public URL to execute deep security header analysis, accessibility checks, performance latency benchmarks, and broken link scans with actionable fix recommendations.
        </p>

        {/* URL Input Form */}
        <div className="pt-4">
          <ScanInput />
        </div>
      </section>

      {/* Audit Pillars Grid */}
      <section className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-zinc-100">Comprehensive 6-Point Audit Engine</h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Real-world HTTP inspections without mock data or simulated responses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-200 space-y-3"
              >
                <div className={`p-3 rounded-2xl w-fit border ${p.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-zinc-100 flex items-center justify-between">
                  <span>{p.title}</span>
                  <ArrowUpRight className="w-4 h-4 text-zinc-600" />
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Scans Section */}
      <section className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-100">Recent Audit History</h2>
          <span className="text-xs text-zinc-400">Saved in SQLite/PostgreSQL database</span>
        </div>

        <HistoryList />
      </section>
    </div>
  );
}

