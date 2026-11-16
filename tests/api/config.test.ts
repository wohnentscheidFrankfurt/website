import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../api/src/config.ts";

const none = () => undefined;
const base = { TOKEN_SECRET: "0123456789abcdef", SMTP_PASSWORD: "pw" };

test("defaults", () => {
  const c = loadConfig(base, none);
  assert.deepEqual(c, {
    port: 8787,
    siteOrigin: "https://wohnentscheid-frankfurt.de",
    tokenSecret: "0123456789abcdef",
    from: "info@wohnentscheid-frankfurt.de",
    to: "info@wohnentscheid-frankfurt.de",
    smtp: { host: "smtp.ionos.de", port: 587, tls: "starttls", user: "info@wohnentscheid-frankfurt.de", password: "pw" },
    limits: { perIp: 5, perAddress: 3, total: 30 },
  });
});

test("env overrides", () => {
  const c = loadConfig(
    {
      ...base, API_PORT: "8788", SITE_ORIGIN: "http://localhost:4322", SMTP_HOST: "127.0.0.1", SMTP_PORT: "1025",
      SMTP_TLS: "none", SMTP_USER: "u@x.de", MAIL_FROM: "f@x.de", MAIL_TO: "t@x.de",
      LIMIT_PER_IP: "1", LIMIT_PER_ADDRESS: "2", LIMIT_TOTAL: "3",
    },
    none,
  );
  assert.equal(c.port, 8788);
  assert.equal(c.siteOrigin, "http://localhost:4322");
  assert.equal(c.from, "f@x.de");
  assert.equal(c.to, "t@x.de");
  assert.deepEqual(c.smtp, { host: "127.0.0.1", port: 1025, tls: "none", user: "u@x.de", password: "pw" });
  assert.deepEqual(c.limits, { perIp: 1, perAddress: 2, total: 3 });
});

test("credentials win over env and lose a trailing newline", () => {
  const cred = (n: string) => ({ "token-secret": "credential-secret-0123\n", "smtp-password": "cred-pw\n" })[n];
  const c = loadConfig(base, cred);
  assert.equal(c.tokenSecret, "credential-secret-0123");
  assert.equal(c.smtp.password, "cred-pw");
});

test("missing or short token secret throws", () => {
  assert.throws(() => loadConfig({ SMTP_PASSWORD: "pw" }, none));
  assert.throws(() => loadConfig({ ...base, TOKEN_SECRET: "short" }, none));
});

test("starttls without password throws", () => {
  assert.throws(() => loadConfig({ TOKEN_SECRET: base.TOKEN_SECRET }, none));
});

test("tls none works without password", () => {
  const c = loadConfig({ TOKEN_SECRET: base.TOKEN_SECRET, SMTP_TLS: "none" }, none);
  assert.equal(c.smtp.tls, "none");
  assert.equal(c.smtp.password, undefined);
});

test("unknown SMTP_TLS throws", () => {
  assert.throws(() => loadConfig({ ...base, SMTP_TLS: "ssl" }, none));
});

for (const [name, value] of [["LIMIT_TOTAL", "30x"], ["LIMIT_TOTAL", "0"], ["LIMIT_TOTAL", "-1"], ["API_PORT", "abc"], ["LIMIT_PER_IP", "1.5"]]) {
  test(`${name}=${value} is refused`, () => {
    assert.throws(() => loadConfig({ ...base, [name]: value }, none), new RegExp(name));
  });
}
