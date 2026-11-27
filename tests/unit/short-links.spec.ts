// Runs the short addresses of server/Caddyfile (print, e.g. the QR code on a flyer) in a local Caddy.
// Needs Caddy: brew install caddy.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { ANCHORS } from "../../src/i18n/ui.ts";
import { startCaddy, type Caddy } from "./caddy.ts";

const SIGNUP = { de: `/#${ANCHORS.de.band}`, en: `/en/#${ANCHORS.en.band}` };
let caddy: Caddy;

test.describe.configure({ mode: "serial" });

// The matcher and redir lines of the short addresses: every line that names @newsletter….
function rules(caddyfile: string): string {
  const lines = caddyfile.split("\n").filter((l) => /^\t(@newsletter\w*|redir @newsletter\w*) /.test(l));
  if (lines.length === 0) throw new Error("no @newsletter rules in server/Caddyfile");
  return lines.join("\n");
}

test.beforeAll(async () => {
  caddy = await startCaddy(rules(fs.readFileSync("server/Caddyfile", "utf8")));
});

test.afterAll(async () => {
  await caddy?.stop();
});

test("/newsletter leads to the sign-up form in the band, with 302", async () => {
  for (const p of ["/newsletter", "/newsletter/"]) {
    const res = await caddy.get(p);
    expect(res.status, p).toBe(302);
    expect(res.headers.location, p).toBe(SIGNUP.de);
  }
});

test("/en/newsletter leads to the English sign-up form, with 302", async () => {
  for (const p of ["/en/newsletter", "/en/newsletter/"]) {
    const res = await caddy.get(p);
    expect(res.status, p).toBe(302);
    expect(res.headers.location, p).toBe(SIGNUP.en);
  }
});

test("short addresses ignore case, as phones capitalize the first letter", async () => {
  for (const [p, target] of [["/Newsletter", SIGNUP.de], ["/NEWSLETTER/", SIGNUP.de], ["/en/Newsletter", SIGNUP.en]]) {
    const res = await caddy.get(p);
    expect(res.status, p).toBe(302);
    expect(res.headers.location, p).toBe(target);
  }
});

test("short addresses drop the query", async () => {
  const res = await caddy.get("/newsletter?von=flyer");
  expect(res.headers.location).toBe(SIGNUP.de);
});

test("nothing else is redirected", async () => {
  for (const p of ["/newsletterx", "/newsletter/x", "/en/newsletter/x", "/de/newsletter"]) {
    expect((await caddy.get(p)).status, p).toBe(404);
  }
});
