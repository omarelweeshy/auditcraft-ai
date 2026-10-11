# AuditCraft AI public demo

A standalone static portfolio demo for Vercel. It deliberately contains no API routes, database connection, credentials, queue, worker, or live scanner. Only the curated fictional fixture snapshot and three public assets are published.

Visitors can inspect the actual recorded evidence, edit recommendations, approve/reject findings, export approved findings as JSON, and open the previously finalized six-page PDF. Edits exist in React memory in the current tab and reset on reload. The sample PDF does not incorporate visitor edits. No external AI provider is called.

## Run and publish

From this directory: `npm ci`, then `npm run dev` (port 3200) or `npm run build` (static output in `out/`). From the repository root: `npm run build:demo` and `npm run test:demo` (requires the root dependencies and Playwright Chromium).

The Vercel project's Root Directory must be `demo` when connecting this repository to GitHub. Framework is Other, install command `npm ci`, build command `npm run build`, output directory `out`. These are also set in `vercel.json`. Deploy from this directory with `npx vercel --prod`. No environment variables are required. Keep Vercel Deployment Protection off for the production URL if visitors should access it without signing in.

The original authenticated application remains in `apps/web` and runs using the documented Docker stack. Hosting fresh audits requires a persistent worker, PostgreSQL, Redis, and shared artifact storage; this static demo does not supply those services.

## Fixture provenance

`fixtures/sample.json` is copied from `output/sample-report.json`, recorded 9 October 2026. `public/desktop.png` and `public/mobile.png` are the original fixture browser captures. `public/sample-proposal.pdf` is the finalized six-page sample from `output/pdf/auditcraft-sample-proposal.pdf`. All business data is fictional. The score is the application's own weighted lab score, not a Lighthouse score or a security certification.

When updating the sample, explicitly copy only reviewed fictional assets. Never copy `.env`, `data/artifacts`, or the entire output directory into the public app.
