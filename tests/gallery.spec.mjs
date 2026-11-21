// Checks of the gallery lightbox (PhotoSwipe) on the kick-off of the events page.
import { test, expect } from "@playwright/test";

const KICKOFF = "2026-10-03-auftakt";
const links = (page) => page.locator(`article[data-event="${KICKOFF}"] .gallery a`);
const lightbox = (page) => page.locator(".pswp");
// PhotoSwipe listens to keys only after its opening animation. Then it shows the slides next to the current one.
const opened = (page) => page.waitForFunction(() => {
  const items = [...document.querySelectorAll(".pswp__item")];
  return items.length === 3 && items.every((e) => e.style.display !== "none");
});
const counter = (page) => page.locator(".pswp__counter");
// The large image of the slide in view. PhotoSwipe hides the other slides from screen readers.
const current = (page) => page.locator('.pswp__item[aria-hidden="false"] img.pswp__img:not(.pswp__img--placeholder)');

async function open(page, n, path = "/veranstaltungen/") {
  await page.goto(path);
  await links(page).nth(n - 1).click();
  await opened(page);
}

test("a click opens the clicked picture", async ({ page }) => {
  await open(page, 3);
  await expect(counter(page)).toHaveText("3 / 5");
  const href = await links(page).nth(2).evaluate((a) => a.href);
  await expect(current(page)).toHaveJSProperty("src", href);
});

// On touch screens PhotoSwipe hides the arrow buttons: people swipe there.
test("arrow keys and buttons move, Esc closes", async ({ page, hasTouch }) => {
  await open(page, 3);
  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("4 / 5");
  const prev = page.locator('button[title="Vorheriges Bild"]');
  if (hasTouch) {
    await expect(prev).toBeHidden();
    await page.keyboard.press("ArrowLeft");
  } else {
    await prev.click();
  }
  await expect(counter(page)).toHaveText("3 / 5");
  await page.keyboard.press("Escape");
  await expect(lightbox(page)).toHaveCount(0);
});

test("with the keyboard the focus returns to the picture", async ({ page }) => {
  await page.goto("/veranstaltungen/");
  await links(page).nth(2).focus();
  await page.keyboard.press("Enter");
  await opened(page);
  await page.keyboard.press("Escape");
  await expect(lightbox(page)).toHaveCount(0);
  await expect(links(page).nth(2)).toBeFocused();
});

test("Tab stays in the lightbox", async ({ page }) => {
  await open(page, 2);
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest(".pswp"))).toBe(true);
});

test("the caption shows below the picture", async ({ page }) => {
  await open(page, 2);
  await expect(page.locator(".pswp__caption")).toHaveText("Boden, öffentlicher Wohnungsbau & Genossenschaften");
  await page.keyboard.press("ArrowLeft");
  await expect(counter(page)).toHaveText("1 / 5");
  await expect(page.locator(".pswp__caption")).toBeHidden();
});

test("the photo is sepia in the lightbox, the flip charts are not", async ({ page }) => {
  await open(page, 1);
  await expect(current(page)).toHaveCSS("filter", /sepia/);
  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("2 / 5");
  await expect(current(page)).toHaveCSS("filter", "none");
});

test("the lightbox is black with white controls", async ({ page }) => {
  await open(page, 2);
  await expect(page.locator(".pswp__bg")).toHaveCSS("background-color", "rgb(17, 17, 17)");
  await expect(page.locator(".pswp__bg")).toHaveCSS("opacity", "1");
  await expect(page.locator(".pswp__button--close .pswp__icn")).toHaveCSS("fill", "rgb(255, 255, 255)");
});

test("German labels on the German page", async ({ page }) => {
  await open(page, 2);
  for (const title of ["Schließen", "Zoomen", "Vorheriges Bild", "Nächstes Bild"]) {
    await expect(page.locator(`.pswp button[title="${title}"]`)).toHaveCount(1);
  }
});

test("English labels on the English page", async ({ page }) => {
  await open(page, 2, "/en/events/");
  for (const title of ["Close", "Zoom", "Previous picture", "Next picture"]) {
    await expect(page.locator(`.pswp button[title="${title}"]`)).toHaveCount(1);
  }
  await expect(page.locator(".pswp__caption")).toHaveText("Land, public housing & cooperatives");
});

test("a broken picture shows the error text", async ({ page }) => {
  await page.goto("/veranstaltungen/");
  const href = await links(page).nth(1).getAttribute("href");
  await page.route(`**${href}`, (route) => route.abort());
  await links(page).nth(1).click();
  await expect(page.locator(".pswp__error-msg")).toHaveText("Das Bild ließ sich nicht laden.");
});

// PhotoSwipe animates with inline CSS transitions. Record every one while the lightbox opens.
async function transitionsWhileOpening(page) {
  await page.goto("/veranstaltungen/");
  await page.evaluate(() => {
    window.transitions = [];
    new MutationObserver((records) => {
      for (const r of records) {
        const t = r.target.style?.transition;
        if (t && !/^(none|all 0s.*)?$/.test(t)) window.transitions.push(t);
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["style"] });
  });
  await links(page).nth(1).click();
  await expect(page.locator(".pswp--open")).toBeVisible();
  await expect(current(page)).toBeVisible();
  return page.evaluate(() => window.transitions);
}

test("the lightbox grows from the picture", async ({ page }) => {
  expect((await transitionsWhileOpening(page)).length).toBeGreaterThan(0);
});

test("reduced motion opens without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await transitionsWhileOpening(page)).toEqual([]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("a link opens the picture", async ({ page }) => {
    await page.goto("/veranstaltungen/");
    const href = await links(page).nth(1).getAttribute("href");
    await links(page).nth(1).click();
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.]/g, "\\.")}$`));
  });
});
