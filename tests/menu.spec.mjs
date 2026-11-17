// Checks of the sticky header: the heart as brand, desktop bar and the house menu on phones.
import { test, expect } from "@playwright/test";

const DESKTOP = "desktop-chrome";

const menu = (page) => page.locator("#menu");
const burger = (page) => page.locator("#menu-button");

async function openMenu(page) {
  await burger(page).click();
  await expect(burger(page)).toHaveAttribute("aria-expanded", "true");
  await expect(menu(page)).toBeVisible();
}

async function expectClosed(page) {
  await expect(burger(page)).toHaveAttribute("aria-expanded", "false");
  await expect(menu(page)).not.toBeVisible();
}

test("brand is the heart and links home", async ({ page }) => {
  await page.goto("/");
  const brand = page.locator("header a.brand");
  await expect(brand).toHaveAttribute("href", "/");
  await expect(brand.locator(".heart")).toBeVisible();
  // No wordmark: the big red logo on the start page names the initiative. The link name keeps it.
  await expect(brand).toHaveText("");
  await expect(page.getByRole("link", { name: "Wohnentscheid Frankfurt – Startseite" })).toBeVisible();
  const header = await page.locator("header").boundingBox();
  const box = await brand.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(header.x);
  expect(box.y).toBeGreaterThanOrEqual(header.y);
  expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height);
  // The layout width: boundingBox() would include the scale of a running beat.
  const width = await brand.locator(".heart").evaluate((el) => el.offsetWidth);
  expect(width).toBeGreaterThanOrEqual(28);
  expect(width).toBeLessThanOrEqual(40);
});

test("header heart is black, as on b-side", async ({ page, request }) => {
  await page.goto("/");
  const src = await page.locator("header .brand .heart").getAttribute("src");
  const svg = await (await request.get(src)).text();
  expect(svg).toContain('fill="#111"');
  expect(svg).not.toContain("#ea1a1a");
});

test("header heart beats once and stops within 5 seconds", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const heart = page.locator("header .brand .heart");
  await expect(heart).toBeVisible();
  const style = await heart.evaluate((el) => {
    const s = getComputedStyle(el);
    return { name: s.animationName, duration: s.animationDuration, count: s.animationIterationCount };
  });
  expect(style.name).toBe("beat");
  // WCAG 2.2.2: motion that starts by itself must stop within 5 seconds, or offer a pause.
  const count = Number(style.count);
  expect(count).toBe(1);
  expect(parseFloat(style.duration) * count).toBeLessThanOrEqual(5);
});

test("header heart stands still with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const heart = page.locator("header .brand .heart");
  expect(await heart.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

// A new visit beats: no same-origin referrer and a plain navigation. A page change, reload or back does not.
const heartAnimation = (page) =>
  page.locator("header .brand .heart").evaluate((el) => getComputedStyle(el).animationName);
const heartMoves = (page) =>
  page.locator("header .brand .heart").evaluate((el) => el.getAnimations().length > 0);

async function clickToEvents(page) {
  await page.locator('a[href="/veranstaltungen/"]:visible').first().click();
  await page.waitForURL("**/veranstaltungen/");
}

test("header heart beats on a direct visit to a subpage", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/veranstaltungen/");
  expect(await heartAnimation(page)).toBe("beat");
});

test("header heart beats only once its image is there", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // A slow phone network: the heart SVG arrives late.
  await page.route("**/*.svg", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto("/");
  const time = await page
    .locator("header .brand .heart")
    .evaluate((el) => el.getAnimations().map((a) => a.currentTime)[0] ?? null);
  expect(time).not.toBeNull();
  expect(time).toBeLessThan(500);
});

test("header heart stands still when the browser restores a discarded tab", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, "wasDiscarded", { configurable: true, get: () => true });
  });
  await page.goto("/");
  expect(await heartAnimation(page)).toBe("none");
});

test("header heart waits for a prerendered page to be shown", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, "prerendering", { configurable: true, get: () => true });
  });
  await page.goto("/");
  expect(await heartAnimation(page)).toBe("none");
  await page.evaluate(() => document.dispatchEvent(new Event("prerenderingchange")));
  expect(await heartAnimation(page)).toBe("beat");
});

test("header heart stands still after a click to another page", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await clickToEvents(page);
  expect(await heartAnimation(page)).toBe("none");
});

test("header heart stands still after a reload", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.reload();
  expect(await heartAnimation(page)).toBe("none");
});

test("header heart stands still after back", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect.poll(() => heartMoves(page), { timeout: 4000 }).toBe(false);
  await clickToEvents(page);
  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/");
  // Not the animation name: bfcache may bring the page back with its class and the finished beat.
  expect(await heartMoves(page)).toBe(false);
});

