import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const format = req.nextUrl.searchParams.get("format") || "json";

    const scan = await prisma.scan.findUnique({
      where: { id },
      include: {
        findings: true,
        metrics: true,
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found." }, { status: 404 });
    }

    const safeDomain = scan.domain.replace(/[^a-zA-Z0-9.-]/g, "_");

    if (format === "markdown") {
      let md = `# WebCheck AI Audit Report: ${scan.url}\n\n`;
      md += `* **Domain**: ${scan.domain}\n`;
      md += `* **Scan Date**: ${new Date(scan.createdAt).toUTCString()}\n`;
      md += `* **Status**: ${scan.status}\n`;
      md += `* **Overall Health Score**: ${scan.overallScore ?? "N/A"}/100\n\n`;

      md += `## Category Scores\n\n`;
      md += `| Category | Score |\n|---|---|\n`;
      md += `| Security | ${scan.securityScore ?? "N/A"}/100 |\n`;
      md += `| SEO | ${scan.seoScore ?? "N/A"}/100 |\n`;
      md += `| Accessibility | ${scan.accessibilityScore ?? "N/A"}/100 |\n`;
      md += `| Performance | ${scan.performanceScore ?? "N/A"}/100 |\n`;
      md += `| Links | ${scan.linksScore ?? "N/A"}/100 |\n\n`;

      const { parseFindingLocation } = await import("@/lib/types");

      md += `## Findings & Recommendations\n\n`;
      if (scan.findings.length === 0) {
        md += `*No issues detected.*\n`;
      } else {
        scan.findings.forEach((f, idx) => {
          const loc = parseFindingLocation(f.evidence);
          md += `### ${idx + 1}. [${f.severity}] ${f.title} (${f.category})\n\n`;
          if (loc.pageUrl) {
            md += `* **Affected Page**: \`${loc.pageUrl}\`\n`;
          }
          if (loc.element) {
            md += `* **Affected Element/Resource**: \`${loc.element}\`\n`;
          }
          md += `\n**Description**: ${f.description}\n\n`;
          if (f.remediation) {
            md += `**Remediation / Fix**: ${f.remediation}\n\n`;
          }
          if (loc.cleanEvidence) {
            md += `**Evidence**:\n\`\`\`text\n${loc.cleanEvidence}\n\`\`\`\n\n`;
          }
        });
      }

      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="webcheck-${safeDomain}-${id.slice(0, 8)}.md"`,
        },
      });
    }

    // Default: JSON export enriched with parsed location fields
    const { parseFindingLocation } = await import("@/lib/types");
    const exportData = {
      ...scan,
      findings: scan.findings.map((f) => {
        const loc = parseFindingLocation(f.evidence);
        return {
          ...f,
          pageUrl: loc.pageUrl,
          element: loc.element,
          evidence: loc.cleanEvidence,
        };
      }),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="webcheck-${safeDomain}-${id.slice(0, 8)}.json"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
