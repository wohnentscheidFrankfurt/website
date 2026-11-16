import { test, expect } from "@playwright/test";
import { berlinDay, splitEvents, formatDateBar, formatTimeLine, countdown, plural } from "../../src/lib/events.ts";

test("berlinDay uses the Berlin day, not UTC", () => {
  expect(berlinDay(new Date("2026-11-28T23:30:00Z"))).toBe("2026-11-29");
  expect(berlinDay(new Date("2026-11-28T13:00:00Z"))).toBe("2026-11-28");
});

test("an event on the build day is upcoming", () => {
  const e = { start: new Date("2026-11-28T14:00:00+01:00") };
  expect(splitEvents([e], "2026-11-28")).toEqual({ upcoming: [e], past: [] });
});

test("upcoming sorts ascending, past descending", () => {
  const a = { start: new Date("2026-09-01T18:00:00+02:00") };
  const b = { start: new Date("2026-10-03T16:00:00+02:00") };
  const c = { start: new Date("2026-11-28T14:00:00+01:00") };
  const d = { start: new Date("2026-12-12T14:00:00+01:00") };
  const { upcoming, past } = splitEvents([d, a, c, b], "2026-11-12");
  expect(upcoming).toEqual([c, d]);
  expect(past).toEqual([b, a]);
});

test("formatDateBar writes German dates", () => {
  expect(formatDateBar(new Date("2026-11-28T14:00:00+01:00"))).toBe("Sa. 28. November 2026");
  expect(formatDateBar(new Date("2026-10-03T16:00:00+02:00"))).toBe("Sa. 3. Oktober 2026");
});

test("formatTimeLine joins start, end and doors", () => {
  expect(formatTimeLine({ start: new Date("2026-11-28T14:00:00+01:00"), end: new Date("2026-11-28T17:30:00+01:00"),
    doors: new Date("2026-11-28T13:30:00+01:00") })).toBe("14:00 – ca. 17:30 Uhr · Einlass 13:30 Uhr");
  expect(formatTimeLine({ start: new Date("2026-11-28T14:00:00+01:00") })).toBe("14:00 Uhr");
});

const start = new Date("2026-11-28T14:00:00+01:00");
const end = new Date("2026-11-28T17:30:00+01:00");

test("countdown splits the time before the start into days, hours and minutes", () => {
  const now = new Date(+start - ((15 * 24 + 20) * 60 + 12) * 60_000 - 30_000);
  expect(countdown(start, end, now)).toEqual({ state: "before", days: 15, hours: 20, minutes: 12 });
});

test("countdown counts exactly one day, one hour and one minute", () => {
  const now = new Date(+start - ((24 + 1) * 60 + 1) * 60_000);
  expect(countdown(start, end, now)).toEqual({ state: "before", days: 1, hours: 1, minutes: 1 });
});

test("countdown rounds minutes down: 59 s before start is 0 min", () => {
  expect(countdown(start, end, new Date(+start - 59_000))).toEqual({ state: "before", days: 0, hours: 0, minutes: 0 });
});

test("countdown is running from start until end", () => {
  expect(countdown(start, end, start)).toEqual({ state: "running" });
  expect(countdown(start, end, new Date(+end - 1))).toEqual({ state: "running" });
});

test("countdown without end is over at start", () => {
  expect(countdown(start, undefined, start)).toEqual({ state: "over" });
});

test("countdown is over at and after the end", () => {
  expect(countdown(start, end, end)).toEqual({ state: "over" });
  expect(countdown(start, end, new Date(+end + 60_000))).toEqual({ state: "over" });
});

test("plural picks the German singular for 1 and the plural otherwise", () => {
  expect(plural(1, "Tag", "Tage")).toBe("1 Tag");
  expect(plural(2, "Tag", "Tage")).toBe("2 Tage");
  expect(plural(0, "Minute", "Minuten")).toBe("0 Minuten");
  expect(plural(1, "Stunde", "Stunden")).toBe("1 Stunde");
});

test("English date bar", () => {
  expect(formatDateBar(new Date("2026-11-28T14:00:00+01:00"), "en")).toBe("Sat 28 November 2026");
});

test("English time line uses a 12 h clock", () => {
  const at = (t: string) => new Date(`2026-11-28T${t}:00+01:00`);
  expect(formatTimeLine({ start: at("14:00"), end: at("17:30"), doors: at("13:30") }, "en")).toBe(
    "2 pm – about 5:30 pm · Doors open 1:30 pm",
  );
  expect(formatTimeLine({ start: at("14:00") }, "en")).toBe("2 pm");
  expect(formatTimeLine({ start: at("12:00") }, "en")).toBe("12 pm");
  expect(formatTimeLine({ start: at("00:00") }, "en")).toBe("12 am");
  expect(formatTimeLine({ start: at("13:05") }, "en")).toBe("1:05 pm");
});
