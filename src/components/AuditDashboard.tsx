"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Category, FindingItem, ScanRecord, Severity, parseFindingLocation } from "@/lib/types";
import { GradeBadge } from "./ScoreBadge";
import { CategoryScoreCard } from "./CategoryScoreCard";
import { FindingCard } from "./FindingCard";
import { ReportExport } from "./ReportExport";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Filter,
  Globe,
  Lock,
  Search,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  AlertOctagon,
  Layers,
  ShieldAlert,
  Info,
} from "lucide-react";

export function AuditDashboard({ scanId }: { scanId: string }) {
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<Category | "ALL">("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "ALL">("ALL");
  const [selectedPage, setSelectedPage] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchScan = async () => {
    try {
      const res = await fetch(`/api/scan/${scanId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Audit report not found.");
        throw new Error("Failed to load audit results.");
      }
      const data = await res.json();
      setScan(data);
      setLoading(false);
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading scan.");
      setLoading(false);
      return null;
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    fetchScan().then((initialData) => {
      if (initialData && (initialData.status === "PENDING" || initialData.status === "IN_PROGRESS")) {
        interval = setInterval(async () => {
          const updated = await fetchScan();
          if (updated && (updated.status === "COMPLETED" || updated.status === "FAILED")) {
            if (interval) clearInterval(interval);
          }
        }, 2000);
      }
    });

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanId]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-base font-medium">Fetching comprehensive audit report...</p>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-red-950/20 border border-red-500/30 text-center space-y-4">
        <AlertOctagon className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-zinc-100">Unable to Load Audit</h2>
        <p className="text-zinc-400 text-sm">{error || "Scan record does not exist."}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Audit Kickoff
        </Link>
      </div>
    );
  }

  // Scan In Progress state
  if (scan.status === "PENDING" || scan.status === "IN_PROGRESS") {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-2xl backdrop-blur-xl text-center space-y-6">
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <Globe className="w-8 h-8 text-indigo-400 animate-pulse" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Auditing Website in Real-Time</h2>
          <p className="text-zinc-400 text-sm mt-1">{scan.url}</p>
        </div>

        <div className="space-y-3 text-left text-xs text-zinc-400 bg-black/40 p-4 rounded-2xl border border-zinc-800/80 font-mono">
          <div className="flex items-center gap-2 text-indigo-400">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            [1/5] SSRF Pre-flight, DNS validation & crawling internal domain links...
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            [2/5] Inspecting SSL/TLS certificates & strict security headers...
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            [3/5] Parsing DOM hierarchy, OpenGraph, sitemap & robots directives...
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            [4/5] Running WCAG 2.1 accessibility & form label verification...
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            [5/5] Benchmarking TTFB, resource weights & auditing live hyperlinks...
          </div>
        </div>
      </div>
    );
  }

  // Scan Failed state
  if (scan.status === "FAILED") {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 rounded-3xl bg-red-950/20 border border-red-500/30 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-2xl font-bold text-zinc-100">Audit Scan Failed</h2>
        <p className="text-zinc-400 text-sm">
          The scanner was unable to complete the audit for{" "}
          <span className="font-mono text-zinc-200">{scan.url}</span>.
        </p>
        {scan.errorMessage && (
          <div className="p-4 rounded-xl bg-red-900/30 border border-red-500/30 text-red-300 font-mono text-xs text-left">
            {scan.errorMessage}
          </div>
        )}
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Try Another URL
          </Link>
        </div>
      </div>
    );
  }

  // Completed State - Enrich findings with parsed location if needed
  const rawFindings: FindingItem[] = (scan.findings as FindingItem[]) || [];
  const findings: FindingItem[] = rawFindings.map((f) => {
    if (f.pageUrl && f.element) return f;
    const loc = parseFindingLocation(f.evidence);
    return {
      ...f,
      pageUrl: f.pageUrl || loc.pageUrl,
      element: f.element || loc.element,
      evidence: loc.cleanEvidence || f.evidence,
    };
  });

  // Extract distinct pages where issues were detected
  const detectedPages = Array.from(
    new Set(findings.map((f) => f.pageUrl).filter((p): p is string => Boolean(p)))
  );

  // Severity counts
  const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
  const highCount = findings.filter((f) => f.severity === "HIGH").length;
  const mediumCount = findings.filter((f) => f.severity === "MEDIUM").length;
  const lowCount = findings.filter((f) => f.severity === "LOW").length;
  const infoCount = findings.filter((f) => f.severity === "INFO").length;

  // Filtered findings
  const filteredFindings = findings.filter((f) => {
    if (selectedCategory !== "ALL" && f.category !== selectedCategory) return false;
    if (selectedSeverity !== "ALL" && f.severity !== selectedSeverity) return false;
    if (selectedPage !== "ALL" && f.pageUrl !== selectedPage) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.remediation && f.remediation.toLowerCase().includes(q)) ||
        (f.element && f.element.toLowerCase().includes(q)) ||
        (f.pageUrl && f.pageUrl.toLowerCase().includes(q)) ||
        (f.evidence && f.evidence.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const categories: Category[] = ["SECURITY", "SEO", "ACCESSIBILITY", "PERFORMANCE", "LINKS"];
  const severities: (Severity | "ALL")[] = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

  return (
    <div className="space-y-8">
      {/* Top Header Card */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Link
                href="/"
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors print:hidden"
                title="Back to home"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2 truncate">
                <span>{scan.domain}</span>
                <a
                  href={scan.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </h1>
            </div>

            <p className="text-xs md:text-sm text-zinc-400 font-mono break-all">{scan.url}</p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                {new Date(scan.createdAt).toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                TTFB: {scan.responseTimeMs ?? "--"}ms
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className={`w-3.5 h-3.5 ${scan.sslValid ? "text-emerald-400" : "text-red-400"}`} />
                {scan.sslValid ? "SSL Valid" : "Insecure HTTP"}
              </span>
              {detectedPages.length > 0 && (
                <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                  <Layers className="w-3.5 h-3.5" />
                  {detectedPages.length} Distinct Page(s) Crawled
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-col items-center p-4 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 min-w-[140px]">
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                Overall Health
              </span>
              <GradeBadge score={scan.overallScore} />
            </div>

            <ReportExport scanId={scan.id} />
          </div>
        </div>
      </div>

      {/* Severity Breakdown Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => setSelectedSeverity("ALL")}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            selectedSeverity === "ALL"
              ? "bg-zinc-800 border-zinc-600 shadow-md"
              : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/40"
          }`}
        >
          <span className="text-xs text-zinc-400 font-medium block">All Findings</span>
          <span className="text-2xl font-black text-white">{findings.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSeverity(selectedSeverity === "CRITICAL" ? "ALL" : "CRITICAL")}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            selectedSeverity === "CRITICAL"
              ? "bg-red-950/60 border-red-500 shadow-md shadow-red-500/10"
              : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/40"
          }`}
        >
          <span className="text-xs text-red-400 font-medium flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Critical
          </span>
          <span className="text-2xl font-black text-red-400">{criticalCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSeverity(selectedSeverity === "HIGH" ? "ALL" : "HIGH")}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            selectedSeverity === "HIGH"
              ? "bg-orange-950/60 border-orange-500 shadow-md shadow-orange-500/10"
              : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/40"
          }`}
        >
          <span className="text-xs text-orange-400 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            High
          </span>
          <span className="text-2xl font-black text-orange-400">{highCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSeverity(selectedSeverity === "MEDIUM" ? "ALL" : "MEDIUM")}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            selectedSeverity === "MEDIUM"
              ? "bg-amber-950/60 border-amber-500 shadow-md shadow-amber-500/10"
              : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/40"
          }`}
        >
          <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Medium
          </span>
          <span className="text-2xl font-black text-amber-400">{mediumCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSeverity(selectedSeverity === "LOW" ? "ALL" : "LOW")}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            selectedSeverity === "LOW"
              ? "bg-blue-950/60 border-blue-500 shadow-md shadow-blue-500/10"
              : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/40"
          }`}
        >
          <span className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Low
          </span>
          <span className="text-2xl font-black text-blue-400">{lowCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedSeverity(selectedSeverity === "INFO" ? "ALL" : "INFO")}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            selectedSeverity === "INFO"
              ? "bg-emerald-950/60 border-emerald-500 shadow-md shadow-emerald-500/10"
              : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/40"
          }`}
        >
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Passed / Info
          </span>
          <span className="text-2xl font-black text-emerald-400">{infoCount}</span>
        </button>
      </div>

      {/* Category Score Grid */}
      <div>
        <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-indigo-400" />
          Audit Category Breakdown
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {categories.map((cat) => {
            let catScore: number | null = null;
            if (cat === "SECURITY") catScore = scan.securityScore;
            if (cat === "SEO") catScore = scan.seoScore;
            if (cat === "ACCESSIBILITY") catScore = scan.accessibilityScore;
            if (cat === "PERFORMANCE") catScore = scan.performanceScore;
            if (cat === "LINKS") catScore = scan.linksScore;

            const catFindings = findings.filter((f) => f.category === cat);

            return (
              <CategoryScoreCard
                key={cat}
                category={cat}
                score={catScore}
                findings={catFindings}
                isSelected={selectedCategory === cat}
                onSelect={() => setSelectedCategory(selectedCategory === cat ? "ALL" : cat)}
              />
            );
          })}
        </div>
      </div>

      {/* Findings Explorer */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-zinc-100">
              Audit Findings & Recommended Fixes
              <span className="ml-2 text-xs font-normal text-zinc-400">
                ({filteredFindings.length} of {findings.length})
              </span>
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Page Filter Dropdown */}
            {detectedPages.length > 1 && (
              <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/80 font-mono"
              >
                <option value="ALL">All Crawled Pages ({detectedPages.length})</option>
                {detectedPages.map((page) => (
                  <option key={page} value={page}>
                    {page.replace(/^https?:\/\/[^/]+/, "") || "/"}
                  </option>
                ))}
              </select>
            )}

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issues, pages, selectors..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/80"
              />
            </div>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {severities.map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSelectedSeverity(sev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                selectedSeverity === sev
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {sev}
            </button>
          ))}
          {(selectedCategory !== "ALL" || selectedSeverity !== "ALL" || selectedPage !== "ALL" || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("ALL");
                setSelectedSeverity("ALL");
                setSelectedPage("ALL");
                setSearchQuery("");
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium ml-2 underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Findings List */}
        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-zinc-800 bg-zinc-900/30 text-zinc-500 text-sm">
            No findings match your selected filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFindings.map((finding, idx) => (
              <FindingCard
                key={`${finding.category}-${finding.title}-${finding.pageUrl || ""}-${idx}`}
                finding={finding}
              />
            ))}
          </div>
        )}
      </div>

      {/* Metrics Table */}
      {scan.metrics && scan.metrics.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-400" />
            Collected Technical Metrics & Crawl Measurements
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {scan.metrics.map((metric, idx) => (
              <div
                key={`${metric.name}-${idx}`}
                className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between"
              >
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  {metric.name}
                </span>
                <span className="text-sm font-mono text-zinc-200 font-medium mt-1 truncate">
                  {metric.value} {metric.unit || ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
