import { test, expect } from "@playwright/test";
import { englishProblems, flyerFor, imageFor, englishBody, localized, shareFileName } from "../../src/lib/event-english.ts";

const en = { title: "T", imageAlt: "A" };
const base = { en };

test("a minimal event has no problems", () => {
  expect(englishProblems(base)).toEqual([]);
});

test("en.gallery must match gallery in length", () => {
  const gallery = [{}, {}];
  expect(englishProblems({ ...base, gallery, en: { ...en, gallery: [{ alt: "a" }, { alt: "b" }] } })).toEqual([]);
  expect(englishProblems({ ...base, gallery, en: { ...en, gallery: [{ alt: "a" }] } })).toHaveLength(1);
  expect(englishProblems({ ...base, gallery })).toHaveLength(1);
  expect(englishProblems({ ...base, en: { ...en, gallery: [{ alt: "a" }] } })).toHaveLength(1);
});

test("en.callout is required with callout", () => {
  expect(englishProblems({ ...base, callout: "x", en: { ...en, callout: "y" } })).toEqual([]);
  expect(englishProblems({ ...base, callout: "x" })).toHaveLength(1);
});

test("en.review is required with review", () => {
  expect(englishProblems({ ...base, review: "x", en: { ...en, review: "y" } })).toEqual([]);
  expect(englishProblems({ ...base, review: "x" })).toHaveLength(1);
});

test("en.flyerAlt is required with flyer", () => {
  expect(englishProblems({ ...base, flyer: "f", en: { ...en, flyerAlt: "y" } })).toEqual([]);
  expect(englishProblems({ ...base, flyer: "f" })).toHaveLength(1);
});

test("en.flyer needs en.flyerAlt", () => {
  expect(englishProblems({ ...base, flyer: "f", en: { ...en, flyer: "g", flyerAlt: "y" } })).toEqual([]);
  expect(englishProblems({ ...base, flyer: "f", en: { ...en, flyer: "g" } })).toEqual([
    "en.flyerAlt is required when flyer is set",
    "en.flyer needs en.flyerAlt",
  ]);
});

test("en.flyer needs the German flyer", () => {
  expect(englishProblems({ ...base, en: { ...en, flyer: "g", flyerAlt: "y" } })).toEqual(["en.flyer needs flyer"]);
});

test("flyerFor: German uses flyer and flyerAlt", () => {
  const d = { flyer: "de.png", flyerAlt: "de", en: { flyer: "en.png", flyerAlt: "en" } };
  expect(flyerFor(d, "de")).toEqual({ src: "de.png", alt: "de" });
});

test("flyerFor: English uses en.flyer", () => {
  const d = { flyer: "de.png", flyerAlt: "de", en: { flyer: "en.png", flyerAlt: "en" } };
  expect(flyerFor(d, "en")).toEqual({ src: "en.png", alt: "en" });
});

test("flyerFor: English without en.flyer uses the German image and the English alt", () => {
  const d = { flyer: "de.png", flyerAlt: "de", en: { flyerAlt: "en" } };
  expect(flyerFor(d, "en")).toEqual({ src: "de.png", alt: "en" });
});

test("flyerFor: no flyer gives undefined", () => {
  expect(flyerFor({ en: {} }, "de")).toBeUndefined();
  expect(flyerFor({ en: {} }, "en")).toBeUndefined();
});

test("imageFor: German uses image and imageAlt", () => {
  const d = { image: "de.png", imageAlt: "de", en: { image: "en.png", imageAlt: "en" } };
  expect(imageFor(d, "de")).toEqual({ src: "de.png", alt: "de" });
});

test("imageFor: English uses en.image", () => {
  const d = { image: "de.png", imageAlt: "de", en: { image: "en.png", imageAlt: "en" } };
  expect(imageFor(d, "en")).toEqual({ src: "en.png", alt: "en" });
});

test("imageFor: English without en.image uses the German image and the English alt", () => {
  const d = { image: "de.png", imageAlt: "de", en: { imageAlt: "en" } };
  expect(imageFor(d, "en")).toEqual({ src: "de.png", alt: "en" });
});

test("englishBody splits at blank lines and trims", () => {
  expect(englishBody("a\n\nb\n")).toEqual(["a", "b"]);
  expect(englishBody("a\nb\n\n\n  c  \n")).toEqual(["a\nb", "c"]);
  expect(englishBody("")).toEqual([]);
});

test("localized: German returns the German fields", () => {
  const d = {
    title: "t", subtitle: "s", address: "a", imageAlt: "i", callout: "c", review: "r",
    gallery: [{ alt: "ga", caption: "gc" }],
    en: { title: "T", subtitle: "S", address: "A", imageAlt: "I", callout: "C", review: "R", gallery: [{ alt: "GA", caption: "GC" }] },
  };
  expect(localized(d, "de")).toEqual({
    title: "t", subtitle: "s", address: "a", imageAlt: "i", callout: "c", review: "r",
    gallery: [{ alt: "ga", caption: "gc" }],
  });
  expect(localized(d, "en")).toEqual({
    title: "T", subtitle: "S", address: "A", imageAlt: "I", callout: "C", review: "R",
    gallery: [{ alt: "GA", caption: "GC" }],
  });
});

test("localized: English address falls back to the German one", () => {
  const d = { title: "t", imageAlt: "i", address: "a", en: { title: "T", imageAlt: "I" } };
  expect(localized(d, "en").address).toBe("a");
});

test("the shared flyer is named after the event", () => {
  expect(shareFileName("2026-11-28-get-together", "de", false)).toBe("wohnentscheid-flyer-2026-11-28-get-together.jpg");
  expect(shareFileName("2026-11-28-get-together", "de", true)).toBe("wohnentscheid-flyer-2026-11-28-get-together.jpg");
});

test("only an English image gets the English name", () => {
  expect(shareFileName("x", "en", true)).toBe("wohnentscheid-flyer-x-en.jpg");
  expect(shareFileName("x", "en", false)).toBe("wohnentscheid-flyer-x.jpg");
});
