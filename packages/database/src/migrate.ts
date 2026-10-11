import { readFile } from "node:fs/promises";
import { db } from "./index";
import { defaultSettings } from "../../core/src/model";
await db.query(
  await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
);
await db.query(
  "INSERT INTO settings(id,data) VALUES(1,$1) ON CONFLICT DO NOTHING",
  [defaultSettings],
);
console.log("Migration 1 applied; settings preserved.");
await db.end();
