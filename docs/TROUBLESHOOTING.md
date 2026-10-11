# Troubleshooting

- **Docker unavailable:** start Docker Desktop and select Linux containers. `docker info` must succeed. Permissions to the Docker engine are required.
- **Port in use:** stop the existing host development process or adjust Compose and `APP_URL` together. Do not change unrelated containers.
- **401:** sign in using the generated local password. Sessions expire after eight hours. Restarting with a different session secret invalidates sessions.
- **403 on writes:** use exactly the configured `APP_URL`, including host and port. `localhost` and `127.0.0.1` are different origins. Send the CSRF token in API clients.
- **Queued forever:** inspect `docker compose ps` and `docker compose logs worker`. Confirm Redis/PostgreSQL health and worker heartbeat. SQL outbox reconciliation repairs missing queue entries.
- **Capture failed:** check Playwright and Chromium versions match. Host development requires `npx playwright install chromium`. Container browsers come from the pinned matching Playwright image. The worker returns sanitized errors.
- **Explanation unavailable:** use raw evidence to add a manual finding. External provider settings are not implemented.
- **PDF pending/failed:** verify the worker is running and artifact volume is writable. A new report version queues another PDF. Existing reports remain immutable.
- **Build EPERM on Windows:** stop the dev server before rebuilding, then rerun the build with normal filesystem permissions. The Docker build provides an independent Linux verification path.
- **No public-site mode:** intentional. Do not add localhost or DNS exceptions. Read ADR 001 before implementing a safe egress transport.
- **Reset:** `docker compose down` stops this project but preserves volumes. Do not use `down -v` unless you explicitly intend to delete all local database and queue history.
