// Checks of the glide's config and link logic (src/lib/glide.ts). The browser part is in tests/glide.spec.mjs.
import { test, expect } from "@playwright/test";
import { glideTarget, duration, ease } from "../../src/lib/glide.ts";

const page = new URL("https://example.org/veranstaltungen/");
const at = (href: string) => glideTarget(new URL(href, page), page);

test("a plain link to the page glides to the top", () => {
  expect(at("/veranstaltungen/")).toEqual({ kind: "top" });
  expect(at("/veranstaltungen")).toEqual({ kind: "top" });
  expect(at("/veranstaltungen/#")).toEqual({ kind: "top" });
});

test("from a page with a hash, a plain link glides to the top", () => {
  const here = new URL("https://example.org/#mitmachen");
  expect(glideTarget(new URL("https://example.org/"), here)).toEqual({ kind: "top" });
});

test("a link with a hash glides to its id, decoded", () => {
  expect(at("#mitmachen")).toEqual({ kind: "anchor", id: "mitmachen" });
  expect(at("/veranstaltungen/#gr%C3%BCn")).toEqual({ kind: "anchor", id: "grün" });
});

test("another path, query or origin is no glide", () => {
  expect(at("/")).toBeNull();
  expect(at("/veranstaltungen/?a=1")).toBeNull();
  expect(at("https://other.org/veranstaltungen/")).toBeNull();
  expect(at("http://example.org/veranstaltungen/")).toBeNull();
  const confirm = new URL("https://example.org/bestaetigen/?t=abc");
  expect(glideTarget(new URL("https://example.org/bestaetigen/"), confirm)).toBeNull();
});

test("a malformed hash is no glide", () => {
  expect(at("#%E0")).toBeNull();
});

test("duration follows Webflow's curve", () => {
  expect(duration(300)).toBeCloseTo(857, -1);
  expect(duration(1000)).toBeCloseTo(1317, -1);
  expect(duration(3000)).toBeCloseTo(1799, -1);
  expect(duration(-1000)).toBe(duration(1000));
});

test("ease is easeInOutCubic", () => {
  expect(ease(0)).toBe(0);
  expect(ease(0.25)).toBeCloseTo(0.0625);
  expect(ease(0.5)).toBe(0.5);
  expect(ease(0.75)).toBeCloseTo(0.9375);
  expect(ease(1)).toBe(1);
});
