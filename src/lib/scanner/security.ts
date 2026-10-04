import * as cheerio from "cheerio";
import tls from "tls";
import dns from "dns/promises";
import { CategoryResult, FindingItem, MetricItem, CrawledPage } from "../types";
import { isPrivateOrReservedIp } from "../ssrf";

/**
 * Safely inspects TLS certificate details without establishing a persistent socket.
 */
export async function checkTlsCertificate(
  hostname: string,
  port = 443
): Promise<{
  valid: boolean;
  issuer?: string;
  validTo?: string;
  daysRemaining?: number;
  protocol?: string;
  authorized?: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    // SSRF pre-check on hostname before socket connection
    dns.lookup(hostname).then((res) => {
      if (isPrivateOrReservedIp(res.address)) {
        return resolve({ valid: false, error: "SSRF Block: Target resolves to internal IP" });
      }

      const socket = tls.connect(
        {
          host: hostname,
          port,
          servername: hostname,
          rejectUnauthorized: false, // allow inspect even if self-signed to report accurate finding
          timeout: 4000,
        },
        () => {
          const cert = socket.getPeerCertificate();
          const authorized = socket.authorized;
          const authError = socket.authorizationError ? String(socket.authorizationError) : undefined;
          const protocol = socket.getProtocol() || undefined;

          let daysRemaining: number | undefined;
          if (cert && cert.valid_to) {
            const expiryDate = new Date(cert.valid_to);
            daysRemaining = Math.round((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          }

          let issuer: string | undefined;
          if (cert?.issuer) {
            const raw = cert.issuer.O || cert.issuer.CN || "Unknown Issuer";
            issuer = Array.isArray(raw) ? raw.join(", ") : String(raw);
          }

          socket.end();
          resolve({
            valid: authorized,
            issuer,
            validTo: cert?.valid_to,
            daysRemaining,
            protocol,
            authorized,
            error: authError,
          });
        }
      );

      socket.on("timeout", () => {
        socket.destroy();
        resolve({ valid: false, error: "TLS connection timed out" });
      });

      socket.on("error", (err) => {
        resolve({ valid: false, error: err.message });
      });
    }).catch((err) => {
      resolve({ valid: false, error: err.message });
    });
  });
}

