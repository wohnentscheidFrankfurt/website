// Checks of the glide (src/lib/glide.ts): a link to the current page glides to the top or to its anchor.
// No reload, a real glide (many positions in between), and the cases left to the browser.
import { test, expect } from "@playwright/test";

const DESKTOP = "desktop-chrome";
const PHONE = "chrome-390";

// A tall block at the start of main: every page is long, the footer is far down.
const lengthen = (page) =>
  page.evaluate(() => {
    const block = document.createElement("div");
    block.style.height = "3000px";
    document.querySelector("main").prepend(block);
  });

// Room below the footer, so the page can scroll an anchor up to the header.
const padBottom = (page) =>
  page.evaluate(() => {
    const block = document.createElement("div");
    block.style.height = "3000px";
    document.body.append(block);
  });

// A reload would drop this mark.
const mark = (page) => page.evaluate(() => (window.__glideMark = 1));
const expectNoReload = async (page) => expect(await page.evaluate(() => window.__glideMark)).toBe(1);

// scrollY on every frame.
const record = (page) =>
  page.evaluate(() => {
    window.__ys = [];
    const tick = () => {
      window.__ys.push(window.scrollY);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
const allSamples = (page) => page.evaluate(() => window.__ys);

// Playwright scrolls a link into view before it clicks. The glide starts at the highest point.
async function samples(page) {
  const ys = await allSamples(page);
  return ys.slice(ys.indexOf(Math.max(...ys)));
}

// A glide, not a jump: many positions between start and end, and the page never moves back.
function expectGlided(ys, from, to) {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  expect(new Set(ys.filter((y) => y > lo && y < hi)).size).toBeGreaterThan(5);
  const direction = Math.sign(to - from);
  for (let i = 1; i < ys.length; i++) expect(Math.sign(ys[i] - ys[i - 1]) * direction).toBeGreaterThanOrEqual(0);
}

const scrollY = (page) => page.evaluate(() => window.scrollY);
const toTop = (page) => expect.poll(() => scrollY(page)).toBe(0);
const footerLink = (page, name) => page.locator("footer").getByRole("link", { name, exact: true });
const heart = (page) => page.locator("header a.brand");
const join = (page) => page.locator("main section#mitmachen");

// "Mitmachen" as a visitor sees it: in the desktop bar, or in the phone menu.
async function mitmachen(page, testInfo) {
  if (testInfo.project.name === DESKTOP) return page.locator("nav.desktop-nav").getByRole("link", { name: "Mitmachen" });
  await page.locator("#menu-button").click();
  return page.locator("#menu").getByRole("link", { name: "Mitmachen" });
}

// The block stands still with its top at its scroll-margin-top (88 px), as after the browser's own jump.
async function expectAtAnchor(page) {
  let last;
  await expect
    .poll(async () => {
      const y = (await join(page).boundingBox()).y;
      const still = y === last;
      last = y;
      return still && Math.abs(y - 88) < 1.5;
    })
    .toBe(true);
}

for (const [path, name] of [
  ["/", "Startseite"],
  ["/veranstaltungen/", "Veranstaltungen"],
  ["/impressum/", "Impressum"],
  ["/en/", "Home"],
]) {
  test(`glides to the top on ${path}`, async ({ page }) => {
    await page.goto(path);
    await lengthen(page);
    await mark(page);
    await record(page);
    await footerLink(page, name).click();
    await toTop(page);
    const ys = await samples(page);
    expectGlided(ys, ys[0], 0);
    await expectNoReload(page);
    expect(new URL(page.url()).pathname).toBe(path);
  });
}

test("the heart glides to the top on /", async ({ page }) => {
  await page.goto("/");
  await lengthen(page);
  await page.evaluate(() => window.scrollTo(0, 2000));
  await mark(page);
  await record(page);
  await heart(page).click();
  await toTop(page);
  const ys = await samples(page);
  expectGlided(ys, ys[0], 0);
  await expectNoReload(page);
});

test("Mitmachen glides to its block", async ({ page }, testInfo) => {
  await page.goto("/");
  await padBottom(page);
  await mark(page);
  const item = await mitmachen(page, testInfo);
  await record(page);
  await item.click();
  await expect(page).toHaveURL(/\/#mitmachen$/);
  await expectAtAnchor(page);
  expectGlided(await allSamples(page), 0, await scrollY(page));
  await expectNoReload(page);
});

test("lands on the anchor when content above grows", async ({ page }, testInfo) => {
  await page.goto("/");
  await padBottom(page);
  const item = await mitmachen(page, testInfo);
  await item.click();
  await lengthen(page);
  await expectAtAnchor(page);
});

test("back after the anchor glide stays on the page", async ({ page }, testInfo) => {
  await page.goto("/");
  await padBottom(page);
  await mark(page);
  const item = await mitmachen(page, testInfo);
  await item.click();
  await expectAtAnchor(page);
  await page.goBack();
  expect(new URL(page.url()).pathname + new URL(page.url()).hash).toBe("/");
  await expectNoReload(page);
});

test("reduced motion jumps at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await lengthen(page);
  await page.evaluate(() => window.scrollTo(0, 2000));
  await mark(page);
  await heart(page).click();
  expect(await scrollY(page)).toBe(0);
  await expectNoReload(page);
});

// Starts a long glide from the footer of the lengthened start page and waits until it has run 300 px.
async function startLongGlide(page) {
  await page.goto("/");
  await lengthen(page);
  const link = footerLink(page, "Startseite");
  await link.scrollIntoViewIfNeeded();
  const start = await scrollY(page);
  await mark(page);
  await link.click();
  await expect.poll(() => scrollY(page)).toBeLessThan(start - 300);
}

// The page stands where the user stopped it: not at the top, and still.
async function expectStopped(page) {
  await page.waitForTimeout(2500);
  const y = await scrollY(page);
  expect(y).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect(await scrollY(page)).toBe(y);
  await expectNoReload(page);
}

test("a wheel turn stops the glide", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "the mouse wheel runs in desktop Chrome only");
  await startLongGlide(page);
  await page.mouse.wheel(0, 50);
  await expectStopped(page);
});

test("a key press stops the glide", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "a keyboard runs in desktop Chrome only");
  await startLongGlide(page);
  await page.keyboard.press("ArrowDown");
  await expectStopped(page);
});

