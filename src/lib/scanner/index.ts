import prisma from "../db";
import { normalizeUrl } from "../ssrf";
import { AuditResult, FindingItem, MetricItem, formatFindingEvidence } from "../types";
import { crawlWebsite } from "./crawler";
import { auditSecurity } from "./security";
import { auditSeo } from "./seo";
import { auditAccessibility } from "./accessibility";
import { auditPerformance } from "./performance";
import { auditLinks } from "./links";

export async function runWebsiteAudit(targetUrl: string, existingScanId?: string): Promise<AuditResult> {
  const normalized = normalizeUrl(targetUrl);
  if (!normalized.valid || !normalized.url) {
    throw new Error(normalized.error || "Invalid website URL");
  }

  const cleanUrl = normalized.url.toString();
  const domain = normalized.url.hostname;

  // 1. Create or update Scan record in DB
  let scanId = existingScanId;
  if (!scanId) {
    const scan = await prisma.scan.create({
      data: {
        url: cleanUrl,
        domain,
        status: "IN_PROGRESS",
      },
    });
    scanId = scan.id;
  } else {
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "IN_PROGRESS" },
    });
  }

  try {
    // 2. Real crawling: crawl root and discover internal pages up to limit
    const crawledPages = await crawlWebsite(cleanUrl, {
      maxPages: 5,
      maxDepth: 2,
      timeoutMs: 10000,
    });

    if (crawledPages.length === 0) {
      throw new Error(`Failed to crawl ${cleanUrl}: Target returned empty or unreachable response.`);
    }

    const primaryPage = crawledPages[0];
    const finalUrl = primaryPage.url;
    const responseTimeMs = primaryPage.responseTimeMs;
    const pageSizeBytes = primaryPage.pageSizeBytes;

    // 3. Run all audit modules with crawled pages
    const [securityRes, seoRes, a11yRes, perfRes, linksRes] = await Promise.all([
      auditSecurity(finalUrl, primaryPage.headers, primaryPage.html, crawledPages),
      auditSeo(crawledPages, finalUrl),
      Promise.resolve(auditAccessibility(crawledPages, finalUrl)),
      Promise.resolve(auditPerformance(crawledPages)),
      auditLinks(crawledPages, finalUrl),
    ]);

    // 4. Calculate weighted overall score (0 - 100)
    // Security: 30%, SEO: 20%, A11y: 20%, Perf: 20%, Links: 10%
    const overallScore = Math.round(
      securityRes.score * 0.3 +
        seoRes.score * 0.2 +
        a11yRes.score * 0.2 +
        perfRes.score * 0.2 +
        linksRes.score * 0.1
    );

    const allFindings: FindingItem[] = [
      ...securityRes.findings,
      ...seoRes.findings,
      ...a11yRes.findings,
      ...perfRes.findings,
      ...linksRes.findings,
    ];

    const allMetrics: MetricItem[] = [
      { name: "Final URL", value: finalUrl },
      { name: "Crawled Pages Count", value: String(crawledPages.length) },
      { name: "Initial Response Status", value: String(primaryPage.status) },
      ...securityRes.metrics,
      ...seoRes.metrics,
      ...a11yRes.metrics,
      ...perfRes.metrics,
      ...linksRes.metrics,
    ];

    const isSsl = new URL(finalUrl).protocol === "https:";

    // 5. Persist scan, findings, and metrics to database using existing schema
    await prisma.$transaction([
      prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "COMPLETED",
          overallScore,
          securityScore: securityRes.score,
          seoScore: seoRes.score,
          accessibilityScore: a11yRes.score,
          performanceScore: perfRes.score,
          linksScore: linksRes.score,
          sslValid: isSsl,
          responseTimeMs,
          pageSizeBytes,
          completedAt: new Date(),
        },
      }),
      prisma.finding.deleteMany({
        where: { scanId },
      }),
      prisma.finding.createMany({
        data: allFindings.map((f) => ({
          scanId: scanId!,
          category: f.category,
          severity: f.severity,
          title: f.title,
          description: f.description,
          remediation: f.remediation,
          evidence: formatFindingEvidence(f),
        })),
      }),
      prisma.metric.deleteMany({
        where: { scanId },
      }),
      prisma.metric.createMany({
        data: allMetrics.map((m) => ({
          scanId: scanId!,
          name: m.name,
          value: m.value,
          unit: m.unit,
        })),
      }),
    ]);

    return {
      url: cleanUrl,
      domain,
      finalUrl,
      status: "COMPLETED",
      overallScore,
      securityScore: securityRes.score,
      seoScore: seoRes.score,
      accessibilityScore: a11yRes.score,
      performanceScore: perfRes.score,
      linksScore: linksRes.score,
      sslValid: isSsl,
      responseTimeMs,
      pageSizeBytes,
      findings: allFindings,
      metrics: allMetrics,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: "FAILED",
        errorMessage: errorMsg,
        completedAt: new Date(),
      },
    });

    throw err;
  }
}
