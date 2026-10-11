import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateUrl,
  publicAddress,
  validateRedirectChain,
  fixtureUrl,
  assertNoLocalBypass,
  safeFailure,
} from "../packages/core/src/security";
const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];
test("accepts public HTTPS with a resolved global address", async () => {
  assert.equal(
    (await validateUrl("https://example.com/path", publicDns)).url.href,
    "https://example.com/path",
  );
});
for (const host of [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "10.0.0.1",
  "172.16.0.1",
  "192.168.1.1",
  "169.254.169.254",
  "100.100.100.200",
  "[::1]",
  "[fe80::1]",
  "[fc00::1]",
  "[::ffff:127.0.0.1]",
  "2130706433",
  "0x7f000001",
  "127.1",
  "0177.0.0.1",
  "%31%32%37.0.0.1",
  "[ff02::1]",
  "224.0.0.1",
  "192.0.2.1",
])
  test(`rejects private, reserved or encoded target ${host}`, async () => {
    await assert.rejects(
      validateUrl(`http://${host}/`, async () => [
        { address: "127.0.0.1", family: 4 },
      ]),
    );
  });
test("rejects credentials, ports and non-web schemes", async () => {
  for (const raw of [
    "https://u:p@example.com",
    "https://example.com:8080",
    "file:///etc/passwd",
    "ftp://example.com",
    "javascript:alert(1)",
  ])
    await assert.rejects(validateUrl(raw, publicDns));
});
test("rejects mixed public/private DNS records", async () => {
  await assert.rejects(
    validateUrl("https://example.com", async () => [
      ...(await publicDns()),
      { address: "10.0.0.1", family: 4 },
    ]),
  );
});
test("redirect policy re-resolves same hostname and rejects rebinding", async () => {
  let n = 0;
  await assert.rejects(
    validateRedirectChain("https://example.com", ["/next"], async () =>
      ++n === 1 ? publicDns() : [{ address: "127.0.0.1", family: 4 }],
    ),
  );
  assert.equal(n, 2);
});
test("rejects private redirects and cross-origin redirects", async () => {
  await assert.rejects(
    validateRedirectChain(
      "https://example.com",
      ["http://169.254.169.254/"],
      publicDns,
    ),
  );
});
test("rejects excessive redirects", async () => {
  await assert.rejects(
    validateRedirectChain(
      "https://example.com",
      Array(6).fill("/next"),
      publicDns,
    ),
  );
});
test("production and development cannot enable a local fixture bypass", () => {
  for (const mode of ["production", "development"])
    assert.throws(() =>
      assertNoLocalBypass({ NODE_ENV: mode, FIXTURE_ALLOW_LOCALHOST: "true" }),
    );
  assert.throws(() => fixtureUrl("http://localhost/"));
  assert.equal(
    fixtureUrl("https://fixture.auditcraft.test/").hostname,
    "fixture.auditcraft.test",
  );
  assert.throws(() => fixtureUrl("https://fixture.auditcraft.test@127.0.0.1/"));
});
test("IPv6 global unicast accepted, mapped private and metadata rejected", () => {
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
  assert.equal(publicAddress("::ffff:169.254.169.254"), false);
});
test("raw infrastructure errors are sanitized", () => {
  assert.ok(
    !JSON.stringify(
      safeFailure(new Error("password=secret db.internal")),
    ).includes("secret"),
  );
});