test("a second click wins", async ({ page }) => {
  await page.goto("/");
  await lengthen(page);
  await page.evaluate(() => window.scrollTo(0, 2000));
  await heart(page).click();
  await page.waitForTimeout(200);
  await heart(page).click();
  await toTop(page);
  // A stale listener of the first glides must not stop the next one.
  await page.evaluate(() => window.scrollTo(0, 2000));
  await record(page);
  await heart(page).click();
  await toTop(page);
  const ys = await samples(page);
  expectGlided(ys, ys[0], 0);
});

test("leaves these clicks to the browser", async ({ page }) => {
  await page.goto("/");
  const prevented = await page.evaluate(() => {
    // Runs after the glide's listener. It records the verdict and keeps the test page from navigating.
    let last;
    document.addEventListener("click", (event) => {
      last = event.defaultPrevented;
      event.preventDefault();
    });
    const click = (el, init = {}) => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
      return last;
    };
    const link = (attributes) => {
      const a = document.createElement("a");
      for (const [key, value] of Object.entries(attributes)) a.setAttribute(key, value);
      a.textContent = "Test";
      document.querySelector("main").append(a);
      return a;
    };
    const brand = document.querySelector("header a.brand");
    return {
      plain: click(brand),
      ctrl: click(brand, { ctrlKey: true }),
      meta: click(brand, { metaKey: true }),
      shift: click(brand, { shiftKey: true }),
      alt: click(brand, { altKey: true }),
      middle: click(brand, { button: 1 }),
      blank: click(link({ href: "/", target: "_blank" })),
      download: click(link({ href: "/", download: "" })),
      missing: click(link({ href: "/#gibtsnicht" })),
    };
  });
  expect(prevented).toEqual({
    plain: true,
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    middle: false,
    blank: false,
    download: false,
    missing: false,
  });
});

test("a click to another page loads it", async ({ page }) => {
  await page.goto("/");
  await mark(page);
  await footerLink(page, "Veranstaltungen").click();
  await expect(page).toHaveURL(/\/veranstaltungen\/$/);
  expect(await page.evaluate(() => window.__glideMark)).toBeUndefined();
});

test("focus goes to the page start", async ({ page }, testInfo) => {
  test.skip(![DESKTOP, PHONE].includes(testInfo.project.name), "WebKit does not tab to links by default");
  await page.goto("/impressum/");
  await lengthen(page);
  await footerLink(page, "Impressum").focus();
  await page.keyboard.press("Enter");
  await toTop(page);
  await page.keyboard.press("Tab");
  await expect(heart(page)).toBeFocused();
});

test("focus goes to the anchor", async ({ page }, testInfo) => {
  test.skip(![DESKTOP, PHONE].includes(testInfo.project.name), "WebKit does not tab to links by default");
  await page.goto("/");
  const item = await mitmachen(page, testInfo);
  await item.focus();
  await page.keyboard.press("Enter");
  await expect(join(page)).toBeFocused();
  expect(await join(page).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
});

test("phone menu glides and closes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === DESKTOP, "the phone menu exists below 900 px only");
  await page.goto("/");
  await lengthen(page);
  await page.evaluate(() => window.scrollTo(0, 2000));
  await mark(page);
  await page.locator("#menu-button").click();
  await page.locator("#menu").getByRole("link", { name: "Startseite" }).click();
  await expect(page.locator("#menu-button")).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.querySelector("main").inert)).toBe(false);
  await toTop(page);
  await expectNoReload(page);
});
