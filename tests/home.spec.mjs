// Checks of the start page. They do not depend on the day the site is built.
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const DESKTOP = "desktop-chrome";
const hero = (page) => page.locator("[data-hero]");
const titleImage = (page) => hero(page).locator('img[alt^="Zeichnung: "], img[alt^="Drawing: "]');
const intro = (page) => hero(page).locator("[data-intro]");
const next = (page) => page.locator("section[data-next]");
const flyer = (page) => next(page).locator("a[data-flyer]");
const timer = (page) => next(page).locator("[data-countdown]");
const MINUTE = 60_000;
// The countdown holds hidden parts. Compare the text a reader sees.
const SEEN = { useInnerText: true };

// Ids of the upcoming events, read from the events page.
async function upcomingIds(page) {
  await page.goto("/veranstaltungen/");
  return page.locator('[data-list="upcoming"] article').evaluateAll((els) => els.map((e) => e.dataset.event));
}

// Does the start page show a flyer? Only while an upcoming event has one.
async function showsFlyer(page) {
  await page.goto("/");
  return (await flyer(page).count()) > 0;
}

// Upcoming events whose Markdown sets a flyer, in date order.
const withFlyer = (ids) => ids.filter((id) => /^flyer:/m.test(readFileSync(`src/content/events/${id}.md`, "utf8")));

// Start and end of the countdown, read from the page.
async function times(page) {
  const { start, end } = await timer(page).evaluate((el) => ({ start: el.dataset.start, end: el.dataset.end }));
  return { start: new Date(start), end: end ? new Date(end) : undefined };
}

// The page at a fixed moment. The clock keeps the timers running.
async function openAt(page, now) {
  await page.clock.setFixedTime(now);
  await page.goto("/");
}

test("hero shows drawing and intro", async ({ page }) => {
  await page.goto("/");
  const img = titleImage(page);
  await expect(img).toBeVisible();
  expect(await img.getAttribute("loading")).not.toBe("lazy");
  // White page, white drawing: no multiply.
  expect(await img.evaluate((el) => getComputedStyle(el).mixBlendMode)).toBe("normal");
  // The red logo is the title. The intro has no heading of its own.
  const title = page.getByRole("heading", { level: 1, name: "Wohnentscheid Frankfurt" });
  await expect(title).toHaveCount(1);
  await expect(title.locator('img[alt="Wohnentscheid Frankfurt"]')).toBeVisible();
  await expect(intro(page).locator("h1, h2, h3")).toHaveCount(0);
  await expect(intro(page)).toContainText("Unsere Utopie: Bezahlbarer Wohnraum für Alle.");
  await expect(page.locator("main .heart")).toHaveCount(0);
});

for (const home of ["/", "/en/"]) test(`desktop shows a big drawing with air below the header on ${home}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "1400 × 900 window");
  await page.goto(home);
  const drawing = await titleImage(page).boundingBox();
  const header = await page.locator("header").boundingBox();
  expect(drawing.width).toBeGreaterThanOrEqual(760);
  expect(drawing.y - (header.y + header.height)).toBeGreaterThanOrEqual(40);
});

// The oval island fills the drawing's lower right. So the intro stands beside the drawing, never on it.
// Its bottom sits on the drawing's bottom. Its top stays below the drawing's top.
for (const [width, home] of [900, 1024, 1120, 1400, 1920].flatMap((w) => [[w, "/"], [w, "/en/"]])) {
  test(`desktop puts the intro lower right beside the drawing at ${width} px on ${home}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, "desktop layout");
    await page.setViewportSize({ width, height: 900 });
    await page.goto(home);
    await page.evaluate(() => document.fonts.ready);
    const drawing = await titleImage(page).boundingBox();
    const block = await intro(page).boundingBox();
    expect(block.x).toBeGreaterThanOrEqual(drawing.x + drawing.width - 1);
    expect(block.y).toBeGreaterThanOrEqual(drawing.y);
    expect(Math.abs(block.y + block.height - (drawing.y + drawing.height))).toBeLessThanOrEqual(1);
    expect(block.x + block.width).toBeLessThanOrEqual(width);
  });
}

