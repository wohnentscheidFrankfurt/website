// Checks of the share button below the start page flyer. They skip while no upcoming event has a flyer.
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const DESKTOP = "desktop-chrome";
const PAGES = ["/", "/en/"];
// The sticker shows a short word. Its accessible name says what it does.
const SAVE = { "/": "Sichern", "/en/": "Save" };
const SHARE = { "/": "Teilen", "/en/": "Share" };
const SAVE_NAME = { "/": "Flyer speichern", "/en/": "Save flyer" };
const SHARE_NAME = { "/": "Flyer teilen", "/en/": "Share flyer" };
const TURQUOISE = "rgb(22, 204, 204)"; // #16cccc, the opposite of the flyer's red

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

// A stand-in for the share sheet. canShare takes JPEG files only. share records what it gets and settles as told:
// "resolve", a DOMException named "AbortError" or "NotAllowedError", or "pending" (the sheet stays open).
const stubShare = (page, outcome) => page.addInitScript((outcome) => {
  window.__shares = [];
  Navigator.prototype.canShare = (d) =>
    Array.isArray(d?.files) && d.files.length > 0 && d.files.every((f) => f.type === "image/jpeg");
  Navigator.prototype.share = (d) => {
    window.__shares.push({
      keys: Object.keys(d),
      files: d.files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    });
    if (outcome === "resolve") return Promise.resolve();
    if (outcome === "pending") return new Promise(() => {});
    return Promise.reject(new DOMException("stub", outcome));
  };
}, outcome);

const shares = (page) => page.evaluate(() => window.__shares);

// Is the topmost element at the middle of the sticker the sticker itself (or its icon or word)?
// elementFromPoint sees only the viewport, so scroll the sticker in first.
const stickerOnTop = async (page) => {
  await shareLink(page).scrollIntoViewIfNeeded();
  return stickerHit(page);
};
const stickerHit = (page) => page.evaluate(() => {
  const link = document.querySelector("main a[data-share]");
  const box = link.getBoundingClientRect();
  return link.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
});

// Counts downloads and page errors from now on.
function watch(page) {
  const seen = { downloads: [], errors: [] };
  page.on("download", (d) => seen.downloads.push(d));
  page.on("pageerror", (e) => seen.errors.push(e));
  return seen;
}

