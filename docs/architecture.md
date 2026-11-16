# Architecture

## Build

- [Astro](https://astro.build) builds a static site. `npm run build` writes plain HTML, CSS and JS to `dist/`.
  The site has no CMS. The only server code is the sign-up API in `api/` (see API).
  One `vite.server.proxy` in `astro.config.mjs` forwards `/api` for `astro dev` and `astro preview`, as Caddy
  does live. It keeps the `Origin` header. `API_URL` picks the API's address (default `127.0.0.1:8787`).
- The map "Sozialraum Frankfurt" lives in the sibling repo `../sozialraum-frankfurt`. It is a single HTML file with
  its own scripts and data, built there. It stays out of Astro: Astro would bundle and rewrite it.
  The integration `integrations/map.mjs` (`checkMap`, `mapIntegration`, registered in `astro.config.mjs`) runs
  after the build and copies `output/sozialraum-frankfurt.html` unchanged to `dist/sozialraum-frankfurt/index.html`.
  The build fails in five cases: the file is missing, the check report has a `| WARN` or `| FAIL` line, the map
  repo is dirty, the file is older than the repo's HEAD commit, or it contains `/Users/`.
  The map is not in the menu and not in the route table. It has German text only, so no English twin.
- In `astro dev` and `astro preview` there is no Caddy. A Vite proxy in `astro.config.mjs` forwards the tile requests
  to the BKG, with the browser's headers. It is for development only.
  `astro preview` serves `/sozialraum-frankfurt` without the slash. Live, Caddy's `file_server` redirects to
  the slash.
- Fonts come from the Fontsource packages `@fontsource-variable/archivo` and `@fontsource/mulish` (5.3.0). They are
  bundled and served from our own origin. Mulish: the `latin-*` files of the weights in use.
  Archivo: the two latin files with the weight and width axes (`archivo-latin-standard-normal` and `-italic`),
  cut down to the ranges in use. They lie in `src/assets/fonts/` with the licence (OFL, no reserved name).
  `src/styles/global.css` declares them itself. The package's CSS would add latin-ext and Vietnamese.
- Why the cut: the full files are 90 and 100 KB. On slow 4G the fallback font then showed for about 1.4 s.
  Cut to weight 700–900 and width 72–85 %, they are 42 and 46 KB. A wider range needs a new cut:
  `fonttools varLib.instancer <package file> wght=700:900 wdth=72:85 -o <file in src/assets/fonts/>`
  (`pip install fonttools brotli`; the package file is in `node_modules/@fontsource-variable/archivo/files/`).
- No font preload. Measured on slow 4G it delayed the first paint and won nothing.
  In Playwright's WebKit it also fetched the font twice.
- `npm run dev` shows the page unstyled for a moment: Vite injects the CSS with JavaScript. The built site does not.
- Archivo falls back to "Arial Narrow", then to "Archivo Fallback", then sans-serif.
  "Archivo Fallback" is a local Arial Bold or a twin (Helvetica, Liberation Sans, Arimo, Roboto) with `size-adjust`.
  It is for Linux and Android without a narrow font. Two faces, split by `font-stretch`: 78 % for `--tight`,
  87 % for `--wide`. Then the text runs about as wide as Archivo. Narrow fonts stay unadjusted, so they are
  a separate family in the stack.
  Checks block the web fonts and look for overflow, with and without the narrow fonts.
- Images go through `astro:assets`. SVG drawings are rasterised (`image.dangerouslyProcessSVG` in `astro.config.mjs`).
  Raster originals never reach `dist/`, except the Signal QR codes (see Content). They are re-encoded without metadata, and a unit check asserts that no raster
  image in `dist/` has EXIF, XMP or IPTC data. SVGs (heart, possibly drawings) are copied as they are.
  A unit check scans every SVG in `dist/` for editor data, embedded images and external links.
  Drawings use `fallbackFormat="webp"`, so no `<img>` points at a raw SVG or PNG.
- Astro inlines the menu script and the countdown script. There is no CSP today. If a CSP with
  `script-src 'self'` comes, set `vite.build.assetsInlineLimit: 0`.
- Versions are pinned exactly in `package.json`. Node 24 (`.nvmrc`).
- Astro telemetry is off (`ASTRO_TELEMETRY_DISABLED=1` in the npm scripts).

## Content

- Events are Markdown files in `src/content/events/`, schema in `src/content.config.ts`. How to add one:
  `add-event.md`.
- Gallery items have `kind: photo | flipchart`.
- "Upcoming" and "past" use the Berlin day of the build (`src/lib/events.ts`). An event moves to the review only
  with the next deploy after its day.
- The start page shows the flyer of the first upcoming event with a `flyer` (`src/components/Flyer.astro`).
  It links to the event's anchor on `/veranstaltungen/`. The anchor is the file name without `.md`.
  Without such a flyer it shows up to three upcoming events in compact rows, each linked the same way.
- The countdown above the flyer runs in the browser (`countdown()` in `src/lib/events.ts`). It updates every 30 s
  and when the tab shows again.
  States: before the start days, hours and minutes; between start and end "Läuft gerade"; after that it hides.
  Without `end` it hides at the start. The flyer itself stays until the next deploy.
  The clock is in the markup from the start, so the flyer does not shift.
  Without JavaScript the countdown shows the date line with the start time.
- Below the flyer the start page shows "Mitmachen" (`src/components/Join.astro`, id `mitmachen`): text and a
  black button that opens a mail with subject "Mitmachen". The menu item "Mitmachen" links to `/#mitmachen`.
  It is never marked current. `scroll-margin-top` keeps the heading clear of the sticky header.
  The English start page `/en/` and events page `/en/events/` show the same blocks (see Languages).
- Every page has the band "Bleib informiert" above the footer (`src/components/StayInformed.astro`). Three
  columns: a sign-up form (see API), the address with the mail button, and the Signal button.
  The form posts to `/api/anmelden`. The pages `/danke/`, `/fehler/` and `/bestaetigen/` are dead ends:
  `noindex`, not in the menu.
  The QR codes `src/assets/brand/signal-qr-1x.png` and `-2x.png` encode the Signal link. A new link needs new ones.
  They were redrawn from Signal's export: module grid read from the finder patterns, 2 or 4 px per module,
  two-colour palette PNG of about 1 KB. They are served unscaled, so the modules stay sharp.
- The German start page shows a teaser for the map (`src/components/MapTeaser.astro`) below "Mitmachen", as the
  last block. It has no English twin, because the map is German only. It links to `/sozialraum-frankfurt/`.
  The image `src/assets/map/teaser.png` is a screenshot of the map. To refresh it, run
  `tests/browser/tools/teaser_image.mjs` in the map repo and copy the result to `src/assets/map/teaser.png`.
  The tool needs network: it loads tiles from basemap.de.
- Spacing: one scale with two steps in `src/styles/global.css`. The frame sets the space, not the block.
  - `--space-l: clamp(96px, 12vw, 160px)`: the start page. Its blocks below the hero stand this far apart
    (`.stack-l`), and it ends this far before the band (`Base` prop `space="l"`). Landing pages leave much air
    (genz-regelt.de, campact.de).
  - `--space-m`, half of it (48–80 px): every other page. Its sections stand this far apart (`.stack-m`), and it
    ends this far before the band or the footer. Pages you read leave less air, so the text holds together.
  - `main` is a flow root with the step as bottom padding. Blocks have no outer margin, and their last child no
    bottom margin. So a new block fits without new numbers. Inside blocks, spacing is the block's own.
  - Exceptions: the top of a page (32 px from the header to the heading) and the hero, which keeps the next
    events 40 px close.
  - `tests/spacing.spec.mjs` measures the page end on every page in `src/pages/`, in both languages.
- Impressum (`/impressum/`) and Datenschutz (`/datenschutz/`) are plain text pages. They share the class `.prose`
  in `src/styles/global.css`: one left-aligned column of at most 42rem.
  Their texts are legal texts. The checks pin them word for word.
- The English legal pages (`/en/imprint/`, `/en/privacy/`) start with a note: "This is a translation. The German
  version is legally binding." Its link to the German page carries `hreflang="de"` and `lang="de"`.
  The checks pin both versions word for word. If the privacy text changes, change both.
- The privacy page describes the server log, the mailbox, the sign-up form, the newsletter list, the map and the tile proxy.
  If the server log, the mailbox, the API, the newsletter or the tile proxy changes, update the privacy page.

## Languages

German is the main language. English is a second version under `/en/`. No Astro `i18n` config: a route table is enough.

- Route table: `src/i18n/routes.ts` holds every page with its German and English path. `route(lang, key)` gives a path.
  `counterpart(path)` gives the same page in the other language and throws for an unknown path.
  So a page without a counterpart fails the build, not the reader.
  English paths: `/en/`, `/en/events/`, `/en/imprint/`, `/en/privacy/`, `/en/thanks/`, `/en/error/`, `/en/confirm/`.
- Dictionary: `src/i18n/ui.ts` holds the strings of the frame and the pages in both languages. A link inside a
  sentence is split into before, link and after. Legal texts, mails and event content are not in it.
  `ui.ts` is the source of the English strings. New English text follows the tone rules below, and the user
  approves it before it goes live. A missing string is asked for, not invented.
- Views: `src/views/` has `Home`, `Events`, `Thanks`, `Error` and `Confirm`. They take `lang`. The page files of
  these pages only render a view. The legal pages are written out in `src/pages/` and `src/pages/en/`.
  Every component takes `lang`. `Base` sets `<html lang>`.
- Hreflang: indexable pages link `de`, `en` and `x-default` (German) with absolute URLs. `noindex` pages have none.
  That is why `astro.config.mjs` sets `site`.
- Switch: `LangSwitch.astro` sits in the header at every width. It shows "EN" or "DE", links
  `counterpart(path)` and carries `lang` and `hreflang` of its target. Its accessible name is in the target language.
  The phone menu ends with the same link as text ("Show the English version", "Zur deutschen Version").
- Anchors: German `mitmachen` and `bleib-informiert`, English `get-involved` and `stay-informed` (`ANCHORS` in
  `ui.ts`). Scripts and CSS select the band by `[data-band]`, never by id.
- Events: every event has an `en:` block (how: `add-event.md`). It has the same fields as the German text, plus
  `body` (plain paragraphs split at blank lines), `flyer` and `flyerAlt`. The English address falls back to the
  German one. The English gallery has only `alt` and `caption`: the images come from the German gallery by index.
  The English flyer falls back to the German image. The build throws when an event has a German body but no `en.body`.
- Countdown: the labels come from `ui` through `data-` attributes. One script serves both languages.
- Times: German 24 h ("14:00 Uhr"). English 12 h, lower case: "2 pm", "5:30 pm", "12 pm" (noon), "12 am" (midnight).
  English dates in British order: "Sat 28 November 2026".
- Tone of the English text: "you" for "du" and "ihr", same warmth and punctuation. Plain words, short sentences,
  one statement per sentence. No idioms, no phrasal verbs where a plain verb exists. Translate sentence by sentence: do not merge, cut or add. Names stay as they are
  (Wohnentscheid Frankfurt, Villa Gründergeist, Dondorf Druckerei, Food That's Left, Mistelfink, Alte Oper).
  The English flyer is the model of plain English: simple words, no Latin or abstract terms where a plain phrase exists.

## Brand

The look follows b-side.ms. White `#fff`, ink `#111`. Red only in the logo and the drawings. Body: Mulish (400/700).
Headings, menu, date bars and buttons take the flyer's type: Archivo, a bold grotesque with a width axis (`--slab`).
Every rule with `--slab` sets a width:

- h1, h2, the date bars and "Läuft gerade": capitals, 800, width 72 % (`--tight`). Countdown numbers: 900, 72 %.
- Menu, event titles, subtitles, callout, footer headings, buttons, countdown labels and the date line
  without JavaScript: normal case, 700, width 85 % (`--wide`). At 72 % normal case looks cramped.
- The current menu item uses the real Archivo italic.
- The callout's separators "|" get extra air. Screen readers skip them.

The event rows on the start page are white cards with a soft shadow; their titles are Mulish, as in the b-side list.
Drawings sit on white without blend mode.

Header: like b-side, only the red heart links home (34 px in a 48 px target). The link name is
"Wohnentscheid Frankfurt – Startseite". The name itself stands on the start page, in the red logo.
From 900 px the menu items follow in one line. Below, the roof burger opens the house menu.
Without JavaScript the bar shows at every width and the burger is hidden. Below 900 px the items
are then smaller and wrap into two lines inside the header. So the row fits at 390 px even in the fallback font.
The language switch ("EN" or "DE", Archivo wide 700, smaller than the items, 48 px target, ink focus ring) stands at
the right end of the bar on desktop and left of the burger on phones. The phone menu ends with a text link to the
other language. On phones without JavaScript the switch sits right of the bar, so at 320 px the row is tight.
The phone menu closes on a click on an item. Otherwise a jump within the page leaves it open.
The heart is `heart.svg`. It blinks softly three times
(opacity, 1.6 s each) and then stays, so it stops within 5 seconds (WCAG 2.2.2). Under reduced motion it does not
blink. No other heart moves.

Hero: a big drawing. The red logo (`logo-red.png`, made from `logo.png`) is the h1. Like on b-side it stands in the
drawing's upper left, half above it and half on it. Its house is smaller than in `logo.png`, its lettering bigger.
It is 39 % as wide as the drawing on desktop (28 % of the column). On phones it is 45 % of the column, at most 280 px. The intro has no heading. From 900 px the intro
stands beside the drawing. The intro's bottom lines up with the drawing's bottom.

Flyer: like the b-side lunch banner. At most 440 px wide, centred, rounded corners. On devices with hover it scales
to 1.05 with a soft shadow. Under reduced motion it does not scale. The focus ring is ink.
The link's name is the event title and the date. The image's alt holds the whole flyer text.

Band "Bleib informiert": black, white text, white buttons, white focus rings. From 900 px three columns
(heading, mail, Signal), below stacked. The QR code brings its own white quiet zone and shows from 900 px only.
Under the form stands only the line "Oder schreib an …". The privacy page is one short scroll away in the footer.

Footer: three centred columns (stacked under 720 px). B-side has a black link bar above them.
We leave it out: the band "Bleib informiert" sits right above, and the bar would only repeat links. The column "Wohnentscheid Frankfurt" links Startseite, Veranstaltungen, Impressum and Datenschutz.
The column "Andere Plattformen" links Instagram and GitHub (the account `wohnentscheidFrankfurt`), each with its
icon in front of the name, like b-side. Only the name is underlined.
All links are plain, nothing loads from outside. "Schreib uns" in the column "Mitmachen" jumps to
`/#mitmachen`. `wurzel-band.svg` stays in `src/assets/drawings/`, unused.

## API

`api/` is a small Node service for the newsletter sign-up with double opt-in. It uses `node:http` and
`nodemailer`. It is not an npm workspace: workspaces hoist `node_modules`, then `api/` could not be copied to the
server as it is. TypeScript runs directly by Node (type stripping): erasable syntax only, imports end in `.ts`,
no build step. It listens on `127.0.0.1:8787` only. Caddy proxies `/api/*` to it.

Flow:

1. The form in the band posts `email` and the honeypot `website` to `/api/anmelden`. No JavaScript.
2. The API sends a confirmation mail with the link `/bestaetigen/#<token>` and answers `303 /danke/`.
   Every failure answers `303 /fehler/`. A filled honeypot answers `303 /danke/` and sends nothing.
3. `/bestaetigen/` reads the token from the URL fragment and posts it to `/api/bestaetigen` once it has loaded.
   The click in the mail is the confirmation; there is no second click. The API then sends one mail to info@
   with the subject `Anmeldung Newsletter (Website)`. On an error the page offers "Noch mal versuchen".
   The mail tool in `../mail` reads it later.

The English pages use the same flow on their own routes. The band on `/en/` posts to `/api/en/signup`. The API
answers `303 /en/thanks/` or `303 /en/error/`, and the mail holds the link `/en/confirm/#<token>`.
`/en/confirm/` posts to `/api/en/confirm`. The confirmation mail is English. The mail to info@ stays German and says
"über die englische Website". Both languages share one code path (`api/src/app.ts`) and the same limiters. The
language type lives in `api/src/types.ts`: the API is copied to the server alone and must not import `src/`.

Traps:

- Mail scanners open every link in a mail. GET never confirms on the server, and the page needs JavaScript to
  post the token. So scanners that only fetch the HTML confirm nothing. Scanners that run JavaScript would
  confirm; the user accepted that for one click less.
- DMARC of the domain is `p=quarantine` (set at IONOS). Spoofed mail from info@ lands in spam, and the mail tool
  reads INBOX only. So nobody can fake a confirmed sign-up by mail.
- A query string would land in Caddy's access log. A fragment never reaches the server.
- Without JavaScript `/bestaetigen/` and `/en/confirm/` show a mailto fallback.
- A POST must carry no `Origin` or the site's origin. `Referrer-Policy` must stay `strict-origin-when-cross-origin`:
  `no-referrer` makes browsers send `Origin: null`, and every sign-up would fail. A unit check pins the header.
- Port 465 is blocked at Hetzner. The API sends over `smtp.ionos.de:587` with STARTTLS required.

Token: `base64url(address "|" expiry)`, a dot and the HMAC-SHA256 of that. It is valid for 72 hours. The API stores
nothing: no address, no token. Nothing personal stays on the server.

Limits, in memory (a restart resets them):

- The English routes count against the same limiters. A German and an English sign-up of one address share the
  per-address limit.
- Sign-up: 5 per IP and hour (IPv4 /32, IPv6 /64), 3 confirmation mails per address and 24 hours, 30 per hour in total.
- Confirm: 3 mails to info@ per address and 24 hours (over the limit: `200`, no mail), 30 per hour in total
  (over the limit: `503`, the page shows the error).
- The stages run in that order (per IP, per address, total). A request that a later stage rejects has already
  counted against the earlier ones. So an SMTP outage can lock an address for 24 hours.
- The client IP is the first entry of `X-Forwarded-For`. That is safe only because Caddy's `reverse_proxy`
  replaces a client-sent header when no `trusted_proxies` is set. Do not add it. A unit check pins this.

Logging: journald gets only fixed words and error codes (`signup sent`, `smtp error ECONNECTION`).
Lines of the English routes end in ` en` (`signup sent en`). Never an address, a token, an IP or an SMTP error
message.

Secrets are encrypted systemd credentials (`smtp-password`, `token-secret`), loaded with `LoadCredentialEncrypted=`.
The API reads them from `$CREDENTIALS_DIRECTORY`. In dev and tests they come from environment variables
(see `api/src/config.ts`). `server/set-secrets.sh` sets them. How: below, Server.

## Checks

`npm test` runs the API tests, then Playwright against `astro preview` on port 4322. `astro preview` serves `dist/` like Caddy does.
Projects: `desktop-chrome` and `chrome-390` use the system Chrome, `webkit-iphone` uses Playwright's WebKit.

- `tests/site.spec.mjs`: the checks run on German and English pages (`PAGES`, `PAGES_EN`). Hreflang links with
  absolute URLs, the switch (href, name), no German words on English pages, English footer links.
  Language, one h1, white background, footer links, no horizontal scroll, no robots meta.
  Nothing loads from other origins. Brand fonts: family, case and width; date bars on the events page,
  visible headings only.
- `tests/menu.spec.mjs`: the heart as brand (links home, size, link name), desktop bar,
  burger switch at 900 px. Phone menu (open, close, focus), sticky header, blinking header heart.
  The current item is italic, in the real Archivo italic. Without JavaScript and in the fallback font
  no horizontal scroll at 390 and 320 px, on `/` and `/en/`. The switch: visible, clickable, lands on the
  counterpart at 1400 and 390 px, last link of the phone menu and inside its focus trap.
- `tests/events.spec.mjs`: events page, date-independent, also the English page (headings, 12 h times, body,
  callout, captions).
- `tests/join.spec.mjs`: "Mitmachen" (texts, mail link, menu item, jump below the header) and the band
  "Bleib informiert" (place, texts, mail subject and body, Signal link, QR code unscaled, columns, focus rings).
- `tests/legal.spec.mjs`: Impressum, Datenschutz and their English pages: title, headings, texts word for word, addresses, mail and
  authority links, text column, no horizontal scroll at 320 px.
- `tests/home.spec.mjs`: start page: hero layout, flyer or event rows, countdown states (with a fixed clock),
  without JavaScript, hover and reduced motion. The countdown checks weight and width of its numbers,
  of "Läuft gerade" and of the date line. The red logo is the h1, red, and half on the drawing at five widths.
- `tests/map.spec.mjs`: the map page is served, has no robots meta and loads nothing from other origins.
  Tiles come from a `page.route` stub.
- `tests/unit/map.spec.ts`: the integration's checks. `tests/unit/tiles-proxy.spec.ts`: starts a real Caddy with
  `server/Caddyfile` against an echo server and checks what reaches upstream (needs Caddy: `brew install caddy`).
  The teaser, its place and the space between the start page blocks are checked in `tests/home.spec.mjs`,
  the place of "Mitmachen" in `tests/join.spec.mjs`, the privacy texts in
  `tests/legal.spec.mjs`.
- `tests/unit/`: date logic, menu items, no EXIF in `dist/` and the server files in `server/`
  (Caddyfile, units, `deploy.sh`).
- `tests/api/`: token, address check, rate limit, config, mail texts and the routes of the API (`node:test`,
  part of `npm test`).
- `tests/signup.spec.mjs`, `tests/confirm.spec.mjs`: sign-up end to end (form, mail, link, mail to info@),
  honeypot, wrong origin, forged token, no-JavaScript fallback. Each also in English (`/en/`, `/api/en/*`,
  English mail, German notice "englische Website", switch on `/en/confirm/#…` without the fragment).
  Limits and expired tokens are covered in `tests/api/app.test.ts`.
  They run the API on port 8788 against Mailpit (SMTP 1026, web 8026). Ports differ from the Docker Mailpit of
  `../mail`. Mailpit and Caddy are prerequisites of `npm test` and so of `deploy.sh`: `brew install mailpit caddy`.

## Server

- Hetzner Cloud, Nürnberg, x86, 2 vCPU, 4 GB RAM, Ubuntu 26.04 LTS. IPv4 `167.235.143.17`,
  IPv6 `2a01:4f8:1c1a:d7a3::/64`.
- Hardened: SSH login only with a key, root password locked, ufw with 22/80/443, unattended-upgrades.
- DNS stays at IONOS. A and AAAA of the domain and of `www` point to the server. MX stays at IONOS (mailbox).
- Caddy 2.11 serves `/var/www/wohnentscheid` for `wohnentscheid-frankfurt.de` (`/etc/caddy/Caddyfile`), with
  security headers. Caddy gets the HTTPS certificates itself. HTTP redirects to HTTPS.
  `www.wohnentscheid-frankfurt.de` redirects with 301 to the domain without `www`.
- Access log `/var/log/caddy/access.log`: time, method, host, path, protocol, status, size, duration and the IP
  address masked to /16 (IPv4) or /32 (IPv6). No headers, no port, no TLS data.
  Caddy rolls it daily and keeps 6 old files, so an entry lives at most 7 days.
  Trap: `caddy validate` as root creates the log file owned by root. Then run
  `chown caddy:caddy /var/log/caddy/access.log`.
- Caddy's default logger writes to journald. It excludes `http.log.access` and `http.log.error`, so no full IP
  address lands there. journald keeps 7 days at most (`/etc/systemd/journald.conf.d/retention.conf`).
- The Caddyfile in Git (`server/Caddyfile`) is the source. Copy it to `/etc/caddy/Caddyfile`, validate, reload.
  `handle /api/*` limits the body to 4 KB and proxies to `127.0.0.1:8787`. A second `handle` serves the site.
  If the API is down, `handle_errors 502 503 504` answers a sign-up POST with 303 to `/fehler/`
  (`/api/en/signup`: `/en/error/`).
- Tile proxy: the map shows background tiles from basemap.de (BKG). The privacy rule says the site loads nothing
  from other origins, so the browser asks `/sozialraum-frankfurt/kacheln/` and Caddy asks the BKG.
  The BKG then sees the server, never a visitor. Rules in `server/Caddyfile`:
  - Only GET and HEAD of `/<z>/<y>/<x>.png` (digits only) go upstream. Every other path and method answers 404.
  - The query is dropped. `header_up -*` removes every client header, also `If-None-Match` (an ETag could track a
    browser). Then it sets `Host` and an empty `User-Agent`, else Go adds its own.
  - `header_down -Set-Cookie` drops upstream cookies.
  - `log_skip`: no access log line for tiles. If the BKG is down, Caddy's error line with the full IP goes to
    `http.log.error`, which the global `exclude` drops.
  - `caddy validate` prints "Unnecessary header_up Host". That is expected: the line is needed when the upstream is
    plain HTTP, as in the test.
- Rollout order for a changed Caddyfile: Caddyfile to the server first (needs the user's go), then `./deploy.sh`.
  With the old Caddyfile an API outage on the English sign-up ends in an empty 502 instead of `/en/error/`.
  With the old Caddyfile the map loads but has no tiles.
- The API lives in `/opt/wohnentscheid-api`, owned by `deploy`. Node 24 comes from the NodeSource apt repo
  (key in `/etc/apt/keyrings/`, origin in `Unattended-Upgrade::Origins-Pattern`). Ubuntu's own `nodejs` 22
  cannot run `.ts`.
- Units in `server/`, copied to `/etc/systemd/system/`: `wohnentscheid-api.service` (`DynamicUser`, hardened,
  `MemoryMax=128M`, credentials) and `wohnentscheid-api-restart.path` with its `.service`. The path unit
  restarts the API when `/opt/wohnentscheid-api/deployed` changes. So the deploy user needs no sudo.
- First-time setup, as root, in this order: copy the three units to `/etc/systemd/system/`;
  `systemctl daemon-reload`; `systemctl enable --now wohnentscheid-api-restart.path`;
  `systemctl enable wohnentscheid-api.service`; run `server/set-secrets.sh` (it restarts the API);
  copy the Caddyfile, validate, reload; then the first `./deploy.sh`.
  Until that deploy there is no `src/main.ts`, so the API restarts every few seconds. That is expected.
- Secrets: run `server/set-secrets.sh` on the Mac. It reads the info@ password from the Keychain
  (`wohnentscheid-mail`, `IONOS_PASSWORD`), pipes it over `ssh wohnentscheid-admin` into `systemd-creds encrypt`
  and restarts the API. It prints no secret. The token secret is created on the server only when missing:
  a new one invalidates pending links. Accepted risk: root on the server can read the password.
- Data processing agreement (AVV) with Hetzner concluded on 13.11.2026. Annex 1 covers the log data of the
  website's visitors.
- `ssh wohnentscheid-admin`: root, key `~/.ssh/wohnentscheid_admin`. Only for server maintenance.
- `wohnentscheid-deploy`: user `deploy` without sudo, key `~/.ssh/wohnentscheid_deploy`. The key is restricted in
  `authorized_keys` with `command="/usr/bin/rrsync /var/www/wohnentscheid",restrict`. It can only write the web root.
- `wohnentscheid-deploy-api`: same user, key `~/.ssh/wohnentscheid_deploy_api`, restricted with
  `rrsync /opt/wohnentscheid-api`. It can only write the API directory.

## Deploy

`./deploy.sh` refuses a dirty working tree. Then, in this order:

1. `npm ci`, `npm ci` and the type check in `api/`, the build, `npm test` (needs Mailpit and Caddy).
2. `npm ci --omit=dev` in `api/`, then rsync of `api/` to `wohnentscheid-deploy-api:/` (with `node_modules`,
   without `deployed` and `tsconfig.json`).
3. A temp file with the tag name is rsynced alone as `deployed`, last (outside the repo, so the tree stays clean). It restarts the API.
4. rsync of `dist/` to `wohnentscheid-deploy:/`. The site goes up after the API, so the form never posts to an old API.
5. Smoke check, up to 10 seconds: `POST /api/anmelden` with a filled honeypot must answer
   `303` to `/danke/`. It sends no mail. If not, the script exits without a tag.
   A second check does the same for `POST /api/en/signup` and `303` to `/en/thanks/`.
6. Annotated Git tag `deploy-<date>`. Its message names the map commit.

Rollback: the map is not in this repo.
Check out the commit named in the tag message in the map repo, rebuild the map, then deploy the site tag.
Deploy tags stay on this Mac; `deploy.sh` does not push them.
The history starts again on 16.11.2026, when the repo went public.
Older tags live only in the archive clone `../website-archiv`; deploy them from there.
Such a tag takes `/sozialraum-frankfurt/` off the server (`rsync --delete`), together with the teaser.
A tag from before the API rolls back the site only, and the API keeps running.
The smoke check does not test SMTP.
After the first deploy, sign up once with a test address of yours, end to end.
Trap: `/usr/bin/rsync` on the Mac is openrsync. Always use the rsync from Homebrew.

## Later

Only when needed: staging subdomain with Basic-Auth, donation form, an own mailbox for the API. At the start only links out.
Privacy: AVV with IONOS (mailbox and newsletter sending).
