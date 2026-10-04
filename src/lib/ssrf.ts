import dns from "dns/promises";
import net from "net";

const MAX_REDIRECTS_DEFAULT = 5;
const TIMEOUT_MS_DEFAULT = 10000;
const MAX_BYTES_DEFAULT = 10 * 1024 * 1024; // 10MB

/**
 * Validates if an IPv4 or IPv6 address is private, loopback, link-local, or reserved.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 0) return true; // invalid IP format is blocked

  if (version === 4) {
    const parts = ip.split(".").map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some(isNaN)) return true;

    const [a, b, c, d] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;

    // 10.0.0.0/8 (RFC 1918 Private)
    if (a === 10) return true;

    // 100.64.0.0/10 (Shared Address Space / CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 169.254.0.0/16 (Link Local & AWS/GCP/Azure metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 – 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && c === 0) return true;

    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;

    // 192.88.99.0/24 (6to4 Relay Anycast)
    if (a === 192 && b === 88 && c === 99) return true;

    // 192.168.0.0/16 (RFC 1918 Private)
    if (a === 192 && b === 168) return true;

    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;

    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 (Reserved) & 255.255.255.255 (Broadcast)
    if (a >= 240) return true;

    return false;
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();

    // Loopback
    if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

    // Unspecified
    if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;

    // IPv4-mapped IPv6 (::ffff:192.0.2.1)
    if (normalized.startsWith("::ffff:")) {
      const ipv4Part = normalized.replace("::ffff:", "");
      return isPrivateOrReservedIp(ipv4Part);
    }

    // Link-local: fe80::/10 (fe80: to febf:)
    if (/^fe[89ab]/i.test(normalized)) return true;

    // Unique local (ULA): fc00::/7 (fc00: to fdff:)
    if (/^f[cd]/i.test(normalized)) return true;

    // Discard & documentation
    if (normalized.startsWith("100::") || normalized.startsWith("2001:db8:")) return true;

    return false;
  }

  return true;
}

/**
 * Normalizes input string to a valid URL or returns an error.
 */
export function normalizeUrl(inputUrl: string): { valid: boolean; error?: string; url?: URL } {
  if (!inputUrl || typeof inputUrl !== "string") {
    return { valid: false, error: "URL cannot be empty." };
  }

  let raw = inputUrl.trim();
  // Only auto-prefix https:// if no URL scheme is present
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    raw = `https://${raw}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { valid: false, error: "Invalid URL syntax." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTP and HTTPS protocols are allowed." };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs with credentials are not permitted." };
  }

  // Reject local and cloud metadata hostnames
  const forbiddenHosts = [
    "localhost",
    "metadata.google.internal",
    "instance-data",
    "metadata",
    "api.metadata",
    "local",
    "internal",
  ];

  if (
    forbiddenHosts.includes(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return { valid: false, error: "Scanning internal or loopback hostnames is prohibited." };
  }

  return { valid: true, url: parsed };
}

/**
 * Resolves all DNS records for hostname and ensures none point to private/internal IPs.
 */
export async function validateHostDns(hostname: string): Promise<{ safe: boolean; error?: string; ip?: string }> {
  try {
    const records = await dns.lookup(hostname, { all: true });

    if (!records || records.length === 0) {
      return { safe: false, error: `Unable to resolve DNS for ${hostname}.` };
    }

    for (const record of records) {
      if (isPrivateOrReservedIp(record.address)) {
        return {
          safe: false,
          error: `Target resolves to forbidden or private IP (${record.address}).`,
        };
      }
    }

    return { safe: true, ip: records[0].address };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { safe: false, error: `DNS resolution failed: ${msg}` };
  }
}

export interface SafeFetchResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  finalUrl: string;
  responseTimeMs: number;
  redirectCount: number;
  resolvedIp?: string;
}

/**
 * Performs a secure HTTP request with pre-flight DNS SSRF checks, redirect hop validation, and strict timeouts.
 */
export async function safeFetch(
  targetUrl: string,
  options?: {
    maxRedirects?: number;
    timeoutMs?: number;
    maxBytes?: number;
    method?: "GET" | "HEAD";
  }
): Promise<SafeFetchResult> {
  const maxRedirects = options?.maxRedirects ?? MAX_REDIRECTS_DEFAULT;
  const timeoutMs = options?.timeoutMs ?? TIMEOUT_MS_DEFAULT;
  const maxBytes = options?.maxBytes ?? MAX_BYTES_DEFAULT;
  const method = options?.method ?? "GET";

  let currentUrl = targetUrl;
  let redirectCount = 0;
  let resolvedIp: string | undefined;

  const startTime = Date.now();

  while (redirectCount <= maxRedirects) {
    const normalized = normalizeUrl(currentUrl);
    if (!normalized.valid || !normalized.url) {
      throw new Error(`SSRF Protection Block: ${normalized.error || "Invalid URL"}`);
    }

    const hostCheck = await validateHostDns(normalized.url.hostname);
    if (!hostCheck.safe) {
      throw new Error(`SSRF Protection Block: ${hostCheck.error}`);
    }

    resolvedIp = hostCheck.ip;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(normalized.url.toString(), {
        method,
        headers: {
          "User-Agent": "WebCheckAI-Scanner/1.0 (+https://webcheck.ai/bot; Security & Health Audit)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for redirect status codes (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("Redirect response received without Location header.");
        }

        const nextUrl = new URL(location, normalized.url).toString();
        currentUrl = nextUrl;
        redirectCount++;
        continue;
      }

      const responseTimeMs = Date.now() - startTime;
      const headersRecord: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        headersRecord[key.toLowerCase()] = val;
      });

      // Stream / read response body safely
      let body = "";
      if (method === "GET" && response.body) {
        const reader = response.body.getReader();
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          receivedBytes += value.length;
          if (receivedBytes > maxBytes) {
            reader.cancel();
            throw new Error(`Content length exceeds safe scanning limit of ${maxBytes / (1024 * 1024)}MB.`);
          }

          body += new TextDecoder().decode(value, { stream: true });
        }
      }

      return {
        status: response.status,
        headers: headersRecord,
        body,
        finalUrl: normalized.url.toString(),
        responseTimeMs,
        redirectCount,
        resolvedIp,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Connection timed out after ${timeoutMs}ms.`);
      }
      throw err;
    }
  }

  throw new Error(`Exceeded maximum redirect limit of ${maxRedirects} hops.`);
}

