import { z } from "zod";
export const categories = [
  "Performance",
  "Accessibility",
  "SEO",
  "Mobile experience",
  "Technical quality",
  "Security headers",
] as const;
export type Category = (typeof categories)[number];
export const severity = z.enum(["info", "low", "medium", "high"]);
export type Severity = z.infer<typeof severity>;
export const weights: Record<Category, number> = {
  Performance: 25,
  Accessibility: 20,
  SEO: 20,
  "Mobile experience": 15,
  "Technical quality": 10,
  "Security headers": 10,
};
export interface Evidence {
  id: string;
  auditId: string;
  pageUrl: string;
  category: Category;
  check: string;
  observed: string;
  expected: string;
  severity: Severity;
  confidence: number;
  method: string;
  artifact?: string;
  tool: string;
  toolVersion: string;
  timestamp: string;
  passed: boolean;
  deduction: number;
  kind: "verified" | "heuristic";
}
export const findingInput = z
  .object({
    title: z.string().min(3).max(180),
    category: z.enum(categories),
    severity,
    confidence: z.number().min(0).max(1),
    explanation: z.string().min(5).max(2000),
    businessRelevance: z.string().min(5).max(1000),
    recommendation: z.string().min(5).max(2000),
    effort: z.enum(["Small", "Medium", "Large", "Needs scoping"]),
    evidenceIds: z.array(z.string().uuid()).min(1).max(50),
    assumptions: z.array(z.string().max(500)).max(10),
    aiGenerated: z.boolean(),
    reviewerNotes: z.string().max(2000).default(""),
    order: z.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type FindingInput = z.infer<typeof findingInput>;
export interface Finding extends FindingInput {
  id: string;
  auditId: string;
  approval: "PENDING" | "APPROVED" | "REJECTED" | "EDITED";
  revision: number;
}
export const settingsInput = z.object({
  displayName: z.string().min(1).max(100),
  businessName: z.string().min(1).max(100),
  email: z.string().email(),
  portfolioUrl: z.union([
    z.literal(""),
    z.url().refine((v) => /^https?:/.test(v)),
  ]),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  services: z.array(z.string().min(1).max(100)).min(1).max(20),
  disclaimer: z.string().min(20).max(2000),
  weights: z
    .object(
      Object.fromEntries(
        categories.map((c) => [c, z.number().min(0).max(100)]),
      ) as Record<Category, z.ZodNumber>,
    )
    .refine(
      (w) => Object.values(w).reduce((a, b) => a + b, 0) === 100,
      "Weights must total 100",
    ),
  limits: z.object({
    maxPages: z.number().int().min(1).max(4),
    maxRequests: z.number().int().min(10).max(100),
    timeoutMs: z.number().int().min(10000).max(120000),
  }),
});
export type Settings = z.infer<typeof settingsInput>;
export const defaultSettings: Settings = {
  displayName: "Independent consultant",
  businessName: "AuditCraft Studio",
  email: "hello@example.com",
  portfolioUrl: "",
  brandColor: "#255a4a",
  services: [
    "Website performance",
    "Accessible interfaces",
    "Website redesign",
    "Technical SEO",
  ],
  disclaimer:
    "This limited automated review describes observations from controlled lab captures. It is not a security assessment, accessibility certification or guarantee of commercial results. All demo companies and data are fictional.",
  weights,
  limits: { maxPages: 4, maxRequests: 60, timeoutMs: 60000 },
};
export const prospectInput = z.object({
  businessName: z.string().min(2).max(120),
  website: z.url().max(2000),
  industry: z.string().max(100),
  location: z.string().max(100),
  contactName: z.string().max(100).default(""),
  contactEmail: z.union([z.literal(""), z.email()]).default(""),
  notes: z.string().max(2000),
  services: z.array(z.string().max(100)).max(20),
  depth: z.number().int().min(1).max(4),
  responsibleUse: z.literal(true),
  mode: z.literal("fixture"),
  simulateFailure: z.boolean().default(false),
  simulateAiFailure: z.boolean().default(false),
});
export type ProspectInput = z.infer<typeof prospectInput>;
export const stages = [
  "VALIDATING",
  "ROBOTS",
  "DESKTOP",
  "MOBILE",
  "PERFORMANCE",
  "ACCESSIBILITY",
  "SEO",
  "HEADERS",
  "NORMALIZING",
  "AI",
  "REVIEW",
] as const;
export interface Capture {
  id: string;
  requestedUrl: string;
  finalUrl: string;
  status: number;
  title: string;
  contentType: string;
  responseSize: number;
  timestamp: string;
  redirects: string[];
  robots: string;
  warnings: string[];
  screenshots: Record<string, string>;
  viewports: {
    desktop: { width: number; height: number };
    mobile: { width: number; height: number };
  };
}
export function score(
  evidence: Evidence[],
  config: Record<Category, number> = weights,
) {
  const breakdown = categories.map((category) => {
    const rows = evidence.filter((e) => e.category === category);
    const deductions = rows
      .filter((e) => !e.passed && e.deduction > 0)
      .map((e) => ({ evidenceId: e.id, check: e.check, points: e.deduction }));
    const raw = deductions.reduce((s, e) => s + e.points, 0);
    const available = rows.length > 0;
    return {
      category,
      weight: config[category],
      available,
      score: available ? Math.max(0, 100 - raw) : null,
      earned: available
        ? (config[category] * Math.max(0, 100 - raw)) / 100
        : null,
      deductions,
      formula: `max(0, 100 - ${raw}) × ${config[category]} / 100`,
      confidence: rows.length
        ? rows.reduce((a, e) => a + e.confidence, 0) / rows.length
        : 0,
    };
  });
  const availableWeight = breakdown
    .filter((c) => c.available)
    .reduce((a, c) => a + c.weight, 0);
  return {
    total: availableWeight
      ? Math.round(
          (breakdown.reduce((a, c) => a + (c.earned ?? 0), 0) /
            availableWeight) *
            100,
        )
      : null,
    coverage: availableWeight / 100,
    breakdown,
  };
}
