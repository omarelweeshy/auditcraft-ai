import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../packages/database/src/index";
import { reportSections } from "../packages/core/src/report";
import { artifactsRoot } from "../packages/core/src/paths";
import { auditQueue } from "../packages/core/src/queue";
const origin = process.env.APP_URL ?? "http://localhost:3100";
const base = process.env.API_BASE ?? origin;
let cookie = "";
let csrf = "";
const passed: string[] = [];
function check(name: string, fn: () => void) {
  fn();
  passed.push(name);
  console.log("PASS " + name);
}
async function request(
  url: string,
  method = "GET",
  data?: unknown,
  headers: Record<string, string> = {},
) {
  return fetch(base + "/api/" + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
      "x-csrf-token": csrf,
      ...headers,
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
async function api(
  url: string,
  method = "GET",
  data?: unknown,
  headers: Record<string, string> = {},
) {
  const res = await request(url, method, data, headers);
  const result = await res.json();
  assert.ok(res.ok, `${url}: ${res.status} ${JSON.stringify(result)}`);
  return result;
}
async function ready(id: string) {
  const until = Date.now() + 150000;
  while (Date.now() < until) {
    const a = await api("audits/" + id);
    if (
      ["REVIEW_REQUIRED", "COMPLETE", "FAILED", "CANCELLED"].includes(a.status)
    ) {
      assert.ok(
        ["REVIEW_REQUIRED", "COMPLETE"].includes(a.status),
        JSON.stringify(a.error),
      );
      return a;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Audit timeout");
}
const input = {
  businessName: "Fieldwork Studio",
  website: "https://fixture.auditcraft.test/",
  industry: "Interior design",
  location: "Cairo (fictional)",
  notes: "Integration verification fixture",
  services: ["Accessible interfaces", "Technical SEO"],
  depth: 1,
  responsibleUse: true,
  mode: "fixture",
};
try {
  check("public dashboard denied", () => {});
  assert.equal((await request("dashboard")).status, 401);
  assert.equal((await request("audits", "POST", input)).status, 401);
  passed.push("unauthorized job creation denied");
  const login = await request("login", "POST", {
    password: process.env.ADMIN_PASSWORD,
  });
  assert.equal(login.status, 200, await login.text());
  cookie = login.headers.get("set-cookie")!.split(";")[0];
  csrf = (await api("session")).csrf;
  assert.equal(
    (await request("settings", "PUT", {}, { "x-csrf-token": "" })).status,
    403,
  );
  assert.equal(
    (await request("settings", "PUT", {}, { Origin: "https://evil.example" }))
      .status,
    403,
  );
  passed.push("CSRF token and origin enforced");
  const workerUrl = process.env.WORKER_URL ?? "http://localhost:3101";
  assert.equal((await fetch(workerUrl)).status, 401);
  assert.equal(
    (
      await fetch(workerUrl, {
        headers: { Authorization: `Bearer ${process.env.WORKER_TOKEN}` },
      })
    ).status,
    200,
  );
  passed.push("worker uses separate credential");
  assert.equal(
    (
      await request(
        "audits",
        "POST",
        { ...input, website: "http://127.0.0.1" },
        { "idempotency-key": randomUUID() },
      )
    ).status,
    400,
  );
  passed.push("API cannot enable private-site scanning");
  const key = randomUUID();
  const [a, b] = await Promise.all([
    api("audits", "POST", input, { "idempotency-key": key }),
    api("audits", "POST", input, { "idempotency-key": key }),
  ]);
  check("concurrent idempotent submissions create one audit", () =>
    assert.equal(a.id, b.id),
  );
  const done = await ready(a.id);
  check("real worker captures fixture and persists evidence", () => {
    assert.equal(done.captures.length, 1);
    assert.ok(done.evidence.length > 15);
    assert.ok(done.findings.length > 3);
    assert.ok(done.evidence.some((e: any) => e.tool === "axe-core"));
  });
  check(
    "all generated findings reference valid evidence and await approval",
    () => {
      for (const f of done.findings) {
        assert.equal(f.approval, "PENDING");
        assert.ok(
          f.evidenceIds.every((id: string) =>
            done.evidence.some((e: any) => e.id === id),
          ),
        );
      }
    },
  );
  const shot = await request(
    "artifacts/" + done.captures[0].screenshots.desktop,
  );
  assert.equal(shot.status, 200);
  assert.ok(
    Number(
      shot.headers.get("content-length") ??
        (await shot.arrayBuffer()).byteLength,
    ) > 10000,
  );
  passed.push("authenticated screenshot retrieval");
  const reportInput = {
    summary:
      "This fictional website review records verified lab observations and opportunities for a focused technical review. Business impact requires independent validation.",
    findingIds: [done.findings[0].id],
    sections: [...reportSections],
    screenshot: done.captures[0].screenshots.desktopFold,
  };
  assert.equal(
    (await request(`audits/${a.id}/reports`, "POST", reportInput)).status,
    400,
  );
  passed.push("unapproved findings cannot enter reports");
  async function edit(f: any, approval: string, editText = false) {
    const {
      id,
      auditId: _auditId,
      approval: _approval,
      revision,
      ...finding
    } = f;
    return api("findings/" + id, "PUT", {
      finding: {
        ...finding,
        ...(editText
          ? { reviewerNotes: "Reviewed in the controlled fixture." }
          : {}),
      },
      approval,
      revision,
    });
  }
  const select = [
    "Images must have alternative text",
    "Horizontal mobile overflow",
    "Meta description",
  ]
    .map((title) => done.findings.find((f: any) => f.title === title))
    .filter(Boolean);
  for (const f of select) await edit(f, "APPROVED", true);
  const rejected = done.findings.find((f: any) => !select.includes(f));
  await edit(rejected, "REJECTED");
  const revisions = await api(`findings/${select[0].id}/revisions`);
  check("editing preserves previous revision", () => {
    assert.equal(revisions[0].revision, 1);
    assert.equal(revisions[0].approval, "PENDING");
  });
  const stale = select[0];
  const {
    id: staleId,
    auditId: _a,
    approval: _p,
    revision: _r,
    ...staleInput
  } = stale;
  assert.equal(
    (
      await request("findings/" + staleId, "PUT", {
        finding: staleInput,
        approval: "APPROVED",
        revision: 1,
      })
    ).status,
    409,
  );
  passed.push("concurrent edit conflict detected");
  const report = await api(`audits/${a.id}/reports`, "POST", {
    ...reportInput,
    findingIds: select.map((f: any) => f.id),
  });
  const snapshot = await api("reports/" + report.id);
  check("report includes only selected approved findings", () => {
    assert.equal(snapshot.snapshot.findings.length, 3);
    assert.ok(
      snapshot.snapshot.findings.every(
        (f: any) => f.approval === "APPROVED" && f.id !== rejected.id,
      ),
    );
  });
  const drafts = await api(`reports/${report.id}/outreach`);
  check("outreach references approved findings only", () =>
    assert.ok(
      drafts[0].data.findingIds.every((id: string) =>
        select.some((f: any) => f.id === id),
      ),
    ),
  );
  await assert.rejects(
    db.query("UPDATE reports SET html=$2 WHERE id=$1", [report.id, "changed"]),
  );
  await assert.rejects(
    db.query("UPDATE evidence SET data=$2 WHERE id=$1", [
      done.evidence[0].id,
      {},
    ]),
  );
  passed.push("database blocks finalized-report and evidence mutation");
  const changed = await api("audits/" + a.id);
  await edit(
    changed.findings.find((f: any) => f.id === select[0].id),
    "REJECTED",
  );
  const after = await api("reports/" + report.id);
  check("later review changes cannot mutate saved report", () =>
    assert.deepEqual(after.snapshot, snapshot.snapshot),
  );
  const pdfUntil = Date.now() + 60000;
  let pdfReady = false;
  while (Date.now() < pdfUntil) {
    if ((await api("reports/" + report.id)).pdf_status === "READY") {
      pdfReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.ok(pdfReady, "PDF worker did not finish");
  const pdf = await request(`reports/${report.id}/pdf`);
  assert.equal(pdf.status, 200);
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdfBytes.subarray(0, 4).toString(), "%PDF");
  passed.push("worker creates downloadable PDF from approved snapshot");
  await mkdir("output/pdf", { recursive: true });
  await mkdir("output/screenshots", { recursive: true });
  await writeFile("output/pdf/auditcraft-sample-proposal.pdf", pdfBytes);
  await writeFile(
    "output/sample-report.html",
    (await (await request(`reports/${report.id}/html`)).text()).replaceAll(
      "/api/artifacts/" + reportInput.screenshot,
      "data:image/png;base64," +
        (
          await readFile(path.join(artifactsRoot(), reportInput.screenshot))
        ).toString("base64"),
    ),
  );
  await writeFile(
    "output/sample-report.json",
    JSON.stringify(snapshot.snapshot, null, 2),
  );
  for (const [name, file] of Object.entries(done.captures[0].screenshots))
    await copyFile(
      path.join(artifactsRoot(), file as string),
      `output/screenshots/fixture-${name}.png`,
    );
  const rerun = await api(
    `audits/${a.id}/rerun`,
    "POST",
    {},
    { "idempotency-key": randomUUID() },
  );
  check("rerun creates a new audit version", () => {
    assert.equal(rerun.version, 2);
    assert.notEqual(rerun.id, a.id);
  });
  await request(`audits/${rerun.id}/cancel`, "POST", {});
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal((await api("audits/" + rerun.id)).status, "CANCELLED");
  passed.push("cancelled job stops and retains records");
  const retry = await api(
    "audits",
    "POST",
    {
      ...input,
      businessName: "Fieldwork / retry verification",
      simulateFailure: true,
    },
    { "idempotency-key": randomUUID() },
  );
  const recovered = await ready(retry.id);
  check("controlled failure retries and preserves audit identity", () => {
    assert.equal(recovered.attempts, 2);
    assert.ok(recovered.events.some((e: any) => e.stage === "FAILURE"));
  });
  const failedAI = await api(
    "audits",
    "POST",
    {
      ...input,
      businessName: "Fieldwork / explanation failure",
      simulateAiFailure: true,
    },
    { "idempotency-key": randomUUID() },
  );
  const manual = await ready(failedAI.id);
  check("provider failure retains evidence and routes to manual review", () => {
    assert.ok(manual.evidence.length > 0);
    assert.equal(manual.findings.length, 0);
    assert.equal(manual.status, "REVIEW_REQUIRED");
  });
  const q = auditQueue();
  const crash = await api(
    "audits",
    "POST",
    { ...input, businessName: "Fieldwork / lease verification" },
    { "idempotency-key": randomUUID() },
  );
  await db.query(
    "UPDATE audits SET status='CAPTURING',heartbeat_at=now()-interval '10 minutes' WHERE id=$1",
    [crash.id],
  );
  const crashDone = await ready(crash.id);
  assert.equal(crashDone.status, "REVIEW_REQUIRED");
  passed.push("orphaned SQL outbox row is recovered by reconciliation");
  await q.close();
  const exported = JSON.stringify({
    snapshot,
    done,
    settings: await api("settings"),
  });
  for (const secret of [
    process.env.ADMIN_PASSWORD,
    process.env.SESSION_SECRET,
    process.env.WORKER_TOKEN,
  ])
    assert.ok(secret && !exported.includes(secret));
  passed.push("secrets absent from representative APIs and report");
  await writeFile(
    "output/integration-results.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        passed,
        auditId: a.id,
        reportId: report.id,
        limitations: [
          "Actual SIGKILL/BullMQ stale-lock recovery is verified separately.",
          "No external live AI or website integrations.",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    `Integration passed: ${passed.length} checks. Report ${report.id}`,
  );
} finally {
  await db.end();
}
