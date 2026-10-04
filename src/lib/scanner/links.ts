import * as cheerio from "cheerio";
import { CategoryResult, FindingItem, MetricItem, CrawledPage } from "../types";
import { normalizeUrl, safeFetch } from "../ssrf";

export interface DiscoveredLink {
  sourcePage: string;
  targetUrl: string;
  linkText: string;
  isInternal: boolean;
}

export async function auditLinks(
  input: string | CrawledPage[],
  baseUrl?: string
): Promise<CategoryResult> {
  const findings: FindingItem[] = [];
  const metrics: MetricItem[] = [];
  let deductions = 0;

  const pages: { url: string; html: string }[] = typeof input === "string"
    ? [{ url: baseUrl || "https://target-audit.local", html: input }]
    : input.map((p) => ({ url: p.url, html: p.html }));

  const primaryUrl = pages[0]?.url || baseUrl || "https://target-audit.local";
  const primaryHost = new URL(primaryUrl).hostname.toLowerCase();

  const internalLinks = new Map<string, DiscoveredLink>();
  const externalLinks = new Map<string, DiscoveredLink>();
  let emptyAnchorsCount = 0;

  for (const page of pages) {
    const $ = cheerio.load(page.html);

    $("a").each((_, el) => {
      const href = $(el).attr("href")?.trim();
      const rawText = $(el).text().trim();
      const ariaLabel = $(el).attr("aria-label");
      const titleAttr = $(el).attr("title");
      const hasImage = $(el).find("img").length > 0;
      const linkText = ariaLabel || rawText || titleAttr || (hasImage ? "(Graphic/Image Link)" : "(No Text)");

      if (!href || href === "#" || href.startsWith("javascript:")) {
        emptyAnchorsCount++;
        findings.push({
          category: "LINKS",
          severity: "LOW",
          title: "Placeholder Anchor Link",
          description: "Links with empty href or href='#' cause confusing behavior and reload page tops.",
          pageUrl: page.url,
          element: `<a href="${href || ""}">`,
          evidence: `Anchor text: "${linkText}", href="${href || ""}" on ${page.url}`,
          remediation: "Provide a valid destination URL or replace dummy <a> tags with accessible <button> elements.",
        });
        return;
      }

      if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("sms:")) {
        return;
      }

      try {
        const resolved = new URL(href, page.url);
        if (resolved.protocol === "http:" || resolved.protocol === "https:") {
          const targetStr = resolved.toString();
          const isInternal = resolved.hostname.toLowerCase() === primaryHost;

          const linkData: DiscoveredLink = {
            sourcePage: page.url,
            targetUrl: targetStr,
            linkText: linkText.slice(0, 80),
            isInternal,
          };

          if (isInternal) {
            if (!internalLinks.has(targetStr)) internalLinks.set(targetStr, linkData);
          } else {
            if (!externalLinks.has(targetStr)) externalLinks.set(targetStr, linkData);
          }
        }
      } catch {
        // Invalid URL format
      }
    });
  }

  if (emptyAnchorsCount > 0) {
    deductions += Math.min(10, emptyAnchorsCount * 2);
  }

  metrics.push({ name: "Discovered Internal Links", value: String(internalLinks.size) });
  metrics.push({ name: "Discovered External Links", value: String(externalLinks.size) });

  // Select sample of links to verify live HTTP status (up to 8 internal, 4 external)
  const linksToTest = [
    ...Array.from(internalLinks.values()).slice(0, 8),
    ...Array.from(externalLinks.values()).slice(0, 4),
  ];

  const brokenLinks: { link: DiscoveredLink; status: number | string }[] = [];

  const checkLink = async (item: DiscoveredLink) => {
    try {
      const normalized = normalizeUrl(item.targetUrl);
      if (!normalized.valid) return;

      let res = await safeFetch(item.targetUrl, {
        method: "HEAD",
        timeoutMs: 5000,
        maxRedirects: 3,
      });

      // Some servers reject HEAD requests with 405 Method Not Allowed; fallback to GET
      if (res.status === 405) {
        res = await safeFetch(item.targetUrl, {
          method: "GET",
          timeoutMs: 5000,
          maxRedirects: 3,
          maxBytes: 10 * 1024,
        });
      }

      if (res.status >= 400) {
        brokenLinks.push({ link: item, status: res.status });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("SSRF Protection Block")) {
        brokenLinks.push({ link: item, status: "Unreachable / Timeout" });
      }
    }
  };

  await Promise.allSettled(linksToTest.map(checkLink));

  metrics.push({
    name: "Live Links Checked",
    value: `${linksToTest.length} (${brokenLinks.length} broken)`,
  });

  if (brokenLinks.length > 0) {
    deductions += Math.min(40, brokenLinks.length * 15);

    brokenLinks.forEach(({ link, status }) => {
      const isInternal = link.isInternal;
      findings.push({
        category: "LINKS",
        severity: isInternal ? "HIGH" : "MEDIUM",
        title: `Broken ${isInternal ? "Internal" : "External"} Link (HTTP ${status})`,
        description: `Hyperlink leads to an error response (${status}). Broken links hurt search engine crawlability and cause immediate user frustration.`,
        pageUrl: link.sourcePage,
        element: `<a href="${link.targetUrl}">${link.linkText}</a>`,
        evidence: `Source Page: ${link.sourcePage}\nLink Text: "${link.linkText}"\nDestination: ${link.targetUrl}\nHTTP Status: ${status}`,
        remediation: `Update or remove the dead hyperlink destination on ${link.sourcePage}.`,
      });
    });
  } else if (linksToTest.length > 0) {
    findings.push({
      category: "LINKS",
      severity: "INFO",
      title: "Audited Hyperlinks Reachable",
      description: `All ${linksToTest.length} sampled internal and external hyperlinks responded with valid HTTP status codes.`,
      pageUrl: primaryUrl,
      element: "Hyperlinks",
      evidence: `Tested ${linksToTest.length} links successfully.`,
    });
  }

  const score = Math.max(0, Math.min(100, 100 - deductions));
  return { score, findings, metrics };
}
