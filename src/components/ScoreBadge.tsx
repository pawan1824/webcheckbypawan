import React from "react";
import { Severity } from "@/lib/types";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    CRITICAL: "bg-red-500/10 text-red-500 border-red-500/20",
    HIGH: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    MEDIUM: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    LOW: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    INFO: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[severity] || styles.INFO}`}
    >
      {severity}
    </span>
  );
}

export function GradeBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-zinc-500 text-sm font-semibold">N/A</span>;
  }

  let grade = "F";
  let color = "text-red-500 bg-red-500/10 border-red-500/30";

  if (score >= 90) {
    grade = "A+";
    color = "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
  } else if (score >= 80) {
    grade = "A";
    color = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  } else if (score >= 70) {
    grade = "B";
    color = "text-blue-400 bg-blue-500/10 border-blue-500/30";
  } else if (score >= 60) {
    grade = "C";
    color = "text-amber-400 bg-amber-500/10 border-amber-500/30";
  } else if (score >= 50) {
    grade = "D";
    color = "text-orange-400 bg-orange-500/10 border-orange-500/30";
  }

  return (
    <span
      className={`inline-flex items-center justify-center font-bold px-2.5 py-1 rounded-md text-sm border ${color}`}
    >
      {grade} ({score}/100)
    </span>
  );
}

