# WebCheck AI 🛡️⚡

WebCheck AI is a production-grade website health, security, SEO, accessibility, and performance auditing engine.

Enter any public URL to initiate a comprehensive multi-vector audit with actionable remediation guides and exportable reports.

---

## Features

- **Strict SSRF Protection**:
  - Pre-flight DNS resolution before any HTTP request.
  - Hard blocks on loopback (`127.0.0.0/8`, `::1`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), Link-Local (`169.254.0.0/16`), cloud metadata services (`169.254.169.254`, `metadata.google.internal`), carrier-grade NAT, and documentation addresses.
  - Hop-by-hop manual redirect validation (up to 5 hops max).
  - Strict 10s timeout and 10MB payload size limit.

- **5-Vector Automated Auditing**:
  1. **Security & Headers**: Evaluates HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, SSL/TLS, and server disclosure.
  2. **Technical SEO**: Evaluates title tag lengths, meta descriptions, canonical URLs, OpenGraph/Twitter social cards, heading hierarchies (H1–H6), and robots/sitemap detection.
  3. **Accessibility (a11y)**: Checks document language (`<html lang>`), missing image alt attributes, ARIA landmark structure (`<main>`, `<nav>`), unlabelled form inputs, and viewport zooming restrictions.
  4. **Performance & CWV**: Benchmarks real server Time to First Byte (TTFB), transfer compression (Brotli/Gzip), render-blocking assets in `<head>`, and estimates Core Web Vitals.
  5. **Hyperlink Health**: Crawls and samples page links to detect 404 errors, dead links, and empty anchor tags.

- **Modern Responsive Dashboard**:
  - Clean URL input with preset demo websites.
  - Overall health score & grade (`A+`, `A`, `B`, `C`, `F`).
  - Interactive category cards with issue counts.
  - Expandable finding cards with severity badges, problem descriptions, and copyable remediation code.
  - Search & filter by severity or category.
  - Audit history table with direct link to past reports.
  - Export to JSON, Markdown, or printable PDF.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router, React 18, Server Actions / Route Handlers)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS, Lucide React Icons
- **Database**: SQLite via Prisma ORM (`file:./dev.db`), switchable to PostgreSQL via `DATABASE_URL`
- **Parsing**: Cheerio, native `fetch` with AbortController, Node.js `dns/promises`

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Initialize Database

```bash
npx prisma db push
```

### 3. Run Automated Tests

```bash
npm test
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build

```bash
npm run build
npm start
```

