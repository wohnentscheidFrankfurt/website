// Checks of the share button below the start page flyer. They skip while no upcoming event has a flyer.
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const DESKTOP = "desktop-chrome";
const PAGES = ["/", "/en/"];
const SAVE = { "/": "Flyer speichern", "/en/": "Save flyer" };

const flyer = (page) => page.locator("main a[data-flyer]");
const shareLink = (page) => page.locator("main a[data-share]");

// The start page, or a skip when it shows no flyer.
async function openStart(page, path) {
  await page.goto(path);
  test.skip((await flyer(page).count()) === 0, "the start page shows no flyer");
}

// The file name people get: the event id, and "-en" only when the event has its own English image.
async function expectedName(page, path) {
  const id = (await flyer(page).getAttribute("href")).split("#")[1];
  const md = readFileSync(`src/content/events/${id}.md`, "utf8");
  const ownEnglish = /^\s+flyer:/m.test(md);
  return `wohnentscheid-flyer-${id}${path === "/en/" && ownEnglish ? "-en" : ""}.jpg`;
}

// No Web Share API: what Firefox and some desktop browsers offer.
const withoutFileSharing = (page) => page.addInitScript(() => {
  delete Navigator.prototype.canShare;
  delete Navigator.prototype.share;
});

for (const path of PAGES) {
  test(`${path} offers the flyer as a download without file sharing`, async ({ page }) => {
    await withoutFileSharing(page);
    await openStart(page, path);
    const link = shareLink(page);
    await expect(link).toHaveText(SAVE[path]);
    const f = await flyer(page).boundingBox();
    const l = await link.boundingBox();
    expect(l.y - (f.y + f.height)).toBeCloseTo(32, 0);
    expect(l.x).toBeCloseTo(f.x, 0);
    expect(l.width).toBeCloseTo(f.width, 0);
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe(await expectedName(page, path));
  });

  test(`${path} shares a small JPEG`, async ({ page, request }) => {
    await openStart(page, path);
    const res = await request.get(await shareLink(page).getAttribute("href"));
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/jpeg");
    expect((await res.body()).length).toBeLessThan(600 * 1024);
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const path of PAGES) {
    test(`${path} offers the save link`, async ({ page }) => {
      await openStart(page, path);
      const link = shareLink(page);
      await expect(link).toHaveText(SAVE[path]);
      await expect(link).toHaveAttribute("download", await expectedName(page, path));
    });
  }
});

test("the hovered flyer does not cover the button", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "hover needs a mouse");
  await openStart(page, "/");
  const rest = await flyer(page).boundingBox();
  await flyer(page).hover();
  // Wait until the scale transition has ended: the box is bigger and stays the same over two polls.
  let last = 0;
  await expect.poll(async () => {
    const height = (await flyer(page).boundingBox()).height;
    const done = height > rest.height && height === last;
    last = height;
    return done;
  }).toBe(true);
  const f = await flyer(page).boundingBox();
  const l = await shareLink(page).boundingBox();
  expect(f.y + f.height).toBeLessThan(l.y);
});
