import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { db, loadAudit, editFinding } from "../packages/database/src/index";
import { finalizeReport } from "../packages/database/src/reports";
import { reportSections } from "../packages/core/src/report";
import { artifactsRoot } from "../packages/core/src/paths";
import type { Finding } from "../packages/core/src/model";
const run = JSON.parse(
  await readFile("output/integration-results.json", "utf8"),
);
try {
  const a = await loadAudit(run.auditId);
  const selected = [
    "Images must have alternative text",
    "Horizontal mobile overflow",
    "Meta description",
  ].map((title) => a.findings.find((f: Finding) => f.title === title)!);
  for (const f of selected) {
    const { id, auditId: _id, revision, approval: _approval, ...data } = f;
    await editFinding(
      id,
      {
        ...data,
        reviewerNotes: "Approved for the fictional, controlled sample report.",
      },
      "APPROVED",
      revision,
    );
  }
  const report = await finalizeReport(a.id, {
    summary:
      "This fictional website review records verified lab observations and opportunities for a focused technical review. Business impact requires independent validation.",
    findingIds: selected.map((f) => f.id),
    sections: [...reportSections],
    screenshot: a.captures[0].screenshots.desktopFold,
  });
  let artifact: any;
  for (let i = 0; i < 60; i++) {
    artifact = (
      await db.query("SELECT * FROM artifacts WHERE report_id=$1", [report.id])
    ).rows[0];
    if (artifact.status === "READY") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (artifact.status !== "READY") throw new Error("Sample PDF did not finish");
  const row = (await db.query("SELECT * FROM reports WHERE id=$1", [report.id]))
    .rows[0];
  await mkdir("output/pdf", { recursive: true });
  await copyFile(
    path.join(artifactsRoot(), artifact.path),
    "output/pdf/auditcraft-sample-proposal.pdf",
  );
  const shot = row.snapshot.screenshot;
  await writeFile(
    "output/sample-report.html",
    row.html.replaceAll(
      "/api/artifacts/" + shot,
      "data:image/png;base64," +
        (await readFile(path.join(artifactsRoot(), shot))).toString("base64"),
    ),
  );
  await writeFile(
    "output/sample-report.json",
    JSON.stringify(row.snapshot, null, 2),
  );
  console.log(`Sample report ${report.id} version ${report.version}`);
} finally {
  await db.end();
}
