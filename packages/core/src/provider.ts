import { findingInput, type Evidence, type FindingInput } from "./model";
import { SafeError } from "./security";
export interface ProviderContext {
  evidence: Evidence[];
  pages: { title: string; url: string }[];
  prospect: { businessName: string; industry: string; notes: string };
  services: string[];
}
export interface ExplanationProvider {
  name: string;
  generate(context: ProviderContext): Promise<unknown[]>;
}
export function explain(e: Evidence, order = 0): FindingInput {
  return {
    title: e.check,
    category: e.category,
    severity: e.severity,
    confidence: e.confidence,
    explanation: `The captured page returned: ${e.observed}. The check expects: ${e.expected}.`,
    businessRelevance:
      e.category === "Accessibility"
        ? "This may create barriers for people using assistive technology. Confirm the impact through manual testing."
        : e.category === "Security headers"
          ? "Response configuration can affect browser protections. A missing header does not demonstrate compromise."
          : "This is an opportunity to improve the clarity, usability or delivery of the inspected page. Business impact requires separate validation.",
    recommendation: `Review ${e.check.toLowerCase()} on the referenced page. ${e.expected}. Re-test after implementation.`,
    effort: "Needs scoping",
    evidenceIds: [e.id],
    assumptions: [
      "Implementation effort depends on access to the website and its underlying platform.",
    ],
    aiGenerated: true,
    reviewerNotes: "",
    order,
  };
}
export class MockProvider implements ExplanationProvider {
  name = "Deterministic template provider";
  async generate(c: ProviderContext) {
    return c.evidence.filter((e) => !e.passed).map(explain);
  }
}
export function validateGenerated(
  raw: unknown,
  evidence: Evidence[],
): FindingInput {
  const f = findingInput.parse(raw);
  const refs = f.evidenceIds.map((id) => evidence.find((e) => e.id === id));
  if (refs.some((e) => !e) || !refs.length)
    throw new SafeError("UNSUPPORTED_EVIDENCE");
  // Fail closed: only exact check-specific templates accepted. External free-form AI is not yet supported.
  const expected = explain(refs[0]!, f.order);
  if (
    f.evidenceIds.length !== 1 ||
    JSON.stringify({ ...f, order: 0 }) !==
      JSON.stringify({ ...expected, order: 0 })
  )
    throw new SafeError("UNSUPPORTED_CLAIM");
  return f;
}
export function validateReviewed(f: FindingInput, evidence: Evidence[]) {
  if (f.evidenceIds.some((id) => !evidence.some((e) => e.id === id)))
    throw new SafeError("UNSUPPORTED_EVIDENCE");
  const text = [
    f.title,
    f.explanation,
    f.businessRelevance,
    f.recommendation,
  ].join(" ");
  if (
    /guarantee[ds]?|certified|legally compliant|will (increase|improve|boost)|revenue (increase|growth)|competitor/i.test(
      text,
    )
  )
    throw new SafeError(
      "UNSUPPORTED_CLAIM",
      "Remove guarantees, certification or unsupported commercial claims.",
    );
  const supported = f.evidenceIds
    .map((id) => evidence.find((e) => e.id === id)!)
    .map((e) => e.observed + " " + e.expected)
    .join(" ");
  for (const n of text.match(/\b\d+(?:\.\d+)?%?/g) ?? [])
    if (!supported.includes(n))
      throw new SafeError(
        "UNSUPPORTED_NUMBER",
        "Numeric claims must appear in the referenced evidence.",
      );
}
