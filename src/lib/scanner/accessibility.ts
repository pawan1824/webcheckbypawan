import * as cheerio from "cheerio";
import { CategoryResult, FindingItem, MetricItem, CrawledPage } from "../types";

export function auditAccessibility(
  input: string | CrawledPage[],
  fallbackUrl?: string
): CategoryResult {
  const findings: FindingItem[] = [];
  const metrics: MetricItem[] = [];
  let deductions = 0;

  // Normalize input into CrawledPage array
  const pages: CrawledPage[] = typeof input === "string"
    ? [{
        url: fallbackUrl || "https://target-audit.local",
        status: 200,
        headers: {},
        html: input,
        responseTimeMs: 0,
        pageSizeBytes: Buffer.byteLength(input, "utf8"),
        depth: 0,
      }]
    : input;

  let totalImagesAudited = 0;
  let totalMissingAlt = 0;
  let totalUnlabelledInputs = 0;

  for (const page of pages) {
    const $ = cheerio.load(page.html);

    // 1. HTML lang attribute (WCAG 3.1.1 Language of Page)
    const htmlEl = $("html");
    const lang = htmlEl.attr("lang")?.trim();

    if (!lang) {
      deductions += 15;
      findings.push({
        category: "ACCESSIBILITY",
        severity: "HIGH",
        title: "Missing <html> Lang Attribute (WCAG 3.1.1)",
        description: "Screen readers rely on the lang attribute to configure speech synthesis, pronunciation rules, and translation.",
        pageUrl: page.url,
        element: "<html>",
        evidence: "Root <html> element has no 'lang' attribute defined.",
        remediation: 'Add a valid BCP 47 language code to the root element, e.g. <html lang="en">.',
      });
    }

    // 2. Image Alt Attributes (WCAG 1.1.1 Non-text Content)
    const images = $("img");
    totalImagesAudited += images.length;

    images.each((_, el) => {
      const alt = $(el).attr("alt");
      const src = $(el).attr("src") || "(inline/blob)";
      const className = $(el).attr("class") ? ` class="${$(el).attr("class")}"` : "";

      if (alt === undefined) {
        totalMissingAlt++;
        deductions += 5;
        findings.push({
          category: "ACCESSIBILITY",
          severity: "HIGH",
          title: "Image Missing Alt Attribute (WCAG 1.1.1)",
          description: "Images without an alt attribute are unreadable to assistive screen reader users navigating non-text content.",
          pageUrl: page.url,
          element: `<img src="${src}"${className}>`,
          evidence: `Element: <img src="${src}"> is missing alt attribute`,
          remediation: `Add a descriptive alt attribute: <img src="${src}" alt="Description of image content"> (or alt="" if decorative).`,
        });
      } else if (/^(image|img|photo|picture|graphic|icon|banner)$/i.test(alt.trim())) {
        deductions += 3;
        findings.push({
          category: "ACCESSIBILITY",
          severity: "LOW",
          title: "Generic Alt Text Used on Image (WCAG 1.1.1)",
          description: `The alt text "${alt}" is non-descriptive and fails to communicate the image's meaning to screen readers.`,
          pageUrl: page.url,
          element: `<img src="${src}" alt="${alt}">`,
          evidence: `Non-descriptive alt attribute: alt="${alt}"`,
          remediation: "Replace generic placeholder text with specific, context-rich wording describing the image purpose.",
        });
      }
    });

    // 3. Landmark Structure (WCAG 1.3.1 Info and Relationships)
    const hasMain = $("main, [role='main']").length > 0;
    if (!hasMain) {
      deductions += 12;
      findings.push({
        category: "ACCESSIBILITY",
        severity: "HIGH",
        title: "Missing <main> Landmark (WCAG 1.3.1)",
        description: "The <main> element allows assistive technology users to jump directly to the primary page content, bypassing repetitive header navigation.",
        pageUrl: page.url,
        element: "<body>",
        evidence: "No <main> or [role='main'] landmark element found in the document.",
        remediation: "Wrap primary content in a semantic <main> tag or add role='main' to the primary container.",
      });
    }

    // 4. Form Controls without Labels (WCAG 4.1.2 Name, Role, Value)
    const formInputs = $("input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']), select, textarea");

    formInputs.each((_, el) => {
      const id = $(el).attr("id");
      const name = $(el).attr("name") || "";
      const type = $(el).attr("type") || el.tagName.toLowerCase();
      const ariaLabel = $(el).attr("aria-label");
      const ariaLabelledby = $(el).attr("aria-labelledby");
      const titleAttr = $(el).attr("title");
      const placeholder = $(el).attr("placeholder");

      let hasLabel = false;
      if (ariaLabel || ariaLabelledby || titleAttr) {
        hasLabel = true;
      } else if (id && $(`label[for="${id}"]`).length > 0) {
        hasLabel = true;
      } else if ($(el).closest("label").length > 0) {
        hasLabel = true;
      }

      if (!hasLabel) {
        totalUnlabelledInputs++;
        deductions += 6;
        const selector = id ? `#${id}` : name ? `[name="${name}"]` : type;
        findings.push({
          category: "ACCESSIBILITY",
          severity: "HIGH",
          title: `Form Control Missing Accessible Label (WCAG 4.1.2: ${type})`,
          description: "Form inputs must have associated <label> elements or aria-label attributes so screen readers know what input data is required.",
          pageUrl: page.url,
          element: `<${el.tagName.toLowerCase()} type="${type}" id="${id || ""}" name="${name}">`,
          evidence: `Input selector: ${selector}${placeholder ? ` (placeholder: "${placeholder}")` : ""} lacks programmatic label`,
          remediation: `Pair the field with a <label for="${id || "field-id"}">Label Name</label> or add aria-label="Field Name".`,
        });
      }
    });

    // 5. Empty Buttons & Links (WCAG 4.1.2)
    $("button").each((_, el) => {
      const text = $(el).text().trim();
      const ariaLabel = $(el).attr("aria-label");
      const ariaLabelledby = $(el).attr("aria-labelledby");
      const title = $(el).attr("title");
      const className = $(el).attr("class") ? ` class="${$(el).attr("class")}"` : "";

      if (!text && !ariaLabel && !ariaLabelledby && !title && $(el).find("svg, img").length > 0) {
        deductions += 5;
        findings.push({
          category: "ACCESSIBILITY",
          severity: "MEDIUM",
          title: "Icon Button Missing Accessible Name (WCAG 4.1.2)",
          description: "Buttons without text content or aria-label attributes are announced as 'unlabelled button' to screen reader users.",
          pageUrl: page.url,
          element: `<button${className}>`,
          evidence: "Button has visual icon but no text, aria-label, or title attribute.",
          remediation: 'Add an aria-label attribute, e.g. <button aria-label="Close modal"> or include a visually-hidden span.',
        });
      }
    });

    $("a").each((_, el) => {
      const href = $(el).attr("href")?.trim();
      const text = $(el).text().trim();
      const ariaLabel = $(el).attr("aria-label");
      const title = $(el).attr("title");

      if (href && !text && !ariaLabel && !title && $(el).find("svg, img").length > 0) {
        deductions += 4;
        findings.push({
          category: "ACCESSIBILITY",
          severity: "MEDIUM",
          title: "Hyperlink Missing Accessible Text (WCAG 2.4.4 Link Purpose)",
          description: "Links without accessible names make it impossible for screen reader users navigating links to know where the link goes.",
          pageUrl: page.url,
          element: `<a href="${href}">`,
          evidence: `Link destination: ${href} has no link text or aria-label`,
          remediation: `Add an aria-label to the anchor tag describing the destination: <a href="${href}" aria-label="View Profile">.`,
        });
      }
    });

    // 6. Viewport Zoom Restricting (WCAG 1.4.4 Resize Text)
    const viewport = $('meta[name="viewport"]').attr("content") || "";
    if (viewport.includes("user-scalable=no") || viewport.includes("maximum-scale=1")) {
      deductions += 10;
      findings.push({
        category: "ACCESSIBILITY",
        severity: "HIGH",
        title: "Pinch-To-Zoom Disabled on Mobile (WCAG 1.4.4)",
        description: "Disabling pinch-to-zoom prevents low-vision users from magnifying content on mobile devices.",
        pageUrl: page.url,
        element: `<meta name="viewport" content="${viewport}">`,
        evidence: `Viewport directive: ${viewport}`,
        remediation: "Remove 'user-scalable=no' and 'maximum-scale=1' from the viewport meta tag.",
      });
    }

    // 7. Duplicate IDs (WCAG 4.1.1 Parsing)
    const idMap = new Map<string, number>();
    $("[id]").each((_, el) => {
      const id = $(el).attr("id")?.trim();
      if (id) {
        idMap.set(id, (idMap.get(id) || 0) + 1);
      }
    });

    for (const [id, count] of idMap.entries()) {
      if (count > 1) {
        deductions += 4;
        findings.push({
          category: "ACCESSIBILITY",
          severity: "LOW",
          title: `Duplicate HTML ID Attribute: #${id} (WCAG 4.1.1)`,
          description: "Document IDs must be unique. Duplicate IDs break ARIA references (aria-labelledby, aria-describedby, label for) and form associations.",
          pageUrl: page.url,
          element: `[id="${id}"]`,
          evidence: `ID "${id}" appears ${count} times on page`,
          remediation: `Ensure the ID "${id}" is unique across the page DOM.`,
        });
      }
    }
  }

  // Summary Metrics
  metrics.push({
    name: "Images Audited (a11y)",
    value: `${totalImagesAudited} (${totalMissingAlt} missing alt)`,
  });
  metrics.push({
    name: "Unlabelled Form Inputs",
    value: String(totalUnlabelledInputs),
  });

  const score = Math.max(0, Math.min(100, 100 - deductions));
  return { score, findings, metrics };
}
