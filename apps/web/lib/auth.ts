import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  scryptSync,
} from "node:crypto";
import path from "node:path";
import { db } from "../../../packages/database/src/index";
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  /* Container environment. */
}
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET is not configured");
  return s;
}
export function equal(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
const sign = (value: string) =>
  createHmac("sha256", secret()).update(value).digest("base64url");
export function sessionToken() {
  const payload = Buffer.from(
    JSON.stringify({
      expires: Date.now() + 8 * 60 * 60 * 1000,
      nonce: randomBytes(24).toString("hex"),
    }),
  ).toString("base64url");
  return payload + "." + sign(payload);
}
export function session(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("auditcraft_session="))
    ?.slice("auditcraft_session=".length);
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !equal(sign(payload), sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.expires < Date.now()) return null;
    return { csrf: sign("csrf:" + token) };
  } catch {
    return null;
  }
}
export function validOrigin(request: Request) {
  return (
    request.headers.get("origin") ===
    (process.env.APP_URL ?? "http://localhost:3100")
  );
}
export async function login(password: string) {
  const row = (
    await db.query(
      "INSERT INTO login_attempts(id,failures,reset_at) VALUES(1,0,now()+interval '5 minutes') ON CONFLICT(id) DO UPDATE SET failures=CASE WHEN login_attempts.reset_at<now() THEN 0 ELSE login_attempts.failures END,reset_at=CASE WHEN login_attempts.reset_at<now() THEN now()+interval '5 minutes' ELSE login_attempts.reset_at END RETURNING *",
    )
  ).rows[0];
  if (row.failures >= 10) return null;
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || configured.length < 16)
    throw new Error("ADMIN_PASSWORD must contain at least 16 characters");
  const salt = secret();
  const ok = timingSafeEqual(
    scryptSync(password, salt, 32),
    scryptSync(configured, salt, 32),
  );
  if (!ok) {
    await db.query("UPDATE login_attempts SET failures=failures+1 WHERE id=1");
    return null;
  }
  await db.query("UPDATE login_attempts SET failures=0 WHERE id=1");
  return sessionToken();
}
export function cookie(token: string) {
  return `auditcraft_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? 28800 : 0}${process.env.APP_URL?.startsWith("https:") ? "; Secure" : ""}`;
}
