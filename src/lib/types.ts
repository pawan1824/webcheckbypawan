export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type Category = "SECURITY" | "SEO" | "ACCESSIBILITY" | "PERFORMANCE" | "LINKS";

export type ScanStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface FindingItem {
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  remediation?: string;
  evidence?: string;
  pageUrl?: string;
  element?: string;
}

export interface CrawledPage {
  url: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  responseTimeMs: number;
  pageSizeBytes: number;
  title?: string;
  depth: number;
}

export function formatFindingEvidence(f: {
  pageUrl?: string;
  element?: string;
  evidence?: string;
}): string | undefined {
  const parts: string[] = [];
  if (f.pageUrl) parts.push(`Affected Page: ${f.pageUrl}`);
  if (f.element) parts.push(`Element: ${f.element}`);
  if (f.evidence) parts.push(`Evidence: ${f.evidence}`);
  return parts.length > 0 ? parts.join("\n") : undefined;
}

export function parseFindingLocation(evidence?: string | null): {
  pageUrl?: string;
  element?: string;
  cleanEvidence?: string;
} {
  if (!evidence) return {};
  let pageUrl: string | undefined;
  let element: string | undefined;
  const remainingLines: string[] = [];

  const lines = evidence.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!pageUrl && line.startsWith("Affected Page: ")) {
      pageUrl = line.replace("Affected Page: ", "").trim();
    } else if (!element && line.startsWith("Element: ")) {
      element = line.replace("Element: ", "").trim();
    } else if (line.startsWith("Evidence: ")) {
      remainingLines.push(line.replace("Evidence: ", ""));
    } else {
      remainingLines.push(line);
    }
  }

  const clean = remainingLines.join("\n").trim();
  return {
    pageUrl,
    element,
    cleanEvidence: clean || evidence,
  };
}

export interface MetricItem {
  name: string;
  value: string;
  unit?: string;
}

export interface CategoryResult {
  score: number;
  findings: FindingItem[];
  metrics: MetricItem[];
}

export interface AuditResult {
  url: string;
  domain: string;
  finalUrl: string;
  status: ScanStatus;
  overallScore: number;
  securityScore: number;
  seoScore: number;
  accessibilityScore: number;
  performanceScore: number;
  linksScore: number;
  sslValid: boolean;
  responseTimeMs: number;
  pageSizeBytes: number;
  findings: FindingItem[];
  metrics: MetricItem[];
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ScanRecord {
  id: string;
  url: string;
  domain: string;
  status: ScanStatus;
  overallScore: number | null;
  securityScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  performanceScore: number | null;
  linksScore: number | null;
  sslValid: boolean | null;
  responseTimeMs: number | null;
  pageSizeBytes: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  findings?: FindingItem[];
  metrics?: MetricItem[];
}
