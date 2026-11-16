import { test } from "node:test";
import assert from "node:assert/strict";
import { berlinDateTime, confirmationMail, notificationMail, transportOptions } from "../../api/src/mail.ts";

test("confirmation mail text", () => {
  const m = confirmationMail("anna@example.org", "https://wohnentscheid-frankfurt.de/bestaetigen/#abc");
  assert.equal(m.to, "anna@example.org");
  assert.equal(m.subject, "Bitte bestätige deine Anmeldung");
  assert.equal(
    m.text,
    `Hallo,

jemand hat diese Adresse für den Newsletter des Wohnentscheids Frankfurt eingetragen.
Warst du das? Dann bestätige hier:

https://wohnentscheid-frankfurt.de/bestaetigen/#abc

Der Link gilt 72 Stunden. Warst du es nicht, ignoriere diese Mail. Dann passiert nichts.

Wohnentscheid Frankfurt
https://wohnentscheid-frankfurt.de/
`,
  );
});

test("English confirmation mail text", () => {
  const m = confirmationMail("anna@example.org", "https://wohnentscheid-frankfurt.de/en/confirm/#abc", "en");
  assert.equal(m.to, "anna@example.org");
  assert.equal(m.subject, "Please confirm your sign-up");
  assert.equal(
    m.text,
    `Hello,

someone entered this address for the newsletter of Wohnentscheid Frankfurt.
Was it you? Then confirm here:

https://wohnentscheid-frankfurt.de/en/confirm/#abc

The link is valid for 72 hours. If it was not you, ignore this email. Then nothing happens.

Wohnentscheid Frankfurt
https://wohnentscheid-frankfurt.de/en/
`,
  );
});

test("English notification mail is German, names the English site and holds one address", () => {
  const m = notificationMail("anna@example.org", new Date("2026-11-13T13:05:00Z"), "info@example.org", "en");
  assert.equal(m.to, "info@example.org");
  assert.equal(m.subject, "Anmeldung Newsletter (Website)");
  assert.equal(m.text, "Neue Anmeldung über die englische Website, bestätigt am 13.11.2026, 14:05: anna@example.org\n");
  assert.equal(m.text.match(/@/g)?.length, 1);
});

test("notification mail in winter time", () => {
  const m = notificationMail("anna@example.org", new Date("2026-11-13T13:05:00Z"), "info@example.org");
  assert.equal(m.to, "info@example.org");
  assert.equal(m.subject, "Anmeldung Newsletter (Website)");
  assert.equal(m.text, "Neue Anmeldung über die Website, bestätigt am 13.11.2026, 14:05: anna@example.org\n");
});

test("notification mail in summer time", () => {
  const m = notificationMail("anna@example.org", new Date("2026-07-01T13:05:00Z"), "info@example.org");
  assert.equal(m.text, "Neue Anmeldung über die Website, bestätigt am 01.07.2026, 15:05: anna@example.org\n");
});

test("berlinDateTime pads and uses Berlin time", () => {
  assert.equal(berlinDateTime(new Date("2026-01-02T23:30:00Z")), "03.01.2026, 00:30");
});

for (const tls of ["starttls", "none"] as const) {
  test(`transport options carry short timeouts (${tls})`, () => {
    const o = transportOptions({ host: "h", port: 1, tls, user: "u", password: "p" });
    assert.equal(o.connectionTimeout, 10_000);
    assert.equal(o.greetingTimeout, 10_000);
    assert.equal(o.socketTimeout, 20_000);
  });
}
