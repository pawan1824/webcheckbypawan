import React from "react";
import { AuditDashboard } from "@/components/AuditDashboard";

export default function ScanReportPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="py-2">
      <AuditDashboard scanId={params.id} />
    </div>
  );
}

