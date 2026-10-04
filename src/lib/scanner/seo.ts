import * as cheerio from "cheerio";
import { CategoryResult, FindingItem, MetricItem, CrawledPage } from "../types";
import { safeFetch } from "../ssrf";

export async function auditSeo(
  input: string | CrawledPage[],
  baseUrl: string
): Promise<CategoryResult> {
  const findings: FindingItem[] = [];
  const metrics: MetricItem[] = [];
  let deductions = 0;

  const crawledPages: CrawledPage[] = typeof input === "string"
    ? [{
        url: baseUrl,
        status: 200,
        headers: {},
        html: input,
        responseTimeMs: 0,
        pageSizeBytes: Buffer.byteLength(input, "utf8"),
        depth: 0,
      }]
    : input;

  // Track duplicates across pages
  const titlesSeen = new Map<string, string>(); // title -> first seen pageUrl
  const descriptionsSeen = new Map<string, string>(); // desc -> first seen pageUrl

  // 1. Site-Wide Robots.txt & Sitemap Verification
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const robotsRes = await safeFetch(robotsUrl, { timeoutMs: 4000 });
    if (robotsRes.status === 200 && robotsRes.body.trim().length > 0) {
      metrics.push({ name: "Robots.txt", value: "Present (HTTP 200)" });
      findings.push({
        category: "SEO",
        severity: "INFO",
        title: "Robots.txt Discovered",
        description: "A valid robots.txt file was found to guide search engine crawlers.",
        pageUrl: robotsUrl,
        element: "/robots.txt",
        evidence: `HTTP ${robotsRes.status}, Size: ${robotsRes.body.length} bytes`,
      });

      // Check if sitemap is referenced inside robots.txt
      const sitemapMatch = robotsRes.body.match(/sitemap:\s*(https?:\/\/[^\s]+)/i);
      if (sitemapMatch) {
        metrics.push({ name: "Sitemap in Robots.txt", value: sitemapMatch[1] });
      }
    } else {
      metrics.push({ name: "Robots.txt", value: `Missing (HTTP ${robotsRes.status})` });
      findings.push({
        category: "SEO",
        severity: "LOW",
        title: "Missing or Inaccessible robots.txt",
        description: "A robots.txt file helps control crawler behavior and points search bots to your XML sitemap.",
        pageUrl: robotsUrl,
        element: "/robots.txt",
        evidence: `HTTP Status: ${robotsRes.status}`,
        remediation: "Create a robots.txt file at the domain root declaring crawl rules and sitemap location.",
      });
    }
  } catch {
    metrics.push({ name: "Robots.txt", value: "Not found / unreachable" });
  }

  try {
    const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();
    const sitemapRes = await safeFetch(sitemapUrl, { timeoutMs: 4000 });
    if (
      sitemapRes.status === 200 &&
      (sitemapRes.body.includes("<urlset") || sitemapRes.body.includes("<sitemapindex"))
    ) {
      metrics.push({ name: "Sitemap.xml", value: "Present (HTTP 200)" });
      findings.push({
        category: "SEO",
        severity: "INFO",
        title: "XML Sitemap Present",
        description: "An XML sitemap exists at /sitemap.xml to aid search engines in indexing all pages.",
        pageUrl: sitemapUrl,
        element: "/sitemap.xml",
        evidence: `Valid XML sitemap detected (${sitemapRes.body.length} bytes)`,
      });
    } else {
      metrics.push({ name: "Sitemap.xml", value: "Missing standard /sitemap.xml" });
      findings.push({
        category: "SEO",
        severity: "LOW",
        title: "Standard /sitemap.xml Not Found",
        description: "Search engines use XML sitemaps to index all available site pages efficiently.",
        pageUrl: sitemapUrl,
        element: "/sitemap.xml",
        evidence: `HTTP status: ${sitemapRes.status}`,
        remediation: "Generate and publish an XML sitemap at /sitemap.xml or link to it in robots.txt.",
      });
    }
  } catch {
    metrics.push({ name: "Sitemap.xml", value: "Not accessible" });
  }

  // 2. Per-Page SEO Audit across all crawled pages
  for (const page of crawledPages) {
    const $ = cheerio.load(page.html);

    // 2a. Title Tag
    const titleEl = $("title").first();
    const title = titleEl.text().trim();

    if (!title) {
      deductions += 20;
      findings.push({
        category: "SEO",
        severity: "CRITICAL",
        title: "Missing <title> Tag",
        description: "Search engines and browser tabs rely on the title tag to identify page topic and ranking context.",
        pageUrl: page.url,
        element: "<head>",
        evidence: "No <title> tag found in <head>.",
        remediation: "Add a descriptive <title> tag between 30 and 60 characters long.",
      });
    } else {
      // Check title length
      if (title.length < 20) {
        deductions += 6;
        findings.push({
          category: "SEO",
          severity: "LOW",
          title: "Title Tag Too Short",
          description: `Title tag is only ${title.length} characters long. Recommended length is between 30 and 60 characters.`,
          pageUrl: page.url,
          element: `<title>${title}</title>`,
          evidence: `Title: "${title}" (${title.length} chars)`,
          remediation: "Expand the title with primary topic keywords and branding.",
        });
      } else if (title.length > 70) {
        deductions += 4;
        findings.push({
          category: "SEO",
          severity: "LOW",
          title: "Title Tag May Be Truncated",
          description: `Title is ${title.length} characters long. Search engine result pages typically truncate titles longer than 60-65 characters.`,
          pageUrl: page.url,
          element: `<title>${title.slice(0, 40)}...</title>`,
          evidence: `Title: "${title}" (${title.length} chars)`,
          remediation: "Shorten the title to under 65 characters.",
        });
      }

      // Check duplicate titles across crawled pages
      if (titlesSeen.has(title)) {
        deductions += 8;
        const previousPage = titlesSeen.get(title)!;
        findings.push({
          category: "SEO",
          severity: "MEDIUM",
          title: "Duplicate Page Title Across Multiple Pages",
          description: "Multiple crawled pages share the exact same title tag, causing internal keyword cannibalization.",
          pageUrl: page.url,
          element: `<title>${title}</title>`,
          evidence: `Same title "${title}" also used on ${previousPage}`,
          remediation: "Ensure each page has a unique, topic-specific title tag.",
        });
      } else {
        titlesSeen.set(title, page.url);
      }
    }

    // 2b. Meta Description
    const metaDescEl = $('meta[name="description"]');
    const metaDesc = metaDescEl.attr("content")?.trim();

    if (!metaDesc) {
      deductions += 15;
      findings.push({
        category: "SEO",
        severity: "HIGH",
        title: "Missing Meta Description",
        description: "Without a meta description, search engines generate automated snippets which often lower search click-through rates.",
        pageUrl: page.url,
        element: "<head>",
        evidence: "No <meta name='description'> found.",
        remediation: "Add a concise meta description between 70 and 160 characters summarizing the page content.",
      });
    } else {
      if (metaDesc.length < 50) {
        deductions += 6;
        findings.push({
          category: "SEO",
          severity: "LOW",
          title: "Meta Description Too Short",
          description: `Meta description is ${metaDesc.length} characters. Optimal length is between 70 and 160 characters.`,
          pageUrl: page.url,
          element: `<meta name="description" content="${metaDesc}">`,
          evidence: `Description: "${metaDesc}" (${metaDesc.length} chars)`,
          remediation: "Elaborate description with informative context and user value.",
        });
      } else if (metaDesc.length > 165) {
        deductions += 4;
        findings.push({
          category: "SEO",
          severity: "LOW",
          title: "Meta Description Too Long",
          description: `Meta description is ${metaDesc.length} characters and will likely be clipped in search snippets.`,
          pageUrl: page.url,
          element: `<meta name="description" content="${metaDesc.slice(0, 40)}...">`,
          evidence: `Description: "${metaDesc}" (${metaDesc.length} chars)`,
          remediation: "Condense the description to under 160 characters.",
        });
      }

      // Check duplicate meta descriptions across pages
      if (descriptionsSeen.has(metaDesc)) {
        deductions += 6;
        const previousPage = descriptionsSeen.get(metaDesc)!;
        findings.push({
          category: "SEO",
          severity: "LOW",
          title: "Duplicate Meta Description Across Pages",
          description: "Multiple pages share identical meta descriptions.",
          pageUrl: page.url,
          element: `<meta name="description">`,
          evidence: `Same description also used on ${previousPage}`,
          remediation: "Create unique meta descriptions tailored to each individual page.",
        });
      } else {
        descriptionsSeen.set(metaDesc, page.url);
      }
    }

    // 2c. Canonical URL
    const canonicalEl = $('link[rel="canonical"]');
    const canonical = canonicalEl.attr("href")?.trim();

    if (!canonical) {
      deductions += 8;
      findings.push({
        category: "SEO",
        severity: "MEDIUM",
        title: "Missing Canonical Tag",
        description: "A canonical link element specifies the preferred URL to prevent duplicate content penalties across query parameters and alternate paths.",
        pageUrl: page.url,
        element: "<head>",
        evidence: "No <link rel='canonical'> element found.",
        remediation: `<link rel="canonical" href="${page.url}" />`,
      });
    } else {
      if (!canonical.startsWith("http://") && !canonical.startsWith("https://")) {
        deductions += 5;
        findings.push({
          category: "SEO",
          severity: "LOW",
          title: "Relative Canonical URL Detected",
          description: "Canonical tags should use absolute URLs including protocol and domain name.",
          pageUrl: page.url,
          element: `<link rel="canonical" href="${canonical}">`,
          evidence: `Canonical href: "${canonical}"`,
          remediation: "Change relative canonical URL to an absolute URL.",
        });
      }
    }

    // 2d. Robots Directives
    const metaRobots = $('meta[name="robots"]').attr("content")?.toLowerCase();
    const xRobots = page.headers["x-robots-tag"]?.toLowerCase();

    if (metaRobots && metaRobots.includes("noindex")) {
      deductions += 25;
      findings.push({
        category: "SEO",
        severity: "CRITICAL",
        title: "Page Blocked From Search Indexing (meta noindex)",
        description: "The page has a meta robots tag with 'noindex', instructing search engines not to show this page in search results.",
        pageUrl: page.url,
        element: `<meta name="robots" content="${metaRobots}">`,
        evidence: `Robots directive: ${metaRobots}`,
        remediation: "Remove 'noindex' if this page should be discoverable in organic search.",
      });
    }
    if (xRobots && xRobots.includes("noindex")) {
      deductions += 25;
      findings.push({
        category: "SEO",
        severity: "CRITICAL",
        title: "Page Blocked From Search Indexing (X-Robots-Tag header)",
        description: "The server sent an X-Robots-Tag: noindex header, preventing search indexation.",
        pageUrl: page.url,
        element: "HTTP Response Header: X-Robots-Tag",
        evidence: `X-Robots-Tag: ${xRobots}`,
        remediation: "Remove the 'noindex' directive from server headers for indexable pages.",
      });
    }

    // 2e. Headings Structure (H1 - H6)
    const h1Elements = $("h1");
    const h1Count = h1Elements.length;

    if (h1Count === 0) {
      deductions += 12;
      findings.push({
        category: "SEO",
        severity: "HIGH",
        title: "Missing <h1> Primary Heading",
        description: "A page should have exactly one <h1> heading defining its main subject.",
        pageUrl: page.url,
        element: "<body>",
        evidence: "Zero <h1> tags found in page body.",
        remediation: "Add an <h1> heading summarizing the page topic.",
      });
    } else if (h1Count > 1) {
      deductions += 5;
      const h1Snippets: string[] = [];
      h1Elements.each((_, el) => {
        h1Snippets.push(`<h1>${$(el).text().trim().slice(0, 40)}</h1>`);
      });

      findings.push({
        category: "SEO",
        severity: "LOW",
        title: "Multiple <h1> Headings Found",
        description: `Found ${h1Count} <h1> headings. Standard SEO recommendations favor a single <h1> heading per page for clean content hierarchy.`,
        pageUrl: page.url,
        element: "<h1>",
        evidence: h1Snippets.slice(0, 3).join(", "),
        remediation: "Keep a single <h1> for page title and downgrade secondary headings to <h2> or <h3>.",
      });
    }

    // Check empty headings
    $("h1, h2, h3").each((_, el) => {
      const text = $(el).text().trim();
      const tagName = el.tagName.toLowerCase();
      if (!text && $(el).find("img, svg").length === 0) {
        deductions += 3;
        findings.push({
          category: "SEO",
          severity: "LOW",
          title: `Empty <${tagName}> Heading Tag`,
          description: `Found an empty <${tagName}> tag with no text content, which provides no value to search engines or screen readers.`,
          pageUrl: page.url,
          element: `<${tagName}>`,
          evidence: `Empty <${tagName}> tag found`,
          remediation: `Populate the <${tagName}> heading with meaningful text or remove the empty element.`,
        });
      }
    });

    // 2f. OpenGraph Social Metadata
    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");

    if (!ogTitle || !ogImage) {
      deductions += 6;
      findings.push({
        category: "SEO",
        severity: "LOW",
        title: "Incomplete OpenGraph Social Tags",
        description: "Missing og:title or og:image tags prevents generating rich preview cards when your page is shared on social platforms.",
        pageUrl: page.url,
        element: "<head>",
        evidence: `og:title: ${ogTitle ? "Present" : "Missing"}, og:image: ${ogImage ? "Present" : "Missing"}`,
        remediation: "Add <meta property='og:title'>, <meta property='og:description'>, and <meta property='og:image'> tags.",
      });
    }
  }

  // Summary Metrics
  if (crawledPages.length > 0) {
    const primary = crawledPages[0];
    const $ = cheerio.load(primary.html);
    metrics.push({ name: "Primary Title", value: $("title").first().text().trim() || "(Missing)" });
    metrics.push({
      name: "Primary Meta Desc",
      value: $('meta[name="description"]').attr("content")?.trim() || "(Missing)",
    });
    metrics.push({ name: "Audited Pages (SEO)", value: String(crawledPages.length) });
  }

  const score = Math.max(0, Math.min(100, 100 - deductions));
  return { score, findings, metrics };
}
