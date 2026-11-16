// Route table of the site: every page has a German and an English path. Pure, no Astro imports.
export type Lang = "de" | "en";
export type RouteKey = "home" | "events" | "imprint" | "privacy" | "thanks" | "error" | "confirm";

export const ROUTES: Record<RouteKey, Record<Lang, string>> = {
  home: { de: "/", en: "/en/" },
  events: { de: "/veranstaltungen/", en: "/en/events/" },
  imprint: { de: "/impressum/", en: "/en/imprint/" },
  privacy: { de: "/datenschutz/", en: "/en/privacy/" },
  thanks: { de: "/danke/", en: "/en/thanks/" },
  error: { de: "/fehler/", en: "/en/error/" },
  confirm: { de: "/bestaetigen/", en: "/en/confirm/" },
};

const withSlash = (path: string) => (path.endsWith("/") ? path : `${path}/`);

/** "/en" and "/en/…" are English, everything else is German. */
export function langOf(path: string): Lang {
  return path === "/en" || path.startsWith("/en/") ? "en" : "de";
}

/** The path of a page in a language. */
export function route(lang: Lang, key: RouteKey): string {
  return ROUTES[key][lang];
}

/** The same page in the other language, with a trailing slash. Throws for an unknown path. */
export function counterpart(path: string): string {
  const normal = withSlash(path);
  for (const pair of Object.values(ROUTES)) {
    if (pair.de === normal) return pair.en;
    if (pair.en === normal) return pair.de;
  }
  throw new Error(`No counterpart for ${path}`);
}
