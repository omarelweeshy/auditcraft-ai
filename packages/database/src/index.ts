import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import {
  defaultSettings,
  type Settings,
  type ProspectInput,
  type FindingInput,
  type Finding,
  type Evidence,
} from "../../core/src/model";
import { SafeError } from "../../core/src/security";
import { validateReviewed } from "../../core/src/provider";
import path from "node:path";
import { projectRoot } from "../../core/src/paths";
try {
  process.loadEnvFile(path.join(projectRoot(), ".env"));
} catch {
  /* Docker supplies environment. */
}
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
export async function transaction<T>(fn: (c: PoolClient) => Promise<T>) {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const v = await fn(c);
    await c.query("COMMIT");
    return v;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function settings(): Promise<Settings> {
  return (
    (await db.query("SELECT data FROM settings WHERE id=1")).rows[0]?.data ??
    defaultSettings
  );
}
export async function createAudit(
  input: ProspectInput,
  key: string,
  rerunId?: string,
) {
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
    const existing = (
      await c.query("SELECT * FROM audits WHERE idempotency_key=$1", [key])
    ).rows[0];
    if (existing) return existing;
    const config = await settings();
    const prospectId = rerunId ?? randomUUID();
    if (rerunId) {
      if (
        !(
          await c.query("SELECT id FROM prospects WHERE id=$1 FOR UPDATE", [
            rerunId,
          ])
        ).rowCount
      )
        throw new SafeError("NOT_FOUND");
    } else
      await c.query("INSERT INTO prospects(id,data) VALUES($1,$2)", [
        prospectId,
        { ...input, domain: new URL(input.website).hostname },
      ]);
    const version = Number(
      (
        await c.query(
          "SELECT COALESCE(MAX(version),0)+1 AS n FROM audits WHERE prospect_id=$1",
          [prospectId],
        )
      ).rows[0].n,
    );
    const id = randomUUID();
    const run = (
      await c.query(
        "INSERT INTO audits(id,prospect_id,idempotency_key,version,config) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [id, prospectId, key, version, { ...config, input }],
      )
    ).rows[0];
    await c.query(
      "UPDATE prospects SET status='AUDITING',updated_at=now() WHERE id=$1",
      [prospectId],
    );
    await c.query(
      "INSERT INTO events(audit_id,stage,message) VALUES($1,'QUEUED','Audit saved to the durable outbox.')",
      [id],
    );
    return run;
  });
}
export async function loadAudit(id: string) {
  const a = (
    await db.query(
      "SELECT a.*,p.data AS prospect,p.status AS prospect_status FROM audits a JOIN prospects p ON p.id=a.prospect_id WHERE a.id=$1",
      [id],
    )
  ).rows[0];
  if (!a) throw new SafeError("NOT_FOUND");
  const [e, f, c, r, t] = await Promise.all([
    db.query("SELECT data FROM evidence WHERE audit_id=$1 ORDER BY id", [id]),
    db.query(
      "SELECT id,audit_id,data,approval,revision FROM findings WHERE audit_id=$1 ORDER BY (data->>'order')::int,id",
      [id],
    ),
    db.query("SELECT data FROM captures WHERE audit_id=$1", [id]),
    db.query(
      "SELECT r.id,r.version,r.created_at,a.status AS pdf_status,a.error AS pdf_error FROM reports r LEFT JOIN artifacts a ON a.report_id=r.id WHERE r.audit_id=$1 ORDER BY r.version DESC",
      [id],
    ),
    db.query(
      "SELECT stage,message,created_at FROM events WHERE audit_id=$1 ORDER BY id",
      [id],
    ),
  ]);
  return {
    ...a,
    evidence: e.rows.map((r) => r.data) as Evidence[],
    findings: f.rows.map((r) => ({
      ...r.data,
      id: r.id,
      auditId: r.audit_id,
      approval: r.approval,
      revision: r.revision,
    })) as Finding[],
    captures: c.rows.map((r) => r.data),
    reports: r.rows,
    events: t.rows,
  };
}
export async function editFinding(
  id: string,
  input: FindingInput,
  approval: Finding["approval"],
  expectedRevision: number,
) {
  return transaction(async (c) => {
    const initial = (
      await c.query("SELECT audit_id FROM findings WHERE id=$1", [id])
    ).rows[0];
    if (!initial) throw new SafeError("NOT_FOUND");
    await c.query("SELECT id FROM audits WHERE id=$1 FOR UPDATE", [
      initial.audit_id,
    ]);
    const row = (
      await c.query("SELECT * FROM findings WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (row.revision !== expectedRevision)
      throw new SafeError(
        "REVISION_CONFLICT",
        "This finding changed. Reload before saving.",
      );
    const evidence = (
      await c.query("SELECT data FROM evidence WHERE audit_id=$1", [
        row.audit_id,
      ])
    ).rows.map((r) => r.data);
    validateReviewed(input, evidence);
    await c.query(
      "INSERT INTO finding_revisions(finding_id,revision,data,approval) VALUES($1,$2,$3,$4)",
      [id, row.revision, row.data, row.approval],
    );
    const edited = JSON.stringify(row.data) !== JSON.stringify(input);
    const finalApproval =
      edited && approval === "PENDING" ? "EDITED" : approval;
    await c.query(
      "UPDATE findings SET data=$2,approval=$3,revision=revision+1 WHERE id=$1",
      [id, input, finalApproval],
    );
    await c.query(
      "INSERT INTO events(audit_id,stage,message) VALUES($1,'REVIEW',$2)",
      [row.audit_id, `Finding revision saved (${finalApproval}).`],
    );
    return { revision: row.revision + 1 };
  });
}
