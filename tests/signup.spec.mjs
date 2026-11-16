// End to end: the band form, the real API and Mailpit. Playwright starts all three (playwright.config.mjs).
import { test, expect } from "@playwright/test";
import { findMail } from "./mailpit.mjs";

const INFO = "info@wohnentscheid-frankfurt.de";
const CONFIRM_SUBJECT = "Bitte bestätige deine Anmeldung";
const INFO_SUBJECT = "Anmeldung Newsletter (Website)";
const address = () => `test-${crypto.randomUUID()}@example.org`;

test("sign-up, confirmation link and notice to info@", async ({ page }) => {
  const mail = address();
  await page.goto("/");
  const band = page.locator("#bleib-informiert");
  await band.getByLabel("Deine Mail-Adresse").fill(mail);
  await band.getByRole("button", { name: "Eintragen" }).click();
  await expect(page).toHaveURL(/\/danke\/$/);

  const confirmation = await findMail({ to: mail, subject: CONFIRM_SUBJECT });
  expect(confirmation).not.toBeNull();
  expect(confirmation.from).toBe(`"Wohnentscheid Frankfurt" <${INFO}>`);
  const link = confirmation.text.match(/http\S+/)?.[0];
  expect(link).toMatch(/^http:\/\/localhost:4322\/bestaetigen\/#/);

  // Opening the link is enough: the page posts the token by itself.
  await page.goto(link);
  await expect(page.getByText("Du bist eingetragen. Danke!")).toBeVisible();

  const notice = await findMail({ to: INFO, subject: INFO_SUBJECT, contains: mail });
  expect(notice).not.toBeNull();
  expect(notice.text.trim()).toMatch(
    new RegExp(`^Neue Anmeldung über die Website, bestätigt am \\d{2}\\.\\d{2}\\.\\d{4}, \\d{2}:\\d{2}: ${mail}$`),
  );
});

test("English sign-up, confirmation link and German notice to info@", async ({ page }) => {
  const mail = address();
  await page.goto("/en/");
  const band = page.locator("#stay-informed");
  await band.getByLabel("Your email address").fill(mail);
  await band.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/en\/thanks\/$/);

  const confirmation = await findMail({ to: mail, subject: "Please confirm your sign-up" });
  expect(confirmation).not.toBeNull();
  expect(confirmation.from).toBe(`"Wohnentscheid Frankfurt" <${INFO}>`);
  const link = confirmation.text.match(/http\S+/)?.[0];
  expect(link).toMatch(/^http:\/\/localhost:4322\/en\/confirm\/#/);

  await page.goto(link);
  await expect(page.getByText("You are signed up. Thank you!")).toBeVisible();

  const notice = await findMail({ to: INFO, subject: INFO_SUBJECT, contains: mail });
  expect(notice).not.toBeNull();
  expect(notice.text.trim()).toMatch(
    new RegExp(`^Neue Anmeldung über die englische Website, bestätigt am \\d{2}\\.\\d{2}\\.\\d{4}, \\d{2}:\\d{2}: ${mail}$`),
  );
});

test.describe("through the proxy", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "the API behaves the same in every browser");
  });
  const post = (request, form, headers = {}) =>
    request.post("/api/anmelden", { form, headers, maxRedirects: 0 });

  test("honeypot looks like success and sends nothing", async ({ request }) => {
    const mail = address();
    const res = await post(request, { email: mail, website: "http://spam.example" });
    expect(res.status()).toBe(303);
    expect(res.headers().location).toBe("/danke/");
    expect(await findMail({ to: mail, subject: CONFIRM_SUBJECT, timeoutMs: 2000 })).toBeNull();
  });

  test("invalid address goes to /fehler/", async ({ request }) => {
    const res = await post(request, { email: "kaputt", website: "" });
    expect(res.status()).toBe(303);
    expect(res.headers().location).toBe("/fehler/");
  });

  test("wrong origin goes to /fehler/", async ({ request }) => {
    const res = await post(request, { email: address(), website: "" }, { Origin: "http://evil.example" });
    expect(res.status()).toBe(303);
    expect(res.headers().location).toBe("/fehler/");
  });

  test("English honeypot looks like success and sends nothing", async ({ request }) => {
    const mail = address();
    const res = await request.post("/api/en/signup", { form: { email: mail, website: "x" }, maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(res.headers().location).toBe("/en/thanks/");
    expect(await findMail({ to: mail, subject: "Please confirm your sign-up", timeoutMs: 2000 })).toBeNull();
  });

  test("English invalid address and wrong origin go to /en/error/", async ({ request }) => {
    for (const [email, headers] of [["kaputt", {}], [address(), { Origin: "http://evil.example" }]]) {
      const res = await request.post("/api/en/signup", { form: { email, website: "" }, headers, maxRedirects: 0 });
      expect(res.status()).toBe(303);
      expect(res.headers().location).toBe("/en/error/");
    }
  });

  test("forged token on the English page shows the English invalid text", async ({ page }) => {
    await page.goto("/en/confirm/#abc.def");
    await expect(page.getByText(/^This link is not valid or has expired\./)).toBeVisible();
    await expect(page.getByRole("status").getByRole("link", { name: "sign up again" }))
      .toHaveAttribute("href", "/en/#stay-informed");
  });

  test("forged token shows the invalid text", async ({ page }) => {
    await page.goto("/bestaetigen/#abc.def");
    await expect(page.getByText(/^Link ungültig oder abgelaufen\./)).toBeVisible();
  });
});
