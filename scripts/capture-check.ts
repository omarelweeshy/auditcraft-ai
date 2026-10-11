import { randomUUID } from "node:crypto";
import { analyze } from "../apps/worker/src/analyze";
import { defaultSettings } from "../packages/core/src/model";
const result = await analyze(
  randomUUID(),
  1,
  defaultSettings.limits,
  async (s, m) => {
    console.log(s, m);
  },
  async () => {},
);
console.log(
  `Captured ${result.captures.length} pages, ${result.evidence.length} observations`,
);
