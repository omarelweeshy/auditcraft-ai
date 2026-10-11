import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { db, createAudit, loadAudit } from "../packages/database/src/index";
import { prospectInput } from "../packages/core/src/model";
const input = prospectInput.parse({
  businessName: "Fieldwork / terminal failure test",
  website: "https://fixture.auditcraft.test/unknown",
  industry: "Design",
  location: "Fictional",
  notes:
    "Internal fault injection. The public API rejects this route before enqueueing.",
  services: [],
  depth: 1,
  responsibleUse: true,
  mode: "fixture",
});
const passed: string[] = [];
try {
  const failed = await createAudit(input, randomUUID());
  let terminal: any;
  for (let i = 0; i < 45; i++) {
    const a = await loadAudit(failed.id);
    if (a.status === "FAILED") {
      terminal = a;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.ok(terminal);
  assert.equal(terminal.attempts, 3);
  assert.equal(terminal.error.code, "FIXTURE_PATH");
  assert.equal(terminal.prospect.businessName, input.businessName);
  passed.push(
    "Three-attempt terminal failure preserves prospect and audit records with a safe error",
  );
  const active = await createAudit(
    {
      ...input,
      businessName: "Fieldwork / active cancellation",
      website: "https://fixture.auditcraft.test/",
      depth: 4,
    },
    randomUUID(),
  );
  let capturing = false;
  for (let i = 0; i < 400; i++) {
    const a = await loadAudit(active.id);
    if (a.stage === "DESKTOP") {
      capturing = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(capturing);
  await db.query(
    "UPDATE audits SET cancelled=true,status='CANCELLED',completed_at=now() WHERE id=$1",
    [active.id],
  );
  await new Promise((r) => setTimeout(r, 5000));
  const cancelled = await loadAudit(active.id);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.captures.length, 0);
  assert.equal(cancelled.findings.length, 0);
  passed.push(
    "Cancellation during active desktop capture closes processing before evidence commit",
  );
  await writeFile(
    "output/recovery-results.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        passed,
        failedAuditId: failed.id,
        cancelledAuditId: active.id,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(passed));
} finally {
  await db.end();
}
