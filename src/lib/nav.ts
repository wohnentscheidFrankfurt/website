import { route, type Lang } from "../i18n/routes";
import { ui, ANCHORS } from "../i18n/ui";

// Items of the main navigation. The start page is not listed: the brand in the header links home.
// The phone menu adds the home item in front.
// "Mitmachen" jumps to a block on the start page. isCurrent never marks it.
export function navItems(lang: Lang): { href: string; label: string }[] {
  return [
    { href: route(lang, "events"), label: ui[lang].frame.menuEvents },
    { href: `${route(lang, "home")}#${ANCHORS[lang].join}`, label: ui[lang].frame.menuJoin },
  ];
}

const normalise = (path: string) => path.replace(/\/+$/, "") || "/";

// True if `href` is the page at `pathname`. Trailing slashes do not count. A link to an anchor ("/#x") never is.
export function isCurrent(pathname: string, href: string): boolean {
  if (href.includes("#")) return false;
  return normalise(pathname) === normalise(href);
}
