"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ScanRecord } from "@/lib/types";
import { GradeBadge } from "./ScoreBadge";
import { Clock, ExternalLink, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

export function HistoryList() {
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch((err) => console.error("Error fetching history:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-zinc-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading recent audits...</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500 rounded-2xl border border-zinc-800/80 bg-zinc-900/30">
        <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
        <p className="text-sm">No previous scans found. Run your first audit above!</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-800/50 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="px-5 py-3 font-semibold">Target Domain</th>
              <th className="px-5 py-3 font-semibold">Overall Score</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Latency</th>
              <th className="px-5 py-3 font-semibold">Audited</th>
              <th className="px-5 py-3 text-right font-semibold">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {history.map((scan) => (
              <tr
                key={scan.id}
                className="hover:bg-zinc-800/30 transition-colors group"
              >
                <td className="px-5 py-3.5 font-medium text-zinc-200 flex items-center gap-2">
                  <span className="truncate max-w-[200px] sm:max-w-xs">{scan.domain}</span>
                </td>
                <td className="px-5 py-3.5">
                  <GradeBadge score={scan.overallScore} />
                </td>
                <td className="px-5 py-3.5">
                  {scan.status === "COMPLETED" ? (
                    <span className="inline-flex items-center text-xs font-semibold text-emerald-400">
                      Completed
                    </span>
                  ) : scan.status === "FAILED" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Failed
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-semibold text-amber-400">
                      Processing...
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-zinc-400 text-xs">
                  {scan.responseTimeMs ? `${scan.responseTimeMs}ms` : "--"}
                </td>
                <td className="px-5 py-3.5 text-zinc-400 text-xs">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {new Date(scan.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={`/scan/${scan.id}`}
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium text-xs transition-colors"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

