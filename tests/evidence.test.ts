import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { score, weights, type Evidence } from "../packages/core/src/model";
import {
  MockProvider,
  validateGenerated,
  explain,
  validateReviewed,
} from "../packages/core/src/provider";
import {
  renderReport,
  outreachDraft,
  type ReportSnapshot,
} from "../packages/core/src/report";
import { defaultSettings } from "../packages/core/src/model";
const e: Evidence = {
  id: randomUUID(),
  auditId: randomUUID(),
  pageUrl: "https://fixture.auditcraft.test/",
  category: "SEO",
  check: "Meta description",
  observed: "Missing",
  expected: "A descriptive meta description",
  severity: "medium",
  confidence: 1,
  method: "DOM",
  tool: "AuditCraft DOM",
  toolVersion: "1",
  timestamp: new Date().toISOString(),
  passed: false,
  deduction: 8,
  kind: "verified",
};
test("template provider produces only valid evidence-linked pending inputs", async () => {
  const raw = await new MockProvider().generate({
    evidence: [e],
    pages: [],
    prospect: { businessName: "Fixture", industry: "Design", notes: "" },
    services: [],
  });
  assert.equal(raw.length, 1);
  assert.deepEqual(validateGenerated(raw[0], [e]).evidenceIds, [e.id]);
  assert.equal("approval" in (raw[0] as object), false);
});
test("rejects unknown/empty IDs, guarantees, numeric invention, company invention and approval injection", () => {
  const base = explain(e);
  for (const override of [
    { evidenceIds: [randomUUID()] },
    { evidenceIds: [] },
    { explanation: "Guaranteed revenue increase of 30%" },
    { explanation: "The company employs 200 people" },
    { explanation: "Your customers abandon the checkout" },
    { approval: "APPROVED" },
  ])
    assert.throws(() => validateGenerated({ ...base, ...override }, [e]));
});
test("review validation rejects unsupported numeric claims and guarantees", () => {
  assert.throws(() =>
    validateReviewed(
      { ...explain(e), explanation: "This guarantees 50% more revenue" },
      [e],
    ),
  );
  assert.throws(() =>
    validateReviewed(
      { ...explain(e), explanation: "200 customers leave the page" },
      [e],
    ),
  );
});
test("scoring is repeatable, deductions reference evidence, missing data lowers coverage", () => {
  const a = score([e]);
  assert.deepEqual(a, score([e]));
  assert.equal(a.total, 92);
  assert.equal(a.coverage, 0.2);
  assert.equal(
    a.breakdown.find((c) => c.category === "SEO")?.deductions[0].evidenceId,
    e.id,
  );
  assert.equal(
    a.breakdown.find((c) => c.category === "Performance")?.score,
    null,
  );
  assert.equal(score([]).total, null);
  assert.equal(
    Object.values(weights).reduce((a, b) => a + b),
    100,
  );
});
test("scoring is capped and weight configuration is preserved by value", () => {
  const s = score(
    Array.from({ length: 20 }, () => ({ ...e, id: randomUUID() })),
  );
  assert.equal(s.total, 0);
  assert.equal(s.breakdown.find((c) => c.category === "SEO")?.earned, 0);
});
test("report escapes user text; outreach references approved snapshot findings", () => {
  const f = {
    ...explain(e),
    id: randomUUID(),
    auditId: e.auditId,
    approval: "APPROVED" as const,
    revision: 1,
  };
  const s: ReportSnapshot = {
    id: randomUUID(),
    version: 1,
    createdAt: new Date().toISOString(),
    prospect: {
      businessName: "<script>alert(1)</script>",
      website: e.pageUrl,
      industry: "",
      location: "",
      services: ["Technical SEO"],
    },
    auditId: e.auditId,
    auditVersion: 1,
    settings: defaultSettings,
    summary: "An evidence-led fictional review.",
    findings: [f],
    evidence: [e],
    captures: [],
    sections: ["Summary", "Findings", "Methodology"],
    screenshot: null,
    score: score([e]),
  };
  assert.ok(!renderReport(s).includes("<script>"));
  assert.deepEqual(outreachDraft(s).findingIds, [f.id]);
  assert.ok(outreachDraft(s).message.includes("Missing"));
});
