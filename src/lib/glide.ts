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

// Events by which the user takes over. They stop a running glide where the page stands.
// popstate: Back in the toolbar fires no key or mouse event. pushState fires no popstate, so the glide's own entry is safe.
const STOP_EVENTS = ["wheel", "touchstart", "keydown", "mousedown", "popstate"] as const;

// Stops the running glide. null when none runs.
let stopRunning: (() => void) | null = null;

// Moves the focus to the target, as the browser's own jump does. tabindex -1 makes any element focusable.
// data-glide-focus hides the ring (global.css). Both go again when the focus leaves.
function focusTarget(el: HTMLElement): void {
  const added = !el.hasAttribute("tabindex");
  if (added) el.setAttribute("tabindex", "-1");
  el.setAttribute("data-glide-focus", "");
  el.addEventListener(
    "blur",
    () => {
      if (added) el.removeAttribute("tabindex");
      el.removeAttribute("data-glide-focus");
    },
    { once: true },
  );
  el.focus({ preventScroll: true });
}

// Where the page stands when the anchor sits at its scroll-margin-top, as after the browser's own jump.
function anchorY(el: HTMLElement): number {
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const y = el.getBoundingClientRect().top + window.scrollY - margin;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return Math.min(Math.max(y, 0), max);
}

// Glides to end(). end is measured on every frame, so content that loads above the target does not matter.
function glide(end: () => number): void {
  stopRunning?.();
  const start = window.scrollY;
  const first = end();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(first - start) < 1) {
    window.scrollTo(0, first);
    return;
  }
  const ms = duration(first - start);
  const began = performance.now();
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    for (const type of STOP_EVENTS) window.removeEventListener(type, stop);
    if (stopRunning === stop) stopRunning = null;
  };
  const step = (now: number) => {
    // The first frame may carry a time from before the click.
    const t = Math.min(Math.max((now - began) / ms, 0), 1);
    window.scrollTo(0, start + (end() - start) * ease(t));
    if (t < 1) frame = requestAnimationFrame(step);
    else stop();
  };
  for (const type of STOP_EVENTS) window.addEventListener(type, stop, { passive: true });
  stopRunning = stop;
  frame = requestAnimationFrame(step);
}

// One listener for every link on the page. It runs after the link's own listeners (the phone menu closes there).
// Clicks that open a new tab or window, downloads and links to other pages stay with the browser.
export function initGlide(): void {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest?.("a[href]");
    if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute("download")) return;
    const target = glideTarget(new URL(link.href), new URL(location.href));
    if (!target) return;
    const el = target.kind === "top" ? document.body : document.getElementById(target.id);
    if (!el) return;
    event.preventDefault();
    // A new URL gets its own history entry, as with the browser's own jump. The same URL gets none, as with a reload.
    if (link.href !== location.href) history.pushState(null, "", link.href);
    focusTarget(el);
    glide(target.kind === "top" ? () => 0 : () => anchorY(el));
  });
}