test("desktop shows the bar, not the burger", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "desktop width only");
  await page.goto("/");
  const bar = page.locator("nav.desktop-nav");
  await expect(bar).toHaveAttribute("aria-label", "Hauptmenü");
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("link", { name: "Veranstaltungen" })).toBeVisible();
  await expect(bar.locator("a[aria-current]")).toHaveCount(0);
  await expect(burger(page)).toBeHidden();
  await expect(menu(page)).toBeHidden();
  const itemFont = await bar.getByRole("link", { name: "Veranstaltungen" }).evaluate((el) => getComputedStyle(el).fontSize);
  expect(parseFloat(itemFont)).toBeGreaterThanOrEqual(21);
  expect(parseFloat(itemFont)).toBeLessThanOrEqual(23);
  // The brand is spaced like a bar item: the gap after it equals the gap between items.
  const right = (loc) => loc.evaluate((el) => el.getBoundingClientRect().right);
  const left = (loc) => loc.evaluate((el) => el.getBoundingClientRect().left);
  const itemGap = await bar.locator("ul").evaluate((el) => parseFloat(getComputedStyle(el).columnGap));
  const brandGap = (await left(bar.locator("li a").first())) - (await right(page.locator("header a.brand")));
  expect(Math.abs(brandGap - itemGap)).toBeLessThanOrEqual(1);
  await page.goto("/veranstaltungen/");
  const current = bar.getByRole("link", { name: "Veranstaltungen" });
  await expect(current).toHaveAttribute("aria-current", "page");
  // The current item is italic, in the real italic face, not a slanted roman.
  expect(await current.evaluate((el) => getComputedStyle(el).fontStyle)).toBe("italic");
  const italic = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((f) =>
      f.family.replaceAll('"', "") === "Archivo" && f.style === "italic" && f.status === "loaded");
  });
  expect(italic).toBe(true);
});

test("at 899 px the burger shows, at 900 px the bar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "resizes a desktop window");
  const bar = page.locator("nav.desktop-nav");
  await page.setViewportSize({ width: 899, height: 900 });
  await page.goto("/");
  await expect(burger(page)).toBeVisible();
  await expect(bar).toBeHidden();
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(burger(page)).toBeHidden();
  await expect(bar).toBeVisible();
  // Tab from the brand: the bar link comes next, the hidden burger never.
  await page.locator("header a.brand").focus();
  const reached = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    reached.push(await page.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim()));
  }
  expect(reached[0]).toBe("Veranstaltungen");
  expect(reached).not.toContain("menu-button");
});

// Hover like b-side, in our yellow-orange: the text turns --hover, nothing is underlined.
const ORANGE = "rgb(217, 119, 6)";

function contrastOnWhite(rgb) {
  const lin = (v) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const [r, g, b] = rgb.match(/\d+/g).map(Number).map(lin);
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

const look = (loc) =>
  loc.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, line: s.textDecorationLine, style: s.fontStyle };
  });

test("desktop bar items turn orange on hover, without underline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "hover with a mouse");
  await page.goto("/");
  const item = page.locator("nav.desktop-nav").getByRole("link", { name: "Veranstaltungen" });
  await item.hover();
  const s = await look(item);
  expect(s.color).toBe(ORANGE);
  expect(s.line).toBe("none");
  // The bar text is large (22 px bold): WCAG 1.4.3 needs 3:1.
  expect(contrastOnWhite(s.color)).toBeGreaterThanOrEqual(3);
});

test("current item is ink and italic, without underline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "desktop width only");
  await page.goto("/veranstaltungen/");
  await page.mouse.move(0, 400);
  const s = await look(page.locator("nav.desktop-nav a[aria-current]"));
  expect(s).toEqual({ color: "rgb(17, 17, 17)", line: "none", style: "italic" });
});

test("language switch turns orange on hover, without underline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "hover with a mouse");
  await page.goto("/");
  const link = page.locator("header [data-lang-switch]");
  await link.hover();
  const s = await look(link);
  expect(s.color).toBe(ORANGE);
  expect(s.line).toBe("none");
});

// The language switch sits in the header at every width and lands on the other language of the same page.
const SWITCH_PAIRS = [["/", "/en/"], ["/veranstaltungen/", "/en/events/"],
  ["/impressum/", "/en/imprint/"], ["/datenschutz/", "/en/privacy/"],
  ["/danke/", "/en/thanks/"], ["/fehler/", "/en/error/"], ["/bestaetigen/", "/en/confirm/"]];
