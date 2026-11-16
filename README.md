# Wohnentscheid Frankfurt: website

We are a non-partisan initiative for affordable housing in Frankfurt, and we want to launch a citizens' referendum.
This is our [website](https://wohnentscheid-frankfurt.de).

We've also built a [tool](https://wohnentscheid-frankfurt.de/sozialraum-frankfurt/) that breaks down Frankfurt's
neighbourhoods to support a different approach to housing and climate policy.
It has its [own repo](https://github.com/wohnentscheidFrankfurt/sozialraum-frankfurt).
Feel free to take a look and discover new perspectives!

The website is a static site built with Astro, in German and English.
A small Node service (`api/`) runs the newsletter sign-up with double opt-in.
`server/` holds the Caddyfile and the systemd units of the live server.

The site loads nothing from other origins: no tracking, no external fonts, scripts or CDNs.
The tests check this.

## Commands

```bash
npm ci && (cd api && npm ci)
npm run dev       # dev server on http://localhost:4321
npm run build     # static site to dist/ (needs the built map in ../sozialraum-frankfurt)
npm test          # API tests, then Playwright checks against dist/ (needs Mailpit and Caddy)
```

## Docs

- `docs/architecture.md`: build, content, languages, brand, API, checks, server, deploy.
- `docs/add-event.md`: how to add an event.

## Licence

- Code: MIT (`LICENSE`).
- Texts, drawings, logo and photos: © Wohnentscheid Frankfurt, all rights reserved.
- Fonts keep their licence: SIL Open Font License (`src/assets/fonts/`).