for (const home of ["/", "/en/"]) test(`phones show the drawing first, then the intro on ${home}`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === DESKTOP, "phone layout");
  await page.goto(home);
  const drawing = await titleImage(page).boundingBox();
  const block = await intro(page).boundingBox();
  const header = await page.locator("header").boundingBox();
  expect(drawing.y - (header.y + header.height)).toBeGreaterThanOrEqual(16);
  expect(block.y).toBeGreaterThanOrEqual(drawing.y + drawing.height);
});

test("without a flyer the next events list is compact and links to the event", async ({ page }) => {
  const ids = await upcomingIds(page);
  test.skip(await showsFlyer(page), "the start page shows a flyer");
  await expect(next(page).getByRole("heading", { name: "Nächste Veranstaltungen" })).toBeVisible();
  const articles = next(page).locator("article");
  await expect(articles).toHaveCount(Math.min(ids.length, 3));
  if (ids.length === 0) {
    await expect(next(page).getByText("Neue Termine folgen bald.")).toBeVisible();
    await expect(next(page).locator(".side p")).toHaveCount(0);
    await expect(next(page).getByRole("link", { name: "Alle Veranstaltungen" })).toBeVisible();
    return;
  }
  await expect(next(page).locator(".side p")).toBeVisible();
  // Cards like b-side: a soft shadow, no multiply on the thumbnail.
  const cardStyle = await next(page).locator("a.card").first().evaluate((el) => ({
    shadow: getComputedStyle(el).boxShadow,
    blend: getComputedStyle(el.querySelector("img")).mixBlendMode,
  }));
  expect(cardStyle.shadow).not.toBe("none");
  expect(cardStyle.blend).toBe("normal");
  // The link name is the title plus the date.
  const card = next(page).locator("a.card").first();
  const title = (await next(page).locator("article h3").first().textContent()).trim();
  const date = (await next(page).locator("article .bar").first().textContent()).trim();
  const name = await card.evaluate((el) => {
    const ids = el.getAttribute("aria-labelledby").split(" ");
    return ids.map((id) => document.getElementById(id).textContent.trim()).join(" ");
  });
  expect(name.startsWith(title)).toBe(true);
  expect(name).toContain(date);
  await expect(page.getByRole("link", { name: new RegExp(`^${title}.*${date}`) }).first()).toBeVisible();
  const hrefs = await next(page).locator("a.card").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs).toHaveLength(Math.min(ids.length, 3));
  hrefs.forEach((href, i) => expect(href).toMatch(new RegExp(`/veranstaltungen/#${ids[i]}$`)));
  await next(page).locator("a.card").first().click();
  await expect(page).toHaveURL(new RegExp(`/veranstaltungen/#${ids[0]}$`));
  const target = page.locator(`article[id="${ids[0]}"]`);
  await expect(target).toBeInViewport();
  // The sticky header does not cover the target.
  const header = await page.locator("header").boundingBox();
  expect((await target.boundingBox()).y).toBeGreaterThanOrEqual(header.y + header.height - 1);
});

test("first event is visible without scrolling on desktop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "1400 × 900 window");
  test.skip(await showsFlyer(page), "the start page shows a flyer");
  await page.evaluate(() => document.fonts.ready);
  const first = next(page).locator("article").first();
  const target = (await first.count()) ? first : next(page).getByText("Neue Termine folgen bald.");
  const box = await target.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
});

test("without a flyer the button leads to all events", async ({ page }) => {
  test.skip(await showsFlyer(page), "the start page shows a flyer");
  await page.getByRole("link", { name: "Alle Veranstaltungen" }).click();
  await expect(page).toHaveURL(/\/veranstaltungen\/$/);
});

test("start page shows a flyer exactly when an upcoming event has one", async ({ page }) => {
  const ids = await upcomingIds(page);
  expect(await showsFlyer(page)).toBe(withFlyer(ids).length > 0);
});

