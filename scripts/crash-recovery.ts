import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { db, createAudit, loadAudit } from "../packages/database/src/index";
import { prospectInput } from "../packages/core/src/model";
const run = await createAudit(
  prospectInput.parse({
    businessName: "Fieldwork / real crash recovery",
    website: "https://fixture.auditcraft.test/",
    industry: "Design",
    location: "Fictional",
    notes:
      "Controlled SIGKILL verification of this project’s worker container.",
    services: ["Technical SEO"],
    depth: 4,
    responsibleUse: true,
    mode: "fixture",
  }),
  randomUUID(),
);
try {
  let active = false;
  for (let i = 0; i < 600; i++) {
    const a = await loadAudit(run.id);
    if (a.stage === "DESKTOP") {
      active = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(active, "No active capture to interrupt");
  execFileSync("docker", ["compose", "kill", "-s", "SIGKILL", "worker"], {
    stdio: "inherit",
  });
  execFileSync("docker", ["compose", "up", "-d", "worker"], {
    stdio: "inherit",
  });
  let completed: any;
  for (let i = 0; i < 180; i++) {
    const a = await loadAudit(run.id);
    if (a.status === "REVIEW_REQUIRED") {
      completed = a;
      break;
    }
    if (a.status === "FAILED") throw new Error(JSON.stringify(a.error));
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.ok(completed, "Stale lock was not recovered");
  assert.ok(completed.attempts >= 2);
  assert.equal(completed.captures.length, 4);
  assert.equal(
    new Set(completed.evidence.map((e: any) => e.id)).size,
    completed.evidence.length,
  );
  await writeFile(
    "output/crash-recovery.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        auditId: run.id,
        attempts: completed.attempts,
        pages: completed.captures.length,
        evidence: completed.evidence.length,
        result:
          "PASS: killed worker during active capture; BullMQ recovered expired lease; completed same audit without duplicate evidence IDs",
      },
      null,
      2,
    ),
  );
  console.log("PASS actual container crash and four-page recovery");
} finally {
  await db.end();
}
