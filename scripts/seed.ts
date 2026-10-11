import { randomUUID } from "node:crypto";
import { db, createAudit } from "../packages/database/src/index";
import { prospectInput, defaultSettings } from "../packages/core/src/model";
export const fixtureInput = prospectInput.parse({
  businessName: "Fieldwork Studio",
  website: "https://fixture.auditcraft.test/",
  industry: "Interior design",
  location: "Cairo, Egypt (fictional)",
  notes: "Fictional prospect for a controlled end-to-end demonstration.",
  services: ["Website redesign", "Accessible interfaces"],
  depth: 1,
  responsibleUse: true,
  mode: "fixture",
});
const success = await createAudit(fixtureInput, "seed-fieldwork-v1");
const retry = await createAudit(
  {
    ...fixtureInput,
    businessName: "Fieldwork / retry demonstration",
    simulateFailure: true,
  },
  "seed-retry-v1",
);
await db.query(
  "INSERT INTO prospects(id,data,status) SELECT $1,$2,'NEW' WHERE NOT EXISTS(SELECT 1 FROM prospects WHERE data->>'businessName'='Fieldwork / failed demonstration')",
  [
    randomUUID(),
    { ...fixtureInput, businessName: "Fieldwork / failed demonstration" },
  ],
);
const p = (
  await db.query(
    "SELECT id FROM prospects WHERE data->>'businessName'='Fieldwork / failed demonstration' LIMIT 1",
  )
).rows[0];
await db.query(
  "INSERT INTO audits(id,prospect_id,idempotency_key,version,status,stage,attempts,config,error,started_at,completed_at) VALUES($1,$2,'seed-failed-v1',1,'FAILED','VALIDATING',3,$3,$4,now(),now()) ON CONFLICT DO NOTHING",
  [
    randomUUID(),
    p.id,
    { ...defaultSettings, input: fixtureInput },
    {
      code: "DEMO_FAILURE",
      message:
        "Seeded failure example. Use New version to run a real fixture retry.",
    },
  ],
);
await db.query(
  "UPDATE audits SET config=$1 WHERE idempotency_key='seed-failed-v1' AND NOT (config ? 'limits')",
  [{ ...defaultSettings, input: fixtureInput }],
);
console.log(
  JSON.stringify({
    auditId: success.id,
    retryId: retry.id,
    message:
      "Fictional demo seeded; worker will capture and analyze queued audits.",
  }),
);
await db.end();