test("flyer links to its event and has the full text as alt", async ({ page }) => {
  const ids = await upcomingIds(page);
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  await expect(next(page).getByRole("heading", { name: "Nächste Veranstaltung", exact: true })).toHaveCount(1);
  await expect(next(page).locator("a")).toHaveCount(1);
  const href = await flyer(page).getAttribute("href");
  const id = href.match(/^\/veranstaltungen\/#(.+)$/)[1];
  expect(ids).toContain(id);
  // The first upcoming event with a flyer.
  expect(id).toBe(withFlyer(ids)[0]);
  const alt = readFileSync(`src/content/events/${id}.md`, "utf8").match(/^flyerAlt: "(.*)"$/m)[1];
  const img = flyer(page).locator("picture img");
  await expect(img).toHaveAttribute("alt", alt);
  await expect(img).toBeVisible();
  expect(await img.getAttribute("loading")).not.toBe("lazy");
  const types = await flyer(page).locator("picture source").evaluateAll((els) => els.map((e) => e.type));
  expect(types).toEqual(["image/avif", "image/webp"]);
  expect(await img.getAttribute("src")).toMatch(/\.webp$/);
  // No side text and no button while a flyer shows.
  await expect(next(page).locator(".side")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Alle Veranstaltungen" })).toHaveCount(0);
  await flyer(page).click();
  await expect(page).toHaveURL(new RegExp(`/veranstaltungen/#${id}$`));
  await expect(page.locator(`article[id="${id}"]`)).toBeInViewport();
});

test("flyer link has a short name: title and date", async ({ page }) => {
  await page.goto("/veranstaltungen/");
  const events = await page.locator('[data-list="upcoming"] article').evaluateAll((els) => els.map((e) => ({
    id: e.dataset.event, title: e.querySelector("h3").textContent.trim(), bar: e.querySelector(".bar").textContent.trim(),
  })));
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  const id = (await flyer(page).getAttribute("href")).split("#")[1];
  const event = events.find((e) => e.id === id);
  // "Get Together: Anders Wohnen – Sa. 28. November 2026", not the long alt text.
  await expect(flyer(page)).toHaveAccessibleName(`${event.title} – ${event.bar}`);
});

test("countdown counts days, hours and minutes and updates", async ({ page }) => {
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  const { start } = await times(page);
  const left = (16 * 24 * 60 + 20 * 60 + 12) * MINUTE;
  // 30 s more than 16 d 20 h 12 min: minutes round down.
  await page.clock.install({ time: new Date(+start - left - 30_000) });
  await page.goto("/");
  const el = timer(page);
  await expect(el).toHaveAttribute("role", "timer");
  await expect(el).not.toHaveAttribute("aria-live", /.*/);
  await expect(el).toBeVisible();
  await expect(el).toContainText("noch", SEEN);
  await expect(el).toContainText("16 Tage", SEEN);
  await expect(el).toContainText("20 Stunden", SEEN);
  await expect(el).toContainText("12 Minuten", SEEN);
  // The date line is gone once the script runs.
  await expect(el.locator("[data-date]")).toBeHidden();
  await page.clock.runFor(MINUTE);
  await expect(el).toContainText("11 Minuten", SEEN);
  // The numbers are big, black and condensed.
  const style = await el.locator("[data-days]").evaluate((n) => {
    const s = getComputedStyle(n);
    return { family: s.fontFamily, size: parseFloat(s.fontSize), weight: s.fontWeight, stretch: parseFloat(s.fontStretch) };
  });
  expect(style.family).toContain("Archivo");
  expect(style.size).toBeGreaterThanOrEqual(40);
  expect(style.weight).toBe("900");
  expect(style.stretch).toBeLessThanOrEqual(75);
});

test("countdown catches up when the tab becomes visible again", async ({ page }) => {
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  const { start } = await times(page);
  await page.clock.install({ time: new Date(+start - (2 * 60 + 30) * MINUTE - 30_000) });
  await page.goto("/");
  await expect(timer(page)).toContainText("30 Minuten", SEEN);
  // A background tab: time passes, but no timer fires.
  await page.clock.setSystemTime(new Date(+start - (2 * 60 + 20) * MINUTE - 30_000));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(timer(page)).toContainText("20 Minuten", SEEN);
});

// Without a layout shift: before the script runs, the countdown is as high as the clock it fills.
test("countdown does not push the flyer down when the script runs", async ({ page }) => {
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  const { start } = await times(page);
  // Same font in both measurements.
  await page.route(/\.woff2?$/, (route) => route.abort());
  const flyerTop = () => page.evaluate(async () => {
    await document.fonts.ready;
    return document.querySelector("a[data-flyer]").getBoundingClientRect().top;
  });
  await openAt(page, new Date(+start - 24 * 60 * MINUTE));
  await expect(timer(page)).toContainText("Tag", SEEN);
  const after = await flyerTop();
  // The same page as it is before the countdown script runs: the page without that script.
  await page.route("/", async (route) => {
    const html = await (await route.fetch()).text();
    const body = html.replace(/<script type="module">(?:(?!<\/script>)[\s\S])*data-countdown[\s\S]*?<\/script>/, "");
    expect(body).not.toBe(html);
    await route.fulfill({ body, contentType: "text/html" });
  });
  await page.goto("/");
  expect(Math.abs((await flyerTop()) - after)).toBeLessThanOrEqual(1);
});

test("countdown uses the singular", async ({ page }) => {
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  const { start } = await times(page);
  await openAt(page, new Date(+start - (24 * 60 + 60 + 1) * MINUTE));
  await expect(timer(page)).toContainText("1 Tag", SEEN);
  await expect(timer(page)).toContainText("1 Stunde", SEEN);
  await expect(timer(page)).toContainText("1 Minute", SEEN);
  await expect(timer(page)).not.toContainText(/Tage|Stunden|Minuten/, SEEN);
});

test("countdown says it runs during the event and hides after", async ({ page }) => {
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  const { start, end } = await times(page);
  if (end) {
    await openAt(page, new Date(+start + MINUTE));
    // innerText follows text-transform, so compare without case.
    await expect(timer(page)).toHaveText("Läuft gerade", { ...SEEN, ignoreCase: true });
    await expect(timer(page)).toBeVisible();
    // A big display line: condensed capitals.
    const style = await timer(page).locator("[data-running]").evaluate((el) => {
      const s = getComputedStyle(el);
      return { case: s.textTransform, weight: s.fontWeight, stretch: parseFloat(s.fontStretch) };
    });
    expect(style.case).toBe("uppercase");
    expect(style.weight).toBe("800");
    expect(style.stretch).toBeLessThanOrEqual(75);
  }
  await openAt(page, new Date(+(end ?? start) + MINUTE));
  await expect(timer(page)).toBeHidden();
  // The flyer stays until the next build.
  await expect(flyer(page)).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("countdown shows the date line", async ({ page }) => {
    await page.goto("/veranstaltungen/");
    const days = await page.locator('[data-list="upcoming"] article').evaluateAll((els) => els.map((e) => ({
      id: e.dataset.event,
      bar: e.querySelector(".bar").textContent.trim(),
      when: e.querySelector(".when").textContent.trim(),
    })));
    test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
    const id = (await flyer(page).getAttribute("href")).split("#")[1];
    const event = days.find((d) => d.id === id);
    // "Sa. 28. November 2026 · 14:00 Uhr"
    await expect(timer(page)).toHaveText(`${event.bar} · ${event.when.split(" ")[0]} Uhr`, SEEN);
    await expect(timer(page)).toBeVisible();
    // Normal case at the wide width, like the countdown labels.
    const style = await timer(page).locator("[data-date]").evaluate((el) => {
      const s = getComputedStyle(el);
      return { weight: s.fontWeight, stretch: parseFloat(s.fontStretch) };
    });
    expect(style.weight).toBe("700");
    expect(style.stretch).toBeGreaterThanOrEqual(80);
  });
});

test("flyer has rounded corners and grows on hover", async ({ page }, testInfo) => {
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  const link = flyer(page);
  const style = await link.evaluate((el) => ({
    radius: getComputedStyle(el).borderTopLeftRadius,
    imgRadius: getComputedStyle(el.querySelector("img")).borderTopLeftRadius,
    property: getComputedStyle(el).transitionProperty,
    duration: getComputedStyle(el).transitionDuration,
    timing: getComputedStyle(el).transitionTimingFunction,
  }));
  expect(style.radius).toBe("8px");
  expect(style.imgRadius).toBe("8px");
  expect(style.property).toContain("transform");
  expect(style.duration).toContain("0.3s");
  expect(style.timing).toContain("ease-in-out");
  if (testInfo.project.name !== DESKTOP) return;
  await link.hover();
  await expect.poll(() => link.evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
  await expect.poll(() => link.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
  // A visible focus ring in ink, not red.
  await page.mouse.move(0, 0);
  await page.keyboard.press("Tab");
  await link.focus();
  const ring = await link.evaluate((el) => ({
    visible: el.matches(":focus-visible"), style: getComputedStyle(el).outlineStyle,
    color: getComputedStyle(el).outlineColor,
  }));
  expect(ring).toEqual({ visible: true, style: "solid", color: "rgb(17, 17, 17)" });
});

test("flyer does not grow under reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "hover with a mouse");
  await page.emulateMedia({ reducedMotion: "reduce" });
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  await flyer(page).hover();
  await page.waitForTimeout(400);
  expect(await flyer(page).evaluate((el) => getComputedStyle(el).transform)).toBe("none");
});

test("countdown and top of the flyer are visible without scrolling on desktop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "1400 × 900 window");
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  // One day before the start, so the clock shows on any day the build still shows the flyer.
  const { start } = await times(page);
  await openAt(page, new Date(+start - 24 * 60 * MINUTE));
  await page.evaluate(() => document.fonts.ready);
  await expect(timer(page)).toBeInViewport({ ratio: 1 });
  const box = await flyer(page).boundingBox();
  expect(box.y + 40).toBeLessThanOrEqual(page.viewportSize().height);
});

test("flyer is centred and at most 440 px wide", async ({ page }, testInfo) => {
  test.skip(!(await showsFlyer(page)), "no upcoming event with a flyer");
  const box = await flyer(page).boundingBox();
  const main = await page.locator("main").evaluate((el) => {
    const r = el.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(el).paddingLeft);
    return { left: r.left + pad, width: r.width - 2 * pad };
  });
  expect(box.width).toBeLessThanOrEqual(441);
  expect(Math.abs(box.x + box.width / 2 - (main.left + main.width / 2))).toBeLessThanOrEqual(1);
  // On phones the flyer fills the content column.
  if (testInfo.project.name !== DESKTOP) expect(box.width).toBeGreaterThanOrEqual(Math.min(main.width, 440) - 1);
});

// Like b-side: the red logo stands in the drawing's upper left, half on it, half above it. It stays on the screen.
// Its width: 28 % of the hero on desktop, 45 % of the hero on phones, at most 280 px.
// The house is small, the lettering big, so the logo is wider than high.
// 800 px: the 280 px cap. 1216 px: the logo starts to stick out left of the drawing.
for (const [width, home] of [390, 800, 900, 1024, 1216, 1400, 1920].flatMap((w) => [[w, "/"], [w, "/en/"]])) {
  test(`red logo stands half on the drawing at ${width} px on ${home}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP && width !== 390, "one phone width");
    // The desktop window tests the wider widths, also 800 px with the phone layout.
    test.skip(testInfo.project.name === DESKTOP && width === 390, "phones test this");
    if (testInfo.project.name === DESKTOP) await page.setViewportSize({ width, height: 900 });
    await page.goto(home);
    const logo = await page.locator("h1 img").boundingBox();
    const drawing = await titleImage(page).boundingBox();
    const header = await page.locator("header").boundingBox();
    expect(logo.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(logo.y).toBeLessThan(drawing.y);
    expect(logo.y + logo.height).toBeGreaterThan(drawing.y + 0.1 * drawing.height);
    expect(logo.y + logo.height).toBeLessThan(drawing.y + 0.6 * drawing.height);
    expect(logo.x).toBeGreaterThanOrEqual(0);
    expect(logo.x).toBeLessThan(drawing.x + 0.1 * drawing.width);
    const hero = await page.locator("[data-hero]").evaluate((el) => el.clientWidth);
    const vw = page.viewportSize().width;
    const expected = vw >= 900 ? 0.28 * hero : Math.min(0.45 * hero, 280);
    expect(Math.abs(logo.width - expected)).toBeLessThanOrEqual(2);
    expect(logo.x + logo.width).toBeLessThanOrEqual(vw);
    expect(logo.height).toBeLessThan(0.75 * logo.width);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize().width);
  });
}

test("red logo is red", async ({ page }) => {
  await page.goto("/");
  // The logo is red ink on white. drawImage takes the source the browser chose (currentSrc), so this samples the
  // AVIF or WebP the page really shows.
  const logo = page.locator("h1 img");
  // Under load WebKit can report the image as decoded and still draw a blank first frame. So wait for the load,
  // then sample until the logo shows red. A logo that is really not red still fails, after the bound.
  await logo.evaluate((img) => (img.complete && img.naturalWidth > 0
    ? undefined
    : new Promise((resolve, reject) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", reject, { once: true });
    })));
  await logo.evaluate((img) => img.decode());
  const sample = () => logo.evaluate((img) => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let red = 0;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) red++;
      else if (d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 90) dark++;
    }
    return { red, dark };
  });
  await expect.poll(async () => (await sample()).red, { timeout: 5000 }).toBeGreaterThan(1000);
  const share = await sample();
  expect(share.red).toBeGreaterThan(1000);
  expect(share.dark).toBeLessThan(share.red / 50);
});

// The English start page. The German checks above run on "/".
const FLYER_ALT_EN = readFileSync("src/content/events/2026-11-28-get-together.md", "utf8")
  .match(/^ {2}flyerAlt: "(.*)"$/m)[1];
const DRAWING_ALT_EN =
  "Drawing: Three apartment buildings on an oval island: an old building with a tower, a long block and a building with eight sides. Solar panels and raised beds on the roofs. Between them a round garden with trees. People play chess, skip rope and ride bikes.";
const GET_TOGETHER = "2026-11-28-get-together";

test.describe("English start page", () => {
  async function openEn(page, now) {
    if (now) await page.clock.setFixedTime(now);
    await page.goto("/en/");
  }

  test("hero has the English drawing text and intro", async ({ page }) => {
    await page.goto("/en/");
    await expect(titleImage(page)).toHaveAttribute("alt", DRAWING_ALT_EN);
    await expect(intro(page)).toContainText("Our dream: good homes that everyone can pay for.");
    await expect(page.getByRole("heading", { level: 1, name: "Wohnentscheid Frankfurt" })).toHaveCount(1);
  });

  test("the flyer is the English one and links to the English event", async ({ page }) => {
    await page.goto("/en/");
    await expect(next(page).getByRole("heading", { name: "Next event", exact: true })).toHaveCount(1);
    await expect(flyer(page)).toHaveAttribute("href", `/en/events/#${GET_TOGETHER}`);
    await expect(flyer(page).locator("picture img")).toHaveAttribute("alt", FLYER_ALT_EN);
    await expect(flyer(page)).toHaveAccessibleName("Get Together: Housing for All – Sat 28 November 2026");
    // The English flyer file, not the German one.
    expect(await flyer(page).locator("picture img").getAttribute("src")).toContain("flyer-en");
  });

  test("countdown reads in English", async ({ page }) => {
    await page.goto("/en/");
    const { start } = await times(page);
    await openEn(page, new Date(+start - (3 * 24 * 60 + 5 * 60 + 1) * MINUTE - 30_000));
    await expect(timer(page).locator(".noch")).toHaveText("in", SEEN);
    await expect(timer(page)).toContainText("3 days", SEEN);
    await expect(timer(page)).toContainText("5 hours", SEEN);
    await expect(timer(page)).toContainText("1 minute", SEEN);
    await expect(timer(page)).not.toContainText(/minutes/, SEEN);
    await openEn(page, new Date(+start - (24 * 60 + 60 + 2) * MINUTE));
    await expect(timer(page)).toContainText("1 day", SEEN);
    await expect(timer(page)).toContainText("1 hour", SEEN);
    await openEn(page, new Date(+start + MINUTE));
    await expect(timer(page)).toHaveText("Happening now", { ...SEEN, ignoreCase: true });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the date line shows the 12 h start time", async ({ page }) => {
      await page.goto("/en/");
      await expect(timer(page)).toHaveText("Sat 28 November 2026 · 2 pm", SEEN);
    });
  });
});

