import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";
export class SafeError extends Error {
  constructor(
    public code: string,
    message = "The operation could not be completed safely.",
  ) {
    super(message);
  }
}
export function publicAddress(address: string) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress())
      ip = (ip as ipaddr.IPv6).toIPv4Address();
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export type Resolver = (
  hostname: string,
) => Promise<{ address: string; family: number }[]>;
export async function validateUrl(
  raw: string,
  resolver: Resolver = (host) => dns.lookup(host, { all: true }),
  origin?: string,
) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SafeError("INVALID_URL");
  }
  if (!["https:", "http:"].includes(u.protocol))
    throw new SafeError("PROTOCOL");
  if (u.username || u.password) throw new SafeError("CREDENTIALS");
  if (u.port) throw new SafeError("PORT");
  if (origin && u.origin !== origin) throw new SafeError("ORIGIN");
  const hostname = u.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    (!hostname.includes(".") && !hostname.includes(":"))
  )
    throw new SafeError("HOST");
  let addresses: { address: string; family: number }[];
  try {
    addresses = ipaddr.isValid(hostname)
      ? [{ address: hostname, family: hostname.includes(":") ? 6 : 4 }]
      : await resolver(hostname);
  } catch {
    throw new SafeError("DNS");
  }
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new SafeError("PRIVATE_TARGET");
  u.hash = "";
  return { url: u, addresses };
}
// Policy helper only. This is deliberately not exposed as a browser transport.
export async function validateRedirectChain(
  raw: string,
  locations: string[],
  resolver: Resolver,
) {
  let target = await validateUrl(raw, resolver);
  const origin = target.url.origin;
  if (locations.length > 5) throw new SafeError("REDIRECT_LIMIT");
  for (const location of locations)
    target = await validateUrl(
      new URL(location, target.url).href,
      resolver,
      origin,
    );
  return target;
}
export function fixtureUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SafeError("FIXTURE_URL");
  }
  if (
    u.origin !== "https://fixture.auditcraft.test" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw new SafeError("FIXTURE_URL");
  if (
    ![
      "/",
      "/about",
      "/services",
      "/contact",
      "/robots.txt",
      "/sitemap.xml",
      "/studio.svg",
    ].includes(u.pathname)
  )
    throw new SafeError("FIXTURE_PATH");
  return u;
}
export function assertNoLocalBypass(env: Record<string, string | undefined>) {
  if (
    env.ALLOW_PRIVATE_NETWORK ||
    env.FIXTURE_ALLOW_LOCALHOST ||
    env.SSRF_BYPASS
  )
    throw new SafeError("UNSAFE_CONFIGURATION");
}
export function safeFailure(error: unknown) {
  return error instanceof SafeError
    ? { code: error.code, message: error.message }
    : {
        code: "PROCESSING_FAILED",
        message:
          "Processing stopped. Your saved evidence is preserved. Retry the audit or inspect the local worker logs.",
      };
}
export const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
