import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env")) {
  console.log(".env already exists; preserved.");
  process.exit(0);
}
const password = randomBytes(18).toString("base64url");
writeFileSync(
  ".env",
  `DATABASE_URL=postgresql://auditcraft:local-only@localhost:55432/auditcraft\nREDIS_URL=redis://localhost:56379\nAPP_URL=http://localhost:3100\nADMIN_PASSWORD=${password}\nSESSION_SECRET=${randomBytes(32).toString("hex")}\nWORKER_TOKEN=${randomBytes(32).toString("hex")}\nARTIFACT_DIR=./data/artifacts\nAI_PROVIDER=mock\n`,
  { mode: 0o600 },
);
console.log("Created ignored .env. Read ADMIN_PASSWORD locally to sign in.");
