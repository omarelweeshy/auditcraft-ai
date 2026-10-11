import { escapeHtml as h } from "./security";
import {
  score,
  type Evidence,
  type Finding,
  type Settings,
  type Capture,
} from "./model";
export const reportSections = [
  "Summary",
  "Score",
  "Strengths",
  "Findings",
  "Plan",
  "Services",
  "Methodology",
] as const;
export interface ReportSnapshot {
  id: string;
  version: number;
  createdAt: string;
  prospect: {
    businessName: string;
    website: string;
    industry: string;
    location: string;
    services: string[];
  };
  auditId: string;
  auditVersion: number;
  settings: Settings;
  summary: string;
  findings: Finding[];
  evidence: Evidence[];
  captures: Capture[];
  sections: string[];
  screenshot: string | null;
  score: ReturnType<typeof score>;
}
export function renderReport(
  s: ReportSnapshot,
  imageSource: (path: string) => string = (p) => `/api/artifacts/${p}`,
) {
  const sections: Record<string, string> = {
    Summary: `<section><p class="eyebrow">01 / EXECUTIVE SUMMARY</p><h2>A clearer path forward.</h2><p>${h(s.summary)}</p><p class="note">Fictional demonstration. Every observation refers to the controlled fixture, not a real business website.</p></section>`,
    Score: `<section><p class="eyebrow">02 / DIGITAL HEALTH</p><h2>${s.score.total ?? "—"}<small> / 100</small></h2><p>Deterministic communication score · ${Math.round(s.score.coverage * 100)}% category coverage</p><table><thead><tr><th>Category</th><th>Score</th><th>Calculation</th></tr></thead><tbody>${s.score.breakdown.map((c) => `<tr><td>${h(c.category)}</td><td>${c.score ?? "Not measured"}</td><td>${h(c.formula)}</td></tr>`).join("")}</tbody></table><p class="note">Deductions are capped at each category’s weight. Missing categories are excluded from the denominator and lower coverage. Scores are not certifications. See the evidence ledger for each deduction.</p></section>`,
    Strengths: `<section><p class="eyebrow">03 / WORKING WELL</p><h2>Keep what works.</h2><ul>${s.evidence
      .filter((e) => e.passed)
      .filter((e, i, a) => a.findIndex((x) => x.check === e.check) === i)
      .slice(0, 5)
      .map(
        (e) =>
          `<li><strong>${h(e.check)}</strong>: ${h(e.observed)} <span class="ref">${h(e.id.slice(0, 8))}</span></li>`,
      )
      .join("")}</ul></section>`,
    Findings: `<section class="major"><p class="eyebrow">04 / APPROVED FINDINGS</p><h2>Priorities, with proof.</h2>${s.findings
      .map(
        (f, i) =>
          `<article class="finding"><p class="eyebrow">${i + 1} / ${h(f.category)} · ${h(f.severity)} · ${Math.round(f.confidence * 100)}% confidence</p><h3>${h(f.title)}</h3><p>${h(f.explanation)}</p><p><strong>Why it matters.</strong> ${h(f.businessRelevance)}</p><p><strong>Recommendation.</strong> ${h(f.recommendation)}</p><p><strong>Effort:</strong> ${h(f.effort)}. Requires scoping; no price or delivery commitment.</p><p class="note">${f.aiGenerated ? "Template-assisted explanation, human approved" : "Manual reviewer interpretation, human approved"}${f.reviewerNotes ? ` · Reviewer: ${h(f.reviewerNotes)}` : ""}</p>${f.assumptions.map((a) => `<p class="note">Assumption: ${h(a)}</p>`).join("")}<div class="evidence">${f.evidenceIds
            .map((id) => {
              const e = s.evidence.find((e) => e.id === id)!;
              return `<p><span class="ref">${h(id.slice(0, 8))}</span> ${h(e.check)}: ${h(e.observed)}<br><a href="${h(e.pageUrl)}">${h(e.pageUrl)}</a><br>${h(e.tool)} ${h(e.toolVersion)} · ${h(e.timestamp)} · ${h(e.kind)} · deduction ${e.deduction}</p>`;
            })
            .join("")}</div></article>`,
      )
      .join("")}</section>`,
    Plan: `<section><p class="eyebrow">05 / IMPLEMENTATION PLAN</p><h2>Start small. Verify the change.</h2><ol><li><strong>Confirm.</strong> Review the approved observations against the live site with its owner; agree on scope and access.</li><li><strong>Improve.</strong> Address high-severity findings first, then group related work by page and service.</li><li><strong>Validate.</strong> Repeat measurements and conduct manual accessibility and mobile checks. Compare evidence under equivalent conditions.</li></ol><p>No implementation dates, prices or commercial outcomes are implied.</p></section>`,
    Services: `<section><p class="eyebrow">06 / PROPOSED SERVICES</p><h2>A focused engagement.</h2><ul>${s.prospect.services.map((x) => `<li>${h(x)}</li>`).join("")}</ul><h3>Suggested next step</h3><p>A short discovery conversation to confirm priorities, constraints and an appropriate scope.</p><p>${h(s.settings.displayName)} · <a href="mailto:${h(s.settings.email)}">${h(s.settings.email)}</a></p></section>`,
    Methodology: `<section class="major"><p class="eyebrow">07 / METHODOLOGY & LIMITATIONS</p><h2>Evidence before opinion.</h2><p>Captured ${s.captures.length} controlled public fixture pages with isolated Chromium, axe-core and deterministic DOM checks. Browser performance values are single-run, unthrottled local lab measurements, not real-user field data. Lighthouse, Speed Index and standardized Total Blocking Time were not measured.</p><p>Verified evidence records describe observed values. Deterministic scores use the saved weights. Template-assisted explanations and manual reviewer notes are interpretations. Heuristic checks and assumptions require manual verification. Automated checks cannot establish complete accessibility, security or usability.</p><p>${h(s.settings.disclaimer)}</p><p>Audit ${h(s.auditId)} · audit version ${s.auditVersion} · report version ${s.version}. Generated ${h(s.createdAt)}.</p><h3>Deduction ledger</h3><table><thead><tr><th>Evidence / check</th><th>Page</th><th>Deduction</th></tr></thead><tbody>${s.evidence
      .filter((e) => e.deduction > 0)
      .map(
        (e) =>
          `<tr><td><span class="ref">${h(e.id.slice(0, 8))}</span><br>${h(e.check)}</td><td>${h(new URL(e.pageUrl).pathname)}</td><td>${e.deduction} ${h(e.category)} points</td></tr>`,
      )
      .join("")}</tbody></table></section>`,
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${h(s.prospect.businessName)} - AuditCraft report ${s.version}</title><style>@page{size:A4;margin:18mm 17mm 20mm}*{box-sizing:border-box}body{font:12px/1.55 Arial,sans-serif;color:#243a35;background:white;margin:0}a{color:${h(s.settings.brandColor)};overflow-wrap:anywhere}h1,h2,h3{font-family:Georgia,serif;font-weight:400;line-height:1.15}h1{font-size:48px;margin:30px 0}h2{font-size:34px;margin:14px 0 24px}h3{font-size:23px}small{font:16px Arial}.eyebrow{font:10px Arial;letter-spacing:1.8px;text-transform:uppercase;color:${h(s.settings.brandColor)}}.cover{min-height:245mm;display:flex;flex-direction:column;justify-content:space-between;break-after:page}.brand{font-size:18px;font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:20px}.cover img{width:100%;max-height:94mm;object-fit:cover;object-position:top;border:1px solid #ddd;margin:16px 0}.cover .label{background:#eff3ee;padding:9px 15px;display:inline-block}.cover-bottom{border-top:1px solid #bbb;padding-top:20px;display:flex;justify-content:space-between}.note{font-size:10px;color:#58665f}section{margin-top:28px;break-before:auto}section.major{break-before:page}article{margin:24px 0;border-top:1px solid #c9d3cd;padding-top:18px;break-inside:avoid}table{border-collapse:collapse;width:100%;font-size:10px}th,td{padding:9px 8px;text-align:left;border-bottom:1px solid #d9dfda;vertical-align:top}tr{break-inside:avoid}thead{display:table-header-group}li{padding:7px 0}.evidence{background:#f1f4ef;padding:8px 14px;font-size:10px;overflow-wrap:anywhere}.ref{font:9px monospace;color:#526b5a}p{overflow-wrap:anywhere}@media screen{body{max-width:850px;margin:30px auto;padding:45px;box-shadow:0 5px 60px #ddd}section{margin:60px 0}.cover{min-height:850px}}@media screen and (max-width:600px){body{padding:20px;margin:0;box-shadow:none}h1{font-size:28px;overflow-wrap:anywhere}h2{font-size:26px}.cover{min-height:720px}.brand{font-size:15px}th,td{padding:6px;font-size:9px}}@media print{.cover{height:245mm}h2,h3{break-after:avoid}}</style></head><body><div class="cover"><div class="brand">${h(s.settings.businessName)} <span class="eyebrow"> / DIGITAL ADVISORY</span></div><div><p class="eyebrow">WEBSITE AUDIT & PROPOSAL · FICTIONAL DEMO</p><h1>Small improvements.<br>Stronger foundations.</h1><p style="font-size:20px">Prepared for ${h(s.prospect.businessName)}</p><a href="${h(s.prospect.website)}">${h(s.prospect.website)}</a>${s.screenshot ? `<img src="${h(imageSource(s.screenshot))}" alt="Captured desktop view of the fictional website">` : ""}<p class="label">Evidence-led. Human-reviewed.</p></div><div class="cover-bottom"><span>${h(s.settings.displayName)}<br>${h(s.createdAt.slice(0, 10))}</span><span>REPORT ${String(s.version).padStart(2, "0")}<br>${s.findings.length} approved findings</span></div></div>${s.sections.map((k) => sections[k] ?? "").join("")}</body></html>`;
}
export function outreachDraft(s: ReportSnapshot) {
  const refs = s.findings.slice(0, 2);
  return {
    subject: `Website observations for ${s.prospect.businessName}`,
    message: `Hello${s.prospect.businessName ? ` ${s.prospect.businessName} team` : ""},\n\nI prepared a short review of your website. The captured pages showed ${refs
      .map((f) =>
        s.evidence
          .filter((e) => f.evidenceIds.includes(e.id))
          .slice(0, 1)
          .map((e) => `${e.check.toLowerCase()}: ${e.observed}`)
          .join(""),
      )
      .join(
        "; ",
      )}.\n\nThese observations may be useful when prioritizing website improvements. The attached report explains the evidence and proposes a focused review of ${s.prospect.services.join(", ") || "the approved findings"}.\n\nWould a short conversation to confirm the priorities be useful?\n\n${s.settings.displayName}\n${s.settings.businessName}\n${s.settings.email}`,
    findingIds: refs.map((f) => f.id),
    approval: "DRAFT",
    fictional: true,
  };
}
