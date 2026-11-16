// The spacing scale (docs/architecture.md, Spacing). The frame sets the space, not the block.
// Start pages end --space-l before the band. Every other page ends --space-m before the band or the footer.
import { test, expect } from "@playwright/test";

// The two steps of src/styles/global.css, computed from the viewport width.
const large = (width) => Math.min(160, Math.max(96, 0.12 * width));
const medium = (width) => large(width) / 2;

const START = ["/", "/en/"];
const OTHER = [
  "/veranstaltungen/", "/en/events/", "/impressum/", "/en/imprint/", "/datenschutz/", "/en/privacy/",
  "/danke/", "/en/thanks/", "/fehler/", "/en/error/", "/bestaetigen/", "/en/confirm/",
];

// From the bottom of the lowest visible box in main to the top of the band, or of the footer without band.
async function pageEnd(page) {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll("main *")]
      .filter((el) => getComputedStyle(el).visibility !== "hidden")
      .map((el) => el.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0);
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    const next = document.querySelector("[data-band]") ?? document.querySelector("body > footer");
    return { width: window.innerWidth, gap: next.getBoundingClientRect().top - bottom };
  });
}

for (const path of START) {
  test(`${path} ends --space-l before the band`, async ({ page }) => {
    await page.goto(path);
    const { width, gap } = await pageEnd(page);
    expect(gap).toBeCloseTo(large(width), 0);
  });
}

for (const path of OTHER) {
  test(`${path} ends --space-m before the band or the footer`, async ({ page }) => {
    await page.goto(path);
    const { width, gap } = await pageEnd(page);
    expect(gap).toBeCloseTo(medium(width), 0);
  });
}

for (const path of ["/veranstaltungen/", "/en/events/"]) {
  test(`the sections of ${path} stand --space-m apart`, async ({ page }) => {
    await page.goto(path);
    const result = await page.evaluate(() => {
      const upcoming = document.querySelector('[data-list="upcoming"]');
      const past = document.querySelector('[data-list="past"]');
      if (!past) return null;
      return { width: window.innerWidth, gap: past.getBoundingClientRect().top - upcoming.getBoundingClientRect().bottom };
    });
    test.skip(result === null, "no past events");
    expect(result.gap).toBeCloseTo(medium(result.width), 0);
  });
}
