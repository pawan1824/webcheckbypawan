"use client";

import React from "react";
import { Download, FileText, Printer } from "lucide-react";

export function ReportExport({ scanId }: { scanId: string }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 print:hidden">
      <button
        type="button"
        onClick={handlePrint}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-200 text-xs font-medium transition-colors"
      >
        <Printer className="w-3.5 h-3.5" />
        <span>Print / PDF</span>
      </button>

      <a
        href={`/api/scan/${scanId}/export?format=markdown`}
        download
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-200 text-xs font-medium transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        <span>Markdown</span>
      </a>

      <a
        href={`/api/scan/${scanId}/export?format=json`}
        download
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-200 text-xs font-medium transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        <span>JSON</span>
      </a>
    </div>
  );
}

