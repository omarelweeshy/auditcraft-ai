import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
try {
  process.loadEnvFile();
} catch {
  /* Environment supplied. */
}
const base = process.env.APP_URL ?? "http://localhost:3100";
const snapshot = JSON.parse(
  await readFile("output/sample-report.json", "utf8"),
);
const checks: string[] = [];
for (const suffix of [
  `reports/${snapshot.id}/html`,
  `reports/${snapshot.id}/pdf`,
  `artifacts/${snapshot.screenshot}`,
])
  assert.equal((await fetch(base + "/api/" + suffix)).status, 401);
checks.push("Unauthenticated HTML, PDF and screenshot access denied");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base);
  await page.getByLabel("Workspace password").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page
    .getByRole("heading", { name: "A little clarity. A better proposal." })
    .waitFor();
  await page.getByRole("button", { name: "Prospects", exact: true }).click();
  await page
    .getByRole("button", { name: /Fieldwork \/ failed demonstration/ })
    .click();
  await page
    .getByRole("heading", { name: "This audit stopped before review." })
    .waitFor();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByText("Seeded failure example.", { exact: false }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "output/screenshots/failed-audit-desktop.png",
    fullPage: true,
  });
  checks.push("Seeded failure review and timeline render correctly");
  await page.getByRole("button", { name: "Prospects", exact: true }).click();
  await page
    .getByRole("button", { name: /Fieldwork \/ browser review/ })
    .first()
    .click();
  await page.getByRole("tab", { name: "Report", exact: true }).click();
  await page.locator("iframe").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .frameLocator("iframe")
    .getByRole("heading", { name: "Small improvements.", exact: false })
    .waitFor();
  assert.ok(
    await page
      .frameLocator("iframe")
      .locator("html")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  );
  checks.push("Mobile report iframe content has no horizontal overflow");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "output/screenshots/report-mobile.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Review", exact: false }).click();
  await page.getByLabel("Finding title").waitFor();
  const before = await page.locator(".finding-item").count();
  await page
    .getByRole("button", { name: "Add manual finding", exact: false })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Manual finding added" })
    .waitFor();
  assert.equal(await page.locator(".finding-item").count(), before + 1);
  checks.push("Manual evidence-linked finding can be added in the mobile UI");
  assert.deepEqual(errors, []);
  await writeFile(
    "output/final-smoke.json",
    JSON.stringify(
      { timestamp: new Date().toISOString(), passed: checks },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(checks));
} finally {
  await browser.close();
}
