import assert from "assert";
import { isPrivateOrReservedIp, normalizeUrl } from "../src/lib/ssrf";
import { auditSecurity } from "../src/lib/scanner/security";
import { auditSeo } from "../src/lib/scanner/seo";
import { auditAccessibility } from "../src/lib/scanner/accessibility";
import { auditPerformance } from "../src/lib/scanner/performance";
import { auditLinks } from "../src/lib/scanner/links";
import { formatFindingEvidence, parseFindingLocation, FindingItem } from "../src/lib/types";

console.log("=========================================");
console.log("   WebCheck AI Automated Test Suite      ");
console.log("=========================================\n");

let passed = 0;
let total = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL: ${name}`);
    console.error(`        ${msg}`);
  }
}

async function main() {
  // 1. SSRF IP Validation Tests
  await runTest("SSRF - blocks IPv4 loopback (127.0.0.1)", () => {
    assert.strictEqual(isPrivateOrReservedIp("127.0.0.1"), true);
    assert.strictEqual(isPrivateOrReservedIp("127.1.2.3"), true);
  });

  await runTest("SSRF - blocks RFC1918 10.0.0.0/8 private network", () => {
    assert.strictEqual(isPrivateOrReservedIp("10.0.0.1"), true);
    assert.strictEqual(isPrivateOrReservedIp("10.254.254.254"), true);
  });

  await runTest("SSRF - blocks RFC1918 172.16.0.0/12 private network", () => {
    assert.strictEqual(isPrivateOrReservedIp("172.16.0.1"), true);
    assert.strictEqual(isPrivateOrReservedIp("172.31.255.254"), true);
    assert.strictEqual(isPrivateOrReservedIp("172.32.0.1"), false); // Public
  });

  await runTest("SSRF - blocks RFC1918 192.168.0.0/16 private network", () => {
    assert.strictEqual(isPrivateOrReservedIp("192.168.1.1"), true);
    assert.strictEqual(isPrivateOrReservedIp("192.168.100.254"), true);
  });

  await runTest("SSRF - blocks Link-Local & Cloud Metadata (169.254.169.254)", () => {
    assert.strictEqual(isPrivateOrReservedIp("169.254.169.254"), true);
    assert.strictEqual(isPrivateOrReservedIp("169.254.1.1"), true);
  });

  await runTest("SSRF - blocks IPv6 loopback and ULA", () => {
    assert.strictEqual(isPrivateOrReservedIp("::1"), true);
    assert.strictEqual(isPrivateOrReservedIp("fe80::1"), true);
    assert.strictEqual(isPrivateOrReservedIp("fc00::1"), true);
  });

  await runTest("SSRF - allows legitimate public IPv4", () => {
    assert.strictEqual(isPrivateOrReservedIp("8.8.8.8"), false); // Google DNS
    assert.strictEqual(isPrivateOrReservedIp("1.1.1.1"), false); // Cloudflare DNS
    assert.strictEqual(isPrivateOrReservedIp("93.184.216.34"), false); // example.com
  });

  // 2. URL Normalization Tests
  await runTest("URL Normalizer - auto-prefixes https://", () => {
    const res = normalizeUrl("example.com");
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.url?.href, "https://example.com/");
  });

  await runTest("URL Normalizer - rejects localhost and internal domains", () => {
    assert.strictEqual(normalizeUrl("http://localhost:3000").valid, false);
    assert.strictEqual(normalizeUrl("https://metadata.google.internal").valid, false);
    assert.strictEqual(normalizeUrl("http://internal.service.local").valid, false);
  });

  await runTest("URL Normalizer - rejects non-HTTP schemes", () => {
    assert.strictEqual(normalizeUrl("ftp://example.com").valid, false);
    assert.strictEqual(normalizeUrl("javascript:alert(1)").valid, false);
  });

  // 3. Finding Details & Location Parsing Tests
  await runTest("Finding Details - encodes and extracts pageUrl, element, and evidence", () => {
    const original: FindingItem = {
      category: "ACCESSIBILITY",
      severity: "HIGH",
      title: "Image Missing Alt Attribute",
      description: "Non-text content without alternative text.",
      pageUrl: "https://example.com/about",
      element: '<img src="/team.jpg">',
      evidence: "Image has no alt attribute defined.",
      remediation: "Add alt='Team photo'.",
    };

    const encodedEvidence = formatFindingEvidence(original);
    assert.ok(encodedEvidence);
    assert.ok(encodedEvidence.includes("Affected Page: https://example.com/about"));
    assert.ok(encodedEvidence.includes('Element: <img src="/team.jpg">'));

    const parsed = parseFindingLocation(encodedEvidence);
    assert.strictEqual(parsed.pageUrl, "https://example.com/about");
    assert.strictEqual(parsed.element, '<img src="/team.jpg">');
    assert.strictEqual(parsed.cleanEvidence, "Image has no alt attribute defined.");
  });

  // 4. Security Audit Tests
  await runTest("Security Audit - flags plaintext HTTP and missing CSP with affected location", async () => {
    const result = await auditSecurity("http://insecure-site.org", {}, "<html><body>Hello</body></html>");
    assert.ok(result.score < 50);

    const httpFinding = result.findings.find((f) => f.title.includes("Plaintext HTTP"));
    assert.ok(httpFinding);
    assert.strictEqual(httpFinding.pageUrl, "http://insecure-site.org");
    assert.ok(httpFinding.element);

    const cspFinding = result.findings.find((f) => f.title.includes("Content-Security-Policy"));
    assert.ok(cspFinding);
    assert.ok(cspFinding.element);
  });

  await runTest("Security Audit - detects mixed content on HTTPS page with exact selector", async () => {
    const mixedHtml = `
      <html>
        <head>
          <script src="http://insecure.cdn.com/app.js"></script>
        </head>
        <body>
          <form action="http://insecure.api.com/submit"></form>
        </body>
      </html>
    `;
    const result = await auditSecurity("https://site.org", {}, mixedHtml);
    const scriptFinding = result.findings.find((f) => f.title.includes("Insecure Mixed Active Script"));
    assert.ok(scriptFinding);
    assert.ok(scriptFinding.element?.includes("http://insecure.cdn.com/app.js"));
    assert.ok(scriptFinding.evidence?.includes("http://insecure.cdn.com/app.js"));

    const formFinding = result.findings.find((f) => f.title.includes("Insecure Plaintext Form Action"));
    assert.ok(formFinding);
    assert.ok(formFinding.element?.includes("http://insecure.api.com/submit"));
  });

  await runTest("Security Audit - awards high score for hardened HTTPS response", async () => {
    const hardenedHeaders = {
      "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
      "content-security-policy": "default-src 'self'",
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    };
    const result = await auditSecurity("https://secure-site.org", hardenedHeaders, "<html><body>Clean</body></html>");
    assert.ok(result.score >= 85);
  });

  // 5. SEO Audit Tests
  await runTest("SEO Audit - identifies missing title, meta description, and heading hierarchy with location", async () => {
    const html = "<html><head></head><body>No meta or heading here</body></html>";
    const result = await auditSeo(html, "https://example.com");

    const titleFinding = result.findings.find((f) => f.title.includes("Missing <title> Tag"));
    assert.ok(titleFinding);
    assert.strictEqual(titleFinding.pageUrl, "https://example.com");
    assert.ok(titleFinding.element);

    const descFinding = result.findings.find((f) => f.title.includes("Missing Meta Description"));
    assert.ok(descFinding);

    const h1Finding = result.findings.find((f) => f.title.includes("Missing <h1> Primary Heading"));
    assert.ok(h1Finding);
    assert.strictEqual(h1Finding.element, "<body>");
  });

  // 6. Accessibility Audit Tests
  await runTest("Accessibility Audit - detects missing alt, unlabelled inputs, and empty buttons with selectors", () => {
    const html = `
      <html>
        <body>
          <img src="avatar.png" class="profile-pic">
          <input type="text" id="username" name="user">
          <button class="icon-close"><svg></svg></button>
        </body>
      </html>
    `;
    const result = auditAccessibility(html, "https://example.com/profile");

    const altFinding = result.findings.find((f) => f.title.includes("Missing Alt Attribute"));
    assert.ok(altFinding);
    assert.strictEqual(altFinding.pageUrl, "https://example.com/profile");
    assert.ok(altFinding.element?.includes("avatar.png"));
    assert.ok(altFinding.remediation);

    const inputFinding = result.findings.find((f) => f.title.includes("Missing Accessible Label"));
    assert.ok(inputFinding);
    assert.ok(inputFinding.element?.includes("username"));

    const btnFinding = result.findings.find((f) => f.title.includes("Missing Accessible Name"));
    assert.ok(btnFinding);
    assert.ok(btnFinding.element?.includes("icon-close"));
  });

  // 7. Performance Audit Tests
  await runTest("Performance Audit - measures TTFB, render blocking scripts, and CLS image dimensions", () => {
    const perfHtml = `
      <html>
        <head>
          <script src="https://cdn.com/heavy.js"></script>
        </head>
        <body>
          <img src="banner.png">
        </body>
      </html>
    `;
    const result = auditPerformance(250, 15000, { "content-encoding": "br" }, perfHtml);
    assert.ok(result.score >= 70);

    const scriptFinding = result.findings.find((f) => f.title.includes("Render-Blocking Script"));
    assert.ok(scriptFinding);
    assert.ok(scriptFinding.element?.includes("heavy.js"));

    const clsFinding = result.findings.find((f) => f.title.includes("CLS Risk"));
    assert.ok(clsFinding);
    assert.ok(clsFinding.element?.includes("banner.png"));
  });

  // 8. Links Audit Tests
  await runTest("Links Audit - extracts internal/external links and identifies empty anchor tags", async () => {
    const linksHtml = `
      <html>
        <body>
          <a href="#">Dead Anchor</a>
          <a href="https://example.com/about">About Us</a>
          <a href="https://external.com/docs">Documentation</a>
        </body>
      </html>
    `;
    const result = await auditLinks(linksHtml, "https://example.com");
    assert.ok(result.metrics.some((m) => m.name.includes("Internal Links")));
    assert.ok(result.findings.some((f) => f.title.includes("Placeholder Anchor Link")));
  });

  console.log(`\n=========================================`);
  console.log(`  Tests Passed: ${passed} / ${total}`);
  console.log(`=========================================\n`);

  if (passed !== total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal Test Suite Error:", err);
  process.exit(1);
});
