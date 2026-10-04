"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe, Loader2, ShieldCheck, AlertCircle } from "lucide-react";

export function ScanInput({ initialUrl = "" }: { initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start audit scan.");
      }

      router.push(`/scan/${data.scanId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error initiating scan.";
      setError(msg);
      setLoading(false);
    }
  };

  const handlePreset = (presetUrl: string) => {
    setUrl(presetUrl);
    setError(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="relative flex items-center shadow-2xl rounded-2xl bg-zinc-900/90 border border-zinc-700/80 p-2 backdrop-blur-xl focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-300">
          <div className="pl-3 pr-2 text-zinc-400">
            <Globe className="w-5 h-5" />
          </div>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL (e.g., example.com, github.com)"
            disabled={loading}
            className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 text-base md:text-lg focus:outline-none px-2 py-2"
          />

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 py-3 rounded-xl transition-all shadow-md shadow-indigo-600/30 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Auditing...</span>
              </>
            ) : (
              <>
                <span>Run Audit</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Scan Blocked or Failed</p>
            <p className="text-xs text-red-400/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Preset demo targets */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-400">
        <span className="flex items-center gap-1 text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          Try public sites:
        </span>
        {["wikipedia.org", "github.com", "cloudflare.com", "python.org"].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handlePreset(preset)}
            className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors"
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}

