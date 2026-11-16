// Pure date logic for events. No Astro imports, so unit tests can load it.
import type { Lang } from "../i18n/routes";

const TZ = "Europe/Berlin";

/** Day of a date in Berlin as "YYYY-MM-DD". */
export function berlinDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

/** Upcoming (today or later, ascending) and past (descending) events. */
export function splitEvents<T extends { start: Date }>(events: T[], today: string): { upcoming: T[]; past: T[] } {
  const upcoming = events.filter((e) => berlinDay(e.start) >= today).sort((a, b) => +a.start - +b.start);
  const past = events.filter((e) => berlinDay(e.start) < today).sort((a, b) => +b.start - +a.start);
  return { upcoming, past };
}

/** "Sa. 28. November 2026" or "Sat 28 November 2026" */
export function formatDateBar(date: Date, lang: Lang = "de"): string {
  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: TZ,
  }).format(date).replace(",", "");
}

const clock = (d: Date) =>
  new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ, hourCycle: "h23" }).format(d);

/** "2 pm", "5:30 pm", "12 pm" (noon), "12 am" (midnight) */
function clock12(d: Date): string {
  const [h, m] = clock(d).split(":").map(Number);
  return `${h % 12 || 12}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`} ${h < 12 ? "am" : "pm"}`;
}

/** "14:00 – ca. 17:30 Uhr · Einlass 13:30 Uhr" or "2 pm – about 5:30 pm · Doors open 1:30 pm" */
export function formatTimeLine(e: { start: Date; end?: Date; doors?: Date }, lang: Lang = "de"): string {
  if (lang === "en") {
    let line = clock12(e.start);
    if (e.end) line += ` – about ${clock12(e.end)}`;
    if (e.doors) line += ` · Doors open ${clock12(e.doors)}`;
    return line;
  }
  let line = clock(e.start);
  if (e.end) line += ` – ca. ${clock(e.end)}`;
  line += " Uhr";
  if (e.doors) line += ` · Einlass ${clock(e.doors)} Uhr`;
  return line;
}

export type Countdown =
  | { state: "before"; days: number; hours: number; minutes: number }
  | { state: "running" }
  | { state: "over" };

/** Time left until start. Running only between start and end; without end it is over at start. */
export function countdown(start: Date, end: Date | undefined, now: Date): Countdown {
  if (+now < +start) {
    const total = Math.floor((+start - +now) / 60_000);
    return { state: "before", days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 };
  }
  if (end && +now < +end) return { state: "running" };
  return { state: "over" };
}

/** "1 Tag", "2 Tage" */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
