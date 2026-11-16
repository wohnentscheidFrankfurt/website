import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../api/src/app.ts";
import { createToken, verifyToken } from "../../api/src/token.ts";
import type { Config, Mailer } from "../../api/src/types.ts";

const ORIGIN = "http://localhost:4322";
const SECRET = "test-secret";
const HOUR = 60 * 60 * 1000;
const config: Config = {
  port: 0, siteOrigin: ORIGIN, tokenSecret: SECRET, from: "info@example.org", to: "info@example.org",
  smtp: { host: "localhost", port: 25, tls: "none" },
  limits: { perIp: 5, perAddress: 3, total: 30 },
};

let clock = 1_800_000_000_000;
let clockBroken = false;
let logs: string[] = [];
let confirmations: { address: string; link: string; lang: string }[] = [];
let notifications: { address: string; at: Date; lang: string }[] = [];
let mailError: Error | null = null;
const mailer: Mailer = {
  async sendConfirmation(address, link, lang) {
    if (mailError) throw mailError;
    confirmations.push({ address, link, lang });
  },
  async sendNotification(address, at, lang) {
    if (mailError) throw mailError;
    notifications.push({ address, at, lang });
  },
};

let server: http.Server;
let base = "";
let app = createApp({ config, mailer, now: () => { if (clockBroken) throw new Error("secret detail"); return clock; }, log: (l) => logs.push(l) });

before(async () => {
  server = http.createServer((req, res) => app(req, res));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.closeAllConnections(); server.close(); });
beforeEach(() => {
  clock = 1_800_000_000_000;
  logs = [];
  confirmations = [];
  notifications = [];
  mailError = null;
  clockBroken = false;
  app = createApp({ config, mailer, now: () => { if (clockBroken) throw new Error("secret detail"); return clock; }, log: (l) => logs.push(l) });
});

type Opts = { origin?: string | null; type?: string; ip?: string; raw?: string };
function post(path: string, fields: Record<string, string>, o: Opts = {}) {
  const headers: Record<string, string> = { "content-type": o.type ?? "application/x-www-form-urlencoded" };
  if (o.origin !== null) headers.origin = o.origin ?? ORIGIN;
  if (o.ip) headers["x-forwarded-for"] = o.ip;
  return fetch(base + path, {
    method: "POST", headers, redirect: "manual",
    body: o.raw ?? new URLSearchParams(fields).toString(),
  });
}
const signup = (email: string, o: Opts = {}, extra: Record<string, string> = {}) =>
  post("/api/anmelden", { email, website: "", ...extra }, o);
const danke = (r: Response) => { assert.equal(r.status, 303); assert.equal(r.headers.get("location"), "/danke/"); };
const fehler = (r: Response) => { assert.equal(r.status, 303); assert.equal(r.headers.get("location"), "/fehler/"); };

test("valid sign-up sends one confirmation", async () => {
  danke(await signup("Anna@Example.org"));
  assert.equal(confirmations.length, 1);
  const { address, link } = confirmations[0];
  assert.equal(address, "anna@example.org");
  assert.ok(link.startsWith(`${ORIGIN}/bestaetigen/#`));
  assert.equal(verifyToken(link.slice(link.indexOf("#") + 1), clock, SECRET), "anna@example.org");
  assert.deepEqual(logs, ["signup sent"]);
});

test("honeypot filled", async () => {
  danke(await signup("anna@example.org", {}, { website: "http://spam.example" }));
  assert.equal(confirmations.length, 0);
  assert.deepEqual(logs, ["signup rejected honeypot"]);
});

test("rejected requests", async () => {
  fehler(await signup("not-an-address"));
  fehler(await signup("anna@example.org", { origin: "http://evil.example" }));
  fehler(await signup("anna@example.org", { origin: "null" }));
  fehler(await signup("anna@example.org", { raw: "email=" + "a".repeat(3000) }));
  fehler(await signup("anna@example.org", { type: "text/plain" }));
  assert.equal(confirmations.length, 0);
  assert.deepEqual(logs, [
    "signup rejected address", "signup rejected origin", "signup rejected origin",
    "signup rejected body", "signup rejected body",
  ]);
});