for (const [german, english] of SWITCH_PAIRS) {
  for (const [from, to, visible] of [[german, english, "EN"], [english, german, "DE"]]) {
    for (const width of [1400, 390]) {
      test(`switch on ${from} is visible at ${width} px and lands on ${to}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== DESKTOP && width !== 390, "phones test 390 px");
        if (testInfo.project.name === DESKTOP) await page.setViewportSize({ width, height: 900 });
        await page.goto(from);
        const link = page.locator("header [data-lang-switch]");
        await expect(link).toBeVisible();
        await expect(link).toHaveText(visible);
        const box = await link.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        // Smaller than the items of the bar, in Archivo wide 700.
        const style = await link.evaluate((el) => {
          const s = getComputedStyle(el);
          return { family: s.fontFamily, weight: s.fontWeight, stretch: parseFloat(s.fontStretch), size: parseFloat(s.fontSize) };
        });
        expect(style.family).toContain("Archivo");
        expect(style.weight).toBe("700");
        expect(style.stretch).toBeGreaterThanOrEqual(80);
        expect(style.size).toBeLessThan(21);
        const header = await page.locator("header").boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(header.y);
        expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height);
        expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
        if (width === 1400) {
          // Right end of the bar: no item lies right of it.
          const last = await page.locator("nav.desktop-nav li a").last().boundingBox();
          expect(box.x).toBeGreaterThan(last.x + last.width);
        } else {
          // Left of the burger.
          const burgerBox = await burger(page).boundingBox();
          expect(box.x + box.width).toBeLessThanOrEqual(burgerBox.x + 1);
        }
        await link.click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(to);
      });
    }
  }
}

test("the phone menu ends with the text variant of the switch", async ({ page }, testInfo) => {
  if (testInfo.project.name === DESKTOP) await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, text, target] of [["/", "Show the English version", "/en/"], ["/en/", "Zur deutschen Version", "/"]]) {
    await page.goto(path);
    await openMenu(page);
    const last = menu(page).locator("a").last();
    await expect(last).toHaveText(text);
    await expect(last).toHaveAttribute("href", target);
    await expect(last).toHaveAttribute("lang", target === "/" ? "de" : "en");
    await last.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(target);
  }
});

test("the focus trap of the phone menu includes the switch link", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "runs in desktop Chrome only: WebKit does not tab to links by default");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/");
  await openMenu(page);
  const last = menu(page).locator("a").last();
  await last.focus();
  await page.keyboard.press("Tab");
  // From the last link the focus wraps to the first focusable element, the close button.
  expect(await page.evaluate(() => document.activeElement.id)).toBe("menu-close");
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.activeElement.textContent.trim())).toBe("Zur deutschen Version");
});

test("the phone menu of the English pages is English", async ({ page }, testInfo) => {
  if (testInfo.project.name === DESKTOP) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/events/");
  await expect(burger(page)).toHaveAttribute("aria-label", "Open menu");
  await expect(menu(page)).toHaveAttribute("aria-label", "Menu");
  await openMenu(page);
  await expect(menu(page).locator("a")).toHaveText(["Home", "Events", "Get involved", "Zur deutschen Version"]);
  await expect(menu(page).locator("a[aria-current=page]")).toHaveText("Events");
  await expect(page.getByRole("link", { name: "Wohnentscheid Frankfurt – Home" })).toBeVisible();
});

test("header stays at the top after scrolling", async ({ page }) => {
  await page.goto("/");
  // The page may be shorter than the viewport. Make it long enough to scroll.
  await page.evaluate(() => (document.body.style.minHeight = "3000px"));
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  const header = page.locator("header");
  await expect(header).toBeVisible();
  expect((await header.boundingBox()).y).toBe(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // Every item shows inside the header. On phones the bar may wrap into two lines. Brand and bar must not overflow.
  async function expectBarFits(page) {
    await expect(burger(page)).toBeHidden();
    await page.evaluate(() => document.fonts.ready);
    const header = await page.locator("header").boundingBox();
    const english = page.url().includes("/en/");
    const switchBox = await page.locator("header [data-lang-switch]").boundingBox();
    expect(switchBox.x + switchBox.width).toBeLessThanOrEqual(header.x + header.width);
    expect(switchBox.y).toBeGreaterThanOrEqual(header.y);
    expect(switchBox.y + switchBox.height).toBeLessThanOrEqual(header.y + header.height);
    for (const name of english ? ["Events", "Get involved"] : ["Veranstaltungen", "Mitmachen"]) {
      const item = page.locator("nav.desktop-nav").getByRole("link", { name });
      await expect(item).toBeVisible();
      const box = await item.boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(header.y);
      expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height);
      expect(box.x + box.width).toBeLessThanOrEqual(header.x + header.width);
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize().width);
  }

  test("the bar replaces the burger at every width", async ({ page }) => {
    await page.goto("/");
    await expectBarFits(page);
  });

  test("the bar fits at 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/");
    await expectBarFits(page);
  });

  for (const path of ["/", "/en/"]) {
    for (const width of [390, 320]) {
      test(`brand, bar and switch fit at ${width} px on ${path} also with the fallback font`, async ({ page }) => {
        await page.setViewportSize({ width, height: 700 });
        // Block the web fonts, so the row renders in the fallback font.
        await page.route(/\.woff2?$/, (route) => route.abort());
        await page.goto(path);
        await expectBarFits(page);
      });
    }
  }
});

// The burger and the house menu exist below 900 px only. On desktop-chrome these checks run at phone width.
test.describe("phone menu", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.project.name === DESKTOP) await page.setViewportSize({ width: 390, height: 844 });
  });

  test("burger opens the menu with both items", async ({ page }) => {
    await page.goto("/");
    await expect(burger(page)).toHaveAttribute("aria-controls", "menu");
    await expect(menu(page)).toHaveAttribute("aria-label", "Menü");
    await openMenu(page);
    await expect(menu(page).getByRole("link", { name: "Startseite" })).toBeVisible();
    await expect(menu(page).getByRole("link", { name: "Veranstaltungen" })).toBeVisible();
  });

  test("current item is marked and coloured", async ({ page }) => {
    await page.goto("/");
    const current = page.locator("#menu a[aria-current=page]");
    await expect(current).toHaveText("Startseite");
    await openMenu(page);
    const style = await current.evaluate((el) => {
      const s = getComputedStyle(el);
      return { fontStyle: s.fontStyle, color: s.color };
    });
    expect(style.fontStyle).toBe("italic");
    expect(style.color).not.toBe("rgb(255, 255, 255)");
  });

  test("current item uses the real italic of Archivo", async ({ page }) => {
    // This page has no other italic Archivo text, so only the menu item can load the italic face.
    await page.goto("/veranstaltungen/");
    await openMenu(page);
    const current = page.locator("#menu a[aria-current=page]");
    await expect(current).toHaveText("Veranstaltungen");
    expect(await current.evaluate((el) => getComputedStyle(el).fontStyle)).toBe("italic");
    const italic = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((f) =>
        f.family.replaceAll('"', "") === "Archivo" && f.style === "italic" && f.status === "loaded");
    });
    expect(italic).toBe(true);
  });

  test("Esc closes the menu and returns focus to the burger", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await page.keyboard.press("Escape");
    await expectClosed(page);
    expect(await page.evaluate(() => document.activeElement.id)).toBe("menu-button");
  });

  test("close button and a click outside close the menu", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await page.locator("#menu-close").click();
    await expectClosed(page);
    await openMenu(page);
    await page.mouse.click(10, 400);
    await expectClosed(page);
  });

  test("burger closes the open menu", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await burger(page).click();
    await expectClosed(page);
  });

  test("a click on the transparent roof area closes the menu", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    const box = await menu(page).boundingBox();
    // Top-left corner of the box: left of the ridge and above the sloping roof, so outside the house polygon.
    await page.mouse.click(box.x + 12, box.y + 12);
    await expectClosed(page);
  });

  test("Tab stays inside the open menu", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "runs in desktop Chrome only: WebKit does not tab to links by default");
    await page.goto("/");
    await openMenu(page);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.querySelector("#menu").contains(document.activeElement))).toBe(true);
    }
  });

  test("menu links go to the right pages", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await menu(page).getByRole("link", { name: "Veranstaltungen" }).click();
    await expect(page).toHaveURL(/\/veranstaltungen\/$/);
    await openMenu(page);
    await expect(page.locator("#menu a[aria-current=page]")).toHaveText("Veranstaltungen");
    await menu(page).getByRole("link", { name: "Startseite" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("widening to desktop closes the open menu", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, "resizes a desktop window");
    await page.goto("/");
    await openMenu(page);
    // Focus a menu link by keyboard, so focus is inside the menu before the resize.
    await menu(page).getByRole("link", { name: "Veranstaltungen" }).focus();
    expect(await page.evaluate(() => document.querySelector("#menu").contains(document.activeElement))).toBe(true);
    await page.setViewportSize({ width: 900, height: 900 });
    await expect(burger(page)).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.activeElement.matches("header a.brand"))).toBe(true);
    const inert = await page.evaluate(() =>
      ["main", "[data-band]", "footer"].map((sel) => document.querySelector(sel).inert));
    expect(inert).toEqual([false, false, false]);
  });

  test("no horizontal scroll with the menu open", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await openMenu(page);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize().width);
  });
});
