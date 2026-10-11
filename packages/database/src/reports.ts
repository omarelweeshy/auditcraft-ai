import { randomUUID } from "node:crypto";
import { transaction, settings } from "./index";
import { SafeError } from "../../core/src/security";
import { score, type Evidence, type Finding } from "../../core/src/model";
import {
  renderReport,
  outreachDraft,
  type ReportSnapshot,
  reportSections,
} from "../../core/src/report";
export async function finalizeReport(
  auditId: string,
  input: {
    summary: string;
    findingIds: string[];
    sections: string[];
    screenshot: string | null;
  },
) {
  return transaction(async (c) => {
    const a = (
      await c.query("SELECT * FROM audits WHERE id=$1 FOR UPDATE", [auditId])
    ).rows[0];
    if (!a || !["REVIEW_REQUIRED", "COMPLETE"].includes(a.status))
      throw new SafeError("NOT_READY");
    const prospect = (
      await c.query("SELECT data FROM prospects WHERE id=$1", [a.prospect_id])
    ).rows[0].data;
    const all = (
      await c.query("SELECT * FROM findings WHERE audit_id=$1", [auditId])
    ).rows;
    const selected = all.filter((r) => input.findingIds.includes(r.id));
    if (
      !selected.length ||
      selected.length !== new Set(input.findingIds).size ||
      selected.some((r) => r.approval !== "APPROVED")
    )
      throw new SafeError(
        "APPROVAL_REQUIRED",
        "Select at least one approved finding.",
      );
    const findings: Finding[] = selected
      .map((r) => ({
        ...r.data,
        id: r.id,
        auditId,
        approval: r.approval,
        revision: r.revision,
      }))
      .sort((a, b) => a.order - b.order);
    const evidence: Evidence[] = (
      await c.query("SELECT data FROM evidence WHERE audit_id=$1", [auditId])
    ).rows.map((r) => r.data);
    if (
      findings.some((f) =>
        f.evidenceIds.some((id) => !evidence.some((e) => e.id === id)),
      )
    )
      throw new SafeError("UNSUPPORTED_EVIDENCE");
    const captures = (
      await c.query("SELECT data FROM captures WHERE audit_id=$1", [auditId])
    ).rows.map((r) => r.data);
    if (
      input.screenshot &&
      !captures.some((c) =>
        Object.values(c.screenshots).includes(input.screenshot),
      )
    )
      throw new SafeError("INVALID_ARTIFACT");
    if (
      input.sections.length !== reportSections.length ||
      new Set(input.sections).size !== reportSections.length ||
      input.sections.some(
        (k) => !reportSections.includes(k as (typeof reportSections)[number]),
      )
    )
      throw new SafeError("SECTIONS");
    const version = Number(
      (
        await c.query(
          "SELECT COALESCE(MAX(version),0)+1 AS n FROM reports WHERE audit_id=$1",
          [auditId],
        )
      ).rows[0].n,
    );
    const id = randomUUID();
    const snapshot: ReportSnapshot = {
      id,
      version,
      createdAt: new Date().toISOString(),
      prospect,
      auditId,
      auditVersion: a.version,
      settings: { ...(await settings()), weights: a.config.weights },
      summary: input.summary,
      findings,
      evidence,
      captures,
      sections: input.sections,
      screenshot: input.screenshot,
      score: score(evidence, a.config.weights),
    };
    const html = renderReport(snapshot);
    await c.query(
      "INSERT INTO reports(id,audit_id,version,snapshot,html) VALUES($1,$2,$3,$4,$5)",
      [id, auditId, version, snapshot, html],
    );
    await c.query("INSERT INTO artifacts(id,report_id) VALUES($1,$2)", [
      randomUUID(),
      id,
    ]);
    await c.query(
      "INSERT INTO outreach(id,report_id,revision,data) VALUES($1,$2,1,$3)",
      [randomUUID(), id, outreachDraft(snapshot)],
    );
    await c.query("UPDATE audits SET status='COMPLETE' WHERE id=$1", [auditId]);
    await c.query(
      "UPDATE prospects SET status='REPORT_READY',updated_at=now() WHERE id=$1",
      [a.prospect_id],
    );
    await c.query(
      "INSERT INTO events(audit_id,stage,message) VALUES($1,'REPORT','Immutable report finalized; PDF queued.')",
      [auditId],
    );
    return { id, version };
  });
}
