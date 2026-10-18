# Verification record

## Public Vercel demo, 12 October 2026

The standalone `demo/` app is a static export with no backend routes or runtime secrets. It publishes only curated fictional fixture data, original desktop/mobile captures, and the previously finalized sample PDF. Visitor edits are tab-local; approved findings can be exported as JSON. The PDF is explicitly labeled as an unchanged historical sample.

Production deployment `dpl_HS1qHg4MABZQat4SwtCPiq8sn6dt` is live at https://auditcraft-ai.vercel.app. The complete browser suite passed against that production alias in a fresh anonymous browser context, including keyboard tab navigation. No Vercel login or protection bypass was used. The repository secret exact-value scan checked 115 repository candidate files and found none of the configured secrets; this is not a general secret scanner.

Executed locally: static production build, strict demo TypeScript check, repository TypeScript/lint checks, and all 35 existing unit tests passed. The browser check verified edits, approvals, rejections, evidence links and filters, JSON export content, reset, image loading, PDF bytes, absence of private/API paths, and no browser exceptions. All four tabs passed automated WCAG 2 A/AA checks and horizontal-overflow checks at 390, 768, and 1440 px. Contrast defects found in the first public build were fixed before final verification. These automated checks do not constitute a complete accessibility audit.

`npm run test:demo` tests the local static output; `DEMO_URL=https://auditcraft-ai.vercel.app npm run test:demo` tests the anonymous public deployment (PowerShell: set `$env:DEMO_URL` first). Records are saved in `output/public-demo-local-results.json` and `output/public-demo-results.json`; screenshots are in `output/screenshots/public-demo-*.png`. GitHub CI was extended to build and check the demo, but has not been executed remotely in this session. No GitHub repository was created or pushed as part of deployment.

The preceding statements describe the 12 October Vercel demo deployment at that point in time. On 19 October 2026, initial commit `3f7822205eb121df2d66724fcbf331b0196d9fed` was pushed to the public GitHub repository. GitHub's `AuditCraft verification` workflow and the dependency and Docker update workflows for that commit subsequently completed successfully. Later commits require fresh checks.

The original full-stack verification below is dated 9 October and was not repeated in full for this static demo deployment.

Run date: 9 October 2026, Africa/Cairo. Local Windows development plus the production-built Linux Docker stack. All results below are from executed commands, not inferred from compilation.

## Passed

| Area                            | Executed evidence                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/backend policy             | `npm test`: 35 passing tests covering IPv4/IPv6/reserved/encoded targets, credentials, ports, protocols, redirects/rebinding policy, no local bypass, strict explanation validation, numeric/guarantee rejection, scoring and HTML escaping                                                                 |
| Static quality                  | `npm run typecheck` and `npm run lint` pass                                                                                                                                                                                                                                                                 |
| Production build                | Host Next.js production build and Linux Docker production build pass                                                                                                                                                                                                                                        |
| Full stack                      | PostgreSQL, Redis, migration service, authenticated web app and dedicated worker started with Compose; migrations re-applied safely; fictional seed command rerun idempotently                                                                                                                              |
| API/database/worker integration | 23 checks pass on the host stack and again from inside the Docker web container: auth/CSRF, worker credential, idempotency, captures, evidence IDs, approvals, revisions/conflicts, immutable reports/evidence, outreach, PDF, rerun, cancel, retry, provider failure, outbox recovery and secret exclusion |
| Browser/frontend                | 11 workflow checks pass against the production Docker app: sign-in, new audit/timeline, finding review/approval, evidence filters/details, protected captures, report/PDF, outreach revision, mobile layouts, automation/failure list and settings; no browser JavaScript errors                            |
| Terminal failure                | Internal invalid-fixture fault reaches FAILED after exactly three attempts; prospect/audit preserved; sanitized error returned                                                                                                                                                                              |
| Active cancellation             | Cancel flag set during desktop capture; run ends CANCELLED before captures/findings are committed                                                                                                                                                                                                           |
| Real worker crash               | Worker container killed with SIGKILL during DESKTOP stage, then restarted. BullMQ recovered the expired lease. Same audit completed in two attempts, with four pages and 126 unique evidence records                                                                                                        |
| UI automated accessibility      | Dashboard tested with axe WCAG 2 A/AA and 2.1 AA tags: 18 passing rules, zero violations in that run. This is not an accessibility certification or a full manual review                                                                                                                                    |
| Sample PDF                      | Six A4 pages, five link annotations; every page rendered with Poppler and visually inspected. No clipping, overlap, or orphaned contact page in the final sample                                                                                                                                            |
| Dependencies                    | `npm audit --omit=dev`: zero known production advisories at the time of execution                                                                                                                                                                                                                           |
| Secrets                         | Repository candidate files scanned against the actual configured password/session/worker secrets; none found. `.env` and runtime artifacts are ignored. This exact-value check is not a comprehensive secret-scanning product                                                                               |
| Final targeted smoke            | Unauthenticated HTML/PDF/capture downloads rejected; seeded failure review and timeline work; mobile report iframe has no horizontal overflow; a manual evidence-linked finding can be added from mobile                                                                                                    |

