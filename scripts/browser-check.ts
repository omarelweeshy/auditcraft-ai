import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
try {
  process.loadEnvFile();
} catch {
  /* CI supplies env. */
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1500, height: 1100 },
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: string[] = [];
await mkdir("output/screenshots", { recursive: true });
async function snapshot(options: { path: string; fullPage: boolean }) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot(options);
}
try {
  await page.goto(process.env.APP_URL ?? "http://localhost:3100");
  await page.getByLabel("Workspace password").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page
    .getByRole("heading", { name: "A little clarity. A better proposal." })
    .waitFor();
  results.push("Browser sign-in and dashboard");
  await snapshot({
    path: "output/screenshots/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "New audit", exact: false }).click();
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Fieldwork / browser review");
  await page.getByText("I will review evidence", { exact: false }).click();
  await page.getByRole("button", { name: "Start evidence collection" }).click();
  await page.getByRole("tab", { name: "Timeline", exact: true }).waitFor();
  await page
    .getByText(
      "Evidence ready. Human approval is required before report generation.",
    )
    .first()
    .waitFor({ timeout: 150000 });
  results.push("New audit form through live timeline");
  await snapshot({
    path: "output/screenshots/timeline-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Review", exact: false }).click();
  await page.getByLabel("Finding title").waitFor();
  await page
    .getByLabel("Reviewer notes")
    .fill("Manually inspected the captured fixture.");
  await page.getByRole("button", { name: "Approve finding" }).click();
  await page.getByRole("status").waitFor();
  results.push("Split review and human approval");
  await snapshot({
    path: "output/screenshots/review-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Evidence", exact: true }).click();
  await page.getByRole("heading", { name: "Evidence explorer" }).waitFor();
  await page.getByLabel("severity", { exact: true }).selectOption("high");
  const rows = await page.locator(".evidence-table details").count();
  assert.ok(rows > 0);
  await page.locator(".evidence-table summary").first().click();
  results.push("Evidence filter and detail expansion");
  await snapshot({
    path: "output/screenshots/evidence-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Captures", exact: true }).click();
  await page.locator(".capture-pair img").first().waitFor();
  assert.ok(
    await page
      .locator(".capture-pair img")
      .first()
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  );
  results.push("Protected screenshots load");
  await page.getByRole("tab", { name: "Report", exact: true }).click();
  await page
    .getByRole("button", { name: "Finalize version & generate PDF" })
    .click();
  await page
    .getByRole("link", { name: "Download PDF" })
    .waitFor({ timeout: 60000 });
  await page
    .frameLocator("iframe")
    .getByRole("heading", { name: "Small improvements.", exact: false })
    .waitFor();
  results.push("Report builder, HTML preview and PDF completion");
  await snapshot({
    path: "output/screenshots/report-desktop.png",
    fullPage: true,
  });
  await page
    .getByLabel("Message", { exact: true })
    .fill(
      (await page.getByLabel("Message", { exact: true }).inputValue()) +
        "\n\nFictional demonstration draft.",
    );
  await page
    .getByRole("button", { name: "Save revision", exact: true })
    .click();
  results.push("Outreach draft revision");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ["Review", "Evidence", "Timeline", "Report", "History"]) {
    await page.getByRole("tab", { name: tab, exact: tab !== "Review" }).click();
    await page.waitForTimeout(150);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Mobile overflow: ${tab}`,
    );
    await snapshot({
      path: `output/screenshots/${tab.toLowerCase()}-mobile.png`,
      fullPage: true,
    });
  }
  results.push(
    "Mobile review, evidence, timeline, report and history without page overflow",
  );
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page
    .getByRole("button", { name: "Automation", exact: false })
    .first()
    .click();
  await page.getByRole("heading", { name: "The work, in motion." }).waitFor();
  await snapshot({
    path: "output/screenshots/automation-desktop.png",
    fullPage: true,
  });
  results.push("Automation and failure views");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Business name", { exact: true }).waitFor();
  results.push("Settings form");
  assert.deepEqual(errors, []);
  results.push("No browser JavaScript errors");
  await writeFile(
    "output/browser-results.json",
    JSON.stringify(
      { timestamp: new Date().toISOString(), passed: results },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
