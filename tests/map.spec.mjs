// Checks of the map "Sozialraum Frankfurt" at /sozialraum-frankfurt/ and, once online, /en/sozialraum-frankfurt/.
// The build copies both from the map repo.
// Over http the map asks our origin for its tiles. The tests answer them with a 1×1 PNG, so no test reaches the BKG.
// Both maps ask the same path /sozialraum-frankfurt/kacheln/, so one Caddy rule serves both.
import { test, expect } from "@playwright/test";
import { ENGLISH_MAP } from "./english-map.mjs";

const MAPS = { de: "/sozialraum-frankfurt/", en: "/en/sozialraum-frankfurt/" };
const ONLINE = ENGLISH_MAP ? ["de", "en"] : ["de"];
const TILE = /\/sozialraum-frankfurt\/kacheln\/\d+\/\d+\/\d+\.png$/;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");

// Fulfils the tile requests and returns the list of their URLs.
async function fakeTiles(page) {
  const tiles = [];
  await page.route("**/sozialraum-frankfurt/kacheln/**", (route) => {
    tiles.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
  });
  return tiles;
}

for (const lang of ONLINE) {
  const MAP = MAPS[lang];

  test(`the map is served at ${MAP}`, async ({ page }) => {
    await fakeTiles(page);
    const response = await page.goto(MAP);
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle("Sozialraum Frankfurt");
    await expect(page.locator("html")).toHaveAttribute("lang", lang === "en" ? "en-GB" : "de");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test(`the map at ${MAP} loads nothing from other origins`, async ({ page, baseURL }) => {
    const tiles = await fakeTiles(page);
    const foreign = [];
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== new URL(baseURL).origin) foreign.push(request.url());
    });
    await page.goto(MAP, { waitUntil: "networkidle" });
    expect(foreign).toEqual([]);
    expect(tiles.some((url) => TILE.test(new URL(url).pathname))).toBe(true);
  });
}

// Online, each map links the other with hreflang. Offline the German map has no such link and /en/… does not exist.
if (ENGLISH_MAP) {
  test("each map links the other with hreflang", async ({ page }) => {
    for (const map of Object.values(MAPS)) {
      await fakeTiles(page);
      await page.goto(map);
      for (const [lang, path] of Object.entries(MAPS)) {
        await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`))
          .toHaveAttribute("href", `https://wohnentscheid-frankfurt.de${path}`);
      }
    }
  });
} else {
  test("the English map is not online yet", async ({ page }) => {
    await fakeTiles(page);
    await page.goto(MAPS.de);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);
    const response = await page.request.get(MAPS.en);
    expect(response.status()).toBe(404);
  });
}
