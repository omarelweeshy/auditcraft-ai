# Engineering case study

## Problem

Freelance proposal preparation often mixes repetitive screenshots and technical checks with unsupported claims. An attractive report is not useful if its conclusions cannot be traced to evidence or if a model fabricates business impact.

## Approach

AuditCraft separates capture, evidence, scoring, explanation, review and publication. The creative center is a split workspace joining a screenshot and source observation to editable proposal language. A reviewer must explicitly approve the text that reaches a report.

PostgreSQL owns durable state and immutable history. BullMQ coordinates browser work. A SQL outbox closes the enqueue gap and stable job IDs prevent duplicate execution from creating duplicate audit identities. Evidence persists independently from explanation success. Snapshots prevent report changes when source review evolves.

## Tradeoffs

The first release prioritizes a fully executable controlled fixture over an unverified internet scanner. URL filtering does not control Chromium DNS resolution, so live scanning stays disabled. The template provider exposes the AI boundary without pretending that free-form facts can be verified by syntax alone. Local performance metrics are labeled precisely rather than called Lighthouse or real-user data.

Raw SQL keeps ownership and transaction boundaries visible. JSONB snapshots simplify historical reproducibility. A single administrator and local Docker stack avoid premature SaaS features. The cost is a local-only operational model, limited metrics and no live third-party integrations.

## Truthful portfolio description

“I built AuditCraft AI to automate the repetitive technical work behind prospect research and proposal preparation. It collects measurable website evidence, converts it into reviewable findings, and produces a human-approved report and proposal. AI explains evidence but cannot invent or approve findings.”

Current implementation uses deterministic explanation templates and a fictional website. It does not establish paid client delivery, revenue, conversion or ranking improvements, certification or production readiness. See the verification record for executed tests and remaining work.
