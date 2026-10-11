import { chromium } from "playwright";
import axe from "axe-core";
import { writeFile } from "node:fs/promises";
try {
  process.loadEnvFile();
} catch {
  /* Runtime env. */
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
const base = process.env.APP_URL ?? "http://localhost:3100";
try {
  await page.goto(base);
  await page.getByLabel("Workspace password").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page
    .getByRole("heading", { name: "A little clarity. A better proposal." })
    .waitFor();
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => {
    return (window as unknown as { axe: typeof axe }).axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
  });
  const issues = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      summary: n.failureSummary,
    })),
  }));
  await writeFile(
    "output/ui-accessibility.json",
    JSON.stringify({ passes: results.passes.length, issues }, null, 2),
  );
  console.log(JSON.stringify(issues, null, 2));
} finally {
  await browser.close();
}
