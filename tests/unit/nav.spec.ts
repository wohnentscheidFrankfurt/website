import { test, expect } from "@playwright/test";
import { navItems, isCurrent } from "../../src/lib/nav.ts";

test("the navigation lists the events page and Mitmachen", () => {
  expect(navItems("de")).toEqual([
    { href: "/veranstaltungen/", label: "Veranstaltungen" },
    { href: "/#mitmachen", label: "Mitmachen" },
  ]);
  expect(navItems("en")).toEqual([
    { href: "/en/events/", label: "Events" },
    { href: "/en/#get-involved", label: "Get involved" },
  ]);
});

test("isCurrent never marks a link to an anchor", () => {
  expect(isCurrent("/", "/#mitmachen")).toBe(false);
  expect(isCurrent("/veranstaltungen/", "/#mitmachen")).toBe(false);
  expect(isCurrent("/en/", "/en/#get-involved")).toBe(false);
});

test("isCurrent ignores trailing slashes", () => {
  expect(isCurrent("/veranstaltungen", "/veranstaltungen/")).toBe(true);
  expect(isCurrent("/veranstaltungen/", "/veranstaltungen/")).toBe(true);
  expect(isCurrent("/", "/")).toBe(true);
});

test("isCurrent does not match other pages", () => {
  expect(isCurrent("/", "/veranstaltungen/")).toBe(false);
  expect(isCurrent("/veranstaltungen/", "/")).toBe(false);
  expect(isCurrent("/veranstaltungen/foo/", "/veranstaltungen/")).toBe(false);
});