export async function auditSecurity(
  finalUrl: string,
  headers: Record<string, string>,
  html: string,
  crawledPages: CrawledPage[] = []
): Promise<CategoryResult> {
  const findings: FindingItem[] = [];
  const metrics: MetricItem[] = [];
  let deductions = 0;

  const urlObj = new URL(finalUrl);
  const isHttps = urlObj.protocol === "https:";

  metrics.push({
    name: "Protocol",
    value: urlObj.protocol.toUpperCase().replace(":", ""),
  });

  // Ensure crawledPages contains at least the primary page if empty
  const allPages: CrawledPage[] = crawledPages.length > 0
    ? crawledPages
    : [{
        url: finalUrl,
        status: 200,
        headers,
        html,
        responseTimeMs: 0,
        pageSizeBytes: Buffer.byteLength(html, "utf8"),
        depth: 0,
      }];

  // 1. HTTPS Protocol & TLS Certificate Verification
  if (!isHttps) {
    deductions += 45;
    findings.push({
      category: "SECURITY",
      severity: "CRITICAL",
      title: "Insecure Plaintext HTTP Protocol",
      description: "The website is delivered over unencrypted HTTP. All traffic, cookies, and user credentials can be intercepted or manipulated in transit.",
      pageUrl: finalUrl,
      element: "URL Scheme (http://)",
      evidence: `Connection URL: ${finalUrl}`,
      remediation: "Install an SSL/TLS certificate and configure a 301 permanent redirect from HTTP to HTTPS.",
    });
  } else {
    findings.push({
      category: "SECURITY",
      severity: "INFO",
      title: "Encrypted HTTPS Protocol Active",
      description: "Website traffic is encrypted using HTTPS.",
      pageUrl: finalUrl,
      element: "URL Scheme (https://)",
      evidence: `Protocol: ${urlObj.protocol}`,
    });

    // Check TLS Certificate
    try {
      const tlsInfo = await checkTlsCertificate(urlObj.hostname);
      if (tlsInfo.protocol) {
        metrics.push({ name: "TLS Protocol", value: tlsInfo.protocol });
      }
      if (tlsInfo.issuer) {
        metrics.push({ name: "SSL Issuer", value: tlsInfo.issuer });
      }
      if (tlsInfo.daysRemaining !== undefined) {
        metrics.push({ name: "SSL Expiry", value: `${tlsInfo.daysRemaining} day(s)` });
      }

      if (tlsInfo.protocol && !tlsInfo.authorized && tlsInfo.error) {
        deductions += 35;
        findings.push({
          category: "SECURITY",
          severity: "CRITICAL",
          title: "Invalid or Untrusted TLS Certificate",
          description: `The SSL/TLS certificate failed verification: ${tlsInfo.error}. Modern browsers will display full-page security warnings.`,
          pageUrl: finalUrl,
          element: "SSL/TLS Certificate",
          evidence: `TLS Authorization Error: ${tlsInfo.error}`,
          remediation: "Renew or replace the SSL/TLS certificate with a valid certificate from a trusted public Certificate Authority.",
        });
      } else if (tlsInfo.daysRemaining !== undefined && tlsInfo.daysRemaining < 15) {
        deductions += 15;
        findings.push({
          category: "SECURITY",
          severity: "HIGH",
          title: "SSL/TLS Certificate Expiring Soon",
          description: `The certificate will expire in ${tlsInfo.daysRemaining} day(s) on ${tlsInfo.validTo}. Once expired, users will be blocked from accessing your website.`,
          pageUrl: finalUrl,
          element: "SSL/TLS Certificate",
          evidence: `Expires on: ${tlsInfo.validTo} (${tlsInfo.daysRemaining} days remaining)`,
          remediation: "Renew and deploy your SSL/TLS certificate before expiration.",
        });
      }
    } catch {
      // Non-fatal if TLS socket check cannot complete
    }
  }

  // 2. Strict-Transport-Security (HSTS)
  const hsts = headers["strict-transport-security"];
  if (!hsts) {
    if (isHttps) {
      deductions += 15;
      findings.push({
        category: "SECURITY",
        severity: "HIGH",
        title: "Missing Strict-Transport-Security (HSTS) Header",
        description: "HSTS instructs browsers to only connect via HTTPS, preventing man-in-the-middle SSL-stripping attacks.",
        pageUrl: finalUrl,
        element: "HTTP Response Header: Strict-Transport-Security",
        evidence: "Strict-Transport-Security header is not sent by the server.",
        remediation: "Add response header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
      });
    }
  } else {
    metrics.push({ name: "HSTS Header", value: hsts });
    findings.push({
      category: "SECURITY",
      severity: "INFO",
      title: "HSTS Header Present",
      description: "Strict-Transport-Security header is configured.",
      pageUrl: finalUrl,
      element: "HTTP Response Header",
      evidence: `Strict-Transport-Security: ${hsts}`,
    });
  }

  // 3. Content-Security-Policy (CSP)
  const csp = headers["content-security-policy"];
  if (!csp) {
    deductions += 20;
    findings.push({
      category: "SECURITY",
      severity: "HIGH",
      title: "Missing Content-Security-Policy (CSP)",
      description: "CSP provides defense-in-depth against Cross-Site Scripting (XSS), clickjacking, and data injection by specifying trusted domain sources for executable scripts and media.",
      pageUrl: finalUrl,
      element: "HTTP Response Header: Content-Security-Policy",
      evidence: "Content-Security-Policy header is absent.",
      remediation: "Configure a Content-Security-Policy header restricting script-src, style-src, frame-ancestors, and object-src.",
    });
  } else {
    metrics.push({ name: "CSP Header", value: "Configured" });
    if (csp.includes("'unsafe-inline'") || csp.includes("'unsafe-eval'")) {
      deductions += 8;
      findings.push({
        category: "SECURITY",
        severity: "MEDIUM",
        title: "CSP Contains Permissive Directives",
        description: "The CSP directive contains 'unsafe-inline' or 'unsafe-eval', weakening resistance against stored and reflected Cross-Site Scripting (XSS).",
        pageUrl: finalUrl,
        element: "Content-Security-Policy header",
        evidence: csp.slice(0, 160) + (csp.length > 160 ? "..." : ""),
        remediation: "Refactor inline scripts to external scripts using cryptographic nonces (nonce-...) or SHA-256 hashes.",
      });
    } else {
      findings.push({
        category: "SECURITY",
        severity: "INFO",
        title: "Content-Security-Policy Active",
        description: "CSP is active without unsafe-inline or unsafe-eval directives.",
        pageUrl: finalUrl,
        element: "Content-Security-Policy header",
        evidence: csp.slice(0, 120),
      });
    }
  }

  // 4. X-Frame-Options (Clickjacking)
  const xfo = headers["x-frame-options"];
  const cspFrames = csp && (csp.includes("frame-ancestors") || csp.includes("frame-src"));
  if (!xfo && !cspFrames) {
    deductions += 12;
    findings.push({
      category: "SECURITY",
      severity: "MEDIUM",
      title: "Missing Anti-Clickjacking Protection",
      description: "Neither X-Frame-Options nor CSP frame-ancestors is present. Attackers can embed your site into hidden iframes on malicious websites to trick visitors into clicking sensitive buttons.",
      pageUrl: finalUrl,
      element: "HTTP Response Header: X-Frame-Options",
      evidence: "Both X-Frame-Options and CSP frame-ancestors are absent.",
      remediation: "Add header: X-Frame-Options: DENY or SAMEORIGIN, or CSP frame-ancestors 'self'.",
    });
  } else {
    findings.push({
      category: "SECURITY",
      severity: "INFO",
      title: "Clickjacking Protection Configured",
      description: `Protected via ${xfo ? `X-Frame-Options: ${xfo}` : "CSP frame-ancestors directive"}.`,
      pageUrl: finalUrl,
      element: xfo ? "X-Frame-Options" : "CSP frame-ancestors",
      evidence: xfo ? `X-Frame-Options: ${xfo}` : "CSP frame-ancestors configured",
    });
  }

  // 5. X-Content-Type-Options
  const xcto = headers["x-content-type-options"];
  if (!xcto || xcto.toLowerCase() !== "nosniff") {
    deductions += 8;
    findings.push({
      category: "SECURITY",
      severity: "LOW",
      title: "Missing X-Content-Type-Options: nosniff",
      description: "Instructs browsers to strictly follow the Content-Type header and not perform MIME-sniffing, preventing executable scripts disguised as images or text files.",
      pageUrl: finalUrl,
      element: "HTTP Response Header: X-Content-Type-Options",
      evidence: xcto ? `Value is '${xcto}', expected 'nosniff'` : "Header is missing",
      remediation: "Add header: X-Content-Type-Options: nosniff",
    });
  } else {
    findings.push({
      category: "SECURITY",
      severity: "INFO",
      title: "MIME-Sniffing Protection Active",
      description: "X-Content-Type-Options: nosniff is set.",
      pageUrl: finalUrl,
      element: "X-Content-Type-Options",
      evidence: "nosniff",
    });
  }

  // 6. Referrer-Policy
  const refPolicy = headers["referrer-policy"];
  if (!refPolicy) {
    deductions += 5;
    findings.push({
      category: "SECURITY",
      severity: "LOW",
      title: "Missing Referrer-Policy Header",
      description: "Without a Referrer-Policy header, sensitive URLs and query parameters (such as tokens or user IDs) can leak to third-party domains.",
      pageUrl: finalUrl,
      element: "HTTP Response Header: Referrer-Policy",
      evidence: "Referrer-Policy header is absent.",
      remediation: "Add header: Referrer-Policy: strict-origin-when-cross-origin",
    });
  } else {
    findings.push({
      category: "SECURITY",
      severity: "INFO",
      title: "Referrer-Policy Active",
      description: `Configured as: ${refPolicy}`,
      pageUrl: finalUrl,
      element: "Referrer-Policy",
      evidence: refPolicy,
    });
  }

  // 7. Permissions-Policy
  const permPolicy = headers["permissions-policy"];
  if (!permPolicy) {
    findings.push({
      category: "SECURITY",
      severity: "LOW",
      title: "Missing Permissions-Policy Header",
      description: "Permissions-Policy allows developers to explicitly disable browser APIs (camera, microphone, geolocation) that the application does not require.",
      pageUrl: finalUrl,
      element: "HTTP Response Header: Permissions-Policy",
      evidence: "Permissions-Policy header is absent.",
      remediation: "Add header: Permissions-Policy: camera=(), microphone=(), geolocation=()",
    });
  }

  // 8. Server Software & Tech Stack Disclosure
  const server = headers["server"];
  const poweredBy = headers["x-powered-by"];
  if (server && /\d+\.\d+/.test(server)) {
    deductions += 5;
    findings.push({
      category: "SECURITY",
      severity: "LOW",
      title: "Detailed Server Software Version Disclosed",
      description: "The Server header exposes exact software and version numbers, allowing automated vulnerability scanners to target version-specific CVEs.",
      pageUrl: finalUrl,
      element: "HTTP Response Header: Server",
      evidence: `Server: ${server}`,
      remediation: "Configure the web server or reverse proxy to omit software version numbers.",
    });
  }
  if (poweredBy) {
    deductions += 5;
    findings.push({
      category: "SECURITY",
      severity: "LOW",
      title: "X-Powered-By Header Discloses Technology Stack",
      description: "The X-Powered-By header fingerprints the server runtime framework (e.g. Express, PHP, ASP.NET).",
      pageUrl: finalUrl,
      element: "HTTP Response Header: X-Powered-By",
      evidence: `X-Powered-By: ${poweredBy}`,
      remediation: "Disable X-Powered-By in your web framework configuration.",
    });
  }

  // 9. Multi-Page Checks across all Crawled Pages
  for (const page of allPages) {
    const $ = cheerio.load(page.html);

    // 9a. Mixed Active Content (Scripts, Stylesheets, Iframes over HTTP on HTTPS site)
    if (isHttps) {
      $('script[src^="http://"]').each((_, el) => {
        const src = $(el).attr("src") || "";
        deductions += 15;
        findings.push({
          category: "SECURITY",
          severity: "HIGH",
          title: "Insecure Mixed Active Script",
          description: "Loading scripts over unencrypted HTTP on an HTTPS page allows network attackers to tamper with script execution (MITM). Browsers will block this script.",
          pageUrl: page.url,
          element: `<script src="${src}">`,
          evidence: `Insecure HTTP Script: ${src}`,
          remediation: `Update the script URL ${src} to use HTTPS.`,
        });
      });

      $('link[rel="stylesheet"][href^="http://"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        deductions += 10;
        findings.push({
          category: "SECURITY",
          severity: "HIGH",
          title: "Insecure Mixed Stylesheet",
          description: "Stylesheets loaded over HTTP can be hijacked to alter user interface appearance or capture data.",
          pageUrl: page.url,
          element: `<link rel="stylesheet" href="${href}">`,
          evidence: `Insecure HTTP Stylesheet: ${href}`,
          remediation: `Update stylesheet URL ${href} to use HTTPS.`,
        });
      });

      $('iframe[src^="http://"]').each((_, el) => {
        const src = $(el).attr("src") || "";
        deductions += 10;
        findings.push({
          category: "SECURITY",
          severity: "HIGH",
          title: "Insecure Mixed Content Iframe",
          description: "Embedding plaintext HTTP iframes inside an HTTPS document degrades page integrity.",
          pageUrl: page.url,
          element: `<iframe src="${src}">`,
          evidence: `Insecure HTTP Iframe: ${src}`,
          remediation: `Update iframe source ${src} to HTTPS.`,
        });
      });

      // Passive mixed content (images)
      $('img[src^="http://"]').each((idx, el) => {
        if (idx < 3) {
          const src = $(el).attr("src") || "";
          deductions += 3;
          findings.push({
            category: "SECURITY",
            severity: "LOW",
            title: "Insecure Passive Image (Mixed Content)",
            description: "Images loaded over unencrypted HTTP can be modified in transit by network attackers.",
            pageUrl: page.url,
            element: `<img src="${src}">`,
            evidence: `Insecure HTTP image URL: ${src}`,
            remediation: `Update image source ${src} to use HTTPS.`,
          });
        }
      });
    }

    // 9b. Reverse Tabnabbing (target="_blank" without rel="noopener" or rel="noreferrer")
    $('a[target="_blank"]').each((_, el) => {
      const rel = ($(el).attr("rel") || "").toLowerCase();
      const href = $(el).attr("href") || "";
      if (href.startsWith("http://") || href.startsWith("https://")) {
        try {
          const linkDomain = new URL(href).hostname;
          if (linkDomain !== urlObj.hostname && !rel.includes("noopener") && !rel.includes("noreferrer")) {
            deductions += 4;
            findings.push({
              category: "SECURITY",
              severity: "MEDIUM",
              title: "Reverse Tabnabbing Vulnerability (target='_blank')",
              description: "Opening external links in target='_blank' without rel='noopener' or rel='noreferrer' allows the target page to manipulate the source tab via window.opener.",
              pageUrl: page.url,
              element: `<a href="${href}" target="_blank">`,
              evidence: `Anchor tag: <a href="${href}" target="_blank" rel="${rel || '(none)'}">`,
              remediation: "Add rel='noopener noreferrer' to external links targeting new tabs.",
            });
          }
        } catch {
          // ignore invalid URLs
        }
      }
    });

    // 9c. Insecure Form Actions (Submitting to HTTP)
    $("form").each((_, el) => {
      const action = $(el).attr("action")?.trim() || "";
      if (action.startsWith("http://")) {
        deductions += 20;
        findings.push({
          category: "SECURITY",
          severity: "CRITICAL",
          title: "Insecure Plaintext Form Action",
          description: "Form inputs and credentials submitted to an unencrypted HTTP endpoint can be intercepted in transit.",
          pageUrl: page.url,
          element: `<form action="${action}">`,
          evidence: `Form action: ${action}`,
          remediation: `Change the form action to submit to an HTTPS endpoint: ${action.replace(/^http:\/\//, "https://")}`,
        });
      }
    });

    // 9d. Exposed Sensitive Information in HTML Comments
    const commentRegex = /<!--([\s\S]*?)-->/g;
    let match: RegExpExecArray | null;
    while ((match = commentRegex.exec(page.html)) !== null) {
      const commentContent = match[1];
      const sensitiveKeywords = [
        /(?:api[_-]?key|secret|password|private[_-]?key|credentials|auth[_-]?token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{6,}/i,
        /TODO:?\s*(?:remove|fix|security|hack|leak|vulnerable)/i,
      ];

      for (const pattern of sensitiveKeywords) {
        if (pattern.test(commentContent)) {
          deductions += 10;
          const snippet = commentContent.trim().slice(0, 100);
          findings.push({
            category: "SECURITY",
            severity: "MEDIUM",
            title: "Potentially Sensitive Information Disclosed in HTML Comment",
            description: "HTML source comments contain references to credentials, API keys, or security-sensitive TODOs visible to anyone inspecting page source.",
            pageUrl: page.url,
            element: `<!-- ${snippet}... -->`,
            evidence: `HTML Comment snippet: ${snippet}`,
            remediation: "Remove development notes, internal paths, and credentials from production HTML output.",
          });
          break;
        }
      }
    }
  }

  const score = Math.max(0, Math.min(100, 100 - deductions));
  return { score, findings, metrics };
}
