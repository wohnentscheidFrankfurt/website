// Checks of the share button below the start page flyer. They skip while no upcoming event has a flyer.
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const DESKTOP = "desktop-chrome";
const PAGES = ["/", "/en/"];
const SAVE = { "/": "Flyer speichern", "/en/": "Save flyer" };
const SHARE = { "/": "Flyer teilen", "/en/": "Share flyer" };

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
    await expect(link).not.toHaveAttribute("data-ready");
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe(await expectedName(page, path));
    expect(await shares(page)).toHaveLength(0);
  });

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
