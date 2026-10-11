import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { session, validOrigin, login, cookie, equal } from "../../../lib/auth";
import {
  db,
  transaction,
  settings,
  createAudit,
  loadAudit,
  editFinding,
} from "../../../../../packages/database/src/index";
import { finalizeReport } from "../../../../../packages/database/src/reports";
import {
  prospectInput,
  settingsInput,
  findingInput,
  score,
  type FindingInput,
} from "../../../../../packages/core/src/model";
import {
  SafeError,
  safeFailure,
  fixtureUrl,
} from "../../../../../packages/core/src/security";
import { validateReviewed } from "../../../../../packages/core/src/provider";
import { artifactsRoot } from "../../../../../packages/core/src/paths";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = z.uuid();
async function body(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new SafeError("EMPTY_BODY");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 64000) {
      await reader.cancel();
      throw new SafeError("BODY_LIMIT");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function handle(
  req: Request,
  { params }: { params: Promise<{ route: string[] }> },
) {
  try {
    const { route } = await params;
    const [resource, id, action] = route;
    const method = req.method;
    if (resource === "login" && method === "POST") {
      if (!validOrigin(req))
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
      const input = z
        .object({ password: z.string().max(200) })
        .parse(await body(req));
      const token = await login(input.password);
      if (!token)
        return NextResponse.json(
          { error: "Sign-in failed or temporarily rate limited." },
          { status: 401 },
        );
      return NextResponse.json(
        { ok: true },
        { headers: { "Set-Cookie": cookie(token) } },
      );
    }
    const auth = session(req);
    if (!auth)
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (
      method !== "GET" &&
      (!validOrigin(req) ||
        !equal(req.headers.get("x-csrf-token") ?? "", auth.csrf))
    )
      return NextResponse.json(
        { error: "Invalid request token or origin." },
        { status: 403 },
      );
    if (resource === "session")
      return NextResponse.json({
        csrf: auth.csrf,
        provider: {
          name: "Deterministic template provider",
          status: "Ready; no API key required",
          live: false,
        },
      });
    if (resource === "logout" && method === "POST")
      return NextResponse.json(
        { ok: true },
        { headers: { "Set-Cookie": cookie("") } },
      );
    if (resource === "settings") {
      if (method === "GET") return NextResponse.json(await settings());
      if (method === "PUT") {
        const value = settingsInput.parse(await body(req));
        await db.query("UPDATE settings SET data=$1 WHERE id=1", [value]);
        return NextResponse.json({ ok: true });
      }
    }
    if (resource === "dashboard" && method === "GET") {
      const [audits, prospects, workers, stats, common] = await Promise.all([
        db.query(
          "SELECT a.id,a.prospect_id,a.status,a.stage,a.version,a.attempts,a.error,a.created_at,a.started_at,a.completed_at,p.data AS prospect,(SELECT count(*) FROM findings f WHERE f.audit_id=a.id AND f.approval='PENDING') AS pending FROM audits a JOIN prospects p ON p.id=a.prospect_id ORDER BY a.created_at DESC LIMIT 100",
        ),
        db.query(
          "SELECT id,status,data,created_at FROM prospects ORDER BY created_at DESC",
        ),
        db.query(
          "SELECT id,heartbeat_at,heartbeat_at>now()-interval '20 seconds' AS online FROM workers ORDER BY heartbeat_at DESC LIMIT 1",
        ),
        db.query(
          "SELECT (SELECT count(*) FROM reports) AS reports,(SELECT avg(extract(epoch from (completed_at-started_at))) FROM audits WHERE completed_at IS NOT NULL AND status IN ('COMPLETE','REVIEW_REQUIRED')) AS duration",
        ),
        db.query(
          "SELECT data->>'category' AS category,count(*)::int AS count FROM findings GROUP BY data->>'category' ORDER BY count(*) DESC",
        ),
      ]);
      return NextResponse.json({
        audits: audits.rows,
        prospects: prospects.rows,
        worker: workers.rows[0] ?? null,
        stats: stats.rows[0],
        common: common.rows,
      });
    }
    if (resource === "audits") {
      if (method === "POST" && !id) {
        const input = prospectInput.parse(await body(req));
        fixtureUrl(input.website);
        const key = z
          .string()
          .min(8)
          .max(100)
          .parse(req.headers.get("idempotency-key"));
        return NextResponse.json(await createAudit(input, key), {
          status: 201,
        });
      }
      if (id) {
        uuid.parse(id);
        if (method === "GET") {
          const a = await loadAudit(id);
          return NextResponse.json({
            ...a,
            score: score(a.evidence, a.config.weights),
          });
        }
        if (method === "POST" && action === "cancel") {
          await transaction(async (c) => {
            await c.query("SELECT id FROM audits WHERE id=$1 FOR UPDATE", [id]);
            await c.query(
              "UPDATE audits SET cancelled=true,status='CANCELLED',completed_at=now() WHERE id=$1 AND status NOT IN ('COMPLETE','REVIEW_REQUIRED','FAILED','CANCELLED')",
              [id],
            );
            await c.query(
              "INSERT INTO events(audit_id,stage,message) VALUES($1,'CANCELLED','Cancellation requested by reviewer.')",
              [id],
            );
          });
          return NextResponse.json({ ok: true });
        }
        if (method === "POST" && (action === "retry" || action === "rerun")) {
          const a = await loadAudit(id);
          const input = { ...a.config.input, simulateFailure: false };
          const key = z
            .string()
            .min(8)
            .max(100)
            .parse(req.headers.get("idempotency-key"));
          return NextResponse.json(
            await createAudit(input, key, a.prospect_id),
            { status: 201 },
          );
        }
        if (method === "POST" && action === "findings") {
          const f = findingInput.parse(await body(req));
          if (f.aiGenerated) throw new SafeError("MANUAL_ONLY");
          return NextResponse.json(
            await transaction(async (c) => {
              await c.query("SELECT id FROM audits WHERE id=$1 FOR UPDATE", [
                id,
              ]);
              const a = await loadAudit(id);
              if (!["REVIEW_REQUIRED", "COMPLETE"].includes(a.status))
                throw new SafeError("NOT_READY");
              validateReviewed(f, a.evidence);
              const findingId = randomUUID();
              await c.query(
                "INSERT INTO findings(id,audit_id,data) VALUES($1,$2,$3)",
                [findingId, id, f],
              );
              return { id: findingId };
            }),
          );
        }
        if (method === "POST" && action === "reports") {
          const input = z
            .object({
              summary: z.string().min(20).max(3000),
              findingIds: z.array(z.uuid()).min(1).max(100),
              sections: z.array(z.string()).max(10),
              screenshot: z.string().nullable(),
            })
            .parse(await body(req));
          if (
            /guarantee|certif|will (increase|boost|improve)/i.test(
              input.summary,
            )
          )
            throw new SafeError("UNSUPPORTED_CLAIM");
          return NextResponse.json(await finalizeReport(id, input), {
            status: 201,
          });
        }
      }
    }
    if (resource === "findings" && id) {
      uuid.parse(id);
      if (method === "GET" && action === "revisions")
        return NextResponse.json(
          (
            await db.query(
              "SELECT revision,data,approval,created_at FROM finding_revisions WHERE finding_id=$1 ORDER BY revision DESC",
              [id],
            )
          ).rows,
        );
      if (method === "PUT") {
        const input = z
          .object({
            finding: findingInput,
            approval: z.enum(["PENDING", "APPROVED", "REJECTED", "EDITED"]),
            revision: z.number().int().min(1),
          })
          .parse(await body(req));
        return NextResponse.json(
          await editFinding(
            id,
            input.finding as FindingInput,
            input.approval,
            input.revision,
          ),
        );
      }
    }
    if (resource === "prospects" && id && method === "PUT") {
      uuid.parse(id);
      const input = z
        .object({
          status: z.enum([
            "NEW",
            "AUDITING",
            "REVIEW_REQUIRED",
            "REPORT_READY",
            "PROPOSAL_READY",
            "CONTACTED",
            "WON",
            "LOST",
            "ARCHIVED",
          ]),
        })
        .parse(await body(req));
      await db.query(
        "UPDATE prospects SET status=$2,updated_at=now() WHERE id=$1",
        [id, input.status],
      );
      return NextResponse.json({ ok: true });
    }
    if (resource === "reports" && id) {
      uuid.parse(id);
      const report = (
        await db.query(
          "SELECT r.*,a.status AS pdf_status,a.path FROM reports r JOIN artifacts a ON a.report_id=r.id WHERE r.id=$1",
          [id],
        )
      ).rows[0];
      if (!report) throw new SafeError("NOT_FOUND");
      if (method === "GET" && action === "html")
        return new Response(report.html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy":
              "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
          },
        });
      if (method === "GET" && action === "pdf") {
        if (report.pdf_status !== "READY") throw new SafeError("PDF_NOT_READY");
        return artifact(report.path, true);
      }
      if (method === "GET" && action === "outreach")
        return NextResponse.json(
          (
            await db.query(
              "SELECT * FROM outreach WHERE report_id=$1 ORDER BY revision DESC",
              [id],
            )
          ).rows,
        );
      if (method === "POST" && action === "outreach") {
        const input = z
          .object({
            subject: z.string().min(3).max(200),
            message: z.string().min(10).max(5000),
            revision: z.number().int().min(1),
            exported: z.boolean().default(false),
          })
          .parse(await body(req));
        if (
          /guarantee|certif|will (increase|boost|improve)/i.test(input.message)
        )
          throw new SafeError("UNSUPPORTED_CLAIM");
        return NextResponse.json(
          await transaction(async (c) => {
            await c.query("SELECT id FROM reports WHERE id=$1 FOR SHARE", [id]);
            await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [id]);
            const latest = (
              await c.query(
                "SELECT * FROM outreach WHERE report_id=$1 ORDER BY revision DESC LIMIT 1",
                [id],
              )
            ).rows[0];
            if (latest.revision !== input.revision)
              throw new SafeError("REVISION_CONFLICT");
            const revision = latest.revision + 1;
            await c.query(
              "INSERT INTO outreach(id,report_id,revision,data,exported_at) VALUES($1,$2,$3,$4,$5)",
              [
                randomUUID(),
                id,
                revision,
                {
                  ...latest.data,
                  subject: input.subject,
                  message: input.message,
                  approval: "MANUAL_DRAFT",
                },
                input.exported ? new Date() : null,
              ],
            );
            return { revision };
          }),
        );
      }
      if (method === "GET")
        return NextResponse.json({
          id: report.id,
          snapshot: report.snapshot,
          pdf_status: report.pdf_status,
        });
    }
    if (resource === "artifacts" && method === "GET") {
      const relative = route.slice(1).join("/");
      if (
        !/^[a-f0-9-]{36}\/page-[1-4]-(desktop|mobile)(-fold)?\.png$/.test(
          relative,
        )
      )
        throw new SafeError("INVALID_ARTIFACT");
      return artifact(relative, false);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        {
          error: "Invalid input. Check the required fields and allowed values.",
        },
        { status: 400 },
      );
    const safe = safeFailure(error);
    return NextResponse.json(
      { error: safe.message, code: safe.code },
      {
        status:
          safe.code === "NOT_FOUND"
            ? 404
            : safe.code === "REVISION_CONFLICT"
              ? 409
              : error instanceof SafeError
                ? 400
                : 500,
      },
    );
  }
}
async function artifact(relative: string, pdf: boolean) {
  const root = artifactsRoot();
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep))
    throw new SafeError("INVALID_ARTIFACT");
  return new Response(await readFile(file), {
    headers: {
      "Content-Type": pdf ? "application/pdf" : "image/png",
      "Cache-Control": "private, no-store",
      ...(pdf
        ? {
            "Content-Disposition":
              'attachment; filename="auditcraft-proposal.pdf"',
          }
        : {}),
    },
  });
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
