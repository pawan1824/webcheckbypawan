import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const scan = await prisma.scan.findUnique({
      where: { id },
      include: {
        findings: {
          orderBy: [
            { severity: "asc" },
            { createdAt: "asc" },
          ],
        },
        metrics: true,
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found." }, { status: 404 });
    }

    const { parseFindingLocation } = await import("@/lib/types");

    const enrichedFindings = scan.findings.map((f) => {
      const loc = parseFindingLocation(f.evidence);
      return {
        ...f,
        pageUrl: loc.pageUrl,
        element: loc.element,
        evidence: loc.cleanEvidence,
      };
    });

    return NextResponse.json({
      ...scan,
      findings: enrichedFindings,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
