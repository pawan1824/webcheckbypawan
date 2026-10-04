import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scans = await prisma.scan.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        domain: true,
        status: true,
        overallScore: true,
        securityScore: true,
        seoScore: true,
        accessibilityScore: true,
        performanceScore: true,
        linksScore: true,
        sslValid: true,
        responseTimeMs: true,
        pageSizeBytes: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json(scans);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

