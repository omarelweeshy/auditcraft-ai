import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
try {
  process.loadEnvFile();
} catch {
  /* CI env. */
}
const paths = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const secrets = ["ADMIN_PASSWORD", "SESSION_SECRET", "WORKER_TOKEN"]
  .map((k) => process.env[k])
  .filter(Boolean);
const leaks = [];
for (const file of paths) {
  const bytes = readFileSync(file);
  if (secrets.some((s) => bytes.includes(Buffer.from(s)))) leaks.push(file);
}
if (leaks.length) {
  console.error(
    "Credential values found in repository candidate files:",
    leaks,
  );
  process.exit(1);
}
console.log(
  `PASS: checked ${paths.length} repository candidate files; no configured secrets found. This exact-value check is not a general secret scanner.`,
);
