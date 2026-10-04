import { NextRequest, NextResponse } from "next/server";
import { enqueueScan } from "@/lib/queue";
import { normalizeUrl } from "@/lib/ssrf";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Please provide a valid website URL." }, { status: 400 });
    }

    const normalized = normalizeUrl(url);
    if (!normalized.valid) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const { scanId } = await enqueueScan(url);

    return NextResponse.json({
      success: true,
      scanId,
      status: "PENDING",
      url: normalized.url?.toString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("SSRF") || message.includes("forbidden") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

