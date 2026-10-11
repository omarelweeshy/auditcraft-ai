import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("demo/out");
const server = process.env.DEMO_URL
  ? null
  : createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const file = path.resolve(
          root,
          "." +
            decodeURIComponent(
              url.pathname === "/" ? "/index.html" : url.pathname,
            ),
        );
        if (!file.startsWith(root + path.sep)) {
          res.writeHead(404).end();
          return;
        }
        const data = await readFile(file);
        const types: Record<string, string> = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".png": "image/png",
          ".pdf": "application/pdf",
        };
        res
          .writeHead(200, {
            "Content-Type":
              types[path.extname(file)] ?? "application/octet-stream",
          })
          .end(data);
      } catch {
        res.writeHead(404).end();
      }
    });
if (server)
  await new Promise<void>((resolve) =>
    server.listen(3201, "127.0.0.1", resolve),
  );
const url = process.env.DEMO_URL ?? "http://127.0.0.1:3201";
const browser = await chromium.launch({ headless: true });
const checks: string[] = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Good proposals start with judgment." })
    .waitFor();
  await page.getByRole("tab", { name: "Review findings" }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: "Evidence ledger" }).getAttribute("aria-selected"), "true");
  await page.keyboard.press("Home");
  assert.equal(await page.getByRole("tab", { name: "Review findings" }).getAttribute("aria-selected"), "true");
  assert(
    await page
      .getByRole("button", { name: "Export reviewed findings" })
      .isDisabled(),
  );
  await page
    .getByRole("textbox", { name: "Recommendation for", exact: false })
    .first()
    .fill(
      "Replace the decorative image with an accessible equivalent, then verify the result.",
    );
  await page
    .getByRole("button", { name: "Approve finding", exact: true })
    .first()
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export reviewed findings" }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  assert.equal(exported.findings.length, 1);
  assert.match(exported.findings[0].recommendation, /accessible equivalent/);
  checks.push("edit, approve, and export only approved findings");
  await page
    .getByRole("button", { name: "Reject", exact: true })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Inspect evidence" }).first().click();
  assert.equal(await page.locator("article.evidence").count(), 1);
  await page.getByRole("button", { name: "Show all evidence" }).click();
  const total = await page.locator("article.evidence").count();
  await page.getByRole("combobox").selectOption("Issues");
  const issues = await page.locator("article.evidence").count();
  assert(issues > 0 && issues < total);
  await page.getByRole("combobox").selectOption("Passed");
  assert.equal(
    (await page.locator("article.evidence").count()) + issues,
    total,
  );
  checks.push("reject, evidence links, and passed/issue filters");
  await page.getByRole("tab", { name: "Page captures" }).click();
  await page
    .locator("img")
    .evaluateAll((images) =>
      Promise.all(images.map((img) => (img as HTMLImageElement).decode())),
    );
  assert(
    await page
      .locator("img")
      .evaluateAll((images) =>
        images.every((img) => (img as HTMLImageElement).naturalWidth > 0),
      ),
  );
  await page.getByRole("tab", { name: "Sample proposal" }).click();
  const pdf = await page.request.get(url + "/sample-proposal.pdf");
  assert.equal(pdf.status(), 200);
  assert.equal((await pdf.body()).subarray(0, 4).toString(), "%PDF");
  checks.push("original captures and real PDF download");
  await page.getByRole("tab", { name: "Review findings" }).click();
  await page.getByRole("button", { name: "Reset review" }).click();
  assert(
    await page
      .getByRole("button", { name: "Export reviewed findings" })
      .isDisabled(),
  );
  await mkdir("output/screenshots", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "output/screenshots/public-demo-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const tab of [
      "Review findings",
      "Evidence ledger",
      "Page captures",
      "Sample proposal",
    ]) {
      await page.getByRole("tab", { name: tab }).click();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${tab}: overflow`,
      );
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      assert.equal(
        axe.violations.length,
        0,
        JSON.stringify(
          axe.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        ),
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Review findings" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "output/screenshots/public-demo-mobile.png",
    fullPage: true,
  });
  checks.push(
    "reset, responsive layout and WCAG A/AA checks across four tabs at three widths",
  );
  for (const resource of [
    "/.env",
    "/api/session",
    "/api/login",
    "/data/artifacts",
    "/.git/config",
  ]) {
    assert.equal(
      (await page.request.get(url + resource)).status(),
      404,
      resource,
    );
  }
  assert.deepEqual(errors, []);
  checks.push("private paths absent and no browser errors");
  await writeFile(
    "output/public-demo-results.json",
    JSON.stringify(
      { url, checks, passed: true, timestamp: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ url, checks, passed: true }, null, 2));
} finally {
  await browser.close();
  server?.closeAllConnections();
  server?.close();
}
