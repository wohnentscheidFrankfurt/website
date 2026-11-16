// Checks of the events page. They do not depend on the day the site is built.
import { test, expect } from "@playwright/test";

const GET_TOGETHER = "2026-11-28-get-together";
const KICKOFF = "2026-10-03-auftakt";
const article = (page, id) => page.locator(`article[data-event="${id}"]`);

test("events page sorts every event by the build day", async ({ page }) => {
  await page.goto("/veranstaltungen/");
  const buildDay = await page.locator("[data-build-day]").getAttribute("data-build-day");
  expect(buildDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  for (const day of await page.locator('[data-list="upcoming"] article').evaluateAll((els) => els.map((e) => e.dataset.day))) {
    expect(day >= buildDay).toBe(true);
  }
  for (const day of await page.locator('[data-list="past"] article').evaluateAll((els) => els.map((e) => e.dataset.day))) {
    expect(day < buildDay).toBe(true);
  }
  const ids = await page.locator("article[data-event]").evaluateAll((els) => els.map((e) => e.dataset.event));
  expect(ids).toContain(GET_TOGETHER);
  expect(ids).toContain(KICKOFF);
});

test("the callout shows on the same cards in German and English", async ({ page }) => {
  const withCallout = async (path) => {
    await page.goto(path);
    return page.locator("article[data-event]:has(.callout)").evaluateAll((els) => els.map((e) => e.dataset.event));
  };
  const german = await withCallout("/veranstaltungen/");
  expect(await withCallout("/en/events/")).toEqual(german);
});

test("every event has an anchor below the sticky header", async ({ page }) => {
  await page.goto("/veranstaltungen/");
  const header = (await page.locator("header").boundingBox()).height;
  const anchors = await page.locator("article[data-event]").evaluateAll((els) =>
    els.map((e) => ({ id: e.id, event: e.dataset.event, margin: parseFloat(getComputedStyle(e).scrollMarginTop) })));
  expect(anchors.length).toBeGreaterThan(0);
  for (const a of anchors) {
    expect(a.id).toBe(a.event);
    expect(a.margin).toBeGreaterThanOrEqual(header + 44); // the cut corners hang 44 px below the header
  }
});

test("an empty upcoming list says that new dates follow", async ({ page }) => {
  await page.goto("/veranstaltungen/");
  const empty = (await page.locator('[data-list="upcoming"] article').count()) === 0;
  await expect(page.getByText("Neue Termine folgen bald.")).toHaveCount(empty ? 1 : 0);
});

test("each event shows a date bar, title, time and place", async ({ page }) => {
  await page.goto("/veranstaltungen/");
  const card = article(page, GET_TOGETHER);
  await expect(card.getByText("Sa. 28. November 2026")).toBeVisible();
  await expect(card.getByText("Get Together: Anders Wohnen")).toBeVisible();
  await expect(card.getByText("14:00 – ca. 17:30 Uhr · Einlass 13:30 Uhr")).toBeVisible();
  await expect(card.getByText("Villa Gründergeist").first()).toBeVisible();
});

test("upcoming cards show the invitation, past cards the review", async ({ page }) => {
  await page.goto("/veranstaltungen/");
  const invitation = "Kommt dazu und bringt Eure Leute mit!";
  // The Get Together has a callout. Where it sits depends on the build day.
  const getTogether = article(page, GET_TOGETHER);
  if (await page.locator(`[data-list="upcoming"] article[data-event="${GET_TOGETHER}"]`).count()) {
    await expect(getTogether.getByText(invitation)).toBeVisible();
    await expect(getTogether.locator(".callout")).toHaveText("28. November | 14 Uhr | Villa Gründergeist");
    // Screen readers skip the separators.
    const seps = await getTogether.locator(".callout .sep")
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-hidden")));
    expect(seps).toEqual(["true", "true"]);
    // Red only in the logo and drawings: the callout is ink and bold.
    const callout = await getTogether.locator(".callout").evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, weight: Number(s.fontWeight) };
    });
    expect(callout.color).toBe("rgb(17, 17, 17)");
    expect(callout.weight).toBeGreaterThanOrEqual(700);
  } else {
    await expect(getTogether.getByText(invitation)).toHaveCount(0);
    await expect(getTogether.locator(".callout")).toHaveCount(0);
  }
  await expect(page.locator('[data-list="past"] .callout')).toHaveCount(0);
  const past = article(page, KICKOFF);
  await expect(page.locator(`[data-list="past"] article[data-event="${KICKOFF}"]`)).toHaveCount(1);
  await expect(past.getByText("Zum Auftakt kamen viele Menschen")).toBeVisible();
});