// The German start page promotes the map "Sozialraum Frankfurt". The map is German only, so /en/ has no teaser.
const MAP = "/sozialraum-frankfurt/";
const TEASER_TEXT = "Wir haben ein Tool gebaut, um die Gebiete Frankfurts für eine andere Wohn- und Klimapolitik "
  + "aufzuschlüsseln. Schaut gerne rein, und gewinnt neue Perspektiven!";

test("the German start page promotes the map", async ({ page }) => {
  await page.goto("/");
  const teaser = page.locator("section.map-teaser");
  await expect(teaser).toBeVisible();
  await expect(teaser.getByRole("heading", { level: 2 })).toHaveText("Sozialraum Frankfurt");
  await expect(teaser.getByText(TEASER_TEXT, { exact: true })).toBeVisible();
  const button = teaser.getByRole("link", { name: "Zur Karte", exact: true });
  await expect(button).toHaveAttribute("href", MAP);
  await expect(teaser.locator(`a[href="${MAP}"] img`)).toBeVisible();
  await expect(teaser.getByText("Hintergrund: © basemap.de / BKG, CC BY 4.0", { exact: true })).toBeVisible();
  await expect(teaser.getByRole("link", { name: "basemap.de" })).toHaveAttribute("href", "https://basemap.de");
  // Order: next events, then "Mitmachen", then the teaser as the last block of the stack, the last block of main.
  const order = await page.evaluate(() => {
    const teaser = document.querySelector("section.map-teaser");
    return {
      afterJoin: teaser.previousElementSibling?.id === "mitmachen",
      last: !teaser.nextElementSibling && teaser.parentElement === document.querySelector("main").lastElementChild,
    };
  });
  expect(order).toEqual({ afterJoin: true, last: true });
});

// The blocks of the start page below the flyer stand --space-l apart: clamp(96px, 12vw, 160px).
// It also holds before the band.
for (const [home, blocks] of [
  ["/", ["[data-next]", "#mitmachen", "section.map-teaser", "#bleib-informiert"]],
  ["/en/", ["[data-next]", "#get-involved", "#stay-informed"]],
]) {
  test(`the blocks of ${home} stand --space-l apart`, async ({ page }) => {
    await page.goto(home);
    const { width, gaps } = await page.evaluate((sels) => {
      const boxes = sels.map((sel) => document.querySelector(sel).getBoundingClientRect());
      return { width: window.innerWidth, gaps: boxes.slice(1).map((box, i) => box.top - boxes[i].bottom) };
    }, blocks);
    const space = Math.min(160, Math.max(96, 0.12 * width));
    for (const gap of gaps) expect(gap).toBeCloseTo(space, 0);
  });
}

test("the English start page has no map teaser", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.locator(".map-teaser")).toHaveCount(0);
  await expect(page.locator(`a[href="${MAP}"]`)).toHaveCount(0);
});
