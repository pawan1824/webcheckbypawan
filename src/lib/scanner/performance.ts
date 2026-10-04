import * as cheerio from "cheerio";
import { CategoryResult, FindingItem, MetricItem, CrawledPage } from "../types";

export function auditPerformance(
  responseTimeMsOrPages: number | CrawledPage[],
  pageSizeBytesOrFallback?: number,
  headersOrFallback?: Record<string, string>,
  htmlOrFallback?: string,
  crawledPages?: CrawledPage[]
): CategoryResult {
  const findings: FindingItem[] = [];
  const metrics: MetricItem[] = [];
  let deductions = 0;

  // Support both legacy signature (responseTimeMs, pageSizeBytes, headers, html) and multi-page CrawledPage[]
  let primaryPage: {
    url: string;
    responseTimeMs: number;
    pageSizeBytes: number;
    headers: Record<string, string>;
    html: string;
  };

  let pagesList: CrawledPage[] = [];

  if (Array.isArray(responseTimeMsOrPages)) {
    pagesList = responseTimeMsOrPages;
    const first = pagesList[0] || {
      url: "https://target-audit.local",
      responseTimeMs: 0,
      pageSizeBytes: 0,
      headers: {},
      html: "",
      depth: 0,
      status: 200,
    };
    primaryPage = {
      url: first.url,
      responseTimeMs: first.responseTimeMs,
      pageSizeBytes: first.pageSizeBytes,
      headers: first.headers,
      html: first.html,
    };
  } else {
    primaryPage = {
      url: "https://target-audit.local",
      responseTimeMs: responseTimeMsOrPages,
      pageSizeBytes: pageSizeBytesOrFallback || 0,
      headers: headersOrFallback || {},
      html: htmlOrFallback || "",
    };
    pagesList = crawledPages || [];
  }

  const { responseTimeMs, pageSizeBytes, headers, html, url: pageUrl } = primaryPage;
  const $ = cheerio.load(html);

  // 1. Time to First Byte (TTFB)
  metrics.push({
    name: "Server TTFB",
    value: `${responseTimeMs}`,
    unit: "ms",
  });

  if (responseTimeMs > 1800) {
    deductions += 30;
    findings.push({
      category: "PERFORMANCE",
      severity: "HIGH",
      title: "Slow Server Response Time (TTFB)",
      description: `Initial response took ${responseTimeMs}ms. Google recommends keeping TTFB below 800ms for optimal user experience and Core Web Vitals rankings.`,
      pageUrl,
      element: "Network / Server Connection",
      evidence: `Time to First Byte: ${responseTimeMs}ms`,
      remediation:
        "Deploy edge caching via a CDN, optimize slow database queries, and enable server-side bytecode/page caching.",
    });
  } else if (responseTimeMs > 800) {
    deductions += 15;
    findings.push({
      category: "PERFORMANCE",
      severity: "MEDIUM",
      title: "Sub-Optimal TTFB Latency",
      description: `Server responded in ${responseTimeMs}ms. Good TTFB should be under 800ms.`,
      pageUrl,
      element: "Network / Server Connection",
      evidence: `TTFB: ${responseTimeMs}ms`,
      remediation: "Deploy a Content Delivery Network (CDN) to serve cached responses closer to users geographically.",
    });
  } else {
    findings.push({
      category: "PERFORMANCE",
      severity: "INFO",
      title: "Fast Server Response Time",
      description: `Server responded rapidly in ${responseTimeMs}ms.`,
      pageUrl,
      element: "Network / Server Connection",
      evidence: `TTFB: ${responseTimeMs}ms`,
    });
  }

  // 2. HTML Document Size
  const sizeKb = Math.round(pageSizeBytes / 1024);
  metrics.push({
    name: "HTML Document Size",
    value: `${sizeKb}`,
    unit: "KB",
  });

  if (sizeKb > 250) {
    deductions += 20;
    findings.push({
      category: "PERFORMANCE",
      severity: "HIGH",
      title: "Large Initial HTML Document Size",
      description: `HTML document is ${sizeKb} KB. Large documents slow down DOM construction, increase memory footprint, and delay First Contentful Paint.`,
      pageUrl,
      element: "HTML Document Payload",
      evidence: `Payload Size: ${sizeKb} KB (${pageSizeBytes} bytes)`,
      remediation: "Remove inline base64 images/fonts, minify HTML, and paginate long lists.",
    });
  } else if (sizeKb > 100) {
    deductions += 8;
    findings.push({
      category: "PERFORMANCE",
      severity: "LOW",
      title: "Moderate HTML Document Size",
      description: `HTML document is ${sizeKb} KB. Keeping initial HTML under 100 KB ensures fast mobile rendering.`,
      pageUrl,
      element: "HTML Document Payload",
      evidence: `Size: ${sizeKb} KB`,
    });
  }

  // 3. Compression (Gzip / Brotli / Zstd)
  const encoding = headers["content-encoding"]?.toLowerCase();
  metrics.push({
    name: "HTTP Compression",
    value: encoding || "None (Uncompressed)",
  });

  if (!encoding || (!encoding.includes("gzip") && !encoding.includes("br") && !encoding.includes("zstd"))) {
    deductions += 20;
    findings.push({
      category: "PERFORMANCE",
      severity: "HIGH",
      title: "HTTP Text Compression Not Enabled",
      description: "Text responses are sent uncompressed. Brotli or Gzip compression reduces transfer payloads by up to 70-80%.",
      pageUrl,
      element: "HTTP Response Header: Content-Encoding",
      evidence: `Content-Encoding: ${encoding || "header missing"}`,
      remediation: "Enable Brotli (`br`) or Gzip compression on your web server or CDN.",
    });
  } else {
    findings.push({
      category: "PERFORMANCE",
      severity: "INFO",
      title: "Payload Compression Active",
      description: `Response compressed using ${encoding}.`,
      pageUrl,
      element: "Content-Encoding",
      evidence: encoding,
    });
  }

  // 4. Render-Blocking External Scripts in <head>
  const headScripts = $("head script[src]:not([async]):not([defer]):not([type='module'])");
  metrics.push({
    name: "Render-Blocking Scripts",
    value: String(headScripts.length),
  });

  headScripts.each((_, el) => {
    const src = $(el).attr("src") || "";
    deductions += 8;
    findings.push({
      category: "PERFORMANCE",
      severity: "HIGH",
      title: "Render-Blocking Script in <head>",
      description:
        "Synchronous external scripts in the <head> stop the browser from constructing the DOM tree until the script is fully downloaded and executed.",
      pageUrl,
      element: `<script src="${src}">`,
      evidence: `Script tag: <script src="${src}"> lacks async, defer, or type='module'`,
      remediation: "Add `defer` or `async` attribute to the <script> tag.",
    });
  });

  // 5. Image Dimensions & Cumulative Layout Shift (CLS)
  const images = $("img");
  let imagesWithoutDimensions = 0;
  let missingLazy = 0;

  images.each((idx, el) => {
    const width = $(el).attr("width");
    const height = $(el).attr("height");
    const loading = $(el).attr("loading");
    const src = $(el).attr("src") || "";

    if (!width || !height) {
      imagesWithoutDimensions++;
      if (imagesWithoutDimensions <= 3) {
        findings.push({
          category: "PERFORMANCE",
          severity: "MEDIUM",
          title: "Image Missing Width and Height Attributes (CLS Risk)",
          description:
            "Images without explicit dimensions cause layout shifts (Cumulative Layout Shift) when downloaded, jarring users and hurting Core Web Vitals.",
          pageUrl,
          element: `<img src="${src}">`,
          evidence: `Image ${src} missing width and/or height attribute`,
          remediation: `Specify explicit width and height: <img src="${src}" width="800" height="600"> or use CSS aspect-ratio.`,
        });
      }
    }

    // Skip the very first image (hero image shouldn't be lazy loaded)
    if (idx > 0 && loading !== "lazy") {
      missingLazy++;
    }
  });

  if (imagesWithoutDimensions > 0) {
    deductions += Math.min(15, imagesWithoutDimensions * 4);
  }

  if (images.length > 3 && missingLazy > 2) {
    deductions += 8;
    findings.push({
      category: "PERFORMANCE",
      severity: "MEDIUM",
      title: `${missingLazy} Below-The-Fold Image(s) Missing loading='lazy'`,
      description:
        "Offscreen images loaded eagerly consume mobile network bandwidth and delay the rendering of critical above-the-fold content.",
      pageUrl,
      element: "<img>",
      evidence: `${missingLazy} image(s) lacking loading='lazy'`,
      remediation: "Add loading='lazy' to all images located outside the initial viewport.",
    });
  }

  // 6. DOM Node Count & Depth
  const totalNodes = $("*").length;
  metrics.push({
    name: "DOM Element Count",
    value: String(totalNodes),
  });

  if (totalNodes > 1500) {
    deductions += 15;
    findings.push({
      category: "PERFORMANCE",
      severity: "MEDIUM",
      title: "Excessive DOM Tree Size",
      description: `Document has ${totalNodes} DOM elements (recommended < 1500). Heavy DOM trees consume excessive RAM, trigger costly reflows, and slow down interaction latency (INP).`,
      pageUrl,
      element: "DOM Document Tree",
      evidence: `Total elements: ${totalNodes}`,
      remediation: "Simplify deeply nested containers and use virtualized lists for long feeds.",
    });
  }

  // 7. Resource Breakdown
  const scriptCount = $("script[src]").length;
  const styleCount = $('link[rel="stylesheet"]').length;
  const imageCount = images.length;
  metrics.push({ name: "External Scripts", value: String(scriptCount) });
  metrics.push({ name: "Stylesheets", value: String(styleCount) });
  metrics.push({ name: "Total Images", value: String(imageCount) });

  // 8. Estimated Core Web Vitals
  const estimatedFcp = responseTimeMs + Math.min(1200, sizeKb * 3);
  const estimatedLcp = estimatedFcp + (images.length > 0 ? 400 : 150);
  metrics.push({ name: "Estimated FCP", value: `${Math.round(estimatedFcp)}`, unit: "ms" });
  metrics.push({ name: "Estimated LCP", value: `${Math.round(estimatedLcp)}`, unit: "ms" });

  const score = Math.max(0, Math.min(100, 100 - deductions));
  return { score, findings, metrics };
}