test("no Origin header is accepted", async () => {
  danke(await signup("anna@example.org", { origin: null }));
  assert.equal(confirmations.length, 1);
});

test("per-IP limit", async () => {
  for (let i = 0; i < 5; i++) danke(await signup(`u${i}@example.org`, { ip: "203.0.113.7" }));
  fehler(await signup("u9@example.org", { ip: "203.0.113.7" }));
  danke(await signup("u9@example.org", { ip: "203.0.113.8" }));
  assert.equal(logs.at(-2), "signup rejected limit-ip");
  clock += HOUR + 1;
  danke(await signup("u10@example.org", { ip: "203.0.113.7" }));
});

test("per-address limit across IPs", async () => {
  for (let i = 0; i < 3; i++) danke(await signup("anna@example.org", { ip: `203.0.113.${i + 1}` }));
  assert.equal(confirmations.length, 3);
  fehler(await signup("anna@example.org", { ip: "203.0.113.50" }));
  assert.equal(logs.at(-1), "signup rejected limit-address");
  clock += 24 * HOUR + 1;
  danke(await signup("anna@example.org", { ip: "203.0.113.50" }));
});

test("total limit", async () => {
  const cfg = { ...config, limits: { perIp: 100, perAddress: 100, total: 2 } };
  app = createApp({ config: cfg, mailer, now: () => { if (clockBroken) throw new Error("secret detail"); return clock; }, log: (l) => logs.push(l) });
  danke(await signup("a@example.org"));
  danke(await signup("b@example.org"));
  fehler(await signup("c@example.org"));
  assert.equal(logs.at(-1), "signup rejected limit-total");
});

test("mail error leaks nothing but the code", async () => {
  mailError = Object.assign(new Error("550 Recipient rejected: anna@example.org"), { responseCode: 550 });
  fehler(await signup("anna@example.org"));
  assert.deepEqual(logs, ["smtp error 550"]);
  assert.ok(!logs.join("\n").includes("anna@"));
});

test("confirm: valid token", async () => {
  const token = createToken("anna@example.org", clock, SECRET);
  const r = await post("/api/bestaetigen", { token });
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].address, "anna@example.org");
  assert.equal(notifications[0].at.getTime(), clock);
  assert.deepEqual(logs, ["confirm sent"]);
});

test("confirm: forged, expired, wrong origin, mail error", async () => {
  const token = createToken("anna@example.org", clock, SECRET);
  const dot = token.indexOf(".") + 1;
  const forged = token.slice(0, dot) + (token[dot] === "A" ? "B" : "A") + token.slice(dot + 1);
  assert.equal((await post("/api/bestaetigen", { token: forged })).status, 400);
  assert.equal((await post("/api/bestaetigen", { token: createToken("anna@example.org", clock, "other") })).status, 400);
  clock += 72 * HOUR + 1;
  assert.equal((await post("/api/bestaetigen", { token })).status, 400);
  clock -= 72 * HOUR + 1;
  assert.equal((await post("/api/bestaetigen", { token }, { origin: "http://evil.example" })).status, 403);
  mailError = Object.assign(new Error("boom"), { code: "ECONNECTION" });
  assert.equal((await post("/api/bestaetigen", { token })).status, 502);
  assert.equal(notifications.length, 0);
  assert.deepEqual(logs, [
    "confirm invalid", "confirm invalid", "confirm invalid", "confirm rejected origin", "smtp error ECONNECTION",
  ]);
});

test("other routes are 404", async () => {
  assert.equal((await fetch(base + "/api/anmelden")).status, 404);
  assert.equal((await fetch(base + "/")).status, 404);
  assert.equal((await post("/api/other", {})).status, 404);
});

