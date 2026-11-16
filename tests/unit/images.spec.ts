import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Needs a build first, like all checks.
test("no image in dist carries EXIF or GPS", async () => {
  const files = (fs.readdirSync("dist", { recursive: true }) as string[])
    .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
    .map((f) => path.join("dist", f));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const m = await sharp(file).metadata();
    expect(m.exif, file).toBeUndefined();
    expect(m.xmp, file).toBeUndefined();
    expect(m.iptc, file).toBeUndefined();
  }
});

// SVGs are copied as they are. They must not carry editor data, embedded images or external links.
test("no SVG in dist has editor data, embedded images or external links", () => {
  const files = (fs.readdirSync("dist", { recursive: true }) as string[]).filter((f) => /\.svg$/i.test(f));
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const svg = fs.readFileSync(path.join("dist", f), "utf8");
    expect(svg, f).not.toMatch(/<metadata|sodipodi:|inkscape:|<image/i);
    expect(svg, f).not.toMatch(/(?:xlink:)?href\s*=\s*["']\s*http/i);
  }
});

// The Signal QR code is redrawn pixel-exact and served unscaled: two colours in a palette, a few KB.
test("the Signal QR codes are small palette PNGs", async () => {
  const files = (fs.readdirSync("dist", { recursive: true }) as string[])
    .filter((f) => /signal-qr.*\.png$/i.test(f))
    .map((f) => path.join("dist", f));
  expect(files.length).toBe(2);
  for (const file of files) {
    const m = await sharp(file).metadata();
    expect(m.isPalette, file).toBe(true);
    expect(m.bitsPerSample, file).toBe(1);
    expect(fs.statSync(file).size, file).toBeLessThan(4096);
  }
});
