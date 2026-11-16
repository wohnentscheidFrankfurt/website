import { test, expect } from "@playwright/test";
import { ROUTES, counterpart, langOf, route, type RouteKey } from "../../src/i18n/routes.ts";
import { ui, ANCHORS } from "../../src/i18n/ui.ts";

const PAIRS = [
  ["/", "/en/"],
  ["/veranstaltungen/", "/en/events/"],
  ["/impressum/", "/en/imprint/"],
  ["/datenschutz/", "/en/privacy/"],
  ["/danke/", "/en/thanks/"],
  ["/fehler/", "/en/error/"],
  ["/bestaetigen/", "/en/confirm/"],
];

test("counterpart maps every pair both ways", () => {
  for (const [de, en] of PAIRS) {
    expect(counterpart(de)).toBe(en);
    expect(counterpart(en)).toBe(de);
  }
});

test("counterpart accepts a missing trailing slash", () => {
  expect(counterpart("/veranstaltungen")).toBe("/en/events/");
  expect(counterpart("/en")).toBe("/");
});

test("counterpart throws for an unknown path", () => {
  expect(() => counterpart("/nope/")).toThrow(/No counterpart for \/nope\//);
});

test("langOf tells English paths from German ones", () => {
  expect(langOf("/en/events/")).toBe("en");
  expect(langOf("/en")).toBe("en");
  expect(langOf("/")).toBe("de");
  expect(langOf("/entwurf/")).toBe("de");
});

test("route returns the path of a key in a language", () => {
  expect(route("de", "events")).toBe("/veranstaltungen/");
  expect(route("en", "confirm")).toBe("/en/confirm/");
});

test("every route key has both paths and no path appears twice", () => {
  const paths: string[] = [];
  for (const key of Object.keys(ROUTES) as RouteKey[]) {
    expect(ROUTES[key].de).toBeTruthy();
    expect(ROUTES[key].en).toBeTruthy();
    paths.push(ROUTES[key].de, ROUTES[key].en);
  }
  expect(new Set(paths).size).toBe(paths.length);
});

test("the dictionaries have the same keys in both languages", () => {
  const shape = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(shape)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
        : typeof value;
  expect(shape(ui.en)).toEqual(shape(ui.de));
});

test("the anchors differ by language", () => {
  expect(ANCHORS.de).toEqual({ join: "mitmachen", band: "bleib-informiert" });
  expect(ANCHORS.en).toEqual({ join: "get-involved", band: "stay-informed" });
});
