import React from "react";
import { Category, FindingItem } from "@/lib/types";
import { Shield, Search, Eye, Zap, Link2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface CategoryScoreCardProps {
  category: Category;
  score: number | null;
  findings: FindingItem[];
  isSelected: boolean;
  onSelect: () => void;
}

export function CategoryScoreCard({
  category,
  score,
  findings,
  isSelected,
  onSelect,
}: CategoryScoreCardProps) {
  const categoryConfig: Record<Category, { title: string; icon: React.ComponentType<{ className?: string }> }> = {
    SECURITY: { title: "Security & Headers", icon: Shield },
    SEO: { title: "SEO & Social", icon: Search },
    ACCESSIBILITY: { title: "Accessibility", icon: Eye },
    PERFORMANCE: { title: "Performance & TTFB", icon: Zap },
    LINKS: { title: "Hyperlinks & Health", icon: Link2 },
  };

  const config = categoryConfig[category];
  const Icon = config.icon;

  const currentScore = score ?? 0;

  let progressColor = "bg-red-500";
  let textColor = "text-red-400";
  if (currentScore >= 85) {
    progressColor = "bg-emerald-500";
    textColor = "text-emerald-400";
  } else if (currentScore >= 70) {
    progressColor = "bg-blue-500";
    textColor = "text-blue-400";
  } else if (currentScore >= 50) {
    progressColor = "bg-amber-500";
    textColor = "text-amber-400";
  }

  const criticalCount = findings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").length;
  const warningCount = findings.filter((f) => f.severity === "MEDIUM" || f.severity === "LOW").length;

  return (
    <button
      onClick={onSelect}
      type="button"
      className={`text-left p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
        isSelected
          ? "bg-zinc-800/90 border-indigo-500/80 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/20"
          : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700/80"
      }`}
    >
      <div className="flex items-center justify-between w-full mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-zinc-800/80 text-indigo-400 border border-zinc-700/50">
            <Icon className="w-5 h-5" />
          </div>
          <span className="font-semibold text-zinc-200 text-sm">{config.title}</span>
        </div>
        <span className={`text-2xl font-black ${textColor}`}>
          {score !== null ? `${score}` : "--"}
          <span className="text-xs text-zinc-500 font-normal">/100</span>
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
          style={{ width: `${Math.min(100, Math.max(0, currentScore))}%` }}
        />
      </div>

      {/* Issue Counters */}
      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
        {criticalCount > 0 ? (
          <span className="flex items-center gap-1 text-red-400 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {criticalCount} critical
          </span>
        ) : (
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Clean
          </span>
        )}

        {warningCount > 0 && (
          <span className="text-amber-400/90 font-medium">
            {warningCount} warning{warningCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  );
}

