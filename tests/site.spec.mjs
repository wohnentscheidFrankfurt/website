// Checks that hold for every page. Add new pages to PAGES.
import { test, expect } from "@playwright/test";

const PAGES = ["/", "/veranstaltungen/", "/impressum/", "/datenschutz/"];
// The English pages.
const PAGES_EN = ["/en/", "/en/events/", "/en/imprint/", "/en/privacy/"];
const ORIGIN = "https://wohnentscheid-frankfurt.de";
// German page and English page of every pair that exists.
const COUNTERPART = { "/": "/en/", "/veranstaltungen/": "/en/events/", "/en/": "/", "/en/events/": "/veranstaltungen/",
  "/impressum/": "/en/imprint/", "/datenschutz/": "/en/privacy/", "/en/imprint/": "/impressum/",
  "/en/privacy/": "/datenschutz/" };
const NAME = { de: "EN – Show the English version", en: "DE – Deutsche Version anzeigen" };
const GERMAN_ONLY = ["Veranstaltungen", "Mitmachen", "Bleib informiert", " Uhr", "Einlass", "Startseite", "Datenschutz", "Impressum"];
// German names that stay on the two English legal pages: the binding note and the authority.
const LEGAL_EN_ALLOWED = {
  "/en/imprint/": ["Impressum"],
  "/en/privacy/": ["Datenschutz", "Der Hessische Beauftragte für Datenschutz und Informationsfreiheit",
    "datenschutz.hessen.de",
    "Bundesamt für Kartographie und Geodäsie", "Sozialraum Frankfurt"],
};
// Pages after sending the form: no band, not for search engines.
const NOINDEX_PAGES = ["/danke/", "/fehler/", "/bestaetigen/", "/en/thanks/", "/en/error/", "/en/confirm/"];
const WHITE = "rgb(255, 255, 255)";

for (const path of [...PAGES, ...PAGES_EN, ...NOINDEX_PAGES]) {
  const lang = path.startsWith("/en/") ? "en" : "de";
  test(`${path} has the right language, one h1 and the right robots meta`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("h1")).toHaveCount(1);
    if (NOINDEX_PAGES.includes(path)) {
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    } else {
      // Search engines may index every other page.
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    }
  });

  test(`${path} background is white`, async ({ page }) => {
    await page.goto(path);
    const colors = await page.evaluate(() =>
      [document.documentElement, document.body].map((el) => getComputedStyle(el).backgroundColor));
    expect(colors).toEqual([WHITE, WHITE]);
  });

  test(`${path} loads nothing from other origins`, async ({ page, baseURL }) => {
    const foreign = [];
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== new URL(baseURL).origin) foreign.push(request.url());
    });
    await page.goto(path, { waitUntil: "networkidle" });
    expect(foreign).toEqual([]);
  });

  test(`${path} has no horizontal scroll`, async ({ page }) => {
    await page.goto(path);
    // Measure with the web fonts. The fallback font is wider and overflows for a moment.
    await page.evaluate(() => document.fonts.ready);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize().width);
  });

  test(`${path} uses the brand fonts`, async ({ page }) => {
    await page.goto(path);
    const style = await page.evaluate(() => {
      const of = (el) => {
        const s = getComputedStyle(el);
        return { family: s.fontFamily, case: s.textTransform, stretch: parseFloat(s.fontStretch) };
      };
      // Skip visually hidden headings: the start page hides its h2 while the flyer shows.
      const seen = (el) => el.getBoundingClientRect().width > 1;
      const h2 = [...document.querySelectorAll("main h2")].find(seen);
      const bar = document.querySelector(".bar");
      return {
        h1: of(document.querySelector("h1")),
        h2: h2 && of(h2),
        bar: bar && of(bar),
        item: of(document.querySelector(".desktop-nav a")),
        body: getComputedStyle(document.body).fontFamily,
      };
    });
    // The events page has date bars and a visible h2. The start page has them only without a flyer.
    if (path === "/veranstaltungen/" || path === "/en/events/") {
      expect(style.bar).toBeTruthy();
      expect(style.h2).toBeTruthy();
    }
    // Headings and date bars: condensed capitals like the flyer.
    for (const el of [style.h1, style.h2, style.bar].filter(Boolean)) {
      expect(el.family).toContain("Archivo");
      expect(el.case).toBe("uppercase");
      expect(el.stretch).toBeLessThanOrEqual(75);
    }
    // Menu items: normal case and wider, so they do not look cramped.
    expect(style.item.family).toContain("Archivo");
    expect(style.item.case).toBe("none");
    expect(style.item.stretch).toBeGreaterThanOrEqual(80);
    expect(style.body).toContain("Mulish");
    // document.fonts.check() is true for undeclared families, so look at the loaded faces.
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replaceAll('"', ""));
    });
    expect(loaded).toContain("Archivo");
    expect(loaded).toContain("Mulish");
  });

  if (lang === "en") continue;
  test(`${path} has a footer with three columns and no link bar`, async ({ page }) => {
    await page.goto(path);
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.locator("nav")).toHaveCount(0);
    expect(await footer.evaluate((el) => el.firstElementChild?.className)).toContain("footer-columns");
    for (const name of ["Wohnentscheid Frankfurt", "Mitmachen", "Andere Plattformen"]) {
      await expect(footer.getByRole("heading", { name })).toBeVisible();
    }
    const first = footer.locator(".footer-columns section").first();
    await expect(first.getByRole("heading")).toHaveText("Wohnentscheid Frankfurt");
    await expect(first.locator("a")).toHaveText(["Startseite", "Veranstaltungen", "Impressum", "Datenschutz"]);
    await expect(first.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "/impressum/");
    await expect(first.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "/datenschutz/");
    await expectPlatforms(footer);
    const targets = await footer.locator('a[target="_blank"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("rel") ?? ""));
    for (const rel of targets) expect(rel).toContain("noopener");
    const image = await footer.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(image).toBe("none");
  });
}

