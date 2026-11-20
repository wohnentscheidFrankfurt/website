// The glide: a click on a link to the current page does not reload it. The page glides to the top or to the anchor.
// Model: the scroll module of Webflow (webflow.js). This file imports nothing, because it reaches the client bundle.

// Change the effect here.
// Duration in milliseconds. It grows with the distance, but only slowly. Webflow's curve: 0.9 s at 300 px, 1.8 s at 3000 px.
export function duration(distance: number): number {
  return 472.143 * Math.log(Math.abs(distance) + 125) - 2000;
}

// The curve over time t from 0 to 1: easeInOutCubic. It starts slowly, runs fast in the middle and ends softly.
export function ease(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

export type GlideTarget = { kind: "top" } | { kind: "anchor"; id: string };

// Same rule as isCurrent in nav.ts: trailing slashes do not count.
const path = (url: URL) => url.pathname.replace(/\/+$/, "") || "/";

// Where a link glides from the page at `page`. null: the link leads to another page, so the browser loads it.
// Another query is another page too (a token on /bestaetigen/, for example).
export function glideTarget(link: URL, page: URL): GlideTarget | null {
  if (link.origin !== page.origin || link.search !== page.search || path(link) !== path(page)) return null;
  if (!link.hash) return { kind: "top" };
  try {
    return { kind: "anchor", id: decodeURIComponent(link.hash.slice(1)) };
  } catch {
    return null;
  }
}
