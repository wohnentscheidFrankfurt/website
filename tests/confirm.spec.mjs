// Checks of /bestaetigen/. The API is faked: the tests never reach a server.
import { test, expect } from "@playwright/test";

const TOKEN = "abc123.def_456-xyz";
const INVALID = "Link ungültig oder abgelaufen. Trag dich einfach noch mal ein.";
const FAILED = "Das hat nicht geklappt. Versuch es später noch mal oder schreib uns.";
const MAIL = "info@wohnentscheid-frankfurt.de";

// Fakes POST /api/bestaetigen with the given status and records the bodies.
async function fake(page, status) {
  const bodies = [];
  await page.route("**/api/bestaetigen", async (route) => {
    bodies.push(route.request().postData());
    if (status === "network") return route.abort();
    await route.fulfill({ status, body: "" });
  });
  return bodies;
}

test("has title, h1, noindex and no band", async ({ page }) => {
  await fake(page, 200);
  await page.goto(`/bestaetigen/#${TOKEN}`);
  await expect(page).toHaveTitle("Anmeldung bestätigen – Wohnentscheid Frankfurt");
  await expect(page.locator("main h1")).toHaveText("Anmeldung bestätigen");
  await expect(page.locator("#bleib-informiert")).toHaveCount(0);
});

const WAIT = "Einen Moment, wir tragen dich ein …";
const RETRY = "Noch mal versuchen";

test("posts the token on load without a click", async ({ page }) => {
  const bodies = await fake(page, 200);
  await page.goto(`/bestaetigen/#${TOKEN}`);
  await expect(page.getByRole("status")).toHaveText("Du bist eingetragen. Danke!");
  expect(bodies).toHaveLength(1);
  expect(new URLSearchParams(bodies[0]).get("token")).toBe(TOKEN);
});

test("shows a wait text while the request runs", async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/bestaetigen", async (route) => {
    await gate;
    await route.fulfill({ status: 200, body: "" });
  });
  await page.goto(`/bestaetigen/#${TOKEN}`);
  await expect(page.getByRole("status")).toHaveText(WAIT);
  release();
  await expect(page.getByRole("status")).toHaveText("Du bist eingetragen. Danke!");
});

test("200 shows the thanks, no button; the token is posted, not shown", async ({ page }) => {
  await fake(page, 200);
  await page.goto(`/bestaetigen/#${TOKEN}`);
  await expect(page.getByRole("status")).toHaveText("Du bist eingetragen. Danke!");
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  expect(await page.content()).not.toContain(TOKEN);
  expect(page.url()).not.toContain("#");
  expect(page.url()).not.toContain(TOKEN);
});

test("after a 400 the fragment stays", async ({ page }) => {
  await fake(page, 400);
  await page.goto(`/bestaetigen/#${TOKEN}`);
  await expect(page.getByRole("status")).toHaveText(INVALID);
  expect(page.url()).toContain(`#${TOKEN}`);
});

test("400 shows the invalid text with a link to the form and no button", async ({ page }) => {
  const bodies = await fake(page, 400);
  await page.goto(`/bestaetigen/#${TOKEN}`);
  await expect(page.getByRole("status")).toHaveText(INVALID);
  await expect(page.getByRole("status").getByRole("link", { name: "noch mal ein" }))
    .toHaveAttribute("href", "/#bleib-informiert");
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  expect(bodies).toHaveLength(1);
});

for (const status of [500, 503, "network"]) {
  test(`${status} shows the error with a mailto and a retry button`, async ({ page }) => {
    const bodies = await fake(page, status);
    await page.goto(`/bestaetigen/#${TOKEN}`);
    await expect(page.getByRole("status")).toHaveText(FAILED);
    await expect(page.getByRole("status").getByRole("link", { name: "schreib uns" }))
      .toHaveAttribute("href", new RegExp(`^mailto:${MAIL}\\?subject=Bleib%20informiert`));
    const retry = page.getByRole("button", { name: RETRY });
    await expect(retry).toBeEnabled();
    await retry.click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(new URLSearchParams(bodies[1]).get("token")).toBe(TOKEN);
  });
}