// Third column, like b-side: Instagram and GitHub, each with its icon in front of the name.
async function expectPlatforms(footer) {
  const third = footer.locator(".footer-columns section").nth(2);
  await expect(third.locator("a")).toHaveText(["Instagram", "GitHub"]);
  await expect(third.getByRole("link", { name: "Instagram" }))
    .toHaveAttribute("href", "https://www.instagram.com/wohnentscheidfrankfurt/");
  await expect(third.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/wohnentscheidFrankfurt");
  const first = await third.locator("a").evaluateAll((els) => els.map((el) => el.firstElementChild?.tagName));
  expect(first).toEqual(["svg", "svg"]);
}

for (const path of [...PAGES_EN, "/en/thanks/", "/en/error/", "/en/confirm/"]) {
  test(`${path} has an English footer with three columns and no link bar`, async ({ page }) => {
    await page.goto(path);
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.locator("nav")).toHaveCount(0);
    await expect(page.locator("nav.desktop-nav")).toHaveAttribute("aria-label", "Main menu");
    await expect(page.locator("#menu-close")).toHaveAttribute("aria-label", "Close menu");
    for (const name of ["Wohnentscheid Frankfurt", "Get involved", "Other platforms"]) {
      await expect(footer.getByRole("heading", { name })).toBeVisible();
    }
    const first = footer.locator(".footer-columns section").first();
    await expect(first.locator("a")).toHaveText(["Home", "Events", "Imprint", "Privacy"]);
    await expect(first.getByRole("link", { name: "Imprint" })).toHaveAttribute("href", "/en/imprint/");
    await expect(first.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/en/privacy/");
    await expect(footer.getByRole("link", { name: "Write to us" })).toHaveAttribute("href", "/en/#get-involved");
    await expectPlatforms(footer);
    const targets = await footer.locator('a[target="_blank"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("rel") ?? ""));
    for (const rel of targets) expect(rel).toContain("noopener");
  });
}

for (const path of [...PAGES, ...PAGES_EN]) {
  const lang = path.startsWith("/en/") ? "en" : "de";
  test(`${path} links its pair with hreflang and has a switch`, async ({ page }) => {
    await page.goto(path);
    const german = lang === "de" ? path : COUNTERPART[path];
    const english = lang === "en" ? path : COUNTERPART[path];
    const links = await page.locator('head link[rel="alternate"][hreflang]')
      .evaluateAll((els) => Object.fromEntries(els.map((el) => [el.hreflang, el.getAttribute("href")])));
    expect(links).toEqual({ de: ORIGIN + german, en: ORIGIN + english, "x-default": ORIGIN + german });
    const link = page.locator("header [data-lang-switch]");
    await expect(link).toHaveAttribute("href", COUNTERPART[path]);
    await expect(link).toHaveAttribute("hreflang", lang === "de" ? "en" : "de");
    await expect(link).toHaveAttribute("lang", lang === "de" ? "en" : "de");
    await expect(link).toHaveAccessibleName(NAME[lang]);
  });
}

for (const path of NOINDEX_PAGES) {
  test(`${path} has no hreflang links`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('link[rel="alternate"]')).toHaveCount(0);
  });
}

for (const path of [...PAGES_EN, "/en/thanks/", "/en/error/", "/en/confirm/"]) {
  test(`${path} shows no German words and links English pages`, async ({ page }) => {
    await page.goto(path);
    let text = await page.locator("body").evaluate((el) => el.innerText);
    for (const allowed of LEGAL_EN_ALLOWED[path] ?? []) text = text.replaceAll(allowed, "");
    for (const word of GERMAN_ONLY) expect(text).not.toContain(word);
    const footer = page.locator("footer");
    const hrefs = await footer.locator(".footer-columns a")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    for (const href of ["/en/events/", "/en/imprint/", "/en/privacy/", "/en/#get-involved"]) {
      expect(hrefs).toContain(href);
    }
    for (const href of hrefs.filter((h) => h.startsWith("/"))) expect(href.startsWith("/en/")).toBe(true);
  });
}