test("confirm: per-address limit answers 200 without mail", async () => {
  const token = createToken("anna@example.org", clock, SECRET);
  for (let i = 0; i < 3; i++) assert.equal((await post("/api/bestaetigen", { token })).status, 200);
  assert.equal((await post("/api/bestaetigen", { token })).status, 200);
  assert.equal(notifications.length, 3);
  assert.equal(logs.at(-1), "confirm rejected limit-address");
  clock += 24 * HOUR + 1;
  const fresh = createToken("anna@example.org", clock, SECRET);
  assert.equal((await post("/api/bestaetigen", { token: fresh })).status, 200);
  assert.equal(notifications.length, 4);
});

test("confirm: total limit answers 503 without mail", async () => {
  const cfg = { ...config, limits: { perIp: 100, perAddress: 100, total: 2 } };
  app = createApp({ config: cfg, mailer, now: () => clock, log: (l) => logs.push(l) });
  const tok = (a: string) => createToken(a, clock, SECRET);
  assert.equal((await post("/api/bestaetigen", { token: tok("a@example.org") })).status, 200);
  assert.equal((await post("/api/bestaetigen", { token: tok("b@example.org") })).status, 200);
  assert.equal((await post("/api/bestaetigen", { token: tok("c@example.org") })).status, 503);
  assert.equal(notifications.length, 2);
  assert.equal(logs.at(-1), "confirm rejected limit-total");
  clock += HOUR + 1;
  assert.equal((await post("/api/bestaetigen", { token: tok("c@example.org") })).status, 200);
});

test("confirm limits are separate from sign-up limits", async () => {
  for (let i = 0; i < 3; i++) danke(await signup("anna@example.org", { ip: `203.0.113.${i + 1}` }));
  const token = createToken("anna@example.org", clock, SECRET);
  assert.equal((await post("/api/bestaetigen", { token })).status, 200);
  assert.equal(notifications.length, 1);
});

test("unexpected errors: sign-up to /fehler/, confirm 500, nothing leaked", async () => {
  const token = createToken("anna@example.org", clock, SECRET);
  clockBroken = true;
  fehler(await signup("anna@example.org"));
  assert.equal((await post("/api/bestaetigen", { token })).status, 500);
  assert.deepEqual(logs, ["signup error", "confirm error"]);
});

// The English routes: same checks, English targets, English link, log lines end with " en".
const signupEn = (email: string, o: Opts = {}, extra: Record<string, string> = {}) =>
  post("/api/en/signup", { email, website: "", ...extra }, o);
const thanksEn = (r: Response) => { assert.equal(r.status, 303); assert.equal(r.headers.get("location"), "/en/thanks/"); };
const errorEn = (r: Response) => { assert.equal(r.status, 303); assert.equal(r.headers.get("location"), "/en/error/"); };

test("English sign-up sends an English confirmation with the English link", async () => {
  thanksEn(await signupEn("Anna@Example.org"));
  assert.equal(confirmations.length, 1);
  const { address, link, lang } = confirmations[0];
  assert.equal(lang, "en");
  assert.equal(address, "anna@example.org");
  assert.ok(link.startsWith(`${ORIGIN}/en/confirm/#`));
  assert.equal(verifyToken(link.slice(link.indexOf("#") + 1), clock, SECRET), "anna@example.org");
  assert.deepEqual(logs, ["signup sent en"]);
});

test("German sign-up passes lang de", async () => {
  danke(await signup("anna@example.org"));
  assert.equal(confirmations[0].lang, "de");
});

test("English honeypot looks like success and sends nothing", async () => {
  thanksEn(await signupEn("anna@example.org", {}, { website: "http://spam.example" }));
  assert.equal(confirmations.length, 0);
  assert.deepEqual(logs, ["signup rejected honeypot en"]);
});