test("kick-off gallery opens large images", async ({ page, request }) => {
  await page.goto("/veranstaltungen/");
  const gallery = article(page, KICKOFF).locator(".gallery");
  await expect(gallery.locator("li.photo img")).toHaveCount(1);
  await expect(gallery.locator("li.flipchart img")).toHaveCount(4);
  await expect(gallery.locator("li.photo a")).toHaveCount(0);
  const links = gallery.locator("li.flipchart a");
  await expect(links).toHaveCount(4);
  for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
    expect(href).toMatch(/\.webp$/);
    expect((await request.get(href)).status()).toBe(200);
  }
});

test("the photo is sepia and the flipcharts are not", async ({ page }) => {
  await page.goto("/veranstaltungen/");
  const gallery = article(page, KICKOFF).locator(".gallery");
  const filters = (sel) => gallery.locator(sel).evaluateAll((els) => els.map((e) => getComputedStyle(e).filter));
  const photo = await filters("li.photo img");
  expect(photo).toHaveLength(1);
  expect(photo[0]).toContain("sepia");
  for (const f of await filters("li.flipchart img")) expect(f).toBe("none");
});

test("all event images have German alt texts", async ({ page }) => {
  await page.goto("/veranstaltungen/");
  const alts = await page.locator("main img:not(.heart)").evaluateAll((els) => els.map((e) => e.getAttribute("alt")));
  expect(alts.length).toBeGreaterThan(0);
  for (const alt of alts) expect(alt?.trim().length).toBeGreaterThan(0);
});

test.describe("English events page", () => {
  test("has English headings and the Get Together card", async ({ page }) => {
    await page.goto("/en/events/");
    await expect(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Coming up" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Past events" })).toBeVisible();
    const card = article(page, GET_TOGETHER);
    await expect(card.getByText("Sat 28 November 2026")).toBeVisible();
    await expect(card.getByRole("heading", { name: "Get Together: Housing for All" })).toBeVisible();
    await expect(card.getByText("2 pm – about 5:30 pm · Doors open 1:30 pm")).toBeVisible();
    await expect(card.getByText("near Alte Oper")).toBeVisible();
    await expect(card.locator(".body p")).toHaveCount(2);
    await expect(card.locator(".body p").nth(1)).toHaveText("Everyone is welcome. Come and bring your friends!");
    await expect(card.locator(".callout")).toHaveText("28 November | 2 pm | Villa Gründergeist");
  });

  test("the past card shows the English review and captions", async ({ page }) => {
    await page.goto("/en/events/");
    const past = article(page, KICKOFF);
    await expect(past.locator(".review")).toContainText("Many people came to the Dondorf Druckerei");
    await expect(past.locator("figcaption")).toHaveText([
      "Land, public housing & cooperatives",
      "Empty buildings, new use & extra floors",
      "Rents & climate",
      "Housing for all?",
    ]);
    // The large images are still reachable.
    await expect(past.locator(".gallery li.flipchart a")).toHaveCount(4);
    await expect(past.locator(".gallery li.photo img")).toHaveAttribute("alt", /.+/);
  });

  test("every image has an alt text and no German text shows", async ({ page }) => {
    await page.goto("/en/events/");
    const alts = await page.locator("main img").evaluateAll((els) => els.map((e) => e.getAttribute("alt")));
    expect(alts.length).toBeGreaterThan(0);
    for (const alt of alts) expect(alt?.trim().length).toBeGreaterThan(0);
    await expect(page.locator("main")).not.toContainText("Uhr");
  });
});
