# Worker and recovery

Run `npm run worker`, or use the Compose worker. Only one job runs at a time. Worker `/` health on port 3101 requires `Authorization: Bearer WORKER_TOKEN`; it is not published by Compose. An authenticated web API reads a nonsecret heartbeat from PostgreSQL.

The worker reconciles unfinished audit rows and queued PDF artifacts every four seconds. Jobs use stable UUID IDs. Audit attempts are persisted in SQL, with at most three automatic attempts and exponential delay starting at two seconds. BullMQ uses a 30-second lock, a 15-second stalled scan and at most two stall recoveries. Missing Redis jobs are recreated subject to the SQL attempt budget. Jobs retain their Redis history.

Capture is atomic at the evidence boundary. A failure before successful normalization may repeat browser capture. Once evidence is persisted, retry reuses that evidence; it does not delete or duplicate it. Explanation errors route to REVIEW_REQUIRED with raw evidence preserved. Existing findings are never regenerated over approved work.

Cancellation is a SQL flag, checked between stages and polled during capture. The browser context closes when cancellation is observed. Completion checks the flag under transaction lock, preventing cancellation from being silently overwritten by success. A manual retry creates a new version; it does not erase the failed run.

PDF jobs have three automatic attempts and separate artifact state. Stored HTML and snapshots remain unchanged on generation failure. A new finalized report version can retry PDF generation. There is no dedicated failed-PDF retry control yet.

Connection failures are logged generically. Audit events carry safe messages and audit correlation IDs. Raw infrastructure exceptions are not returned through APIs. Redis and PostgreSQL volumes persist local state. Backups and restoration drills remain operational work.