test("English rejected requests go to /en/error/", async () => {
  errorEn(await signupEn("not-an-address"));
  errorEn(await signupEn("anna@example.org", { origin: "http://evil.example" }));
  errorEn(await signupEn("anna@example.org", { type: "text/plain" }));
  assert.equal(confirmations.length, 0);
  assert.deepEqual(logs, ["signup rejected address en", "signup rejected origin en", "signup rejected body en"]);
});

test("English SMTP error goes to /en/error/ and leaks only the code", async () => {
  mailError = Object.assign(new Error("550 Recipient rejected: anna@example.org"), { responseCode: 550 });
  errorEn(await signupEn("anna@example.org"));
  assert.deepEqual(logs, ["smtp error 550 en"]);
});

test("a German and an English sign-up share the per-address limit", async () => {
  danke(await signup("anna@example.org", { ip: "203.0.113.1" }));
  thanksEn(await signupEn("anna@example.org", { ip: "203.0.113.2" }));
  danke(await signup("anna@example.org", { ip: "203.0.113.3" }));
  errorEn(await signupEn("anna@example.org", { ip: "203.0.113.4" }));
  assert.equal(confirmations.length, 3);
  assert.equal(logs.at(-1), "signup rejected limit-address en");
});

test("English per-IP and total limits are shared with German", async () => {
  for (let i = 0; i < 5; i++) thanksEn(await signupEn(`u${i}@example.org`, { ip: "203.0.113.7" }));
  fehler(await signup("u9@example.org", { ip: "203.0.113.7" }));
  const cfg = { ...config, limits: { perIp: 100, perAddress: 100, total: 1 } };
  app = createApp({ config: cfg, mailer, now: () => clock, log: (l) => logs.push(l) });
  danke(await signup("a@example.org"));
  errorEn(await signupEn("b@example.org"));
});

test("English confirm: valid token sends an English-site notification", async () => {
  const token = createToken("anna@example.org", clock, SECRET);
  const r = await post("/api/en/confirm", { token });
  assert.equal(r.status, 200);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].lang, "en");
  assert.deepEqual(logs, ["confirm sent en"]);
});

test("German confirm passes lang de", async () => {
  await post("/api/bestaetigen", { token: createToken("anna@example.org", clock, SECRET) });
  assert.equal(notifications[0].lang, "de");
});

test("English confirm: forged, wrong origin, limits, mail error", async () => {
  const token = createToken("anna@example.org", clock, SECRET);
  assert.equal((await post("/api/en/confirm", { token: "x.y" })).status, 400);
  assert.equal((await post("/api/en/confirm", { token }, { origin: "http://evil.example" })).status, 403);
  for (let i = 0; i < 3; i++) assert.equal((await post("/api/en/confirm", { token })).status, 200);
  // The confirm limit per address is shared with the German confirm route.
  assert.equal((await post("/api/bestaetigen", { token })).status, 200);
  assert.equal(notifications.length, 3);
  clock += 24 * HOUR + 1;
  mailError = Object.assign(new Error("boom"), { code: "ECONNECTION" });
  assert.equal((await post("/api/en/confirm", { token: createToken("anna@example.org", clock, SECRET) })).status, 502);
  assert.deepEqual(logs, [
    "confirm invalid en", "confirm rejected origin en", "confirm sent en", "confirm sent en", "confirm sent en",
    "confirm rejected limit-address", "smtp error ECONNECTION en",
  ]);
});

test("English unexpected errors: sign-up to /en/error/, confirm 500", async () => {
  const token = createToken("anna@example.org", clock, SECRET);
  clockBroken = true;
  errorEn(await signupEn("anna@example.org"));
  assert.equal((await post("/api/en/confirm", { token })).status, 500);
  assert.deepEqual(logs, ["signup error en", "confirm error en"]);
});

test("no log line contains an address", async () => {
  await signupEn("anna@example.org");
  await signupEn("not-an-address");
  await post("/api/en/confirm", { token: createToken("anna@example.org", clock, SECRET) });
  assert.ok(!logs.join("\n").includes("anna"));
});
