# AuditCraft AI: project handover

**Purpose:** give a new developer or coding agent an accurate, runnable orientation to the project. Start here, then open the topic specific documents linked below.

**Last reconciled:** 19 October 2026

**Local project:** `D:\Projects\auditcraft-ai`

**GitHub:** [omarelweeshy/auditcraft-ai](https://github.com/omarelweeshy/auditcraft-ai)
**Public Vercel demo:** [auditcraft-ai.vercel.app](https://auditcraft-ai.vercel.app)

## Read this first

AuditCraft is a polished portfolio MVP with two related but separate parts:

1. A complete **local, single administrator web application**. It performs real browser measurements against an intentionally fictional, locally fulfilled fixture. It uses PostgreSQL, Redis/BullMQ, a persistent Playwright worker and local artifact storage.
2. A **public, static Vercel portfolio demo**. It shows a saved fictional audit and lets visitors review findings and export their review in their browser. It has no backend and does not initiate scans.

The system is intentionally fixture only. It does **not** scan arbitrary live websites, run a real language model, send email, or implement a multi-user hosted SaaS. The URL policy helper is not an enabled live scanner. Do not change this boundary as a routine feature addition: safe Chromium egress, DNS rebinding, redirects, robots enforcement and resource isolation must first be implemented and verified as a complete transport. Read [the threat model](docs/THREAT-MODEL.md), [responsible use](docs/RESPONSIBLE-USE.md), and [ADR 001](docs/ADR-001.md).

This is an independent portfolio project inspired by common freelance audit and proposal workflows. It is not commissioned client work. Use that description when writing public materials; do not claim real client results, business impact, security certification, WCAG conformance, revenue, or production readiness.

## Current repository and release state

- Public repository default branch: `main`.
- Last confirmed repository commit: `3f7822205eb121df2d66724fcbf331b0196d9fed` (`Build AuditCraft AI portfolio MVP and public demo`).
- Last GitHub API check, 19 October 2026: remote `main` matched this commit; `.env`, `data/`, `.vercel`, and `node_modules` paths were absent from the 140 entry repository tree. GitHub's `AuditCraft verification` workflow and three GitHub/Dependabot jobs all reported success. [Actions history](https://github.com/omarelweeshy/auditcraft-ai/actions).
- Vercel production hostname: `https://auditcraft-ai.vercel.app`. The Vercel deployment list was checked on 19 October: the newest production deployment from `demo/` was `https://auditcraft-gtq44bw0z-omarelweeshys-projects.vercel.app`, status Ready, about 7 days old. The deployment identifier recorded in [verification](docs/VERIFICATION.md) is `dpl_HS1qHg4MABZQat4SwtCPiq8sn6dt`. The public alias passed anonymous browser checks on 12 October. Check the alias itself again before sharing it; a Vercel deployment's Ready status alone does not verify the friendly domain.
- The demo deployment came from the Vercel CLI. A Git push should not be assumed to deploy it. For Git integration, configure Vercel's Root Directory as `demo`, then verify the new production alias after each deployment.
- The GitHub Actions workflow currently runs the existing root checks plus `npm ci --prefix demo`, the static demo build and `npm run test:demo`. CI success is evidence for that commit only; rerun checks after changing files.
- Local setup credentials in `.env` are ignored. The public demo itself needs no runtime credentials. Never copy the root `.env`, `data/`, `.vercel/`, database contents, or arbitrary generated output into the public demo.

## Product behavior

### Full local application

The end-to-end fictional workflow is: create a prospect and fixture audit, enqueue work, capture the controlled page at desktop and mobile sizes, normalize browser evidence, calculate a weighted lab score, review or edit proposed findings, approve/reject them, finalize an immutable report, generate a PDF, and export a revisioned outreach draft. Outreach is text only; no mail is sent.

The evidence comes from a controlled Playwright/Chromium fixture, axe-core accessibility checks, DOM metadata and structure checks, limited browser performance observations, and controlled response-header inspection. Scoring is the application's own weighted lab score; it is not Lighthouse, Speed Index, a field metric, or a security test. A deterministic template provider creates check-specific text, not LLM output. Approval always belongs to a human reviewer.

### Public static demo

The separately installable Next.js app under [`demo/`](demo/README.md) imports a curated frozen sample, static screenshots and a finalized six-page PDF. Visitors can inspect the evidence ledger and recordings, modify recommendations and reviewer notes, approve or reject findings, filter evidence, and download approved findings plus the sample evidence as JSON. Browser state resets on reload. The prebuilt PDF does not include visitor edits. The site requires no login and makes no backend/API calls.

## Architecture at a glance

```text
Local reviewer browser
        |
        v
Next.js web and JSON API -----> PostgreSQL (records, versions, outbox)
        |                                      |
        | protected local artifact files      v
        +<------------------------- Redis + BullMQ
                                               |
                                               v
                                Playwright worker in Docker
                                  | controlled fixture only
                                  +--> evidence and screenshots
                                  +--> immutable report HTML / PDF

Public visitors --> static Next.js export in demo/ --> browser-only review/export
```

PostgreSQL is the source of truth for application state. A SQL outbox and worker reconciler re-enqueue missing BullMQ work; Redis alone does not own audit history. The worker does audit and PDF jobs. Artifacts persist in the local `data/artifacts` mount. This is a developer's Compose stack, not a cloud production architecture or a backup system.

More detailed storage contracts, trust boundaries, and stage flow are in [architecture](docs/ARCHITECTURE.md). Queue recovery and retry behavior are in [worker notes](docs/WORKER.md). [ADR 001](docs/ADR-001.md) explains the main product/security decisions.

## Technology and source map

| Path | Responsibility |
| --- | --- |
| `apps/web/app/workspace.tsx` | Authenticated local workspace and UI workflows. |
| `apps/web/app/api/[...route]/route.ts` | JSON API router: auth/CSRF gates, inputs, database calls, protected report/artifact access. |
| `apps/web/lib/auth.ts` | Signed session cookie, CSRF/origin validation and login handling. |
| `apps/web/app/globals.css` | Local app styles. |
| `apps/worker/src/index.ts` | Worker process, BullMQ consumption, health endpoint, recovery/reconciliation, PDF jobs. |
| `apps/worker/src/analyze.ts` | Capture stages and evidence normalization. |
| `apps/worker/src/fixture.ts` | Fictional HTML fixture and request allowlist. Preserve fail closed behavior. |
| `packages/core/src/model.ts` | Shared application data types and strict Zod input schemas. |
| `packages/core/src/security.ts` | URL policy/helper routines and error sanitization; helper validation alone does not enable live scanning. |
| `packages/core/src/provider.ts` | Deterministic template provider and strict explanation validation. |
| `packages/core/src/report.ts` | Escaped static report and outreach rendering. |
| `packages/database/src/schema.sql` | PostgreSQL schema, foreign keys and immutable-history safeguards. |
| `packages/database/src/index.ts` | Database access, business state and audit operations. |
| `packages/database/src/reports.ts` | Report finalization, snapshots and PDF artifact state. |
| `demo/app/page.tsx` | Interactive browser-only public demo. |
| `demo/fixtures/sample.json` | Curated fictional report snapshot published by the demo. |
| `demo/public/` | Specifically selected public screenshot and PDF files. |
| `compose.yaml` / `Dockerfile` | Local PostgreSQL, Redis, migration, web, worker services and image. |
| `tests/` | Unit and policy tests. |
| `scripts/integration.ts` | Authenticated API/database/worker integration suite. |
| `scripts/browser-check.ts` | Authenticated local app browser workflow checks. |
| `scripts/demo-check.ts` | Anonymous static demo browser, layout and accessibility checks. |
| `scripts/final-smoke.ts` | Focused local-app smoke checks. |
| `scripts/check-secrets.mjs` | Exact-value check against credentials in the local environment. It is not a general secret scanner. |
| `output/` | Review samples, screenshots and machine-readable verification records; these are not runtime state. |

The local app router API is documented in [API v1](docs/API.md). To understand findings, provenance, score coverage and approval, read [scoring](docs/SCORING.md) and [report methodology](docs/REPORT-METHODOLOGY.md). The [case study](docs/CASE-STUDY.md) is portfolio copy, not independent proof of business outcomes.

## Run the local full app

Requirements: Node.js 22 or newer (Node 24 was used for the recorded verification), npm, Docker Desktop with Linux containers, and about 3 GB free for the browser container. The Compose ports must be free: web `3100`, PostgreSQL `55432`, Redis `56379`.

```powershell
Set-Location D:\Projects\auditcraft-ai
npm ci
npm run setup
docker compose up --build -d
docker compose exec web npm run seed
```

Open `http://localhost:3100`. Sign in using the locally generated `ADMIN_PASSWORD` from `.env`. Never paste, print, or commit the password, `SESSION_SECRET`, or `WORKER_TOKEN`. Setup preserves an existing `.env`; do not recreate it merely to obtain access. Database/Redis ports bind to loopback; worker health has no host port published.

For app work without rebuilding the image, keep PostgreSQL/Redis in Compose, then run the web app, worker and seed in separate terminals:

```powershell
docker compose up -d postgres redis
npm run migrate
npx playwright install chromium
npm run dev
# Separate terminal:
npm run worker
# Another terminal:
npm run seed
```

Do not run host and Compose workers at the same time during recovery tests. For stack shutdown, use `docker compose down`. Do not add `-v` unless you explicitly intend to erase the local database and Redis volumes. Generated artifacts are under `data/artifacts/` and should be treated as private runtime data.

Full stack test addressing and other local commands are in [README](README.md), [reviewer guide](docs/REVIEWER-GUIDE.md), and [troubleshooting](docs/TROUBLESHOOTING.md).

## Run and publish the public demo

The demo has an independent lockfile and is a static export. To run it from the repository root after root dependencies are installed:

```powershell
npm ci
npm run build:demo
```

Or, to install its standalone dependencies and run the development server:

```powershell
cd demo
npm ci
npm run dev
```

The local server uses port 3200. The exported files are under `demo/out/`; they are ignored by Git and must not be committed. Vercel settings are in `demo/vercel.json`. Configure Root Directory `demo`, install command `npm ci`, build command `npm run build` and output directory `out`. There are no environment variables for this static app. Check that deployment protection is off if you want an anonymous public link. Verify the resulting production URL from a logged-out browser.

**Only publish reviewed fictional assets.** To update the sample, review the data and images individually, copy only the chosen files into `demo/fixtures/` or `demo/public/`, run the checks and deploy the demo. Do not point the public demo at the entire root `output/` directory. Root output includes unrelated screens and local test results.

The Vercel app deploy and GitHub source push are separate operations. Check the Vercel project/link and current production domain before assuming a push triggered a deployment.

## Commands and checks

| Command | What it checks / does |
| --- | --- |
| `npm run setup` | Generate safe local secrets and prepare environment config. It does not start Docker. |
| `npm run migrate` | Apply database migrations. |
| `npm run seed` | Add fictional reviewer data; idempotent. |
| `npm test` | 35 unit/policy tests in the recorded baseline. |
| `npm run typecheck` | Root TypeScript check. |
| `npm run lint` | ESLint across app/packages/scripts/tests and demo source. |
| `npm run build` | Production build for the full web app. |
| `npm run test:integration` | Integration check; requires a reachable DB and worker health endpoint. |
| `npm run test:browser` | Authenticated browser workflow against a running web app. |
| `npm run build:demo` | Static public demo build. |
| `npm run test:demo` | Browser validation of local `demo/out` using installed Playwright Chromium. Set `$env:DEMO_URL` in PowerShell to check a deployed demo instead. |
| `node scripts/check-secrets.mjs` | Checks candidate source files against exact credentials loaded from `.env`; does not detect unknown secrets. |

Recorded full-stack results are dated 9 October; public demo checks/deployment are dated 12 October. Do not present old verification as a fresh run. The remote Actions run for the initial published commit was observed successful on 19 October. Re-run relevant commands and inspect the workflow state for later commits. Exact results and their limits are in [verification](docs/VERIFICATION.md).

## Security, privacy, and product boundaries

- The full app is a **local single-user fixture app**. Loopback binds and the fictional fixture allowlist are intentional safeguards.
- `https://fixture.auditcraft.test` is fulfilled by controlled strings. Every unrelated browser request is aborted. WebSockets close, downloads and service workers are disabled. Preserve this behavior.
- The validated-URL helper is policy code. It is not connected to a safe outbound browser transport. A public URL validator by itself does not stop Chromium DNS rebinding or private-address access.
- The local password/session pattern is not sufficient for public SaaS. Do not expose `apps/web` on Vercel by only redirecting its Next build. It needs durable Postgres/Redis, shared artifact storage, worker scheduling, HTTPS secure cookies, identity and tenant authorization, rate limiting/quotas, managed secrets, backups and restore verification, retention, and a hardened browser egress boundary.
- The public Vercel demo contains only published static fictional information. Visitor review edits are transient and do not reach the local application or its database.
- Reports escape data, use content policy, and PDF Chromium network access is disabled. These controls do not make this app appropriate for hostile real customer input at public scale.
- Avoid modifying real developer data during checks. Do not remove Docker volumes or `data/` unless the project owner expressly requests data deletion.

## Suggested first steps for the next agent

1. Read this file, then check `git status --short`, `git log -3 --oneline`, the current GitHub Actions result, and whether `https://auditcraft-ai.vercel.app` still serves an anonymous page. Treat old URLs and statuses above as records to reconfirm.
2. Read the specific source module and its linked architecture/API notes before editing. Preserve local user data and fixture-only network isolation.
3. State which app surface the task affects: authenticated local app or static public demo. They have separate build/deploy paths.
4. Make the focused change, run the relevant root or demo checks, and update `docs/VERIFICATION.md` only with checks actually executed. If deploying, verify the production hostname directly.
5. Report tested behavior, any limits, commit/remote status, and production URL accurately. Do not say GitHub Actions passed until the current commit's run completes successfully.

## Documentation index

- [Project README and local quick start](README.md)
- [Public demo source, limits and deploy settings](demo/README.md)
- [Architecture and data flow](docs/ARCHITECTURE.md) · [architecture decision](docs/ADR-001.md)
- [API routes](docs/API.md) · [worker and recovery](docs/WORKER.md)
- [Threat model](docs/THREAT-MODEL.md) · [responsible use](docs/RESPONSIBLE-USE.md)
- [Scoring](docs/SCORING.md) · [report methodology](docs/REPORT-METHODOLOGY.md)
- [Reviewer guide](docs/REVIEWER-GUIDE.md) · [troubleshooting](docs/TROUBLESHOOTING.md)
- [Portfolio case study](docs/CASE-STUDY.md) · [implementation history](docs/IMPLEMENTATION-PLAN.md)
- [Verification evidence and remaining untested areas](docs/VERIFICATION.md)
