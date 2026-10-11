# API v1

All routes use `/api`. Except login, every route requires the `auditcraft_session` cookie. Writes require `Origin` equal to `APP_URL` and `x-csrf-token` from `GET /session`. Bodies are JSON with a 64 KB application limit. Errors return sanitized `error` and optional `code`; no raw provider or database exceptions.

| Route                                  | Behavior                                                               |
| -------------------------------------- | ---------------------------------------------------------------------- |
| POST `/login`                          | `{password}`; sets expiring HttpOnly cookie                            |
| GET `/session`                         | CSRF token and nonsecret provider status                               |
| POST `/logout`                         | Clears cookie                                                          |
| GET `/dashboard`                       | Prospects, recent 100 audit runs, worker heartbeat, metrics            |
| GET/PUT `/settings`                    | Validated brand, services, limits, weights and disclaimer              |
| POST `/audits`                         | Validated fixture prospect input, `idempotency-key` header required    |
| GET `/audits/:id`                      | Audit, captures, evidence, findings, reports, score and timeline       |
| POST `/audits/:id/cancel`              | Requests cancellation for unfinished run                               |
| POST `/audits/:id/retry` or `/rerun`   | New immutable audit version; idempotency key required                  |
| POST `/audits/:id/findings`            | Manual finding with existing evidence IDs; approval starts pending     |
| PUT `/findings/:id`                    | `{finding, approval, revision}`; optimistic revision check             |
| GET `/findings/:id/revisions`          | Previous finding revisions                                             |
| PUT `/prospects/:id`                   | `{status}` from supported status enum                                  |
| POST `/audits/:id/reports`             | `{summary,findingIds,sections,screenshot}`; approved-only finalization |
| GET `/reports/:id`                     | Immutable snapshot and PDF status                                      |
| GET `/reports/:id/html`                | Protected stored HTML with strict report CSP                           |
| GET `/reports/:id/pdf`                 | Protected PDF attachment when READY                                    |
| GET/POST `/reports/:id/outreach`       | Revision list / append `{subject,message,revision,exported?}`          |
| GET `/artifacts/:auditId/:capture.png` | Allowlisted protected screenshot                                       |

Input schemas are in `packages/core/src/model.ts`. Invalid input returns 400, missing session 401, invalid CSRF/origin 403, missing object 404 and stale revision 409. Generated explanations have no HTTP approval bypass. There is no public arbitrary-job endpoint, live URL mode, email-send endpoint or secret-read endpoint.
