import prisma from "./db";
import { normalizeUrl } from "./ssrf";
import { runWebsiteAudit } from "./scanner";

/**
 * Enqueues a new scan. Runs asynchronously in the background and updates Prisma.
 */
export async function enqueueScan(inputUrl: string): Promise<{ scanId: string }> {
  const normalized = normalizeUrl(inputUrl);
  if (!normalized.valid || !normalized.url) {
    throw new Error(normalized.error || "Invalid URL syntax");
  }

  const cleanUrl = normalized.url.toString();
  const domain = normalized.url.hostname;

  // 1. Create initial Pending Scan record
  const scan = await prisma.scan.create({
    data: {
      url: cleanUrl,
      domain,
      status: "PENDING",
    },
  });

  // 2. Fire and forget async processing (or BullMQ job if configured)
  // We use setImmediate/process.nextTick to detach execution from the API response
  setTimeout(async () => {
    try {
      await runWebsiteAudit(cleanUrl, scan.id);
    } catch (err) {
      console.error(`[ScanWorker Error] Scan ${scan.id} failed:`, err);
    }
  }, 50);

  return { scanId: scan.id };
}

