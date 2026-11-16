// Checks of the map "Sozialraum Frankfurt" at /sozialraum-frankfurt/. The build copies it from the map repo.
// Over http the map asks our origin for its tiles. The tests answer them with a 1×1 PNG, so no test reaches the BKG.
import { test, expect } from "@playwright/test";

const MAP = "/sozialraum-frankfurt/";
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

test("the map is served at /sozialraum-frankfurt/", async ({ page }) => {
  await fakeTiles(page);
  const response = await page.goto(MAP);
  expect(response.status()).toBe(200);
  await expect(page).toHaveTitle("Sozialraum Frankfurt");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test("the map loads nothing from other origins", async ({ page, baseURL }) => {
  const tiles = await fakeTiles(page);
  const foreign = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL).origin) foreign.push(request.url());
  });
  await page.goto(MAP, { waitUntil: "networkidle" });
  expect(foreign).toEqual([]);
  expect(tiles.some((url) => TILE.test(new URL(url).pathname))).toBe(true);
});