for (const path of PAGES) {
  test(`${path} shares only the flyer image`, async ({ page }) => {
    await stubShare(page, "resolve");
    const seen = watch(page);
    await openStart(page, path);
    const link = shareLink(page);
    await expect(link).toHaveAttribute("data-ready", "");
    await expect(link).toHaveText(SHARE[path]);
    await expect(link).toHaveAccessibleName(SHARE_NAME[path]);
    await link.click();
    const [shared] = await shares(page);
    expect(await shares(page)).toHaveLength(1);
    expect(shared.keys).toEqual(["files"]);
    expect(shared.files).toHaveLength(1);
    expect(shared.files[0].type).toBe("image/jpeg");
    expect(shared.files[0].name).toBe(await expectedName(page, path));
    expect(shared.files[0].size).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    expect(seen.downloads).toHaveLength(0);
    expect(seen.errors).toHaveLength(0);
  });

  test(`${path} does nothing when the sheet is closed`, async ({ page }) => {
    await stubShare(page, "AbortError");
    const seen = watch(page);
    await openStart(page, path);
    await expect(shareLink(page)).toHaveAttribute("data-ready", "");
    await shareLink(page).click();
    await page.waitForTimeout(500);
    expect(await shares(page)).toHaveLength(1);
    expect(seen.downloads).toHaveLength(0);
    expect(seen.errors).toHaveLength(0);
  });

  test(`${path} downloads when the browser refuses to share`, async ({ page }) => {
    await stubShare(page, "NotAllowedError");
    await openStart(page, path);
    await expect(shareLink(page)).toHaveAttribute("data-ready", "");
    const [download] = await Promise.all([page.waitForEvent("download"), shareLink(page).click()]);
    expect(download.suggestedFilename()).toBe(await expectedName(page, path));
    expect(await shares(page)).toHaveLength(1);
  });

  test(`${path} opens one sheet on a double tap`, async ({ page }) => {
    await stubShare(page, "pending");
    const seen = watch(page);
    await openStart(page, path);
    await expect(shareLink(page)).toHaveAttribute("data-ready", "");
    await shareLink(page).click();
    await shareLink(page).click();
    await page.waitForTimeout(500);
    expect(await shares(page)).toHaveLength(1);
    expect(seen.downloads).toHaveLength(0);
  });

  test(`${path} downloads before the image is ready`, async ({ page }) => {
    await stubShare(page, "resolve");
    // Hold the script's fetch of the JPEG. Let later requests (the download) through.
    let held = false;
    await page.route(/\/_astro\/flyer[^/]*\.jpe?g$/, (route) => {
      if (held) return route.continue();
      held = true;
    });
    await openStart(page, path);
    const link = shareLink(page);
    await expect.poll(() => held).toBe(true);
    await expect(link).toHaveText(SAVE[path]);
    await expect(link).toHaveAccessibleName(SAVE_NAME[path]);
    await expect(link).not.toHaveAttribute("data-ready");
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe(await expectedName(page, path));
    expect(await shares(page)).toHaveLength(0);
  });

  test(`${path} loads no extra image where files cannot be shared`, async ({ page }) => {
    await withoutFileSharing(page);
    const jpegs = [];
    page.on("request", (r) => { if (/\/_astro\/flyer[^/]*\.jpe?g$/.test(r.url())) jpegs.push(r.url()); });
    await openStart(page, path);
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000);
    expect(jpegs).toEqual([]);
  });

  test(`${path} frees the button when the page shows again`, async ({ page }) => {
    // Some Android apps never settle the share promise. Coming back to the page must not leave a dead button.
    await stubShare(page, "pending");
    await openStart(page, path);
    await expect(shareLink(page)).toHaveAttribute("data-ready", "");
    await shareLink(page).click();
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await shareLink(page).click();
    expect(await shares(page)).toHaveLength(2);
  });

  test(`${path} offers the flyer as a download without file sharing`, async ({ page }) => {
    await withoutFileSharing(page);
    await openStart(page, path);
    const link = shareLink(page);
    await expect(link).toHaveText(SAVE[path]);
    await expect(link).toHaveAccessibleName(SAVE_NAME[path]);
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
      await expect(link).toHaveAccessibleName(SAVE_NAME[path]);
      await expect(link).toHaveAttribute("download", await expectedName(page, path));
    });
  }
});

for (const path of PAGES) {
  test(`${path} puts a turquoise sticker on the flyer's lower right corner`, async ({ page }) => {
    await openStart(page, path);
    const f = await flyer(page).boundingBox();
    const l = await shareLink(page).boundingBox();
    // The corner of the flyer lies under the sticker.
    expect(l.x).toBeLessThan(f.x + f.width);
    expect(l.x + l.width).toBeGreaterThan(f.x + f.width);
    expect(l.y).toBeLessThan(f.y + f.height);
    expect(l.y + l.height).toBeGreaterThan(f.y + f.height);
    expect(await shareLink(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(TURQUOISE);
    // A tap on the sticker hits the sticker, not the flyer link below it.
    expect(await stickerOnTop(page)).toBe(true);
  });
}

test("the sticker causes no sideways scroll at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openStart(page, "/");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(320);
});

test("the hovered flyer does not cover the sticker", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, "hover needs a mouse");
  await openStart(page, "/");
  // Scroll first, then hover near the flyer's lower left corner, so nothing scrolls the mouse off the flyer.
  await shareLink(page).scrollIntoViewIfNeeded();
  const rest = await flyer(page).boundingBox();
  await flyer(page).hover({ position: { x: 20, y: rest.height - 40 } });
  // Wait until the scale transition has ended: the box is bigger and stays the same over two polls.
  let last = 0;
  await expect.poll(async () => {
    const height = (await flyer(page).boundingBox()).height;
    const done = height > rest.height && height === last;
    last = height;
    return done;
  }).toBe(true);
  expect(await stickerHit(page)).toBe(true);
  // Still hovered: the flyer is scaled while the check ran.
  expect(await flyer(page).evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
});
