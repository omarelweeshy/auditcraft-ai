import { Worker, UnrecoverableError } from "bullmq";
import { createServer } from "node:http";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { readFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { db, transaction } from "../../../packages/database/src/index";
import { auditQueue, connection } from "../../../packages/core/src/queue";
import {
  MockProvider,
  validateGenerated,
} from "../../../packages/core/src/provider";
import {
  SafeError,
  safeFailure,
  fixtureUrl,
  assertNoLocalBypass,
} from "../../../packages/core/src/security";
import { type ReportSnapshot } from "../../../packages/core/src/report";
import { analyze, artifactRoot } from "./analyze";
assertNoLocalBypass(process.env);
if (!process.env.WORKER_TOKEN || process.env.WORKER_TOKEN.length < 32)
  throw new Error("WORKER_TOKEN must contain at least 32 characters");
const queue = auditQueue();
const workerId = `worker-${process.pid}`;
async function cancelled(id: string) {
  const row = (await db.query("SELECT cancelled FROM audits WHERE id=$1", [id]))
    .rows[0];
  if (!row || row.cancelled)
    throw new SafeError("CANCELLED", "Audit cancelled by the reviewer.");
}
async function stage(id: string, s: string, message: string) {
  await cancelled(id);
  await db.query("UPDATE audits SET stage=$2,heartbeat_at=now() WHERE id=$1", [
    id,
    s,
  ]);
  await db.query(
    "INSERT INTO events(audit_id,stage,message) VALUES($1,$2,$3)",
    [id, s, message],
  );
}
async function pdf(reportId: string) {
  const r = (
    await db.query(
      "SELECT r.snapshot,r.html,a.status FROM reports r JOIN artifacts a ON a.report_id=r.id WHERE r.id=$1",
      [reportId],
    )
  ).rows[0];
  if (!r || r.status === "READY") return;
  await db.query(
    "UPDATE artifacts SET status='PROCESSING',error=NULL WHERE report_id=$1",
    [reportId],
  );
  const snapshot = r.snapshot as ReportSnapshot;
  let image = "";
  if (snapshot.screenshot) {
    const file = path.resolve(artifactRoot(), snapshot.screenshot);
    if (!file.startsWith(artifactRoot() + path.sep))
      throw new SafeError("INVALID_ARTIFACT");
    image =
      "data:image/png;base64," + (await readFile(file)).toString("base64");
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    await context.route("**/*", (r) => r.abort());
    await context.routeWebSocket("**/*", (ws) => ws.close());
    const page = await context.newPage();
    await page.setContent(
      r.html.replaceAll(
        snapshot.screenshot
          ? "/api/artifacts/" + snapshot.screenshot
          : "__NO_SCREENSHOT__",
        image,
      ),
      { waitUntil: "load" },
    );
    await page.evaluate(() => document.fonts.ready);
    const dir = path.join(artifactRoot(), "reports");
    await mkdir(dir, { recursive: true });
    const output = path.join(dir, `${reportId}.pdf`);
    await page.pdf({
      path: output + ".tmp",
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="font-size:8px;width:100%;margin:0 17mm;color:#657069;display:flex;justify-content:space-between"><span>AuditCraft · Fictional demo · Report ${snapshot.version}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: "18mm", bottom: "20mm", left: "17mm", right: "17mm" },
      preferCSSPageSize: true,
    });
    await rename(output + ".tmp", output);
    await db.query(
      "UPDATE artifacts SET status='READY',path=$2,error=NULL WHERE report_id=$1",
      [reportId, `reports/${reportId}.pdf`],
    );
    await db.query(
      "UPDATE prospects SET status='PROPOSAL_READY' WHERE id=(SELECT prospect_id FROM audits WHERE id=$1)",
      [snapshot.auditId],
    );
  } finally {
    await browser.close();
  }
}
const worker = new Worker(
  "auditcraft",
  async (job) => {
    if (job.name === "pdf") {
      try {
        await pdf(job.data.reportId);
      } catch (e) {
        await db.query(
          "UPDATE artifacts SET status=$2,error=$3 WHERE report_id=$1",
          [
            job.data.reportId,
            job.attemptsMade + 1 >= 3 ? "FAILED" : "QUEUED",
            safeFailure(e),
          ],
        );
        throw new Error("PDF_PROCESSING_FAILED");
      }
      return;
    }
    const id = job.data.auditId as string;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    try {
      await cancelled(id);
      const run = (await db.query("SELECT * FROM audits WHERE id=$1", [id]))
        .rows[0];
      if (["COMPLETE", "REVIEW_REQUIRED"].includes(run.status)) return;
      await db.query(
        "UPDATE audits SET status='VALIDATING',attempts=attempts+1,started_at=COALESCE(started_at,now()),heartbeat_at=now(),error=NULL WHERE id=$1",
        [id],
      );
      heartbeat = setInterval(
        () =>
          void db
            .query("UPDATE audits SET heartbeat_at=now() WHERE id=$1", [id])
            .catch(() => {}),
        3000,
      );
      const input = run.config.input;
      fixtureUrl(input.website);
      await stage(
        id,
        "VALIDATING",
        "Fixture origin validated. Browser network is isolated.",
      );
      if (input.simulateFailure && run.attempts === 0)
        throw new SafeError(
          "SIMULATED_TIMEOUT",
          "Controlled first-attempt failure. A bounded retry will follow.",
        );
      let evidence = (
        await db.query("SELECT data FROM evidence WHERE audit_id=$1", [id])
      ).rows.map((r) => r.data);
      if (!evidence.length) {
        await db.query("UPDATE audits SET status='CAPTURING' WHERE id=$1", [
          id,
        ]);
        const result = await analyze(
          id,
          input.depth,
          run.config.limits,
          (s, m) => stage(id, s, m),
          () => cancelled(id),
        );
        await cancelled(id);
        await stage(
          id,
          "NORMALIZING",
          `Collected ${result.evidence.length} observations across ${result.captures.length} pages; ${result.requests} controlled requests.`,
        );
        await transaction(async (c) => {
          await c.query("SELECT id FROM audits WHERE id=$1 FOR UPDATE", [id]);
          if (
            (await c.query("SELECT cancelled FROM audits WHERE id=$1", [id]))
              .rows[0].cancelled
          )
            throw new SafeError("CANCELLED");
          for (const e of result.evidence)
            await c.query(
              "INSERT INTO evidence(id,audit_id,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
              [e.id, id, e],
            );
          for (const capture of result.captures)
            await c.query(
              "INSERT INTO captures(id,audit_id,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
              [capture.id, id, capture],
            );
        });
        evidence = result.evidence;
      }
      await stage(id, "AI", "Preparing evidence-linked template explanations.");
      await db.query(
        "UPDATE audits SET status='GENERATING_FINDINGS' WHERE id=$1",
        [id],
      );
      try {
        if (input.simulateAiFailure) throw new SafeError("PROVIDER_FAILED");
        const provider = new MockProvider();
        const candidates = await provider.generate({
          evidence,
          pages: [],
          prospect: input,
          services: input.services,
        });
        const valid = candidates.map((f) => validateGenerated(f, evidence));
        await transaction(async (c) => {
          await c.query("SELECT id FROM audits WHERE id=$1 FOR UPDATE", [id]);
          if (
            !(await c.query("SELECT id FROM findings WHERE audit_id=$1", [id]))
              .rowCount
          )
            for (const f of valid)
              await c.query(
                "INSERT INTO findings(id,audit_id,data) VALUES($1,$2,$3)",
                [randomUUID(), id, f],
              );
        });
      } catch {
        await db.query(
          "INSERT INTO events(audit_id,stage,message) VALUES($1,'AI','Explanation unavailable or rejected. Deterministic evidence is preserved for manual findings.')",
          [id],
        );
      }
      await cancelled(id);
      await transaction(async (c) => {
        await c.query("SELECT id FROM audits WHERE id=$1 FOR UPDATE", [id]);
        const row = (
          await c.query("SELECT cancelled FROM audits WHERE id=$1", [id])
        ).rows[0];
        if (row.cancelled) throw new SafeError("CANCELLED");
        await c.query(
          "UPDATE audits SET status='REVIEW_REQUIRED',stage='REVIEW',completed_at=now() WHERE id=$1",
          [id],
        );
        await c.query(
          "UPDATE prospects SET status='REVIEW_REQUIRED' WHERE id=$1",
          [run.prospect_id],
        );
        await c.query(
          "INSERT INTO events(audit_id,stage,message) VALUES($1,'REVIEW','Evidence ready. Human approval is required before report generation.')",
          [id],
        );
      });
    } catch (e) {
      const error = safeFailure(e);
      const cancel = error.code === "CANCELLED";
      const final = cancel || job.attemptsMade + 1 >= 3;
      await db.query(
        "UPDATE audits SET status=$2,error=$3,completed_at=CASE WHEN $4 THEN now() ELSE NULL END WHERE id=$1",
        [id, cancel ? "CANCELLED" : final ? "FAILED" : "QUEUED", error, final],
      );
      await db.query(
        "INSERT INTO events(audit_id,stage,message) VALUES($1,'FAILURE',$2)",
        [id, error.message],
      );
      if (cancel) throw new UnrecoverableError("CANCELLED");
      throw new Error(error.code);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  },
  {
    connection: connection(),
    concurrency: 1,
    lockDuration: 30000,
    maxStalledCount: 2,
    stalledInterval: 15000,
  },
);
worker.on("error", () =>
  console.error("Worker connection error; reconnecting."),
);
let reconciling = false;
async function reconcile() {
  if (reconciling) return;
  reconciling = true;
  try {
    await db.query(
      "INSERT INTO workers(id) VALUES($1) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()",
      [workerId],
    );
    const runs = (
      await db.query(
        "SELECT id,status,attempts,heartbeat_at FROM audits WHERE cancelled=false AND status NOT IN ('FAILED','CANCELLED','COMPLETE','REVIEW_REQUIRED')",
      )
    ).rows;
    for (const r of runs) {
      const job = await queue.getJob(r.id);
      if (!job) {
        if (r.attempts >= 3) {
          await db.query(
            "UPDATE audits SET status='FAILED',error=$2,completed_at=now() WHERE id=$1",
            [
              r.id,
              {
                code: "ATTEMPTS_EXHAUSTED",
                message: "Maximum attempts reached. Start a versioned retry.",
              },
            ],
          );
          continue;
        }
        await queue.add(
          "audit",
          { auditId: r.id },
          { jobId: r.id, attempts: 3 - r.attempts },
        );
      } else if ((await job.getState()) === "failed") {
        await db.query(
          "UPDATE audits SET status='FAILED',completed_at=now(),error=$2 WHERE id=$1",
          [
            r.id,
            {
              code: "WORKER_LEASE_EXHAUSTED",
              message:
                "Worker lease recovery stopped after bounded retries. Start a versioned retry.",
            },
          ],
        );
      }
    }
    for (const r of (
      await db.query(
        "SELECT report_id FROM artifacts WHERE status IN ('QUEUED','PROCESSING')",
      )
    ).rows) {
      const id = `pdf-${r.report_id}`;
      const job = await queue.getJob(id);
      if (!job)
        await queue.add("pdf", { reportId: r.report_id }, { jobId: id });
      else if ((await job.getState()) === "failed")
        await db.query(
          "UPDATE artifacts SET status='FAILED',error=$2 WHERE report_id=$1",
          [
            r.report_id,
            {
              code: "PDF_FAILED",
              message: "PDF failed after bounded attempts.",
            },
          ],
        );
    }
  } catch {
    console.error("Reconciliation temporarily unavailable.");
  } finally {
    reconciling = false;
  }
}
await reconcile();
const interval = setInterval(() => void reconcile(), 4000);
const server = createServer((req, res) => {
  const provided = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${process.env.WORKER_TOKEN}`);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    res.writeHead(401);
    return res.end("Unauthorized");
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "online", worker: workerId }));
}).listen(3101, "0.0.0.0");
console.log("AuditCraft worker ready. Fixture-only network policy active.");
async function stop() {
  clearInterval(interval);
  server.close();
  await worker.close();
  await queue.close();
  await db.end();
  process.exit(0);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
