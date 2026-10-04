import * as cheerio from "cheerio";
import { safeFetch, normalizeUrl } from "../ssrf";
import { CrawledPage } from "../types";

export interface CrawlerOptions {
  maxPages?: number;
  maxDepth?: number;
  timeoutMs?: number;
}

const STATIC_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "svg", "ico",
  "css", "js", "mjs", "map", "json", "xml", "txt",
  "pdf", "zip", "tar", "gz", "rar", "7z", "mp3", "mp4", "wav", "webm",
  "woff", "woff2", "ttf", "eot", "otf"
]);

/**
 * Normalizes a crawl candidate URL:
 * - strips hashes/fragments
 * - ensures valid http/https protocol
 * - returns normalized string or null if invalid
 */
function normalizeCrawlUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(rawUrl, baseUrl);
    // Only HTTP / HTTPS
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }

    // Strip hash fragment
    resolved.hash = "";

    // Check file extension to avoid downloading heavy media/archives during page crawl
    const pathname = resolved.pathname.toLowerCase();
    const dotIndex = pathname.lastIndexOf(".");
    if (dotIndex !== -1) {
      const ext = pathname.slice(dotIndex + 1);
      if (STATIC_EXTENSIONS.has(ext)) {
        return null;
      }
    }

    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Crawls a target website up to maxPages, staying strictly within the target domain.
 * Enforces SSRF validation on every single fetched page.
 */
export async function crawlWebsite(
  startUrl: string,
  options?: CrawlerOptions
): Promise<CrawledPage[]> {
  const maxPages = options?.maxPages ?? 5;
  const maxDepth = options?.maxDepth ?? 3;
  const timeoutMs = options?.timeoutMs ?? 10000;

  const normalized = normalizeUrl(startUrl);
  if (!normalized.valid || !normalized.url) {
    throw new Error(normalized.error || "Invalid starting URL for crawl");
  }

  const rootUrl = normalized.url.toString();
  const targetHost = normalized.url.hostname.toLowerCase();

  const pages: CrawledPage[] = [];
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: rootUrl, depth: 0 }];

  while (queue.length > 0 && pages.length < maxPages) {
    const item = queue.shift();
    if (!item) break;

    const { url: currentUrl, depth } = item;

    // Deduplicate
    const normalizedKey = currentUrl.replace(/\/$/, "");
    if (visited.has(normalizedKey)) {
      continue;
    }
    visited.add(normalizedKey);

    try {
      // safeFetch enforces SSRF checks, redirect hop validation, and timeout
      const fetchResult = await safeFetch(currentUrl, {
        timeoutMs,
        maxRedirects: 4,
      });

      const contentType = fetchResult.headers["content-type"] || "";
      const isHtml =
        contentType.includes("text/html") ||
        contentType.includes("application/xhtml+xml") ||
        fetchResult.body.includes("<html");

      // Only parse and continue crawling if response is HTML
      if (!isHtml) {
        continue;
      }

      const html = fetchResult.body;
      const pageSizeBytes = Buffer.byteLength(html, "utf8");

      // Extract title for reporting
      const $ = cheerio.load(html);
      const pageTitle = $("title").first().text().trim() || undefined;

      pages.push({
        url: fetchResult.finalUrl,
        status: fetchResult.status,
        headers: fetchResult.headers,
        html,
        responseTimeMs: fetchResult.responseTimeMs,
        pageSizeBytes,
        title: pageTitle,
        depth,
      });

      // Discover internal links if depth limit has not been reached
      if (depth < maxDepth && pages.length < maxPages) {
        $("a").each((_, el) => {
          const href = $(el).attr("href")?.trim();
          if (
            !href ||
            href.startsWith("#") ||
            href.startsWith("javascript:") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:")
          ) {
            return;
          }

          const resolved = normalizeCrawlUrl(href, fetchResult.finalUrl);
          if (!resolved) return;

          try {
            const linkObj = new URL(resolved);
            // Strict same-host / same-domain boundary
            if (linkObj.hostname.toLowerCase() === targetHost) {
              const linkKey = resolved.replace(/\/$/, "");
              if (!visited.has(linkKey) && !queue.some((q) => q.url.replace(/\/$/, "") === linkKey)) {
                queue.push({ url: resolved, depth: depth + 1 });
              }
            }
          } catch {
            // invalid URL ignored
          }
        });
      }
    } catch (err: unknown) {
      // If root page fails, we must throw error
      if (pages.length === 0) {
        throw err;
      }
      // Otherwise record failure log and continue crawl
      console.warn(`[Crawler] Failed to fetch internal page ${currentUrl}:`, err);
    }
  }

  return pages;
}