test("an empty fragment shows the invalid text and no button", async ({ page }) => {
  const bodies = await fake(page, 200);
  await page.goto("/bestaetigen/");
  await expect(page.getByRole("status")).toHaveText(INVALID);
  await expect(page.getByRole("status").getByRole("link", { name: "noch mal ein" }))
    .toHaveAttribute("href", "/#bleib-informiert");
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  await expect(page.getByText(WAIT)).toBeHidden();
  expect(bodies).toEqual([]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("shows the mailto fallback and none of the script texts", async ({ page }) => {
    await page.goto(`/bestaetigen/#${TOKEN}`);
    // Playwright's text selectors skip <noscript>, so read the rendered text.
    const text = await page.locator("main .prose").evaluate((el) => el.innerText);
    expect(text).toContain("Schreib uns kurz, dann tragen wir dich ein.");
    expect(text).not.toContain("Einen Moment");
    expect(text).not.toContain("Link ungültig");
    const link = page.locator("main").getByRole("link", { name: MAIL });
    const href = new URL(await link.getAttribute("href"));
    expect(href.pathname).toBe(MAIL);
    expect(href.searchParams.get("subject")).toBe("Bleib informiert");
    expect(href.searchParams.get("body")).toBe("Bitte tragt mich in euren Newsletter ein.");
    await expect(page.locator("main").getByRole("button")).toBeHidden();
    await expect(page.getByText(INVALID)).toBeHidden();
  });
});

// The English page: same script, English strings and endpoint.
test.describe("English", () => {
  const EN_TOKEN = "abc123.def_456-xyz";
  const EN_INVALID = "This link is not valid or has expired. Just sign up again.";
  const EN_FAILED = "That did not work. Try again later or write to us.";

  async function fakeEn(page, status) {
    const bodies = [];
    await page.route("**/api/en/confirm", async (route) => {
      bodies.push(route.request().postData());
      await route.fulfill({ status, body: "" });
    });
    return bodies;
  }

  test("has title, h1, noindex and no band", async ({ page }) => {
    await fakeEn(page, 200);
    await page.goto(`/en/confirm/#${EN_TOKEN}`);
    await expect(page).toHaveTitle("Confirm your sign-up – Wohnentscheid Frankfurt");
    await expect(page.locator("main h1")).toHaveText("Confirm your sign-up");
    await expect(page.locator("#stay-informed")).toHaveCount(0);
  });

  test("posts the token to the English endpoint and shows the thanks", async ({ page }) => {
    const bodies = await fakeEn(page, 200);
    await page.goto(`/en/confirm/#${EN_TOKEN}`);
    await expect(page.getByRole("status")).toHaveText("You are signed up. Thank you!");
    expect(bodies).toHaveLength(1);
    expect(new URLSearchParams(bodies[0]).get("token")).toBe(EN_TOKEN);
    expect(page.url()).not.toContain("#");
  });

  test("400 shows the English invalid text with a link to the English band", async ({ page }) => {
    await fakeEn(page, 400);
    await page.goto(`/en/confirm/#${EN_TOKEN}`);
    await expect(page.getByRole("status")).toHaveText(EN_INVALID);
    await expect(page.getByRole("status").getByRole("link", { name: "sign up again" }))
      .toHaveAttribute("href", "/en/#stay-informed");
    await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  });

  test("an empty fragment shows the invalid text without a request", async ({ page }) => {
    const bodies = await fakeEn(page, 200);
    await page.goto("/en/confirm/");
    await expect(page.getByRole("status")).toHaveText(EN_INVALID);
    expect(bodies).toEqual([]);
  });

  test("500 shows the English error with the English mailto and a retry button", async ({ page }) => {
    const bodies = await fakeEn(page, 500);
    await page.goto(`/en/confirm/#${EN_TOKEN}`);
    await expect(page.getByRole("status")).toHaveText(EN_FAILED);
    await expect(page.getByRole("status").getByRole("link", { name: "write to us" }))
      .toHaveAttribute("href", new RegExp(`^mailto:${MAIL}\\?subject=Stay%20informed`));
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.poll(() => bodies.length).toBe(2);
  });

  test("the header switch keeps no fragment and leads to the German page", async ({ page }) => {
    await fakeEn(page, 200);
    await page.goto(`/en/confirm/#${EN_TOKEN}`);
    await expect(page.locator("header [data-lang-switch]")).toHaveAttribute("href", "/bestaetigen/");
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("shows the English mailto fallback", async ({ page }) => {
      await page.goto(`/en/confirm/#${EN_TOKEN}`);
      const text = await page.locator("main .prose").evaluate((el) => el.innerText);
      expect(text).toContain("Write to us by email, then we will sign you up.");
      expect(text).not.toContain("One moment");
      const href = new URL(await page.locator("main").getByRole("link", { name: MAIL }).getAttribute("href"));
      expect(href.searchParams.get("subject")).toBe("Stay informed");
      expect(href.searchParams.get("body")).toBe("Please add me to your newsletter.");
    });
  });
});
