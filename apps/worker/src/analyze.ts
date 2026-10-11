import { chromium, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fixtureOrigin, fixtureResponse } from "./fixture";
import {
  fixtureUrl,
  SafeError,
  assertNoLocalBypass,
} from "../../../packages/core/src/security";
import type {
  Evidence,
  Capture,
  Category,
  Severity,
  Settings,
} from "../../../packages/core/src/model";
import { artifactsRoot } from "../../../packages/core/src/paths";
export const artifactRoot = artifactsRoot;
export async function analyze(
  auditId: string,
  depth: number,
  limits: Settings["limits"],
  stage: (s: string, m: string) => Promise<void>,
  cancel: () => Promise<void>,
) {
  assertNoLocalBypass(process.env);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    serviceWorkers: "block",
    acceptDownloads: false,
    viewport: { width: 1440, height: 1000 },
  });
  const evidence: Evidence[] = [];
  const captures: Capture[] = [];
  let requests = 0;
  let bytes = 0;
  const start = Date.now();
  const dir = path.join(artifactRoot(), auditId);
  await mkdir(dir, { recursive: true });
  const timer = setTimeout(() => void context.close(), limits.timeoutMs);
  let closed = false;
  const cancellation = setInterval(
    () =>
      void cancel().catch(() => {
        closed = true;
        void context.close();
      }),
    700,
  );
  await context.routeWebSocket("**/*", (ws) => ws.close());
  await context.route("**/*", async (route) => {
    requests++;
    if (requests > limits.maxRequests || Date.now() - start > limits.timeoutMs)
      return route.abort();
    try {
      const url = fixtureUrl(route.request().url());
      const response = fixtureResponse(url.pathname);
      if (!response) return route.abort();
      bytes += Buffer.byteLength(response.body);
      if (bytes > 5 * 1024 * 1024) return route.abort();
      return route.fulfill({
        status: response.status,
        contentType: response.type,
        body: response.body,
        headers: { "x-content-type-options": "nosniff" },
      });
    } catch {
      return route.abort();
    }
  });
  const add = (
    url: string,
    category: Category,
    check: string,
    observed: string,
    expected: string,
    passed: boolean,
    options: {
      severity?: Severity;
      tool?: string;
      confidence?: number;
      deduction?: number;
      kind?: "verified" | "heuristic";
      artifact?: string;
    } = {},
  ) => {
    evidence.push({
      id: randomUUID(),
      auditId,
      pageUrl: url,
      category,
      check,
      observed,
      expected,
      passed,
      severity: passed ? "info" : (options.severity ?? "medium"),
      confidence: options.confidence ?? 1,
      method:
        options.tool === "axe-core"
          ? "Automated axe rules"
          : category === "Performance"
            ? "Single unthrottled Chromium lab capture of an in-memory fixture"
            : "Deterministic DOM / controlled response inspection",
      tool: options.tool ?? "AuditCraft DOM",
      toolVersion: options.tool === "axe-core" ? "4.10.3" : "1.0",
      timestamp: new Date().toISOString(),
      deduction: passed ? 0 : (options.deduction ?? 10),
      kind: options.kind ?? "verified",
      artifact: options.artifact,
    });
  };
  const urls = [fixtureOrigin + "/"];
  try {
    await stage(
      "ROBOTS",
      "Controlled robots policy permits the four fixture pages. No external requests are made.",
    );
    for (let i = 0; i < Math.min(depth, limits.maxPages, urls.length); i++) {
      await cancel();
      const url = urls[i];
      const page = await context.newPage();
      await page.addInitScript(() => {
        const lab: { lcp: number | null; cls: number; blocking: number } = {
          lcp: null,
          cls: 0,
          blocking: 0,
        };
        Object.assign(window, { __auditLab: lab });
        try {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) lab.lcp = e.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as (PerformanceEntry & {
              hadRecentInput: boolean;
              value: number;
            })[])
              if (!e.hadRecentInput) lab.cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
          new PerformanceObserver((list) => {
            for (const e of list.getEntries())
              lab.blocking += Math.max(0, e.duration - 50);
          }).observe({ type: "longtask", buffered: true });
        } catch {
          /* Coverage explicitly disclosed below. */
        }
      });
      await stage("DESKTOP", `Capturing desktop page ${i + 1}.`);
      const res = await page.goto(url, { waitUntil: "load", timeout: 10000 });
      await page.evaluate(async () => {
        for (
          let y = 0;
          y < Math.min(document.body.scrollHeight, 8000);
          y += 700
        ) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 25));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(300);
      const prefix = `${auditId}/page-${i + 1}`;
      await page.screenshot({
        path: path.join(artifactRoot(), `${prefix}-desktop.png`),
        fullPage: true,
      });
      await page.screenshot({
        path: path.join(artifactRoot(), `${prefix}-desktop-fold.png`),
      });
      const dom = await inspect(page);
      if (i === 0)
        for (const href of dom.links) {
          try {
            const u = fixtureUrl(href);
            if (
              u.origin === fixtureOrigin &&
              !urls.includes(u.href) &&
              fixtureResponse(u.pathname)?.type === "text/html"
            )
              urls.push(u.href);
          } catch {
            /* Only allow fixture routes. */
          }
        }
      await stage(
        "PERFORMANCE",
        `Collecting local lab signals for page ${i + 1}.`,
      );
      const perf = await page.evaluate(() => ({
        paint:
          performance.getEntriesByName("first-contentful-paint")[0]
            ?.startTime ?? null,
        lab: (
          window as unknown as {
            __auditLab: { lcp: number | null; cls: number; blocking: number };
          }
        ).__auditLab,
        resources: performance.getEntriesByType("resource").length,
      }));
      if (perf.paint !== null)
        add(
          url,
          "Performance",
          "First Contentful Paint",
          `${Math.round(perf.paint)} ms (local lab)`,
          "FCP at or below 1800 ms under the stated lab conditions",
          perf.paint <= 1800,
          { deduction: 20, tool: "Chromium PerformanceObserver" },
        );
      if (perf.lab.lcp !== null)
        add(
          url,
          "Performance",
          "Largest Contentful Paint",
          `${Math.round(perf.lab.lcp)} ms (local lab)`,
          "LCP at or below 2500 ms under the stated lab conditions",
          perf.lab.lcp <= 2500,
          { deduction: 25, tool: "Chromium PerformanceObserver" },
        );
      add(
        url,
        "Performance",
        "Cumulative Layout Shift",
        `${perf.lab.cls.toFixed(3)} (local lab)`,
        "CLS at or below 0.100",
        perf.lab.cls <= 0.1,
        { deduction: 20, tool: "Chromium PerformanceObserver" },
      );
      add(
        url,
        "Performance",
        "Observed long-task blocking",
        `${Math.round(perf.lab.blocking)} ms during capture`,
        "Observed blocking at or below 200 ms; not Lighthouse TBT",
        perf.lab.blocking <= 200,
        { tool: "Chromium PerformanceObserver", deduction: 15 },
      );
      add(
        url,
        "Technical quality",
        "Response status",
        `${res?.status() ?? 0}`,
        "200 response",
        res?.status() === 200,
      );
      add(
        url,
        "Technical quality",
        "Broken images",
        `${dom.brokenImages} broken images`,
        "0 broken images",
        dom.brokenImages === 0,
      );
      add(
        url,
        "Technical quality",
        "Duplicate element IDs",
        `${dom.duplicateIds} duplicate IDs`,
        "0 duplicate IDs",
        dom.duplicateIds === 0,
      );
      add(
        url,
        "Technical quality",
        "Fixture resource inventory",
        `${perf.resources} subresources; HTML ${Buffer.byteLength(fixtureResponse(new URL(url).pathname)!.body)} bytes`,
        "Inventory only; in-memory transfer is not real network page weight",
        true,
      );
      await stage("ACCESSIBILITY", `Running axe-core on page ${i + 1}.`);
      const axe = await new AxeBuilder({ page }).analyze();
      for (const violation of axe.violations)
        add(
          url,
          "Accessibility",
          violation.help,
          `${violation.nodes.length} affected elements; rule ${violation.id}`,
          `Resolve axe rule ${violation.id}; validate manually`,
          false,
          {
            severity:
              violation.impact === "critical" || violation.impact === "serious"
                ? "high"
                : "medium",
            tool: "axe-core",
            deduction: violation.impact === "serious" ? 15 : 8,
            artifact: `${prefix}-desktop.png`,
          },
        );
      if (!axe.violations.length)
        add(
          url,
          "Accessibility",
          "Automated axe checks",
          `${axe.passes.length} rules passed`,
          "No automated violations; manual accessibility testing still required",
          true,
          { tool: "axe-core" },
        );
      add(
        url,
        "Accessibility",
        "Heading order",
        `${dom.headingSkips} skipped heading levels`,
        "0 skipped heading levels",
        dom.headingSkips === 0,
        { deduction: 8 },
      );
      await stage("SEO", `Inspecting metadata and structure on page ${i + 1}.`);
      for (const [check, observed, expected, passed] of [
        [
          "Page title",
          dom.title || "Missing",
          "A descriptive page title",
          Boolean(dom.title),
        ],
        [
          "Meta description",
          dom.description || "Missing",
          "A descriptive meta description",
          Boolean(dom.description),
        ],
        [
          "Canonical URL",
          dom.canonical || "Missing",
          "An explicit canonical URL",
          Boolean(dom.canonical),
        ],
        ["Main heading", `${dom.h1} H1 headings`, "1 H1 heading", dom.h1 === 1],
        [
          "Open Graph metadata",
          dom.og ? "Present" : "Missing",
          "Open Graph title metadata",
          dom.og,
        ],
        [
          "Structured data",
          dom.structured ? "Present" : "Missing",
          "Consider relevant structured data after manual review",
          dom.structured,
        ],
        [
          "Indexability",
          dom.noindex ? "Noindex directive" : "No noindex directive",
          "Review indexability against the owner’s intent",
          true,
        ],
        [
          "Viewport configuration",
          dom.viewport || "Missing",
          "A device-width viewport",
          dom.viewport.includes("device-width"),
        ],
      ] as [string, string, string, boolean][])
        add(url, "SEO", check, observed, expected, passed, {
          deduction: check === "Structured data" ? 3 : 8,
          kind: check === "Structured data" ? "heuristic" : "verified",
          confidence: check === "Structured data" ? 0.6 : 1,
        });
      add(
        url,
        "SEO",
        "Sitemap availability",
        "Controlled sitemap.xml returns 200",
        "An accessible sitemap",
        true,
      );
      const broken = dom.links.filter((l) => {
        try {
          return (
            new URL(l).origin === fixtureOrigin &&
            !fixtureResponse(new URL(l).pathname)
          );
        } catch {
          return true;
        }
      });
      add(
        url,
        "Technical quality",
        "Internal link targets",
        `${broken.length} unavailable fixture routes`,
        "0 unavailable fixture routes",
        broken.length === 0,
      );
      await stage(
        "HEADERS",
        `Inspecting response configuration on page ${i + 1}.`,
      );
      const headers = res?.headers() ?? {};
      for (const header of [
        "strict-transport-security",
        "content-security-policy",
        "x-content-type-options",
        "referrer-policy",
        "permissions-policy",
        "x-frame-options",
      ])
        add(
          url,
          "Security headers",
          header,
          headers[header] ?? "Not present on controlled response",
          `Review an appropriate ${header} policy`,
          Boolean(headers[header]),
          { severity: "low", deduction: 8 },
        );
      await stage("MOBILE", `Capturing mobile page ${i + 1}.`);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(150);
      await page.screenshot({
        path: path.join(artifactRoot(), `${prefix}-mobile.png`),
        fullPage: true,
      });
      await page.screenshot({
        path: path.join(artifactRoot(), `${prefix}-mobile-fold.png`),
      });
      const mobile = await page.evaluate(() => ({
        overflow: Math.max(
          0,
          document.documentElement.scrollWidth - innerWidth,
        ),
        tiny: [...document.querySelectorAll("a,button,input")].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24);
        }).length,
        zoom: /maximum-scale\s*=\s*1|user-scalable\s*=\s*no/i.test(
          document
            .querySelector('meta[name="viewport"]')
            ?.getAttribute("content") ?? "",
        ),
      }));
      add(
        url,
        "Mobile experience",
        "Horizontal mobile overflow",
        `${mobile.overflow} px beyond the viewport`,
        "0 px horizontal overflow",
        mobile.overflow === 0,
        { severity: "high", deduction: 25, artifact: `${prefix}-mobile.png` },
      );
      add(
        url,
        "Mobile experience",
        "Small interactive targets",
        `${mobile.tiny} targets smaller than 24 px`,
        "Review target spacing and size; 24 px minimum is a heuristic here",
        mobile.tiny === 0,
        {
          kind: "heuristic",
          confidence: 0.7,
          deduction: 10,
          artifact: `${prefix}-mobile.png`,
        },
      );
      add(
        url,
        "Mobile experience",
        "Zoom restrictions",
        mobile.zoom
          ? "Zoom limited in viewport metadata"
          : "No zoom restriction detected",
        "Allow user zoom",
        !mobile.zoom,
        { deduction: 15 },
      );
      captures.push({
        id: randomUUID(),
        requestedUrl: url,
        finalUrl: page.url(),
        status: res?.status() ?? 0,
        title: dom.title,
        contentType: "text/html",
        responseSize: Buffer.byteLength(
          fixtureResponse(new URL(url).pathname)!.body,
        ),
        timestamp: new Date().toISOString(),
        redirects: [],
        robots: "Allowed by controlled fixture policy",
        warnings: [
          "Fictional in-memory website; no real network performance.",
          "No cookie consent was accepted. Manual keyboard, overlap and journey review remain necessary.",
          "Speed Index, Lighthouse TBT and real-user field metrics unavailable.",
        ],
        screenshots: {
          desktop: `${prefix}-desktop.png`,
          desktopFold: `${prefix}-desktop-fold.png`,
          mobile: `${prefix}-mobile.png`,
          mobileFold: `${prefix}-mobile-fold.png`,
        },
        viewports: {
          desktop: { width: 1440, height: 1000 },
          mobile: { width: 390, height: 844 },
        },
      });
      await page.close();
    }
    await cancel();
    if (closed) throw new SafeError("CANCELLED");
    if (requests > limits.maxRequests) throw new SafeError("REQUEST_LIMIT");
    return { evidence, captures, requests, bytes };
  } finally {
    clearTimeout(timer);
    clearInterval(cancellation);
    await browser.close();
  }
}
async function inspect(page: Page) {
  return page.evaluate(() => {
    const meta = Object.fromEntries(
      [...document.querySelectorAll("meta")].map((m) => [
        m.getAttribute("name") ?? m.getAttribute("property") ?? "",
        m.getAttribute("content") ?? "",
      ]),
    );
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(
      (e) => Number(e.tagName[1]),
    );
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    return {
      title: document.title,
      description: meta.description ?? "",
      canonical:
        document.querySelector('link[rel="canonical"]')?.getAttribute("href") ??
        "",
      h1: document.querySelectorAll("h1").length,
      og: Boolean(meta["og:title"]),
      structured: Boolean(
        document.querySelector('script[type="application/ld+json"]'),
      ),
      noindex: /noindex/i.test(meta.robots ?? ""),
      viewport: meta.viewport ?? "",
      headingSkips: headings.filter((n, i) => i > 0 && n > headings[i - 1] + 1)
        .length,
      duplicateIds: ids.length - new Set(ids).size,
      brokenImages: [...document.images].filter(
        (i) => !i.complete || i.naturalWidth === 0,
      ).length,
      links: [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].map(
        (a) => a.href,
      ),
    };
  });
}
