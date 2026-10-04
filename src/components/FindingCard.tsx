"use client";

import React, { useState } from "react";
import { FindingItem, parseFindingLocation } from "@/lib/types";
import { SeverityBadge } from "./ScoreBadge";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Terminal,
  Wrench,
  Globe,
  Code2,
  ExternalLink,
} from "lucide-react";

export function FindingCard({ finding }: { finding: FindingItem }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedElement, setCopiedElement] = useState(false);

  // Parse location and evidence
  const parsed = parseFindingLocation(finding.evidence);
  const pageUrl = finding.pageUrl || parsed.pageUrl;
  const element = finding.element || parsed.element;
  const displayEvidence = parsed.cleanEvidence || finding.evidence;

  const handleCopyEvidence = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayEvidence) {
      navigator.clipboard.writeText(displayEvidence);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyElement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (element) {
      navigator.clipboard.writeText(element);
      setCopiedElement(true);
      setTimeout(() => setCopiedElement(false), 2000);
    }
  };

  const isInfo = finding.severity === "INFO";

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isInfo
          ? "bg-zinc-900/40 border-zinc-800/60"
          : "bg-zinc-900/80 border-zinc-800 hover:border-zinc-700/80"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 md:p-5 text-left flex items-start justify-between gap-4 cursor-pointer"
      >
        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <SeverityBadge severity={finding.severity} />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/60 uppercase tracking-wider w-fit">
              {finding.category}
            </span>
            <h3 className="text-zinc-100 font-semibold text-sm md:text-base leading-snug">
              {finding.title}
            </h3>
          </div>

          {/* Quick Location Preview in Header */}
          {(pageUrl || element) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono">
              {pageUrl && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-zinc-800/60 text-zinc-300 border border-zinc-700/40 truncate max-w-md">
                  <Globe className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                  <span className="truncate">{pageUrl}</span>
                </span>
              )}
              {element && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-950/30 text-indigo-300 border border-indigo-500/20 truncate max-w-xs">
                  <Code2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                  <span className="truncate">{element}</span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-zinc-400 flex-shrink-0 mt-0.5">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-5 md:px-5 border-t border-zinc-800/80 pt-4 space-y-4 text-sm">
          {/* WHERE Was It Found - Detailed Location Section */}
          {(pageUrl || element) && (
            <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                Where Problem Was Found
              </span>

              {pageUrl && (
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="text-zinc-500 font-medium">Page:</span>
                    <span className="font-mono text-zinc-300 truncate">{pageUrl}</span>
                  </div>
                  <a
                    href={pageUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 flex-shrink-0 font-medium"
                  >
                    <span>Visit</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {element && (
                <div className="flex items-start justify-between gap-3 text-xs pt-1 border-t border-zinc-800/60">
                  <div className="flex items-start gap-2 min-w-0">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <span className="text-zinc-500 font-medium flex-shrink-0">Element:</span>
                    <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 break-all">
                      {element}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyElement}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 flex items-center gap-1 flex-shrink-0"
                  >
                    {copiedElement ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedElement ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Issue Explanation & Impact
            </h4>
            <p className="text-zinc-300 leading-relaxed">{finding.description}</p>
          </div>

          {/* Remediation */}
          {finding.remediation && (
            <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-indigo-200">
              <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider text-indigo-400 mb-1.5">
                <Wrench className="w-4 h-4" />
                Recommended Fix & Remediation
              </div>
              <p className="text-zinc-300 text-xs md:text-sm font-mono leading-relaxed break-words">
                {finding.remediation}
              </p>
            </div>
          )}

          {/* Evidence / Code Snippet */}
          {displayEvidence && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  <Terminal className="w-3.5 h-3.5" />
                  Technical Evidence & Observed Value
                </span>
                <button
                  type="button"
                  onClick={handleCopyEvidence}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 border border-zinc-700/60 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-black/60 border border-zinc-800 text-zinc-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {displayEvidence}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