Machine-readable records are in `output/integration-results.json`, `output/docker-integration-results.json`, `output/browser-results.json`, `output/recovery-results.json`, `output/crash-recovery.json`, `output/ui-accessibility.json`, `output/final-smoke.json` and `output/pdf-verification.json`. UI screenshots and the fictional sample report/PDF are also in `output/`.

## Tools actually exercised

Playwright 1.56.1 / Chromium 141; axe-core through `@axe-core/playwright`; AuditCraft deterministic DOM checks; browser PerformanceObserver FCP/LCP/CLS and observed long tasks; controlled response-header inspection; PostgreSQL 17; Redis 7; BullMQ 5.81.5; Next.js 16.4.0; Chromium PDF generation; Poppler rendering and pypdf structural inspection.

Only a **deterministic template provider** was exercised. No OpenAI, Ollama or other live model was called. No external website, third-party scraping service, email, CRM or payment integration was used or represented as working.

## Failures found and corrected

- Initial Playwright package versions produced conflicting types; pinned the shared `playwright-core` version.
- A TypeScript-transformed helper caused `__name is not defined` inside browser evaluation; changed the DOM evaluator to avoid that serialization issue. Repeated real captures and complete workflows pass afterward.
- Generated Next.js TypeScript configuration was not strict; enabled strict mode and reran builds.
- A host build encountered Windows EPERM; the build passed with appropriate filesystem permissions, and Linux container builds passed independently.
- Browser tests found ambiguous filter/textarea accessible labels; added explicit labels.
- Dashboard contrast checks found low-contrast secondary text; corrected it and reran axe with zero reported violations.
- The sample PDF initially had excessive page breaks and an orphaned contact line. Reworked pagination and visually inspected all six final pages.
- BullMQ's initial transitive uuid advisory was resolved by upgrading BullMQ; production dependency audit then returned zero advisories.
- Seeded failure records initially lacked limits; seed configuration and failure-state rendering were corrected.

## Not verified / intentionally unavailable

- Real public-site auditing. DNS/redirect tests exercise a policy helper, **not a production network transport**. Live Chromium egress, real robots fetching, external redirects and hostile website isolation are not implemented or verified.
- Lighthouse, Speed Index, standardized Lighthouse TBT, real-user field metrics, meaningful external transfer-size budgets, rendering-blocker analysis, oversized-image analysis, full focus/keyboard/overlap/journey checks, duplicate metadata across real pages and real cookie-policy assessment.
- External AI providers, semantic truth verification of arbitrary human prose, automatic prices, outbound email and third-party integrations.
- Firefox, Safari, real mobile hardware, manual assistive-technology review and tagged accessible PDF output.
- Multi-user authorization or deployment of the full-stack local service as a public service, distributed rate limiting, security review of hostile browser execution, backups/restoration, retention, load/performance testing and production operations. The separately hosted static portfolio demo is described in the dated section above.
- GitHub Actions configuration exists but was not executed on GitHub; no remote repository or deployment was created.

The tested result is a functional local fixture MVP. It is not production-ready and must not be presented as a validated live prospect-audit service. The original 9 October verification snapshot preceded GitHub publication. The initial public repository commit is documented above.

